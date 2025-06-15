import React, { useState, useEffect } from 'react';
import { MessageCircle, Users, Zap, ArrowRight, LogOut, User as UserIcon, AlertCircle, Plus, Hash } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import ChatRoom from './ChatRoom';

const WelcomePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const { currentRoom, rooms, joinRoom, createRoom, isConnected } = useChat();
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [urlRoomId, setUrlRoomId] = useState<string | null>(null);

  // Check for room parameter in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
      setUrlRoomId(roomId);
      // Clean up URL parameter immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Try to join room from URL when everything is ready
  useEffect(() => {
    if (urlRoomId && user && isConnected && !currentRoom) {
      console.log('Attempting to join room from URL:', urlRoomId);
      handleJoinRoom(urlRoomId);
      setUrlRoomId(null); // Clear after attempting
    }
  }, [urlRoomId, user, isConnected, currentRoom]);

  // If user is in a room, show the chat room
  if (currentRoom) {
    return <ChatRoom />;
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!user) {
      setJoinError('Please sign in to join a room.');
      return;
    }
    
    // Prevent multiple simultaneous join attempts
    if (joiningRoomId) {
      console.log('Already joining a room, ignoring request');
      return;
    }
    
    setJoiningRoomId(roomId);
    setJoinError(null);
    
    try {
      console.log('Joining room:', roomId, 'User:', user.name);
      
      // First check if the room exists in Supabase
      const roomExists = await checkRoomExists(roomId);
      
      if (!roomExists) {
        setJoinError(`Room "${roomId}" not found. The room may have been deleted or the link is invalid.`);
        return;
      }

      const success = await joinRoom(roomId, user.name);
      if (!success) {
        setJoinError(`Unable to join room "${roomId}". Please try again or contact the room creator.`);
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      setJoinError('Failed to join room. Please check your connection and try again.');
    } finally {
      setJoiningRoomId(null);
    }
  };

  const checkRoomExists = async (roomId: string): Promise<boolean> => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomId)
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking room existence:', error);
      return false;
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !user) return;
    
    setIsCreating(true);
    try {
      console.log('Creating room with name:', newRoomName.trim());
      await createRoom(newRoomName.trim(), user.name);
      setNewRoomName('');
      setShowCreateRoom(false);
      console.log('Room created successfully');
    } catch (error) {
      console.error('Failed to create room:', error);
      setJoinError(`Failed to create room: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Active now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Show loading state while connecting
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gentle">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to ChatMind...</p>
          {urlRoomId && (
            <p className="text-sm text-primary-600 mt-2">Preparing to join room...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-subtle">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-gentle">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ChatMind</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="avatar"
                style={{ backgroundColor: user?.color }}
              >
                {user ? getInitials(user.name) : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            
            <button
              onClick={signOut}
              className="btn-ghost text-sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to ChatMind, {user?.name}!</h2>
            <p className="text-gray-600">Create your first room or join an existing one to start collaborating</p>
          </div>

          {/* Join Error */}
          {joinError && (
            <div className="notification error max-w-2xl mx-auto mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-error-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-error-700 text-sm font-medium">Unable to join room</p>
                  <p className="text-error-600 text-sm mt-1">{joinError}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setShowCreateRoom(true)}
                      className="btn-primary text-sm py-1 px-3"
                    >
                      Create New Room
                    </button>
                    <button
                      onClick={() => setJoinError(null)}
                      className="btn-secondary text-sm py-1 px-3"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Room Button */}
          <div className="text-center mb-8">
            <button
              onClick={() => setShowCreateRoom(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New Room
            </button>
          </div>

          {/* Available Rooms or Empty State */}
          {rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div key={room.id} className="card p-6 card-hover">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-primary-500" />
                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{room.participants.length} online</span>
                        </div>
                        <span>{formatTime(room.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Participants */}
                  {room.participants.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex -space-x-2">
                        {room.participants.slice(0, 4).map((participant, index) => (
                          <div
                            key={participant.id}
                            className="avatar border-2 border-white"
                            style={{ 
                              backgroundColor: participant.color,
                              zIndex: 10 - index 
                            }}
                            title={participant.name}
                          >
                            {participant.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      {room.participants.length > 4 && (
                        <span className="text-sm text-gray-500">+{room.participants.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* Recent Message Preview */}
                  {room.messages.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        <span className="font-medium">{room.messages[room.messages.length - 1].userName}:</span>{' '}
                        {room.messages[room.messages.length - 1].content}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={joiningRoomId === room.id}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {joiningRoomId === room.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        Join Room
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-gentle">
                  <MessageCircle className="w-10 h-10 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to start collaborating?</h3>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Create your first room to begin real-time conversations with your team. 
                  You can invite others by sharing the room link once it's created.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="text-center p-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-subtle">
                      <MessageCircle className="w-6 h-6 text-primary-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Real-time Chat</h4>
                    <p className="text-sm text-gray-600">Instant messaging with live updates</p>
                  </div>
                  
                  <div className="text-center p-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-subtle">
                      <Users className="w-6 h-6 text-primary-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Team Collaboration</h4>
                    <p className="text-sm text-gray-600">Invite team members to join</p>
                  </div>
                  
                  <div className="text-center p-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-subtle">
                      <Zap className="w-6 h-6 text-primary-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">AI Assistant</h4>
                    <p className="text-sm text-gray-600">Get help by mentioning @AI</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
                >
                  <Plus className="w-6 h-6" />
                  Create Your First Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="card max-w-md w-full p-6 shadow-gentle">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Room</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name (e.g., Project Alpha, Team Chat)"
                  className="input-field"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isCreating) {
                      handleCreateRoom();
                    }
                  }}
                  disabled={isCreating}
                />
              </div>
              
              <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
                <p className="text-sm text-primary-700">
                  💡 <strong>Tip:</strong> Choose a descriptive name that helps team members understand the room's purpose.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateRoom(false);
                  setNewRoomName('');
                }}
                disabled={isCreating}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim() || isCreating}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Room
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;