/*
  # Fix join room function and add missing functions

  1. Functions
    - Create join_room_as_participant function
    - Ensure all required functions exist
    - Fix any missing database functions

  2. Security
    - Maintain proper RLS policies
    - Ensure safe room joining
*/

-- Create join_room_as_participant function
CREATE OR REPLACE FUNCTION join_room_as_participant(
  p_room_id text,
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

  -- Check if room exists
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Add user as participant (ignore if already exists)
  INSERT INTO room_participants (room_id, user_id, joined_at)
  VALUES (p_room_id, p_user_id, now())
  ON CONFLICT (room_id, user_id) DO NOTHING;

  -- Update user presence to online in this room
  PERFORM update_user_presence(p_user_id, p_room_id, true);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to join room: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION join_room_as_participant(text, uuid) TO authenticated;

-- Ensure create_room_with_participant function exists and works properly
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

  -- Set user presence as online in this room
  PERFORM update_user_presence(p_user_id, p_room_id, true);

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create room: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_room_with_participant(text, text, uuid) TO authenticated;