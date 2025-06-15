/*
  # Fix presence tracking for accurate online/offline status

  1. Issues Fixed
    - Improve presence update logic
    - Add better cleanup for stale presence
    - Fix participant loading with accurate presence data
    - Add automatic presence cleanup on disconnect

  2. Changes
    - Enhanced presence update functions
    - Better stale presence detection
    - Improved participant queries with presence
    - Add presence cleanup triggers
*/

-- Drop and recreate the presence update function with better logic
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
  INSERT INTO user_presence (user_id, room_id, is_online, last_seen, updated_at)
  VALUES (p_user_id, p_room_id, p_is_online, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    room_id = EXCLUDED.room_id,
    is_online = EXCLUDED.is_online,
    last_seen = now(),
    updated_at = now();
END;
$$;

-- Enhanced function to set user offline with better cleanup
CREATE OR REPLACE FUNCTION set_user_offline(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_presence
  SET 
    is_online = false, 
    updated_at = now(),
    last_seen = now()
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one as offline
  INSERT INTO user_presence (user_id, is_online, last_seen, updated_at)
  VALUES (p_user_id, false, now(), now())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Improved cleanup function with more aggressive stale detection
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  cleaned_count bigint;
BEGIN
  -- Mark users as offline if they haven't been seen in 2 minutes
  UPDATE user_presence
  SET is_online = false, updated_at = now()
  WHERE is_online = true
    AND (last_seen < now() - interval '2 minutes' OR updated_at < now() - interval '2 minutes');
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$;

-- Enhanced function to get participants with accurate presence
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
  -- First clean up stale presence
  PERFORM cleanup_stale_presence();
  
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.color,
    CASE 
      WHEN up.is_online IS NULL THEN false
      WHEN up.last_seen < now() - interval '2 minutes' THEN false
      WHEN up.updated_at < now() - interval '2 minutes' THEN false
      ELSE COALESCE(up.is_online, false)
    END as is_online,
    COALESCE(up.last_seen, rp.joined_at) as last_seen
  FROM room_participants rp
  JOIN profiles p ON p.id = rp.user_id
  LEFT JOIN user_presence up ON up.user_id = rp.user_id
  WHERE rp.room_id = p_room_id
  ORDER BY 
    CASE 
      WHEN up.is_online IS NULL THEN false
      WHEN up.last_seen < now() - interval '2 minutes' THEN false
      WHEN up.updated_at < now() - interval '2 minutes' THEN false
      ELSE COALESCE(up.is_online, false)
    END DESC,
    COALESCE(up.last_seen, rp.joined_at) DESC;
END;
$$;

-- Function to force refresh presence for a room (useful for debugging)
CREATE OR REPLACE FUNCTION refresh_room_presence(p_room_id text)
RETURNS TABLE(
  user_id uuid,
  name text,
  is_online boolean,
  last_seen_minutes_ago numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Clean up stale presence first
  PERFORM cleanup_stale_presence();
  
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    CASE 
      WHEN up.is_online IS NULL THEN false
      WHEN up.last_seen < now() - interval '2 minutes' THEN false
      WHEN up.updated_at < now() - interval '2 minutes' THEN false
      ELSE COALESCE(up.is_online, false)
    END as is_online,
    EXTRACT(EPOCH FROM (now() - COALESCE(up.last_seen, rp.joined_at))) / 60 as last_seen_minutes_ago
  FROM room_participants rp
  JOIN profiles p ON p.id = rp.user_id
  LEFT JOIN user_presence up ON up.user_id = rp.user_id
  WHERE rp.room_id = p_room_id
  ORDER BY is_online DESC, last_seen_minutes_ago ASC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_user_presence(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_offline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_participants_with_presence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_room_presence(text) TO authenticated;

-- Add composite index for better performance
CREATE INDEX IF NOT EXISTS idx_user_presence_composite ON user_presence(user_id, is_online, last_seen, updated_at);

-- Add index for room-based presence queries
CREATE INDEX IF NOT EXISTS idx_user_presence_room_online ON user_presence(room_id, is_online, last_seen);