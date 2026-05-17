-- Role-based access: replaces is_admin boolean
DO $$ BEGIN
  CREATE TYPE actor_role AS ENUM ('user', 'moderator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE actors ADD COLUMN IF NOT EXISTS role actor_role NOT NULL DEFAULT 'user';
UPDATE actors SET role = 'admin' WHERE is_admin = true;

-- Moderation audit trail (transparency)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors(id),
  action varchar(100) NOT NULL,
  target_type varchar(50),
  target_id varchar(255),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at DESC);
