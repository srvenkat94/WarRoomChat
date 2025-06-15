/*
  # Simplified Presence System - Message-Based Activity

  1. Changes
    - Simplify presence to be based purely on recent message activity
    - Remove complex client-side presence tracking
    - Use message timestamps as the source of truth for "online" status
    - Keep it simple: online = sent message within 10 minutes, offline = otherwise

  2. Functions
    - Simplified presence functions that work with message activity
    - Remove bloated presence tracking code
    - Focus on core functionality: join rooms, see messages, chat with AI

  3. Performance
    - Reduce database overhead from complex presence tracking
    - Use existing message data for presence calculation
    - Maintain real-time messaging without interference
*/

-- Simplified function to get participants with message-based presence
CREATE OR REPLACE FUNCTION get_room_participants_with_presence(p_room_id text)
RETURNS TABLE(
  user_id uuid,
  name text,
  color text,
  is_online boolean,
  last_seen timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.color,
    -- Simple rule: online if they sent a message in the last 10 minutes
    CASE 
      WHEN m.last_message_time > now() - interval '10 minutes' THEN true
      ELSE false
    END as is_online,
    COALESCE(m.last_message_time, rp.joined_at) as last_seen
  FROM room_participants rp
  JOIN profiles p ON p.id = rp.user_id
  LEFT JOIN (
    -- Get the most recent message time for each user in this room
    SELECT 
      user_id,
      MAX(created_at) as last_message_time
    FROM messages 
    WHERE room_id = p_room_id AND is_ai = false
    GROUP BY user_id
  ) m ON m.user_id = rp.user_id
  WHERE rp.room_id = p_room_id
  ORDER BY 
    CASE 
      WHEN m.last_message_time > now() - interval '10 minutes' THEN true
      ELSE false
    END DESC,
    COALESCE(m.last_message_time, rp.joined_at) DESC;
END;
$$;

-- Simplified presence update that just records basic info (optional)
CREATE OR REPLACE FUNCTION update_user_presence(
  p_user_id uuid,
  p_room_id text,
  p_is_online boolean DEFAULT true
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Just update the basic presence record for compatibility
  -- The real presence is determined by message activity
  INSERT INTO user_presence (user_id, room_id, is_online, last_seen, updated_at)
  VALUES (p_user_id, p_room_id, p_is_online, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    room_id = EXCLUDED.room_id,
    updated_at = now();
END;
$$;

-- Simplified offline function
CREATE OR REPLACE FUNCTION set_user_offline(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Just update the record for compatibility
  -- Real presence is based on message activity
  UPDATE user_presence
  SET updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Remove the complex cleanup function - not needed with message-based presence
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- No-op function for compatibility
  -- Presence is now calculated from message activity
  RETURN 0;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_room_participants_with_presence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_presence(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_offline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_presence() TO authenticated;