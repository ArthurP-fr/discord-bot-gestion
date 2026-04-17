CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tenants_owner_user'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT fk_tenants_owner_user
      FOREIGN KEY (owner_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  discord_bot_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_tag TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('stopped', 'starting', 'running', 'stopping', 'error')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, discord_bot_id),
  UNIQUE (discord_bot_id)
);

CREATE TABLE IF NOT EXISTS bot_runtime_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bots_tenant_id ON bots (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_runtime_events_tenant_created ON bot_runtime_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_runtime_events_bot_created ON bot_runtime_events (bot_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_bots_updated_at ON bots;
CREATE TRIGGER trg_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

ALTER TABLE bot_presence_states
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

ALTER TABLE bot_member_message_configs
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

ALTER TABLE bot_log_event_configs
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

UPDATE bot_presence_states p
SET tenant_id = b.tenant_id,
    owner_user_id = b.owner_user_id
FROM bots b
WHERE p.bot_id = b.discord_bot_id
  AND (p.tenant_id IS NULL OR p.owner_user_id IS NULL);

UPDATE bot_member_message_configs m
SET tenant_id = b.tenant_id,
    owner_user_id = b.owner_user_id
FROM bots b
WHERE m.bot_id = b.discord_bot_id
  AND (m.tenant_id IS NULL OR m.owner_user_id IS NULL);

UPDATE bot_log_event_configs l
SET tenant_id = b.tenant_id,
    owner_user_id = b.owner_user_id
FROM bots b
WHERE l.bot_id = b.discord_bot_id
  AND (l.tenant_id IS NULL OR l.owner_user_id IS NULL);

DELETE FROM bot_presence_states p
WHERE p.tenant_id IS NULL OR p.owner_user_id IS NULL;

DELETE FROM bot_member_message_configs m
WHERE m.tenant_id IS NULL OR m.owner_user_id IS NULL;

DELETE FROM bot_log_event_configs l
WHERE l.tenant_id IS NULL OR l.owner_user_id IS NULL;

ALTER TABLE bot_presence_states
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE bot_member_message_configs
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN owner_user_id SET NOT NULL;

ALTER TABLE bot_log_event_configs
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN owner_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_presence_states_tenant'
  ) THEN
    ALTER TABLE bot_presence_states
      ADD CONSTRAINT fk_bot_presence_states_tenant
      FOREIGN KEY (tenant_id)
      REFERENCES tenants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_presence_states_owner_user'
  ) THEN
    ALTER TABLE bot_presence_states
      ADD CONSTRAINT fk_bot_presence_states_owner_user
      FOREIGN KEY (owner_user_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_member_message_configs_tenant'
  ) THEN
    ALTER TABLE bot_member_message_configs
      ADD CONSTRAINT fk_bot_member_message_configs_tenant
      FOREIGN KEY (tenant_id)
      REFERENCES tenants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_member_message_configs_owner_user'
  ) THEN
    ALTER TABLE bot_member_message_configs
      ADD CONSTRAINT fk_bot_member_message_configs_owner_user
      FOREIGN KEY (owner_user_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_log_event_configs_tenant'
  ) THEN
    ALTER TABLE bot_log_event_configs
      ADD CONSTRAINT fk_bot_log_event_configs_tenant
      FOREIGN KEY (tenant_id)
      REFERENCES tenants(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_log_event_configs_owner_user'
  ) THEN
    ALTER TABLE bot_log_event_configs
      ADD CONSTRAINT fk_bot_log_event_configs_owner_user
      FOREIGN KEY (owner_user_id)
      REFERENCES users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_presence_states_tenant_id ON bot_presence_states (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_member_message_configs_tenant_id ON bot_member_message_configs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_bot_log_event_configs_tenant_id ON bot_log_event_configs (tenant_id);
