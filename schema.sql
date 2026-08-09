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
  self_clue text, -- User-submitted personal clue (nullable)
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
  verified_at timestamptz,
  hidden boolean DEFAULT false
);

-- Partial unique index: A user can only have one verified connection to a specific participant
CREATE UNIQUE INDEX IF NOT EXISTS one_verified_connection 
  ON connections (from_uid, to_participant_id) 
  WHERE status = 'verified';

CREATE TABLE config (
  id text PRIMARY KEY DEFAULT 'main',
  admins text[], -- Array of admin emails
  event_active boolean DEFAULT true,
  leaderboard_visible boolean DEFAULT false,
  total_participants int DEFAULT 0
);

CREATE TABLE public_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  selfie_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
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
ALTER TABLE public_gallery ENABLE ROW LEVEL SECURITY;

-- 2.5 Security Definer Helpers
CREATE OR REPLACE FUNCTION get_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM users WHERE uid = auth.uid();
$$;


-- 3. RLS Policies

-- Participants: Revoke all from anon. Authenticated can read (but data is masked via RPCs/views in practice)
DROP POLICY IF EXISTS "Deny all to anon on participants" ON participants;
CREATE POLICY "Deny all to anon on participants" ON participants FOR ALL TO anon USING (false);

-- Users: Users can read/update their own profile. Admins can read all.
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users FOR SELECT TO authenticated
USING (auth.uid() = uid OR get_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated
USING (auth.uid() = uid);

-- Connections: Users can insert their own connections
DROP POLICY IF EXISTS "Users can insert own connections" ON connections;
CREATE POLICY "Users can insert own connections" ON connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = from_uid);

-- Connections: Admins can update connections (e.g. for moderation)
DROP POLICY IF EXISTS "Admins can update connections" ON connections;
CREATE POLICY "Admins can update connections" ON connections FOR UPDATE TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

-- Connections: Users can read their own connections. Admins can read all.
DROP POLICY IF EXISTS "Users can read own connections" ON connections;
CREATE POLICY "Users can read own connections" ON connections FOR SELECT TO authenticated
USING (auth.uid() = from_uid OR get_user_role() = 'admin');

-- Config: Read allowed for all authenticated users. Write restricted to admins.
DROP POLICY IF EXISTS "Authenticated can read config" ON config;
CREATE POLICY "Authenticated can read config" ON config FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update config" ON config;
CREATE POLICY "Admins can update config" ON config FOR UPDATE TO authenticated
USING (get_user_role() = 'admin');

-- Public Gallery: Read allowed for all
DROP POLICY IF EXISTS "read gallery" ON public_gallery;
CREATE POLICY "read gallery" ON public_gallery FOR SELECT USING (true);


-- 4. RPCs (Stored Procedures)

-- Submit Connection: Validates code and inserts connection record
CREATE OR REPLACE FUNCTION submit_connection(
  p_target_participant_id uuid,
  p_submitted_code text,
  p_selfie_url text,
  p_fact_text text
) RETURNS TABLE (connection_status text) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_correct_code text;
  v_recent_failures int;
  v_new_connection_id uuid;
BEGIN
  SELECT unique_code INTO v_correct_code FROM participants WHERE id = p_target_participant_id;

  SELECT count(*) INTO v_recent_failures FROM connections
    WHERE from_uid = auth.uid() AND to_participant_id = p_target_participant_id AND connections.status = 'rejected';
  
  IF v_recent_failures >= 5 THEN
    RETURN QUERY SELECT 'too_many_attempts'::text;
    RETURN;
  END IF;

  IF v_correct_code = p_submitted_code THEN
    INSERT INTO connections (from_uid, to_participant_id, selfie_url, fact_learned, status, submitted_code, verified_at)
      VALUES (auth.uid(), p_target_participant_id, p_selfie_url, p_fact_text, 'verified', p_submitted_code, now())
      RETURNING id INTO v_new_connection_id;
    
    INSERT INTO public_gallery (connection_id, selfie_url) VALUES (v_new_connection_id, p_selfie_url);
    
    UPDATE participants SET connections_made_count = connections_made_count + 1 WHERE id = p_target_participant_id;
    RETURN QUERY SELECT 'verified'::text;
  ELSE
    INSERT INTO connections (from_uid, to_participant_id, selfie_url, fact_learned, status, submitted_code)
      VALUES (auth.uid(), p_target_participant_id, p_selfie_url, p_fact_text, 'rejected', p_submitted_code);
    RETURN QUERY SELECT 'rejected'::text;
  END IF;
END;
$$;

-- Reveal Connection: Returns the real name and selfie only if the connection is verified and owned by the caller.
CREATE OR REPLACE FUNCTION get_connection_reveal(p_connection_id uuid)
RETURNS TABLE (name text, selfie_url text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.name, CASE WHEN c.hidden THEN NULL ELSE c.selfie_url END as selfie_url
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
  name text,
  clue_text text,
  self_clue text,
  department text,
  connections_made_count int,
  claimed_by_uid uuid,
  connection_status text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    p.id, 
    p.name,
    p.clue_text, 
    p.self_clue,
    p.department, 
    p.connections_made_count, 
    p.claimed_by_uid,
    (SELECT c.status FROM connections c WHERE c.to_participant_id = p.id AND c.from_uid = auth.uid() ORDER BY c.created_at DESC LIMIT 1) as connection_status
  FROM participants p;
$$;

-- Get My Code: Returns the unique code for the logged-in user's participant row
CREATE OR REPLACE FUNCTION get_my_code()
RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT unique_code FROM participants WHERE claimed_by_uid = auth.uid();
$$;

-- Update My Clue: Lets authenticated user update their own self_clue (max 100 chars enforced)
CREATE OR REPLACE FUNCTION update_my_clue(p_text text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF length(p_text) > 100 THEN
    RAISE EXCEPTION 'Clue must be 100 characters or fewer';
  END IF;
  IF array_length(regexp_split_to_array(trim(p_text), '\s+'), 1) < 3 THEN
    RAISE EXCEPTION 'Clue must be at least 3 words';
  END IF;
  
  -- Lock-in: Prevent update if clue is already set
  IF EXISTS (SELECT 1 FROM participants WHERE claimed_by_uid = auth.uid() AND self_clue IS NOT NULL) THEN
    RAISE EXCEPTION 'Your clue is already set and cannot be changed.';
  END IF;

  UPDATE participants SET self_clue = NULLIF(trim(p_text), '') WHERE claimed_by_uid = auth.uid();
END;
$$;

-- Admin Reset Clue: Allows an admin to delete a participant's self_clue
CREATE OR REPLACE FUNCTION admin_reset_clue(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admins only';
  END IF;
  
  UPDATE participants SET self_clue = NULL WHERE id = p_participant_id;
END;
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

-- Get Scrapbook: Securely fetches a user's verified connections and selfies, masking hidden selfies
CREATE OR REPLACE FUNCTION get_scrapbook()
RETURNS TABLE (
  id uuid,
  target_name text,
  target_department text,
  fact_text text,
  selfie_url text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  -- Connections the user made to others
  SELECT 
    c.id,
    p.name as target_name,
    p.department as target_department,
    c.fact_learned as fact_text,
    CASE WHEN c.hidden THEN NULL ELSE c.selfie_url END as selfie_url,
    c.created_at
  FROM connections c
  JOIN participants p ON c.to_participant_id = p.id
  WHERE c.from_uid = auth.uid() 
    AND c.status = 'verified'
    
  UNION ALL
  
  -- Connections others made to this user
  SELECT 
    c.id,
    u.display_name as target_name,
    COALESCE(p_user.department, 'Connected to you') as target_department,
    c.fact_learned as fact_text,
    CASE WHEN c.hidden THEN NULL ELSE c.selfie_url END as selfie_url,
    c.created_at
  FROM connections c
  JOIN users u ON c.from_uid = u.uid
  LEFT JOIN participants p_user ON u.participant_id = p_user.id
  WHERE c.to_participant_id = (SELECT id FROM participants WHERE claimed_by_uid = auth.uid())
    AND c.status = 'verified'
    
  ORDER BY created_at DESC;
$$;

-- Admin Export: Securely exports participant data for admins
CREATE OR REPLACE FUNCTION get_admin_export()
RETURNS TABLE (
  name text,
  email text,
  department text,
  paper_title text,
  unique_code text,
  connections_made_count int
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    p.name,
    p.email,
    p.department,
    p.paper_title,
    p.unique_code,
    p.connections_made_count
  FROM participants p
  WHERE get_user_role() = 'admin'
  ORDER BY p.connections_made_count DESC;
$$;

-- Admin Moderation Queue: Fetches recent selfies for moderation
CREATE OR REPLACE FUNCTION get_admin_moderation_queue()
RETURNS TABLE (
  id uuid,
  from_name text,
  to_name text,
  fact_learned text,
  selfie_url text,
  status text,
  hidden boolean,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 
    c.id,
    u.display_name as from_name,
    p.name as to_name,
    c.fact_learned,
    c.selfie_url,
    c.status,
    c.hidden,
    c.created_at
  FROM connections c
  JOIN users u ON u.uid = c.from_uid
  JOIN participants p ON p.id = c.to_participant_id
  WHERE get_user_role() = 'admin'
    AND c.selfie_url IS NOT NULL
  ORDER BY c.created_at DESC
  LIMIT 100;
$$;

-- Admin Update Policy: Allow admins to update participant rows (for self_clue moderation)
DROP POLICY IF EXISTS "Admins can update participants" ON participants;
CREATE POLICY "Admins can update participants" ON participants
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

-- Toggle Selfie Visibility: Security-definer RPC for admins to hide/unhide selfies
CREATE OR REPLACE FUNCTION toggle_selfie_visibility(
  p_connection_id uuid,
  p_hidden boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_selfie_url text;
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE connections SET hidden = p_hidden WHERE id = p_connection_id RETURNING selfie_url INTO v_selfie_url;

  IF p_hidden THEN
    DELETE FROM public_gallery WHERE connection_id = p_connection_id;
  ELSE
    INSERT INTO public_gallery (connection_id, selfie_url) VALUES (p_connection_id, v_selfie_url) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Admin Clue Queue: Lists all participants with a self_clue for admin moderation
CREATE OR REPLACE FUNCTION get_admin_clue_queue()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  department text,
  clue_text text,
  self_clue text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.name, p.email, p.department, p.clue_text, p.self_clue
  FROM participants p
  WHERE p.self_clue IS NOT NULL
    AND get_user_role() = 'admin'
  ORDER BY p.name;
$$;

-- Admin Clear Self Clue: Clears a participant's self_clue (admin only)
CREATE OR REPLACE FUNCTION admin_clear_self_clue(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE participants SET self_clue = NULL WHERE id = p_participant_id;
END;
$$;

-- Admin Get Participants: Lists all participants and claim status
CREATE OR REPLACE FUNCTION get_admin_participants_list()
RETURNS TABLE (id uuid, name text, email text, department text, claimed boolean)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, name, email, department, (claimed_by_uid IS NOT NULL)
  FROM participants
  ORDER BY name ASC;
$$;

-- Admin Delete Participant: Completely deletes a participant and cascades to their connections/users
CREATE OR REPLACE FUNCTION admin_delete_participant(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admins only';
  END IF;

  SELECT claimed_by_uid INTO v_uid FROM participants WHERE id = p_id;

  -- Delete connections to this participant (cascades to gallery)
  DELETE FROM connections WHERE to_participant_id = p_id;

  IF v_uid IS NOT NULL THEN
    -- Delete connections made by this user
    DELETE FROM connections WHERE from_uid = v_uid;
    
    -- Delete the user profile so they are forced to log in fresh
    DELETE FROM users WHERE uid = v_uid;
  END IF;

  -- Delete the participant
  DELETE FROM participants WHERE id = p_id;
END;
$$;

-- 4.5 Realtime Setup
-- Enable Realtime replication for public_gallery
ALTER PUBLICATION supabase_realtime ADD TABLE public_gallery;


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
