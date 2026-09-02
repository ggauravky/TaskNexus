-- TaskNexus V2 Phase 1: contract, concurrency, and database security baseline.
-- This migration is additive, repeatable where PostgreSQL permits, and preserves
-- the legacy JSONB collaboration payloads during the normalized-table backfill.

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'mobile-development';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'marketing';
ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'data-entry';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_idempotency_key
  ON submissions(freelancer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_client_status_updated
  ON tasks(client_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_freelancer_status_updated
  ON tasks(freelancer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_available_updated
  ON tasks(status, updated_at DESC) WHERE freelancer_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status_created
  ON notifications(recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_task_created
  ON submissions(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_created
  ON reviews(reviewee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_freelancer_status_created
  ON payments(freelancer_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  author_name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_milestones (
  id TEXT PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_at TIMESTAMPTZ,
  weight NUMERIC NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_activity (
  id TEXT PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_name TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
  ON task_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_milestones_task_position
  ON task_milestones(task_id, position, created_at);
CREATE INDEX IF NOT EXISTS idx_task_activity_task_created
  ON task_activity(task_id, created_at);

INSERT INTO task_comments (id, task_id, author_id, author_name, body, mentions, attachments, created_at)
SELECT
  comment->>'id',
  task.id,
  NULLIF(comment->>'authorId', '')::uuid,
  COALESCE(comment->>'authorName', 'Unknown user'),
  COALESCE(comment->>'body', ''),
  COALESCE(comment->'mentions', '[]'::jsonb),
  COALESCE(comment->'attachments', '[]'::jsonb),
  COALESCE((comment->>'createdAt')::timestamptz, task.created_at)
FROM tasks AS task
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(task.workflow #> '{collaboration,comments}', '[]'::jsonb)
) AS comment
WHERE NULLIF(comment->>'id', '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_milestones (
  id, task_id, title, description, due_at, weight, completed,
  completed_at, completed_by, position, created_at, updated_at
)
SELECT
  milestone->>'id',
  task.id,
  COALESCE(milestone->>'title', 'Untitled milestone'),
  COALESCE(milestone->>'description', ''),
  NULLIF(milestone->>'dueDate', '')::timestamptz,
  COALESCE((milestone->>'weight')::numeric, 0),
  COALESCE((milestone->>'completed')::boolean, false),
  NULLIF(milestone->>'completedAt', '')::timestamptz,
  NULLIF(milestone->>'completedBy', '')::uuid,
  COALESCE((milestone->>'order')::integer, 0),
  COALESCE((milestone->>'createdAt')::timestamptz, task.created_at),
  COALESCE((milestone->>'updatedAt')::timestamptz, task.updated_at)
FROM tasks AS task
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(task.metrics->'subtasks', '[]'::jsonb)
) AS milestone
WHERE NULLIF(milestone->>'id', '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_activity (id, task_id, activity_type, actor_id, actor_name, message, metadata, created_at)
SELECT
  activity->>'id',
  task.id,
  COALESCE(activity->>'type', 'task_updated'),
  NULLIF(activity->>'actorId', '')::uuid,
  COALESCE(activity->>'actorName', 'Unknown user'),
  COALESCE(activity->>'message', 'Task updated'),
  COALESCE(activity->'metadata', '{}'::jsonb),
  COALESCE((activity->>'createdAt')::timestamptz, task.updated_at)
FROM tasks AS task
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(task.workflow #> '{collaboration,activity}', '[]'::jsonb)
) AS activity
WHERE NULLIF(activity->>'id', '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION accept_task(p_task_id UUID, p_freelancer_id UUID)
RETURNS SETOF tasks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tasks
  SET
    freelancer_id = p_freelancer_id,
    status = 'assigned',
    workflow = jsonb_set(
      COALESCE(workflow, '{}'::jsonb),
      '{assignedAt}',
      to_jsonb(now()),
      true
    ),
    updated_at = now()
  WHERE id = p_task_id
    AND status = 'under_review'
    AND freelancer_id IS NULL
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION accept_task(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_task(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION submit_task_work(
  p_task_id UUID,
  p_freelancer_id UUID,
  p_content JSONB,
  p_submission_type submission_type,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE existing_submission submissions%ROWTYPE;
DECLARE submitted_task tasks%ROWTYPE;
DECLARE created_submission submissions%ROWTYPE;
BEGIN
  SELECT * INTO existing_submission
  FROM submissions
  WHERE task_id = p_task_id
    AND freelancer_id = p_freelancer_id
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO submitted_task FROM tasks WHERE id = existing_submission.task_id;
    RETURN jsonb_build_object('task', to_jsonb(submitted_task), 'submission', to_jsonb(existing_submission));
  END IF;

  UPDATE tasks
  SET status = 'delivered',
      workflow = jsonb_set(COALESCE(workflow, '{}'::jsonb), '{deliveredAt}', to_jsonb(now()), true),
      updated_at = now()
  WHERE id = p_task_id AND freelancer_id = p_freelancer_id AND status = 'in_progress'
  RETURNING * INTO submitted_task;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE submissions SET is_active = false WHERE task_id = p_task_id AND is_active = true;
  INSERT INTO submissions (
    task_id, freelancer_id, submission_type, content, version, is_active, idempotency_key
  ) VALUES (
    p_task_id, p_freelancer_id, p_submission_type, p_content,
    COALESCE((SELECT MAX(version) + 1 FROM submissions WHERE task_id = p_task_id), 1),
    true, p_idempotency_key
  ) RETURNING * INTO created_submission;

  RETURN jsonb_build_object('task', to_jsonb(submitted_task), 'submission', to_jsonb(created_submission));
END $$;

REVOKE ALL ON FUNCTION submit_task_work(UUID, UUID, JSONB, submission_type, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_task_work(UUID, UUID, JSONB, submission_type, TEXT)
  TO service_role;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'tasks', 'submissions', 'payments', 'reviews', 'notifications',
    'newsletter_subscriptions', 'service_bookings', 'support_jar_contributions',
    'audit_logs', 'task_comments', 'task_milestones', 'task_activity'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated', table_name);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
