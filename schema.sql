-- CONNECT: Postgres Schema & RLS Policies

-- 1. Create Tables
CREATE TABLE participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  department text NOT NULL,
  paper_title text NOT NULL,
  interest text, -- Optional
  clue_text text NOT NULL,
  unique_code text NOT NULL,
  claimed_by_uid uuid REFERENCES auth.users(id),
  connections_made_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE users (
  uid uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  photo_url text,
  participant_id uuid REFERENCES participants(id),
  role text DEFAULT 'user', -- 'user' or 'admin'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_uid uuid REFERENCES auth.users(id) NOT NULL,
  to_participant_id uuid REFERENCES participants(id) NOT NULL,
  fact_learned text NOT NULL,
  selfie_url text NOT NULL, -- Public Storage URL
  status text DEFAULT 'pending', -- 'pending', 'verified', or 'rejected'
  submitted_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz
);

-- Partial unique index: A user can only have one verified connection to a specific participant
CREATE UNIQUE INDEX IF NOT EXISTS one_verified_connection 
  ON connections (from_uid, to_participant_id) 
  WHERE status = 'verified';

CREATE TABLE config (
  id text PRIMARY KEY,
  admins text[], -- Array of admin emails
  event_active boolean DEFAULT true,
  leaderboard_visible boolean DEFAULT false,
  total_participants int DEFAULT 0
);

-- Seed initial admin config
INSERT INTO config (id, admins, event_active, leaderboard_visible, total_participants)
VALUES ('main', ARRAY['muhammedsinan.m67@gmail.com'], true, false, 0)
ON CONFLICT (id) DO NOTHING;


-- 2. Enable Row Level Security (RLS)
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;


-- 3. RLS Policies

-- Participants: Revoke all from anon. Authenticated can read (but data is masked via RPCs/views in practice)
DROP POLICY IF EXISTS "Deny all to anon on participants" ON participants;
CREATE POLICY "Deny all to anon on participants" ON participants FOR ALL TO anon USING (false);

-- Users: Users can read/update their own profile. Admins can read all.
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users FOR SELECT TO authenticated
USING (auth.uid() = uid OR (SELECT role FROM users WHERE uid = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated
USING (auth.uid() = uid);

-- Connections: Users can insert their own connections
DROP POLICY IF EXISTS "Users can insert own connections" ON connections;
CREATE POLICY "Users can insert own connections" ON connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = from_uid);

-- Connections: Users can read their own connections. Admins can read all.
DROP POLICY IF EXISTS "Users can read own connections" ON connections;
CREATE POLICY "Users can read own connections" ON connections FOR SELECT TO authenticated
USING (auth.uid() = from_uid OR (SELECT role FROM users WHERE uid = auth.uid()) = 'admin');

-- Config: Read allowed for all authenticated users. Write restricted to admins.
DROP POLICY IF EXISTS "Authenticated can read config" ON config;
CREATE POLICY "Authenticated can read config" ON config FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update config" ON config;
CREATE POLICY "Admins can update config" ON config FOR UPDATE TO authenticated
USING ((SELECT role FROM users WHERE uid = auth.uid()) = 'admin');


-- 4. RPCs (Stored Procedures)

-- Submit Connection: Validates code and inserts connection record
CREATE OR REPLACE FUNCTION submit_connection(
  p_target_participant_id uuid,
  p_submitted_code text,
  p_selfie_url text,
  p_fact_text text
) RETURNS TABLE (status text) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_correct_code text;
  v_recent_failures int;
BEGIN
  SELECT unique_code INTO v_correct_code FROM participants WHERE id = p_target_participant_id;

  SELECT count(*) INTO v_recent_failures FROM connections
    WHERE from_uid = auth.uid() AND to_participant_id = p_target_participant_id AND status = 'rejected';
  
  IF v_recent_failures >= 5 THEN
    RETURN QUERY SELECT 'too_many_attempts'::text;
    RETURN;
  END IF;

  IF v_correct_code = p_submitted_code THEN
    INSERT INTO connections (from_uid, to_participant_id, selfie_url, fact_text, status, submitted_code, verified_at)
      VALUES (auth.uid(), p_target_participant_id, p_selfie_url, p_fact_text, 'verified', p_submitted_code, now());
    UPDATE participants SET connections_made_count = connections_made_count + 1 WHERE id = p_target_participant_id;
    RETURN QUERY SELECT 'verified'::text;
  ELSE
    INSERT INTO connections (from_uid, to_participant_id, selfie_url, fact_text, status, submitted_code)
      VALUES (auth.uid(), p_target_participant_id, p_selfie_url, p_fact_text, 'rejected', p_submitted_code);
    RETURN QUERY SELECT 'rejected'::text;
  END IF;
END;
$$;

-- Reveal Connection: Returns the real name and selfie only if the connection is verified and owned by the caller.
CREATE OR REPLACE FUNCTION get_connection_reveal(p_connection_id uuid)
RETURNS TABLE (name text, selfie_url text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.name, c.selfie_url
  FROM connections c
  JOIN participants p ON p.id = c.to_participant_id
  WHERE c.id = p_connection_id
    AND c.from_uid = auth.uid()
    AND c.status = 'verified';
$$;

-- Get Public Clue Grid: Returns masked participant data and connection state relative to caller.
CREATE OR REPLACE FUNCTION get_clue_grid()
RETURNS TABLE (
  id uuid,
  clue_text text,
  department text,
  connections_made_count int,
  claimed_by_uid uuid,
  connection_status text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    p.id, 
    p.clue_text, 
    p.department, 
    p.connections_made_count, 
    p.claimed_by_uid,
    (SELECT c.status FROM connections c WHERE c.to_participant_id = p.id AND c.from_uid = auth.uid() ORDER BY c.created_at DESC LIMIT 1) as connection_status
  FROM participants p;
$$;

-- Get Leaderboard: Securely fetches the leaderboard list
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (participant_id uuid, name text, connections_made_count int)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, name, connections_made_count
  FROM participants
  WHERE claimed_by_uid IS NOT NULL
    AND (SELECT leaderboard_visible FROM config WHERE id = 'main') = true
  ORDER BY connections_made_count DESC;
$$;


-- 5. Storage Bucket Configuration (selfies)

-- Create the bucket if it doesn't exist (must be public for read access)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('selfies', 'selfies', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Note: Storage policies act on the `storage.objects` table.

-- Allow public read access to all files in the selfies bucket
DROP POLICY IF EXISTS "Public read access for selfies" ON storage.objects;
CREATE POLICY "Public read access for selfies" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'selfies');

-- Allow authenticated users to upload files only to their own folder (folder name = their UID)
DROP POLICY IF EXISTS "Authenticated users can upload own selfies" ON storage.objects;
CREATE POLICY "Authenticated users can upload own selfies" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'selfies' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
