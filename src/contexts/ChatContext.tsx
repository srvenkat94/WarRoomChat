import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { usePresence } from '../hooks/usePresence';

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  isAI: boolean;
  timestamp: Date;
  replyingTo?: {
    userId: string;
    userName: string;
    content: string;
  };
}

interface ChatUser {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface RoomSettings {
  roomId: string;
  isAIMuted: boolean;
  aiMutedBy?: string;
  aiMutedByName?: string;
  aiMutedAt?: Date;
}

interface ChatRoom {
  id: string;
  name: string;
  participants: ChatUser[];
  messages: ChatMessage[];
  settings: RoomSettings;
  createdAt: Date;
}

interface ChatContextType {
  currentRoom: ChatRoom | null;
  rooms: ChatRoom[];
  isConnected: boolean;
  isAIMuted: boolean;
  isAIResponding: boolean;
  toggleAIMute: () => void;
  joinRoom: (roomId: string, userName?: string) => Promise<boolean>;
  createRoom: (roomName: string, userName?: string) => Promise<void>;
  sendMessage: (content: string) => void;
  leaveRoom: () => void;
  currentUser: ChatUser | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const currentRoomRef = useRef<ChatRoom | null>(null);
  const messagesChannelRef = useRef<any>(null);
  const participantsChannelRef = useRef<any>(null);
  const settingsChannelRef = useRef<any>(null);
  const presenceUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const aiResponseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessagesRef = useRef<Set<string>>(new Set()); // Track pending messages

  // Set up simplified presence tracking
  usePresence({
    userId: user?.id || null,
    roomId: currentRoom?.id || null,
    isActive: !!currentRoom
  });

  // Convert auth user to chat user
  const createChatUser = (authUser: any): ChatUser => ({
    id: authUser.id,
    name: authUser.name,
    color: authUser.color,
    isOnline: true
  });

  const currentUser = user ? createChatUser(user) : null;

  // Get AI mute status from current room settings
  const isAIMuted = currentRoom?.settings?.isAIMuted || false;

  // Helper function to safely parse JSON
  const safeJsonParse = (jsonString: any) => {
    if (!jsonString) return null;
    if (typeof jsonString === 'object') return jsonString;
    if (typeof jsonString !== 'string') return null;
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON:', jsonString, error);
      return null;
    }
  };

  // Toggle AI mute state for the entire room
  const toggleAIMute = async () => {
    if (!currentRoom || !user) {
      console.warn('Cannot toggle AI mute: no current room or user');
      return;
    }

    try {
      console.log('🔄 Toggling AI mute for room:', currentRoom.id);
      
      const { data, error } = await supabase.rpc('toggle_room_ai_mute', {
        p_room_id: currentRoom.id,
        p_user_id: user.id
      });

      if (error) {
        console.error('❌ Failed to toggle AI mute:', error);
        return;
      }

      console.log('✅ AI mute toggled successfully:', data);
      
      // The real-time subscription will handle updating the UI
    } catch (error) {
      console.error('❌ Error toggling AI mute:', error);
    }
  };

  // Helper function to load room settings
  const loadRoomSettings = async (roomId: string): Promise<RoomSettings> => {
    try {
      const { data, error } = await supabase.rpc('get_room_settings', {
        p_room_id: roomId
      });

      if (error) {
        console.warn(`Failed to load room settings for ${roomId}:`, error);
        return {
          roomId,
          isAIMuted: false
        };
      }

      const settings = data?.[0];
      return {
        roomId,
        isAIMuted: settings?.is_ai_muted || false,
        aiMutedBy: settings?.ai_muted_by,
        aiMutedByName: settings?.ai_muted_by_name,
        aiMutedAt: settings?.ai_muted_at ? new Date(settings.ai_muted_at) : undefined
      };
    } catch (error) {
      console.warn(`Error loading room settings for ${roomId}:`, error);
      return {
        roomId,
        isAIMuted: false
      };
    }
  };

  // Simplified participant loading using message-based presence
  const loadParticipantsWithPresence = async (roomId: string): Promise<ChatUser[]> => {
    try {
      console.log('🟢 Loading participants with message-based presence for room:', roomId);
      
      const { data: participants, error } = await supabase.rpc('get_room_participants_with_presence', {
        p_room_id: roomId
      });

      if (error) {
        console.warn(`Failed to load participants with presence for room ${roomId}:`, error);
        return [];
      }

      const result = participants?.map((p: any) => ({
        id: p.user_id,
        name: p.name || 'Unknown User',
        color: p.color || '#6B7280',
        isOnline: p.is_online || false, // This is now based on message activity within 10 minutes
        lastSeen: p.last_seen ? new Date(p.last_seen) : undefined
      })) || [];

      console.log('✅ Participants loaded with message-based presence:', result);
      return result;
    } catch (error) {
      console.warn(`Error loading participants with presence for room ${roomId}:`, error);
      return [];
    }
  };

  // Helper function to load messages for a room
  const loadRoomMessages = async (roomId: string): Promise<ChatMessage[]> => {
    try {
      console.log('📨 Loading messages for room:', roomId);
      
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100); // Load more messages initially

      if (error) {
        console.error(`Error loading messages for room ${roomId}:`, error);
        return [];
      }

      const result = messages?.map((m: any) => {
        // Handle replying_to field more carefully
        let replyingTo = null;
        if (m.replying_to) {
          if (typeof m.replying_to === 'string') {
            try {
              replyingTo = JSON.parse(m.replying_to);
            } catch (e) {
              console.warn('Failed to parse replying_to:', m.replying_to);
              replyingTo = null;
            }
          } else if (typeof m.replying_to === 'object') {
            replyingTo = m.replying_to;
          }
        }

        return {
          id: m.id,
          roomId: m.room_id,
          userId: m.user_id || 'unknown',
          userName: m.user_name || 'Unknown User',
          userColor: m.user_color || '#6B7280',
          content: m.content || '',
          isAI: m.is_ai || false,
          timestamp: new Date(m.created_at),
          replyingTo
        };
      }) || [];

      console.log(`✅ Loaded ${result.length} messages for room ${roomId}`);
      return result;
    } catch (error) {
      console.error(`Error loading messages for room ${roomId}:`, error);
      return [];
    }
  };

  // Helper function to find who the AI should reply to
  const findReplyTarget = (content: string, recentMessages: ChatMessage[]): ChatMessage | null => {
    // Look for the most recent non-AI message that mentions AI or asks a question
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const message = recentMessages[i];
      
      // Skip AI messages
      if (message.isAI) continue;
      
      // If the current message mentions AI, reply to the most recent user message
      if (content.includes('@AI') || content.toLowerCase().includes('@ai')) {
        return message;
      }
      
      // Look for question patterns in recent messages
      if (message.content.includes('?') || 
          message.content.toLowerCase().includes('how') ||
          message.content.toLowerCase().includes('what') ||
          message.content.toLowerCase().includes('why') ||
          message.content.toLowerCase().includes('when') ||
          message.content.toLowerCase().includes('where') ||
          message.content.toLowerCase().includes('can you') ||
          message.content.toLowerCase().includes('could you') ||
          message.content.toLowerCase().includes('help')) {
        return message;
      }
    }
    
    // If no specific pattern found, reply to the most recent non-AI message
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const message = recentMessages[i];
      if (!message.isAI) {
        return message;
      }
    }
    
    return null;
  };

  // Initialize connection and load rooms
  const initializeConnection = async () => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping chat initialization');
      setIsConnected(false);
      return;
    }

    try {
      await loadRoomsFromSupabase();
      setIsConnected(true);
      console.log('✅ Chat connection initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize connection:', error);
      setRooms([]);
      setIsConnected(true);
    }
  };

  const loadRoomsFromSupabase = async () => {
    if (!user || !isSupabaseConfigured()) return;

    try {
      console.log('🔄 Loading rooms for user:', user.id);

      // Get rooms where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('room_participants')
        .select(`
          room_id,
          rooms!inner(
            id,
            name,
            created_by,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (participantError) {
        console.error('Error loading participant data:', participantError);
        return;
      }

      const roomsData = participantData?.map(p => p.rooms).filter(Boolean) || [];
      
      // Load messages, participants, and settings for each room
      const roomsWithData = await Promise.all(
        roomsData.map(async (room: any) => {
          try {
            // Get participants with message-based presence data
            const participants = await loadParticipantsWithPresence(room.id);

            // Get room settings
            const settings = await loadRoomSettings(room.id);

            // Get messages
            const messages = await loadRoomMessages(room.id);

            return {
              id: room.id,
              name: room.name,
              createdAt: new Date(room.created_at),
              participants,
              settings,
              messages
            };
          } catch (error) {
            console.error('Error loading room data for room:', room.id, error);
            return {
              id: room.id,
              name: room.name,
              createdAt: new Date(room.created_at),
              participants: [],
              settings: { roomId: room.id, isAIMuted: false },
              messages: []
            };
          }
        })
      );

      console.log('✅ Processed rooms:', roomsWithData);
      setRooms(roomsWithData);
    } catch (error) {
      console.error('❌ Failed to load rooms from Supabase:', error);
      setRooms([]);
    }
  };

  // Set up real-time subscriptions for current room
  const setupRealtimeSubscriptions = (roomId: string) => {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, skipping real-time subscriptions');
      return;
    }

    // Clean up existing subscriptions
    cleanupSubscriptions();

    console.log('🔄 Setting up real-time subscriptions for room:', roomId);

    // Subscribe to new messages - CRITICAL: This must work for ALL participants
    const messagesChannel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('📨 New message received via real-time:', payload.new);
          
          // Handle replying_to field more carefully
          let replyingTo = null;
          if (payload.new.replying_to) {
            if (typeof payload.new.replying_to === 'string') {
              try {
                replyingTo = JSON.parse(payload.new.replying_to);
              } catch (e) {
                console.warn('Failed to parse replying_to in real-time:', payload.new.replying_to);
                replyingTo = null;
              }
            } else if (typeof payload.new.replying_to === 'object') {
              replyingTo = payload.new.replying_to;
            }
          }

          const newMessage: ChatMessage = {
            id: payload.new.id,
            roomId: payload.new.room_id,
            userId: payload.new.user_id || 'unknown',
            userName: payload.new.user_name || 'Unknown User',
            userColor: payload.new.user_color || '#6B7280',
            content: payload.new.content || '',
            isAI: payload.new.is_ai || false,
            timestamp: new Date(payload.new.created_at),
            replyingTo
          };

          // If this is an AI message, clear the AI responding state
          if (newMessage.isAI) {
            console.log('🤖 AI message received, clearing responding state');
            setIsAIResponding(false);
            if (aiResponseTimeoutRef.current) {
              clearTimeout(aiResponseTimeoutRef.current);
              aiResponseTimeoutRef.current = null;
            }
          }

          // Remove from pending messages if it exists
          pendingMessagesRef.current.delete(newMessage.id);

          // CRITICAL: Update current room messages for ALL participants
          setCurrentRoom(prevRoom => {
            if (prevRoom && prevRoom.id === roomId) {
              console.log('📝 Current messages before update:', prevRoom.messages.length);
              console.log('📝 Adding new message:', { id: newMessage.id, content: newMessage.content.substring(0, 50) });
              
              // Check if message already exists (prevent duplicates)
              const messageExists = prevRoom.messages.some(m => m.id === newMessage.id);
              if (messageExists) {
                console.log('⚠️ Message already exists, skipping duplicate');
                return prevRoom;
              }
              
              // Add the new message - THIS MUST WORK FOR ALL PARTICIPANTS
              const updatedMessages = [...prevRoom.messages, newMessage];
              
              const updatedRoom = {
                ...prevRoom,
                messages: updatedMessages
              };
              
              currentRoomRef.current = updatedRoom;
              console.log('✅ Message added to room state. Total messages:', updatedMessages.length);
              return updatedRoom;
            }
            return prevRoom;
          });

          // Refresh participants after any new message to update presence
          console.log('🔄 Refreshing participants after new message...');
          const updatedParticipants = await loadParticipantsWithPresence(roomId);
          
          setCurrentRoom(prevRoom => {
            if (prevRoom && prevRoom.id === roomId) {
              const updatedRoom = {
                ...prevRoom,
                participants: updatedParticipants
              };
              currentRoomRef.current = updatedRoom;
              console.log('✅ Participants refreshed after message. Online count:', updatedParticipants.filter(p => p.isOnline).length);
              return updatedRoom;
            }
            return prevRoom;
          });
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status);
      });

    // Subscribe to participant changes (simplified)
    const participantsChannel = supabase
      .channel(`room-participants-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('New participant joined via real-time:', payload.new);
          
          // Reload participants with updated message-based presence data
          const updatedParticipants = await loadParticipantsWithPresence(roomId);
          
          setCurrentRoom(prevRoom => {
            if (prevRoom && prevRoom.id === roomId) {
              const updatedRoom = {
                ...prevRoom,
                participants: updatedParticipants
              };
              currentRoomRef.current = updatedRoom;
              console.log('Updated participants list');
              return updatedRoom;
            }
            return prevRoom;
          });
        }
      )
      .subscribe((status) => {
        console.log('Participants subscription status:', status);
      });

    // Subscribe to room settings changes
    const settingsChannel = supabase
      .channel(`room-settings-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_settings',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('🔄 Room settings changed via real-time:', payload);
          
          // Reload room settings
          const updatedSettings = await loadRoomSettings(roomId);
          
          setCurrentRoom(prevRoom => {
            if (prevRoom && prevRoom.id === roomId) {
              const updatedRoom = {
                ...prevRoom,
                settings: updatedSettings
              };
              currentRoomRef.current = updatedRoom;
              console.log('✅ Updated room settings:', updatedSettings);
              return updatedRoom;
            }
            return prevRoom;
          });
        }
      )
      .subscribe((status) => {
        console.log('Settings subscription status:', status);
      });

    messagesChannelRef.current = messagesChannel;
    participantsChannelRef.current = participantsChannel;
    settingsChannelRef.current = settingsChannel;

    // Simplified presence refresh - just reload participants periodically
    // This will update the message-based presence status
    if (presenceUpdateInterval.current) {
      clearInterval(presenceUpdateInterval.current);
    }
    
    presenceUpdateInterval.current = setInterval(async () => {
      if (currentRoomRef.current) {
        console.log('🔄 Periodic presence refresh for room:', roomId);
        const updatedParticipants = await loadParticipantsWithPresence(roomId);
        
        setCurrentRoom(prevRoom => {
          if (prevRoom && prevRoom.id === roomId) {
            const updatedRoom = {
              ...prevRoom,
              participants: updatedParticipants
            };
            currentRoomRef.current = updatedRoom;
            return updatedRoom;
          }
          return prevRoom;
        });
      }
    }, 60000); // Refresh every 60 seconds
  };

  // Clean up subscriptions
  const cleanupSubscriptions = () => {
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
      messagesChannelRef.current = null;
    }
    if (participantsChannelRef.current) {
      supabase.removeChannel(participantsChannelRef.current);
      participantsChannelRef.current = null;
    }
    if (settingsChannelRef.current) {
      supabase.removeChannel(settingsChannelRef.current);
      settingsChannelRef.current = null;
    }
    if (presenceUpdateInterval.current) {
      clearInterval(presenceUpdateInterval.current);
      presenceUpdateInterval.current = null;
    }
    if (aiResponseTimeoutRef.current) {
      clearTimeout(aiResponseTimeoutRef.current);
      aiResponseTimeoutRef.current = null;
    }
  };

  const joinRoom = async (roomId: string, userName?: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }

    try {
      if (!user) {
        console.error('No user found');
        return false;
      }

      console.log('🔄 Joining room:', roomId, 'for user:', user.name);
      
      // Use the safe join function
      const { data: joinResult, error: joinError } = await supabase.rpc('join_room_as_participant', {
        p_room_id: roomId,
        p_user_id: user.id
      });

      if (joinError || !joinResult) {
        console.error('❌ Failed to join room:', joinError);
        return false;
      }

      // Load room data with better error handling
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError || !roomData) {
        console.error('❌ Room not found:', roomError);
        return false;
      }

      // Load participants with message-based presence data
      const participants = await loadParticipantsWithPresence(roomId);
      console.log('🟢 Participants loaded for room join:', participants);

      // Load room settings
      const settings = await loadRoomSettings(roomId);

      // Load messages
      const messages = await loadRoomMessages(roomId);

      const room: ChatRoom = {
        id: roomData.id,
        name: roomData.name,
        createdAt: new Date(roomData.created_at),
        participants,
        settings,
        messages
      };

      console.log('🟢 Room data loaded for join:', { 
        id: room.id, 
        name: room.name, 
        participantCount: room.participants.length,
        onlineCount: room.participants.filter(p => p.isOnline).length,
        messageCount: room.messages.length 
      });

      // Set up real-time subscriptions BEFORE setting current room
      setupRealtimeSubscriptions(roomId);

      setCurrentRoom(room);
      currentRoomRef.current = room;
      
      // Update rooms list if not already there
      setRooms(prevRooms => {
        const existingRoom = prevRooms.find(r => r.id === roomId);
        if (existingRoom) {
          return prevRooms.map(r => r.id === roomId ? room : r);
        } else {
          return [...prevRooms, room];
        }
      });

      console.log('✅ Successfully joined room:', roomId);
      return true;
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      return false;
    }
  };

  const createRoom = async (roomName: string, userName?: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🔄 Creating room:', roomName, 'for user:', user.name);

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use the safe create function (which now initializes settings)
      const { data: createResult, error: createError } = await supabase.rpc('create_room_with_participant', {
        p_room_id: roomId,
        p_room_name: roomName,
        p_user_id: user.id
      });

      if (createError || !createResult) {
        console.error('❌ Failed to create room:', createError);
        throw new Error(`Failed to create room: ${createError?.message || 'Unknown error'}`);
      }

      console.log('✅ Room created successfully:', roomId);

      // Create room object with default settings
      const newRoom: ChatRoom = {
        id: roomId,
        name: roomName,
        participants: [createChatUser(user)],
        settings: { roomId, isAIMuted: false },
        messages: [],
        createdAt: new Date()
      };

      // Update local state
      setRooms(prevRooms => [...prevRooms, newRoom]);
      setCurrentRoom(newRoom);
      currentRoomRef.current = newRoom;

      // Set up real-time subscriptions
      setupRealtimeSubscriptions(roomId);

      console.log('✅ Room creation completed successfully');

    } catch (error) {
      console.error('❌ Failed to create room:', error);
      throw error;
    }
  };

  const sendMessage = async (content: string) => {
    if (!user || !currentRoom || !isSupabaseConfigured()) {
      console.error('❌ Cannot send message: missing user, room, or Supabase config');
      return;
    }

    try {
      console.log('📤 Sending message:', content, 'to room:', currentRoom.id);
      console.log('👤 User details:', { id: user.id, name: user.name, color: user.color });

      // Generate a temporary ID for optimistic update
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to pending messages
      pendingMessagesRef.current.add(tempId);

      // Create optimistic message for immediate UI update
      const optimisticMessage: ChatMessage = {
        id: tempId,
        roomId: currentRoom.id,
        userId: user.id,
        userName: user.name,
        userColor: user.color,
        content,
        isAI: false,
        timestamp: new Date()
      };

      // Add optimistic message to UI immediately
      setCurrentRoom(prevRoom => {
        if (prevRoom) {
          const updatedRoom = {
            ...prevRoom,
            messages: [...prevRoom.messages, optimisticMessage]
          };
          currentRoomRef.current = updatedRoom;
          return updatedRoom;
        }
        return prevRoom;
      });

      // Save to Supabase (this will trigger real-time updates for other users)
      const { data, error } = await supabase
        .from('messages')
        .insert({
          room_id: currentRoom.id,
          user_id: user.id,
          user_name: user.name,
          user_color: user.color,
          content,
          is_ai: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to save message to Supabase:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        // Remove optimistic message on error
        pendingMessagesRef.current.delete(tempId);
        setCurrentRoom(prevRoom => {
          if (prevRoom) {
            const updatedRoom = {
              ...prevRoom,
              messages: prevRoom.messages.filter(m => m.id !== tempId)
            };
            currentRoomRef.current = updatedRoom;
            return updatedRoom;
          }
          return prevRoom;
        });
        
        throw error;
      }

      console.log('✅ Message saved successfully:', data);

      // Replace optimistic message with real message when we get the response
      if (data) {
        pendingMessagesRef.current.delete(tempId);
        
        const realMessage: ChatMessage = {
          id: data.id,
          roomId: data.room_id,
          userId: data.user_id,
          userName: data.user_name,
          userColor: data.user_color,
          content: data.content,
          isAI: data.is_ai,
          timestamp: new Date(data.created_at)
        };

        setCurrentRoom(prevRoom => {
          if (prevRoom) {
            const updatedRoom = {
              ...prevRoom,
              messages: prevRoom.messages.map(m => 
                m.id === tempId ? realMessage : m
              )
            };
            currentRoomRef.current = updatedRoom;
            return updatedRoom;
          }
          return prevRoom;
        });
      }

      // CRITICAL: AI should respond for ALL participants, not just room creator
      // Check if AI should respond (only if not muted for the room)
      if (!isAIMuted && (content.includes('@AI') || content.toLowerCase().includes('@ai'))) {
        console.log('🤖 AI mention detected and AI is active for room, generating response...');
        
        // Set AI responding state immediately
        setIsAIResponding(true);
        
        // Set a timeout to clear AI responding state if it takes too long
        if (aiResponseTimeoutRef.current) {
          clearTimeout(aiResponseTimeoutRef.current);
        }
        
        aiResponseTimeoutRef.current = setTimeout(() => {
          console.warn('⏰ AI response timeout - clearing responding state');
          setIsAIResponding(false);
        }, 25000); // 25 second timeout
        
        // Add a small delay to make the AI response feel more natural
        setTimeout(async () => {
          try {
            const { klusterAI } = await import('../services/klusterAI');
            
            // Test AI connection first
            console.log('🔍 Testing AI connection before generating response...');
            const isAIWorking = await klusterAI.testConnection();
            if (!isAIWorking) {
              console.error('❌ AI service test failed');
              setIsAIResponding(false);
              if (aiResponseTimeoutRef.current) {
                clearTimeout(aiResponseTimeoutRef.current);
                aiResponseTimeoutRef.current = null;
              }
              // Send error message using the AI function
              await supabase.rpc('insert_ai_message', {
                p_room_id: currentRoom.id,
                p_content: "I'm having trouble connecting to my AI service right now. Please try mentioning @AI again in a moment!",
                p_user_name: 'AI Assistant',
                p_user_color: '#8B5CF6'
              });
              return;
            }
            
            console.log('✅ AI connection test passed, generating response...');
            
            // Get recent messages for context - SHARED CONTEXT FOR THE ROOM
            const recentMessages = (currentRoomRef.current?.messages || [])
              .filter(m => !m.id.startsWith('temp_')) // Exclude temporary messages
              .slice(-10)
              .map(m => ({
                role: m.isAI ? 'assistant' as const : 'user' as const,
                content: `${m.userName}: ${m.content}`
              }));

            console.log('📝 Sending shared room context to AI:', recentMessages);

            const aiResponse = await klusterAI.generateResponse(recentMessages, currentRoom.name);
            console.log('✅ AI response received:', aiResponse);

            // Find who the AI should reply to
            const currentMessages = currentRoomRef.current?.messages || [];
            const replyTarget = findReplyTarget(content, currentMessages);
            
            let replyingToData = null;
            if (replyTarget) {
              replyingToData = {
                userId: replyTarget.userId,
                userName: replyTarget.userName,
                content: replyTarget.content.length > 50 
                  ? replyTarget.content.substring(0, 50) + '...'
                  : replyTarget.content
              };
            }

            // Use the enhanced AI message function with reply data
            const { data: aiData, error: aiError } = await supabase.rpc('insert_ai_message_with_reply', {
              p_room_id: currentRoom.id,
              p_content: aiResponse,
              p_user_name: 'AI Assistant',
              p_user_color: '#8B5CF6',
              p_replying_to: replyingToData ? JSON.stringify(replyingToData) : null
            });

            if (aiError) {
              console.error('❌ Failed to save AI message:', aiError);
              // Try to send a fallback message without reply data
              await supabase.rpc('insert_ai_message', {
                p_room_id: currentRoom.id,
                p_content: "I'm having trouble responding right now. Please try mentioning @AI again!",
                p_user_name: 'AI Assistant',
                p_user_color: '#8B5CF6'
              });
            } else {
              console.log('✅ AI response saved successfully:', aiData);
            }

          } catch (error) {
            console.error('❌ AI response error:', error);
            setIsAIResponding(false);
            if (aiResponseTimeoutRef.current) {
              clearTimeout(aiResponseTimeoutRef.current);
              aiResponseTimeoutRef.current = null;
            }
            
            // Send error message using the AI function
            try {
              await supabase.rpc('insert_ai_message', {
                p_room_id: currentRoom.id,
                p_content: "I'm having trouble connecting right now. Please try mentioning @AI again in a moment!",
                p_user_name: 'AI Assistant',
                p_user_color: '#8B5CF6'
              });
            } catch (fallbackError) {
              console.error('❌ Failed to send AI error message:', fallbackError);
            }
          }
        }, 1500); // 1.5 second delay for more natural feel
      } else if (isAIMuted && (content.includes('@AI') || content.toLowerCase().includes('@ai'))) {
        console.log('🔇 AI mention detected but AI is muted for this room - not responding');
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  };

  const leaveRoom = () => {
    if (!currentRoom) return;

    try {
      console.log('🚪 Leaving room:', currentRoom.id);

      // Clean up real-time subscriptions
      cleanupSubscriptions();
      
      // Clear pending messages
      pendingMessagesRef.current.clear();
      
      setCurrentRoom(null);
      currentRoomRef.current = null;
      setIsAIResponding(false);
    } catch (error) {
      console.error('❌ Failed to leave room:', error);
      setCurrentRoom(null);
      currentRoomRef.current = null;
      setIsAIResponding(false);
    }
  };

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      initializeConnection();
    } else if (!isSupabaseConfigured()) {
      setIsConnected(false);
    }

    return () => {
      // Cleanup all connections
      cleanupSubscriptions();
      pendingMessagesRef.current.clear();
    };
  }, [user]);

  const value: ChatContextType = {
    currentRoom,
    rooms,
    isConnected,
    isAIMuted,
    isAIResponding,
    toggleAIMute,
    joinRoom,
    createRoom,
    sendMessage,
    leaveRoom,
    currentUser
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};