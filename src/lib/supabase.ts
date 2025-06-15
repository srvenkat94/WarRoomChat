import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are available
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
}

// Create a fallback client that will show helpful error messages
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that throws helpful errors
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Supabase not configured') }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        signOut: () => Promise.resolve({ error: new Error('Supabase not configured') })
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }) }) }),
        insert: () => Promise.resolve({ error: new Error('Supabase not configured') }),
        update: () => Promise.resolve({ error: new Error('Supabase not configured') }),
        delete: () => Promise.resolve({ error: new Error('Supabase not configured') })
      }),
      channel: () => ({
        on: () => ({ subscribe: () => {} }),
        subscribe: () => {}
      }),
      removeChannel: () => {},
      getChannels: () => []
    } as any;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
};

export const supabase = createSupabaseClient();

// Database types
interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          color: string;
        };
        Insert: {
          id: string;
          name: string;
          color?: string;
        };
        Update: {
          name?: string;
          color?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          created_by: string;
        };
        Update: {
          name?: string;
        };
      };
      room_participants: {
        Row: {
          room_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          room_id: string;
          user_id: string;
        };
        Update: {};
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          content: string;
          is_ai: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          content: string;
          is_ai?: boolean;
        };
        Update: {
          content?: string;
        };
      };
    };
  };
}

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};