/*
  # Fix message display and JSON parsing issues

  1. Issues Fixed
    - Ensure all required database functions exist
    - Fix JSON handling for replying_to field
    - Add better error handling for message operations
    - Ensure proper data types and constraints

  2. Changes
    - Verify and recreate essential functions
    - Add better validation for message insertion
    - Fix any missing indexes or constraints
*/

-- Ensure the insert_ai_message function exists and works properly
CREATE OR REPLACE FUNCTION insert_ai_message(
  p_room_id text,
  p_content text,
  p_user_name text DEFAULT 'AI Assistant',
  p_user_color text DEFAULT '#8B5CF6'
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  ai_user_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  message_id uuid;
BEGIN
  -- Check if the room exists
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'Room % does not exist', p_room_id;
  END IF;

  -- Insert the AI message directly
  INSERT INTO messages (
    room_id,
    user_id,
    user_name,
    user_color,
    content,
    is_ai,
    created_at
  ) VALUES (
    p_room_id,
    ai_user_id,
    p_user_name,
    p_user_color,
    p_content,
    true,
    now()
  ) RETURNING id INTO message_id;

  RETURN message_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to insert AI message: %', SQLERRM;
END;
$$;

-- Ensure the enhanced AI message function with reply support exists
CREATE OR REPLACE FUNCTION insert_ai_message_with_reply(
  p_room_id text,
  p_content text,
  p_user_name text DEFAULT 'AI Assistant',
  p_user_color text DEFAULT '#8B5CF6',
  p_replying_to jsonb DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  ai_user_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  message_id uuid;
BEGIN
  -- Check if the room exists
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'Room % does not exist', p_room_id;
  END IF;

  -- Insert the AI message with reply data
  INSERT INTO messages (
    room_id,
    user_id,
    user_name,
    user_color,
    content,
    is_ai,
    replying_to,
    created_at
  ) VALUES (
    p_room_id,
    ai_user_id,
    p_user_name,
    p_user_color,
    p_content,
    true,
    p_replying_to,
    now()
  ) RETURNING id INTO message_id;

  RETURN message_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to insert AI message with reply: %', SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION insert_ai_message(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_ai_message_with_reply(text, text, text, text, jsonb) TO authenticated;

-- Ensure all required indexes exist for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_created_composite ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_ai ON messages(user_id, is_ai);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, created_at DESC);

-- Add composite index for real-time queries
CREATE INDEX IF NOT EXISTS idx_messages_realtime ON messages(room_id, user_id, created_at);

-- Ensure room participants composite index exists
CREATE INDEX IF NOT EXISTS idx_room_participants_composite ON room_participants(room_id, user_id, joined_at);

-- Add index for room participants by room
CREATE INDEX IF NOT EXISTS idx_room_participants_room_user_composite ON room_participants(room_id, user_id);

-- Function to validate and clean message data
CREATE OR REPLACE FUNCTION validate_message_data()
RETURNS trigger AS $$
BEGIN
  -- Ensure user_name is not null or empty
  IF NEW.user_name IS NULL OR trim(NEW.user_name) = '' THEN
    NEW.user_name := 'Unknown User';
  END IF;
  
  -- Ensure user_color is not null
  IF NEW.user_color IS NULL OR trim(NEW.user_color) = '' THEN
    NEW.user_color := '#6B7280';
  END IF;
  
  -- Ensure content is not null
  IF NEW.content IS NULL THEN
    NEW.content := '';
  END IF;
  
  -- Ensure is_ai has a default value
  IF NEW.is_ai IS NULL THEN
    NEW.is_ai := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate message data on insert/update
DROP TRIGGER IF EXISTS validate_message_data_trigger ON messages;
CREATE TRIGGER validate_message_data_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_message_data();

-- Function to get messages for a room with proper error handling
CREATE OR REPLACE FUNCTION get_room_messages(
  p_room_id text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  room_id text,
  user_id uuid,
  user_name text,
  user_color text,
  content text,
  is_ai boolean,
  created_at timestamptz,
  replying_to jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Check if room exists
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE rooms.id = p_room_id) THEN
    RAISE EXCEPTION 'Room % does not exist', p_room_id;
  END IF;
  
  -- Return messages for the room
  RETURN QUERY
  SELECT 
    m.id,
    m.room_id,
    m.user_id,
    COALESCE(m.user_name, 'Unknown User') as user_name,
    COALESCE(m.user_color, '#6B7280') as user_color,
    COALESCE(m.content, '') as content,
    COALESCE(m.is_ai, false) as is_ai,
    m.created_at,
    m.replying_to
  FROM messages m
  WHERE m.room_id = p_room_id
  ORDER BY m.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_room_messages(text, integer) TO authenticated;

-- Function to test message operations
CREATE OR REPLACE FUNCTION test_message_operations(p_room_id text)
RETURNS TABLE(
  operation text,
  success boolean,
  message text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  test_message_id uuid;
BEGIN
  -- Test 1: Insert regular message
  BEGIN
    INSERT INTO messages (room_id, user_id, user_name, user_color, content, is_ai)
    VALUES (p_room_id, auth.uid(), 'Test User', '#FF0000', 'Test message', false)
    RETURNING id INTO test_message_id;
    
    RETURN QUERY SELECT 'insert_regular_message'::text, true, 'Successfully inserted regular message'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'insert_regular_message'::text, false, SQLERRM::text;
  END;
  
  -- Test 2: Insert AI message
  BEGIN
    SELECT insert_ai_message(p_room_id, 'Test AI message') INTO test_message_id;
    RETURN QUERY SELECT 'insert_ai_message'::text, true, 'Successfully inserted AI message'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'insert_ai_message'::text, false, SQLERRM::text;
  END;
  
  -- Test 3: Get room messages
  BEGIN
    PERFORM get_room_messages(p_room_id, 10);
    RETURN QUERY SELECT 'get_room_messages'::text, true, 'Successfully retrieved room messages'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'get_room_messages'::text, false, SQLERRM::text;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_message_operations(text) TO authenticated;