/*
  # Add presence tracking for online/offline participants

  1. New Tables
    - `user_presence` table to track online/offline status
    - Stores last seen timestamp and connection status

  2. Security
    - Enable RLS on user_presence table
    - Add policies for authenticated users to manage their own presence

  3. Functions
    - Function to update user presence
    - Function to clean up stale presence records
    - Function to get online participants for a room

  4. Indexes
    - Optimize queries for presence lookups
*/

-- Create user_presence table
CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_online boolean DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  room_id text REFERENCES rooms(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Create policies for user_presence
CREATE POLICY "Users can read all presence data"
  ON user_presence
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own presence"
  ON user_presence
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_presence_room_id ON user_presence(room_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online, last_seen);
CREATE INDEX IF NOT EXISTS idx_user_presence_updated ON user_presence(updated_at);

-- Function to update user presence
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
    room_id = p_room_id,
    is_online = p_is_online,
    last_seen = now(),
    updated_at = now();
END;
$$;

-- Function to set user offline
CREATE OR REPLACE FUNCTION set_user_offline(p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_presence
  SET is_online = false, updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to clean up stale presence records (users offline for more than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS bigint
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  cleaned_count bigint;
BEGIN
  UPDATE user_presence
  SET is_online = false
  WHERE is_online = true
    AND last_seen < now() - interval '5 minutes';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$;

-- Function to get online participants for a room
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
    COALESCE(up.is_online, false) as is_online,
    COALESCE(up.last_seen, rp.joined_at) as last_seen
  FROM room_participants rp
  JOIN profiles p ON p.id = rp.user_id
  LEFT JOIN user_presence up ON up.user_id = rp.user_id
  WHERE rp.room_id = p_room_id
  ORDER BY 
    COALESCE(up.is_online, false) DESC,
    COALESCE(up.last_seen, rp.joined_at) DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_presence(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_offline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_participants_with_presence(text) TO authenticated;

-- Create a trigger to automatically clean up stale presence periodically
-- This will be handled by the application instead for better control