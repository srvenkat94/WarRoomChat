import React from 'react';
import { Bot, Users, X, Wifi, Clock, Volume2, VolumeX, WifiOff } from 'lucide-react';

interface ChatUser {
  id: string;
  name: string;
  color: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface UserSidebarProps {
  participants: ChatUser[];
  currentUser: ChatUser;
  isAIMuted: boolean;
  isAITyping: boolean;
  onClose: () => void;
}

const UserSidebar: React.FC<UserSidebarProps> = ({
  participants,
  currentUser,
  isAIMuted,
  isAITyping,
  onClose
}) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatLastSeen = (date?: Date) => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Separate online and offline participants
  const onlineParticipants = participants.filter(p => p.isOnline);
  const offlineParticipants = participants.filter(p => !p.isOnline);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-subtle">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">
              People ({participants.length + (isAIMuted ? 0 : 1)})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* AI Assistant Section - AVAILABLE TO ALL PARTICIPANTS */}
        {!isAIMuted && (
          <div className="p-4 border-b border-gray-100 bg-indigo-50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="avatar-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-gentle">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                {isAITyping && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">AI Assistant</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium border border-indigo-200">
                    AI
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  {isAITyping ? (
                    <>
                      <div className="presence-typing"></div>
                      <span className="text-amber-600 font-medium">Thinking...</span>
                    </>
                  ) : (
                    <>
                      <div className="presence-online"></div>
                      <span>Active • Ready to help ALL participants</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Volume2 className="w-4 h-4 text-green-600" title="AI is active for this room - ALL participants can interact" />
              </div>
            </div>
            
            {/* AI Access Notice */}
            <div className="mt-3 bg-indigo-100 border border-indigo-200 rounded-lg p-3">
              <p className="text-xs text-indigo-800 font-medium">
                ✅ AI Access: ALL room participants can mention @AI for assistance
              </p>
              <p className="text-xs text-indigo-700 mt-1">
                The AI has shared context for the entire room conversation
              </p>
            </div>
          </div>
        )}

        {/* Muted AI Section */}
        {isAIMuted && (
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="avatar-lg bg-gray-400 shadow-gentle">
                <Bot className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">AI Assistant</span>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium border border-gray-300">
                    MUTED
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <div className="presence-offline"></div>
                  <span>Muted for this room</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <VolumeX className="w-4 h-4 text-gray-400" title="AI is muted for this room" />
              </div>
            </div>
          </div>
        )}

        {/* Online Users */}
        {onlineParticipants.length > 0 && (
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <div className="presence-online"></div>
              Online — {onlineParticipants.length}
            </h4>
            
            <div className="space-y-3">
              {onlineParticipants.map((participant) => {
                const isCurrentUserItem = participant.id === currentUser.id;
                
                return (
                  <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      <div
                        className="avatar-lg shadow-gentle"
                        style={{ backgroundColor: participant.color }}
                      >
                        {getInitials(participant.name)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${
                          isCurrentUserItem ? 'text-indigo-700' : 'text-gray-900'
                        }`}>
                          {participant.name}
                          {isCurrentUserItem && (
                            <span className="text-xs text-indigo-600 font-medium ml-1">(You)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Wifi className="w-3 h-3" />
                        <span>Active now • Can interact with AI</span>
                      </div>
                    </div>
                    
                    {isCurrentUserItem && (
                      <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium border border-indigo-200">
                        You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Offline Users */}
        {offlineParticipants.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <div className="presence-offline"></div>
              Offline — {offlineParticipants.length}
            </h4>
            
            <div className="space-y-3">
              {offlineParticipants.map((participant) => {
                const isCurrentUserItem = participant.id === currentUser.id;
                
                return (
                  <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg opacity-60 hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      <div
                        className="avatar-lg shadow-gentle"
                        style={{ backgroundColor: participant.color }}
                      >
                        {getInitials(participant.name)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-400 border-2 border-white rounded-full flex items-center justify-center">
                        <WifiOff className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${
                          isCurrentUserItem ? 'text-indigo-700' : 'text-gray-900'
                        }`}>
                          {participant.name}
                          {isCurrentUserItem && (
                            <span className="text-xs text-indigo-600 font-medium ml-1">(You)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatLastSeen(participant.lastSeen)}</span>
                      </div>
                    </div>
                    
                    {isCurrentUserItem && (
                      <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium border border-indigo-200">
                        You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Room Info */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Room Info</h4>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Total members:</span>
              <span className="font-medium">{participants.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Online now:</span>
              <span className="font-medium status-online">{onlineParticipants.length}</span>
            </div>
            <div className="flex justify-between">
              <span>AI Assistant:</span>
              <span className={`font-medium ${isAIMuted ? 'status-offline' : 'status-online'}`}>
                {isAIMuted ? 'Muted for room' : 'Active for ALL participants'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Real-time sync:</span>
              <span className="font-medium status-online">Connected</span>
            </div>
            <div className="flex justify-between">
              <span>AI Context:</span>
              <span className="font-medium status-online">Shared room memory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSidebar;