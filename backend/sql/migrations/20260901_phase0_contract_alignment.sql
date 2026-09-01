-- Phase 0: align the notification enum with values emitted by the active API.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_cancelled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dispute_raised';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_warning';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_unaccepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_progress';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'submission_updated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_status_changed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'task_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'submission_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_review';
