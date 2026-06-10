const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        onesignal_player_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_solo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE workspaces
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (workspace_id, user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT DEFAULT '',
        color TEXT DEFAULT '#ffffff',
        is_pinned BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        created_by UUID NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        status TEXT DEFAULT 'scheduled',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS meeting_attendees (
        meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'invited',
        PRIMARY KEY (meeting_id, user_id)
      );
    `);

    await client.query(`
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
    `);

    // External guest emails on meetings (for non-workspace GCal invitees)
    await client.query(`
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS guest_emails TEXT[] DEFAULT '{}';
    `);

    // Private visibility flag on notes
    await client.query(`
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
    `);

    await client.query(`
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS position_x INTEGER;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS position_y INTEGER;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS note_width INTEGER;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS note_height INTEGER;
    `);

    await client.query(`
      WITH ranked_notes AS (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY workspace_id
          ORDER BY is_pinned DESC, updated_at DESC, created_at DESC
        ) AS position
        FROM notes
      )
      UPDATE notes
      SET sort_order = ranked_notes.position
      FROM ranked_notes
      WHERE notes.id = ranked_notes.id
        AND notes.sort_order = 0
        AND NOT EXISTS (
          SELECT 1
          FROM notes ordered_note
          WHERE ordered_note.workspace_id = notes.workspace_id
            AND ordered_note.sort_order <> 0
        );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS note_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        mime_type TEXT NOT NULL,
        image_data BYTEA NOT NULL,
        context_title TEXT,
        context_content TEXT,
        context_updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE note_images ADD COLUMN IF NOT EXISTS context_title TEXT;
      ALTER TABLE note_images ADD COLUMN IF NOT EXISTS context_content TEXT;
      ALTER TABLE note_images ADD COLUMN IF NOT EXISTS context_updated_at TIMESTAMPTZ;
      ALTER TABLE note_images ADD COLUMN IF NOT EXISTS ocr_text TEXT NOT NULL DEFAULT '';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS note_sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        context_updated_at TIMESTAMPTZ DEFAULT NOW(),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE note_images
      ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES note_sections(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE workspace_members
      ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}';

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        due_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS note_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS note_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS image_annotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        image_id UUID NOT NULL REFERENCES note_images(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'comment',
        x NUMERIC NOT NULL,
        y NUMERIC NOT NULL,
        width NUMERIC,
        height NUMERIC,
        color TEXT NOT NULL DEFAULT '#10b981',
        body TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS note_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        expires_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public_shares ADD COLUMN IF NOT EXISTS password_hash TEXT;

      CREATE TABLE IF NOT EXISTS workspace_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID,
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id UUID,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS tasks_workspace_idx ON tasks(workspace_id);
      CREATE INDEX IF NOT EXISTS activity_workspace_idx ON workspace_activity(workspace_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS comments_note_idx ON note_comments(note_id, created_at);
    `);

    // Workspace email invitations (for users without accounts yet)
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        invited_email TEXT NOT NULL,
        invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token UUID NOT NULL DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        accepted_at TIMESTAMPTZ,
        UNIQUE(workspace_id, invited_email)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS google_tokens (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expiry TIMESTAMPTZ,
        google_email TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Keep notes updated_at fresh automatically
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_TABLE_NAME = 'notes'
          AND NEW.title IS NOT DISTINCT FROM OLD.title
          AND NEW.content IS NOT DISTINCT FROM OLD.content
          AND NEW.color IS NOT DISTINCT FROM OLD.color
          AND NEW.is_pinned IS NOT DISTINCT FROM OLD.is_pinned
          AND NEW.is_private IS NOT DISTINCT FROM OLD.is_private
          AND NEW.position_x IS NOT DISTINCT FROM OLD.position_x
          AND NEW.position_y IS NOT DISTINCT FROM OLD.position_y
          AND NEW.note_width IS NOT DISTINCT FROM OLD.note_width
          AND NEW.note_height IS NOT DISTINCT FROM OLD.note_height
        THEN
          NEW.updated_at = OLD.updated_at;
        ELSE
          NEW.updated_at = NOW();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS notes_updated_at ON notes;
      CREATE TRIGGER notes_updated_at
        BEFORE UPDATE ON notes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS meetings_updated_at ON meetings;
      CREATE TRIGGER meetings_updated_at
        BEFORE UPDATE ON meetings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    await client.query('COMMIT');
    console.log('Migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;
