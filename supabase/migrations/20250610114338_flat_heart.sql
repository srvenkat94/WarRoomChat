/*
  # Database Schema Migration for MindMesh Chat

  1. Tables
    - Works with existing `profiles` table (extends auth.users)
    - Creates `rooms` table for chat rooms
    - Creates `room_participants` for many-to-many relationships
    - Creates `messages` table for chat messages

  2. Security
    - Enables RLS on all tables
    - Creates policies for authenticated users
    - Ensures users can only access rooms they participate in

  3. Performance
    - Adds indexes for frequently queried columns
    - Optimizes for real-time chat operations

  4. Compatibility
    - Works with existing database structure
    - Safely handles existing objects
    - Maintains backward compatibility
*/

-- First, check if we need to work with existing profiles table or create new users table
DO $$
BEGIN
  -- Check if profiles table exists (current schema)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
    -- Work with existing profiles table structure
    
    -- Drop existing policies on profiles if they exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
      DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
      DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
      DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    END IF;
    
    -- Ensure profiles table has all required columns
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'name') THEN
      ALTER TABLE profiles ADD COLUMN name text NOT NULL DEFAULT 'User';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'color') THEN
      ALTER TABLE profiles ADD COLUMN color text DEFAULT '#6E56CF';
    END IF;
    
  ELSE
    -- Create users table if profiles doesn't exist
    CREATE TABLE IF NOT EXISTS profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id),
      name text NOT NULL,
      color text DEFAULT '#6E56CF'
    );
  END IF;
END $$;

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create room_participants table
CREATE TABLE IF NOT EXISTS room_participants (
  room_id text REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  is_ai boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Drop existing policies safely
DO $$
BEGIN
  -- Drop policies on rooms if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rooms') THEN
    DROP POLICY IF EXISTS "Users can read rooms they participate in" ON rooms;
    DROP POLICY IF EXISTS "Authenticated users can create rooms" ON rooms;
    DROP POLICY IF EXISTS "Anyone can read rooms" ON rooms;
  END IF;
  
  -- Drop policies on room_participants if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'room_participants') THEN
    DROP POLICY IF EXISTS "Users can read participants of rooms they're in" ON room_participants;
    DROP POLICY IF EXISTS "Users can join rooms" ON room_participants;
    DROP POLICY IF EXISTS "Room members can see participants" ON room_participants;
  END IF;
  
  -- Drop policies on messages if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
    DROP POLICY IF EXISTS "Users can read messages from rooms they're in" ON messages;
    DROP POLICY IF EXISTS "Users can send messages to rooms they're in" ON messages;
    DROP POLICY IF EXISTS "Room members can access messages" ON messages;
    DROP POLICY IF EXISTS "Room members can send messages" ON messages;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies (compatible with existing structure)
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Rooms policies
CREATE POLICY "Users can read rooms they participate in"
  ON rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = rooms.id
      AND room_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create rooms"
  ON rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Room participants policies
CREATE POLICY "Users can read participants of rooms they're in"
  ON room_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_participants.room_id
      AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join rooms"
  ON room_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can read messages from rooms they're in"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = messages.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to rooms they're in"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = messages.room_id
      AND room_participants.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- Create a function to handle user registration (works with profiles table)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, color)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    '#6E56CF'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();