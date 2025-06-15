/*
  # Enhanced presence tracking with better accuracy

  1. Improvements
    - More aggressive stale presence detection (1 minute instead of 2)
    - Better handling of edge cases
    - Improved cleanup logic
    - More accurate online status detection

  2. Functions
    - Enhanced presence update with better conflict resolution
    - Improved stale cleanup with shorter timeouts
    - Better participant loading with accurate status
*/

-- Enhanced presence update function with better accuracy
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
    updated_at = now()
  WHERE user_presence.user_id = p_user_id;
END;
$$;

-- Enhanced offline function with immediate effect
CREATE OR REPLACE FUNCTION set_user_offline(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Update existing record or create new one as offline
  INSERT INTO user_presence (user_id, is_online, last_seen, updated_at)
  VALUES (p_user_id, false, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_online = false,
    last_seen = now(),
    updated_at = now()
  WHERE user_presence.user_id = p_user_id;
END;
$$;

-- More aggressive cleanup function (1 minute timeout)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  cleaned_count bigint;
BEGIN
  -- Mark users as offline if they haven't been seen in 1 minute
  UPDATE user_presence
  SET is_online = false, updated_at = now()
  WHERE is_online = true
    AND (
      last_seen < now() - interval '1 minute' OR 
      updated_at < now() - interval '1 minute'
    );
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$;

-- Enhanced participant loading with more accurate presence detection
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
  -- Clean up stale presence first
  PERFORM cleanup_stale_presence();
  
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.color,
    CASE 
      WHEN up.user_id IS NULL THEN false
      WHEN up.last_seen < now() - interval '1 minute' THEN false
      WHEN up.updated_at < now() - interval '1 minute' THEN false
      WHEN up.is_online IS NULL THEN false
      ELSE up.is_online
    END as is_online,
    COALESCE(up.last_seen, rp.joined_at) as last_seen
  FROM room_participants rp
  JOIN profiles p ON p.id = rp.user_id
  LEFT JOIN user_presence up ON up.user_id = rp.user_id
  WHERE rp.room_id = p_room_id
  ORDER BY 
    CASE 
      WHEN up.user_id IS NULL THEN false
      WHEN up.last_seen < now() - interval '1 minute' THEN false
      WHEN up.updated_at < now() - interval '1 minute' THEN false
      WHEN up.is_online IS NULL THEN false
      ELSE up.is_online
    END DESC,
    COALESCE(up.last_seen, rp.joined_at) DESC;
END;
$$;

-- Function to force a user online (useful for immediate updates)
CREATE OR REPLACE FUNCTION force_user_online(
  p_user_id uuid,
  p_room_id text
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_presence (user_id, room_id, is_online, last_seen, updated_at)
  VALUES (p_user_id, p_room_id, true, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    room_id = p_room_id,
    is_online = true,
    last_seen = now(),
    updated_at = now();
END;
$$;

-- Function to get current presence status for debugging
CREATE OR REPLACE FUNCTION get_user_presence_status(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  room_id text,
  is_online boolean,
  last_seen timestamptz,
  updated_at timestamptz,
  minutes_since_last_seen numeric,
  should_be_online boolean
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.room_id,
    up.is_online,
    up.last_seen,
    up.updated_at,
    EXTRACT(EPOCH FROM (now() - up.last_seen)) / 60 as minutes_since_last_seen,
    CASE 
      WHEN up.last_seen > now() - interval '1 minute' AND up.is_online THEN true
      ELSE false
    END as should_be_online
  FROM user_presence up
  WHERE up.user_id = p_user_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_user_presence(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_offline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_participants_with_presence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION force_user_online(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_presence_status(uuid) TO authenticated;

-- Add better indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen_online ON user_presence(last_seen, is_online);
CREATE INDEX IF NOT EXISTS idx_user_presence_updated_online ON user_presence(updated_at, is_online);

-- Create a function to automatically clean up stale presence every minute
-- This would typically be called by a cron job or background task
CREATE OR REPLACE FUNCTION auto_cleanup_presence()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM cleanup_stale_presence();
END;
$$;

GRANT EXECUTE ON FUNCTION auto_cleanup_presence() TO authenticated;