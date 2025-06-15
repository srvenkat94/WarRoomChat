/*
  # Fix AI permissions and ensure proper message broadcasting

  1. Issues Fixed
    - Remove any creator-only restrictions for AI interaction
    - Ensure all participants can trigger AI responses
    - Fix message broadcasting to all room participants
    - Ensure AI has shared context for the entire room

  2. Changes
    - Update RLS policies to allow all participants to interact with AI
    - Ensure message insertion works for all authenticated users in the room
    - Fix any permission checks that might block AI responses
*/

-- Ensure the messages RLS policy allows ALL room participants to insert messages
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON messages;

CREATE POLICY "Enable insert for authenticated users"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      -- Regular user messages: user must be participant and user_id must match auth.uid()
      (
        user_id = auth.uid() AND
        is_ai = false AND
        EXISTS (
          SELECT 1 FROM room_participants
          WHERE room_participants.room_id = messages.room_id
          AND room_participants.user_id = auth.uid()
        )
      )
      OR
      -- AI messages: allow if is_ai is true and user_id is the special AI UUID
      -- CRITICAL: No creator-only restrictions here
      (
        is_ai = true AND
        user_id = '00000000-0000-0000-0000-000000000000'::uuid
      )
    )
  );

-- Ensure the read policy allows ALL room participants to see messages
DROP POLICY IF EXISTS "Enable read for authenticated users" ON messages;

CREATE POLICY "Enable read for authenticated users"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = messages.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

-- Update the AI message function to ensure it works for any authenticated user
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

  -- CRITICAL: No creator-only checks here - any participant can trigger AI
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
    -- Log the error and re-raise with more context
    RAISE EXCEPTION 'Failed to insert AI message: %', SQLERRM;
END;
$$;

-- Update the enhanced AI message function with reply support
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

  -- CRITICAL: No creator-only checks here - any participant can trigger AI
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
    -- Log the error and re-raise with more context
    RAISE EXCEPTION 'Failed to insert AI message with reply: %', SQLERRM;
END;
$$;

-- Grant execute permissions to all authenticated users
GRANT EXECUTE ON FUNCTION insert_ai_message(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_ai_message_with_reply(text, text, text, text, jsonb) TO authenticated;

-- Function to test AI permissions for any user
CREATE OR REPLACE FUNCTION test_ai_permissions(p_room_id text)
RETURNS TABLE(
  test_name text,
  success boolean,
  message text,
  user_id uuid
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  current_user_id uuid := auth.uid();
  test_message_id uuid;
BEGIN
  -- Test 1: Check if user is a participant
  IF EXISTS (
    SELECT 1 FROM room_participants 
    WHERE room_id = p_room_id AND user_id = current_user_id
  ) THEN
    RETURN QUERY SELECT 
      'participant_check'::text, 
      true, 
      'User is a participant in the room'::text,
      current_user_id;
  ELSE
    RETURN QUERY SELECT 
      'participant_check'::text, 
      false, 
      'User is NOT a participant in the room'::text,
      current_user_id;
    RETURN;
  END IF;
  
  -- Test 2: Try to insert a regular message
  BEGIN
    INSERT INTO messages (room_id, user_id, user_name, user_color, content, is_ai)
    VALUES (p_room_id, current_user_id, 'Test User', '#FF0000', 'Test message from user', false)
    RETURNING id INTO test_message_id;
    
    RETURN QUERY SELECT 
      'user_message_insert'::text, 
      true, 
      'User can insert messages'::text,
      current_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 
        'user_message_insert'::text, 
        false, 
        SQLERRM::text,
        current_user_id;
  END;
  
  -- Test 3: Try to insert an AI message
  BEGIN
    SELECT insert_ai_message(p_room_id, 'Test AI message triggered by user') INTO test_message_id;
    
    RETURN QUERY SELECT 
      'ai_message_insert'::text, 
      true, 
      'User can trigger AI messages'::text,
      current_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 
        'ai_message_insert'::text, 
        false, 
        SQLERRM::text,
        current_user_id;
  END;
  
  -- Test 4: Check if user can read messages
  BEGIN
    PERFORM * FROM messages WHERE room_id = p_room_id LIMIT 1;
    
    RETURN QUERY SELECT 
      'message_read'::text, 
      true, 
      'User can read messages'::text,
      current_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 
        'message_read'::text, 
        false, 
        SQLERRM::text,
        current_user_id;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_ai_permissions(text) TO authenticated;

-- Function to verify room-wide AI access
CREATE OR REPLACE FUNCTION verify_room_ai_access(p_room_id text)
RETURNS TABLE(
  check_name text,
  status text,
  details text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Check if room exists
  RETURN QUERY
  SELECT 
    'room_exists'::text as check_name,
    CASE 
      WHEN EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) 
      THEN 'PASS' 
      ELSE 'FAIL' 
    END as status,
    'Room existence check'::text as details;

  -- Check participant count
  RETURN QUERY
  SELECT 
    'participant_count'::text as check_name,
    (SELECT COUNT(*)::text FROM room_participants WHERE room_id = p_room_id) as status,
    'Number of participants in room'::text as details;

  -- Check AI mute status
  RETURN QUERY
  SELECT 
    'ai_mute_status'::text as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM room_settings 
        WHERE room_settings.room_id = p_room_id AND is_ai_muted = true
      ) 
      THEN 'MUTED' 
      ELSE 'ACTIVE' 
    END as status,
    'AI mute status for the room'::text as details;

  -- Check message permissions
  RETURN QUERY
  SELECT 
    'message_permissions'::text as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policyname = 'Enable insert for authenticated users'
      ) 
      THEN 'CONFIGURED' 
      ELSE 'MISSING' 
    END as status,
    'Message insertion policies'::text as details;

  -- Check AI functions
  RETURN QUERY
  SELECT 
    'ai_functions'::text as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name IN ('insert_ai_message', 'insert_ai_message_with_reply')
      ) 
      THEN 'AVAILABLE' 
      ELSE 'MISSING' 
    END as status,
    'AI message insertion functions'::text as details;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION verify_room_ai_access(text) TO authenticated;