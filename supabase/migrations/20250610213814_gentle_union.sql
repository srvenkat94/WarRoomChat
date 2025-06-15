/*
  # Add room-wide AI settings

  1. New Tables
    - `room_settings` table to store room-wide preferences
    - Includes AI mute status and who last changed it

  2. Security
    - Enable RLS on room_settings table
    - Add policies for room participants to read/update settings

  3. Functions
    - Function to toggle AI mute status for a room
    - Function to get room settings
    - Function to track who made the change

  4. Real-time
    - Enable real-time updates for room settings changes
*/

-- Create room_settings table
CREATE TABLE IF NOT EXISTS room_settings (
  room_id text PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  is_ai_muted boolean DEFAULT false,
  ai_muted_by uuid REFERENCES profiles(id),
  ai_muted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE room_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for room_settings
CREATE POLICY "Room participants can read settings"
  ON room_settings
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_settings.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Room participants can update settings"
  ON room_settings
  FOR ALL
  TO authenticated
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_settings.room_id
      AND room_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = room_settings.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_room_settings_room_id ON room_settings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_settings_ai_muted ON room_settings(is_ai_muted, updated_at);

-- Function to toggle AI mute status for a room
CREATE OR REPLACE FUNCTION toggle_room_ai_mute(
  p_room_id text,
  p_user_id uuid
)
RETURNS TABLE(
  room_id text,
  is_ai_muted boolean,
  ai_muted_by uuid,
  ai_muted_by_name text,
  ai_muted_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  current_mute_status boolean;
  user_name text;
BEGIN
  -- Check if user is a participant in the room
  IF NOT EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_participants.room_id = p_room_id
    AND room_participants.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a participant in this room';
  END IF;

  -- Get user name
  SELECT name INTO user_name FROM profiles WHERE id = p_user_id;

  -- Get current mute status or default to false
  SELECT COALESCE(is_ai_muted, false) INTO current_mute_status
  FROM room_settings
  WHERE room_settings.room_id = p_room_id;

  -- Toggle the mute status
  INSERT INTO room_settings (room_id, is_ai_muted, ai_muted_by, ai_muted_at, updated_at)
  VALUES (
    p_room_id,
    NOT current_mute_status,
    CASE WHEN NOT current_mute_status THEN p_user_id ELSE NULL END,
    CASE WHEN NOT current_mute_status THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (room_id)
  DO UPDATE SET
    is_ai_muted = NOT current_mute_status,
    ai_muted_by = CASE WHEN NOT current_mute_status THEN p_user_id ELSE NULL END,
    ai_muted_at = CASE WHEN NOT current_mute_status THEN now() ELSE NULL END,
    updated_at = now();

  -- Return the updated settings
  RETURN QUERY
  SELECT 
    rs.room_id,
    rs.is_ai_muted,
    rs.ai_muted_by,
    COALESCE(p.name, 'Unknown User') as ai_muted_by_name,
    rs.ai_muted_at
  FROM room_settings rs
  LEFT JOIN profiles p ON p.id = rs.ai_muted_by
  WHERE rs.room_id = p_room_id;
END;
$$;

-- Function to get room settings
CREATE OR REPLACE FUNCTION get_room_settings(p_room_id text)
RETURNS TABLE(
  room_id text,
  is_ai_muted boolean,
  ai_muted_by uuid,
  ai_muted_by_name text,
  ai_muted_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p_room_id as room_id,
    COALESCE(rs.is_ai_muted, false) as is_ai_muted,
    rs.ai_muted_by,
    COALESCE(p.name, 'Unknown User') as ai_muted_by_name,
    rs.ai_muted_at
  FROM room_settings rs
  LEFT JOIN profiles p ON p.id = rs.ai_muted_by
  WHERE rs.room_id = p_room_id
  
  UNION ALL
  
  SELECT 
    p_room_id as room_id,
    false as is_ai_muted,
    NULL::uuid as ai_muted_by,
    NULL as ai_muted_by_name,
    NULL::timestamptz as ai_muted_at
  WHERE NOT EXISTS (
    SELECT 1 FROM room_settings WHERE room_settings.room_id = p_room_id
  )
  LIMIT 1;
END;
$$;

-- Function to initialize room settings when room is created
CREATE OR REPLACE FUNCTION initialize_room_settings(p_room_id text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO room_settings (room_id, is_ai_muted)
  VALUES (p_room_id, false)
  ON CONFLICT (room_id) DO NOTHING;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION toggle_room_ai_mute(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_settings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_room_settings(text) TO authenticated;

-- Update the create_room_with_participant function to initialize settings
CREATE OR REPLACE FUNCTION create_room_with_participant(
  p_room_id text,
  p_room_name text,
  p_user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Create the room
  INSERT INTO rooms (id, name, created_by, created_at)
  VALUES (p_room_id, p_room_name, p_user_id, now());

  -- Add user as participant
  INSERT INTO room_participants (room_id, user_id, joined_at)
  VALUES (p_room_id, p_user_id, now());

  -- Initialize room settings
  PERFORM initialize_room_settings(p_room_id);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create room: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_room_with_participant(text, text, uuid) TO authenticated;