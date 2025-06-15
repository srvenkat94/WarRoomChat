import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UsePresenceProps {
  userId: string | null;
  roomId: string | null;
  isActive: boolean;
}

export const usePresence = ({ userId, roomId, isActive }: UsePresenceProps) => {
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Simplified presence update - just basic tracking
  const updatePresence = useCallback(async (online: boolean = true) => {
    if (!userId || !roomId) return;

    try {
      // Simple presence update - the real presence is determined by message activity
      const { error } = await supabase.rpc('update_user_presence', {
        p_user_id: userId,
        p_room_id: roomId,
        p_is_online: online
      });

      if (error) {
        console.warn('Failed to update presence:', error);
      }
    } catch (error) {
      console.warn('Error updating presence:', error);
    }
  }, [userId, roomId]);

  const setOffline = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase.rpc('set_user_offline', {
        p_user_id: userId
      });

      if (error) {
        console.warn('Failed to set offline:', error);
      }
    } catch (error) {
      console.warn('Error setting offline:', error);
    }
  }, [userId]);

  // Simplified presence tracking
  useEffect(() => {
    if (!userId || !roomId || !isActive) {
      return;
    }

    console.log('🟢 Starting simplified presence tracking for:', { userId, roomId });

    // Set initial presence
    updatePresence(true);

    // Simple heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      }
    }, 30000);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence(true);
      }
    };

    // Handle beforeunload
    const handleBeforeUnload = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Cleanup
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Set offline when component unmounts
      setOffline();
    };
  }, [userId, roomId, isActive, updatePresence, setOffline]);

  return {
    updatePresence,
    setOffline
  };
};