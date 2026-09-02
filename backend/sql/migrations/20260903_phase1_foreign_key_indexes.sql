-- Phase 1 advisor hardening: cover foreign keys used by TaskNexus relations.
-- These indexes reduce lock amplification and lookup cost when parent rows are
-- updated or deleted, while remaining safe to apply to existing environments.

CREATE INDEX IF NOT EXISTS idx_notifications_actor_id
  ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_task_id
  ON notifications(related_task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_actor_id
  ON task_activity(actor_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id
  ON task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_task_milestones_completed_by
  ON task_milestones(completed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by_id
  ON tasks(assigned_by_id);
