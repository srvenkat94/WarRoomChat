/*
  # Add replying_to column to messages table

  1. Changes
    - Add `replying_to` column to messages table to store reply context
    - Update AI message functions to support reply data
    - Maintain backward compatibility

  2. Security
    - No changes to RLS policies needed
    - Column is optional and doesn't affect existing functionality
*/

-- Add replying_to column to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'replying_to'
  ) THEN
    ALTER TABLE messages ADD COLUMN replying_to jsonb;
  END IF;
END $$;

-- Add user_name and user_color columns if they don't exist (for better message display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'user_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN user_name text DEFAULT 'Unknown User';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'user_color'
  ) THEN
    ALTER TABLE messages ADD COLUMN user_color text DEFAULT '#6B7280';
  END IF;
END $$;

-- Create enhanced AI message function with reply support
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
    -- Log the error and re-raise with more context
    RAISE EXCEPTION 'Failed to insert AI message with reply: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION insert_ai_message_with_reply(text, text, text, text, jsonb) TO authenticated;

-- Add index for better performance on replying_to queries
CREATE INDEX IF NOT EXISTS idx_messages_replying_to ON messages USING GIN (replying_to) WHERE replying_to IS NOT NULL;