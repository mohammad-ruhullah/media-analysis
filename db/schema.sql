-- ============================================================
-- Media Analysis System — Neon Postgres schema
-- Run: node db/migrate.mjs
-- ============================================================

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'analyst', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE video_status AS ENUM (
    'recovered',
    'linked',
    'assigned_to_analyst',
    'in_analysis',
    'completed',
    'assigned_to_editor',
    'in_editing',
    'edited',
    'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE note_status AS ENUM ('draft', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- users & roles ----------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- ---------- discs & videos ----------
CREATE TABLE IF NOT EXISTS discs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL UNIQUE,
  rip_status   TEXT NOT NULL DEFAULT 'pending',
  iso_path     TEXT,
  sha256       TEXT,
  recovered_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disc_id             UUID REFERENCES discs(id) ON DELETE SET NULL,
  code                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL DEFAULT '',
  duration_seconds    DOUBLE PRECISION,
  width               INTEGER,
  height              INTEGER,
  youtube_url         TEXT,
  youtube_video_id    TEXT,
  status              video_status NOT NULL DEFAULT 'recovered',
  assigned_analyst_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_editor_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_analyst ON videos(assigned_analyst_id);
CREATE INDEX IF NOT EXISTS idx_videos_editor ON videos(assigned_editor_id);

-- pipeline (AI analysis) tracking — independent of the human workflow status
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_state TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_error TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMPTZ;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS analysis_finished_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_videos_analysis ON videos(analysis_state);

-- ---------- analysis artifacts ----------
CREATE TABLE IF NOT EXISTS transcripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  language   TEXT,
  model      TEXT,
  segments   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transcripts_video ON transcripts(video_id);

CREATE TABLE IF NOT EXISTS scenes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  scene_index   INTEGER NOT NULL,
  start_seconds DOUBLE PRECISION NOT NULL,
  end_seconds   DOUBLE PRECISION NOT NULL,
  keyframe_url  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scenes_video ON scenes(video_id, scene_index);

-- ---------- notes (analyst-authored; AI drafts live here too) ----------
CREATE TABLE IF NOT EXISTS notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_seconds  DOUBLE PRECISION NOT NULL,
  end_seconds    DOUBLE PRECISION NOT NULL,
  title          TEXT NOT NULL DEFAULT '',
  caption        TEXT NOT NULL DEFAULT '',
  hashtags       TEXT[] NOT NULL DEFAULT '{}',
  hook           TEXT,
  reason         TEXT,
  score          DOUBLE PRECISION,
  source         TEXT NOT NULL DEFAULT 'analyst', -- analyst | ai_draft
  status         note_status NOT NULL DEFAULT 'draft',
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_video ON notes(video_id);

-- ---------- assignments & audit ----------
CREATE TABLE IF NOT EXISTS assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_video ON assignments(video_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id         BIGSERIAL PRIMARY KEY,
  video_id   UUID REFERENCES videos(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_video ON activity_log(video_id);

-- ---------- updated_at triggers ----------
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_discs_updated ON discs;
CREATE TRIGGER trg_discs_updated BEFORE UPDATE ON discs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_videos_updated ON videos;
CREATE TRIGGER trg_videos_updated BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notes_updated ON notes;
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();