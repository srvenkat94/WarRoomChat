/*
  # Fix AI Assistant - Handle AI Messages Without Profile Dependency

  1. Problem
    - AI messages fail because of foreign key constraint on profiles
    - Cannot create AI profile without corresponding auth.users entry
    - Need to allow AI messages while maintaining data integrity

  2. Solution
    - Remove foreign key constraint on messages.user_id
    - Handle AI messages with special UUID that doesn't require profile
    - Update RLS policies to allow AI messages
    - Create robust AI message insertion function

  3. Security
    - Maintains security for regular user messages
    - AI messages are clearly marked with is_ai flag
    - Only authenticated users can trigger AI responses
*/

-- First, drop the foreign key constraint on messages.user_id
-- This allows AI messages to use a special UUID without requiring a profile
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

-- Update the AI message function to be more robust and handle the lack of foreign key
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
    -- Log the error and re-raise with more context
    RAISE EXCEPTION 'Failed to insert AI message: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION insert_ai_message(text, text, text, text) TO authenticated;

-- Update the messages RLS policy to properly handle AI messages
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
      (
        is_ai = true AND
        user_id = '00000000-0000-0000-0000-000000000000'::uuid
      )
    )
  );

-- Update the read policy to handle AI messages properly
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

-- Create a function to test AI message insertion
CREATE OR REPLACE FUNCTION test_ai_message(p_room_id text)
RETURNS TABLE(
  success boolean,
  message_id uuid,
  error_message text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  new_message_id uuid;
BEGIN
  BEGIN
    SELECT insert_ai_message(p_room_id, 'Test AI message - if you see this, AI messaging is working!') INTO new_message_id;
    RETURN QUERY SELECT true, new_message_id, 'AI message inserted successfully';
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT false, NULL::uuid, SQLERRM;
  END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_ai_message(text) TO authenticated;

-- Add an index for AI messages for better performance
CREATE INDEX IF NOT EXISTS idx_messages_ai_user ON messages(user_id) WHERE is_ai = true;

-- Add an index for better AI message queries
CREATE INDEX IF NOT EXISTS idx_messages_ai_flag ON messages(is_ai, created_at DESC);

-- Create a function to clean up any orphaned messages (optional maintenance function)
CREATE OR REPLACE FUNCTION cleanup_orphaned_messages()
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  deleted_count bigint;
BEGIN
  -- Delete messages from users that no longer exist (except AI messages)
  DELETE FROM messages 
  WHERE is_ai = false 
    AND user_id NOT IN (SELECT id FROM profiles);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission (for admin use)
GRANT EXECUTE ON FUNCTION cleanup_orphaned_messages() TO authenticated;

-- Verify the setup with a diagnostic function
CREATE OR REPLACE FUNCTION diagnose_ai_setup()
RETURNS TABLE(
  check_name text,
  status text,
  details text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Check if foreign key constraint is removed
  RETURN QUERY
  SELECT 
    'Foreign Key Constraint' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_user_id_fkey' 
        AND table_name = 'messages'
      ) THEN 'PRESENT (may cause issues)'
      ELSE 'REMOVED (good)'
    END as status,
    'Foreign key constraint on messages.user_id' as details;

  -- Check if AI message function exists
  RETURN QUERY
  SELECT 
    'AI Message Function' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'insert_ai_message'
      ) THEN 'EXISTS (good)'
      ELSE 'MISSING (problem)'
    END as status,
    'Function to insert AI messages' as details;

  -- Check RLS policies
  RETURN QUERY
  SELECT 
    'RLS Policies' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policyname = 'Enable insert for authenticated users'
      ) THEN 'CONFIGURED (good)'
      ELSE 'MISSING (problem)'
    END as status,
    'Row Level Security policies for messages' as details;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION diagnose_ai_setup() TO authenticated;