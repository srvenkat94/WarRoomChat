import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  color: string;
  createdAt: Date;
}

interface AuthContextType {
  user: AuthUser | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If Supabase is not configured, don't try to initialize auth
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Get initial session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        await loadUserProfile(session.user);
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing user state');
          setUser(null);
          setError(null);
        } else if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
      });

      setLoading(false);

      return () => subscription.unsubscribe();
    } catch (err) {
      console.error('Auth initialization error:', err);
      setError('Failed to initialize authentication');
      setLoading(false);
    }
  };

  const loadUserProfile = async (authUser: any) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const newProfile = {
          id: authUser.id,
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          color: generateRandomColor()
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile]);

        if (insertError) throw insertError;

        setUser({
          ...newProfile,
          email: authUser.email || '',
          createdAt: new Date()
        });
      } else if (error) {
        throw error;
      } else {
        setUser({
          id: profile.id,
          name: profile.name,
          email: authUser.email || '',
          color: profile.color,
          createdAt: new Date()
        });
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError('Failed to load user profile');
    }
  };

  const generateRandomColor = () => {
    const colors = [
      '#6E56CF', '#FF6B6B', '#4ECDC4', '#45B7D1', 
      '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
      '#FF8A80', '#82B1FF', '#B39DDB', '#81C784'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }

    setLoading(true);
    setError(null);

    try {
      if (!email || !password || !name) {
        throw new Error('All fields are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email address');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: undefined // Disable email confirmation
        }
      });

      if (error) {
        // Handle specific Supabase errors
        if (error.message.includes('Email signups are disabled')) {
          throw new Error('Account creation is temporarily disabled. Please contact support.');
        }
        if (error.message.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw error;
      }

      // If signup was successful and we have a session, the user is immediately signed in
      if (data.session) {
        // User is automatically signed in
        console.log('User signed up and logged in successfully');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }

    setLoading(true);
    setError(null);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        }
        throw error;
      }

      console.log('User signed in successfully:', data.user?.id);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, clearing user state locally');
      setUser(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('Signing out user...');
      
      // Clear user state immediately for better UX
      setUser(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        // Don't throw the error, just log it since we already cleared the user state
        // This ensures the user is signed out locally even if the server request fails
      } else {
        console.log('Successfully signed out from Supabase');
      }
      
      // Clear any cached data
      localStorage.removeItem('supabase.auth.token');
      
    } catch (err: any) {
      console.error('Sign out error:', err);
      // Don't set error state or throw, since we want to ensure user is signed out locally
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    signUp,
    signIn,
    signOut,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};