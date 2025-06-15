import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Users, Loader2, ArrowLeft, Copy, Check, AlertCircle, Wifi, WifiOff, Volume2, VolumeX, Hash, FileText, Brain, Cpu } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { supabase } from '../lib/supabase';
import MentionDropdown from './MentionDropdown';
import { useMentions } from '../hooks/useMentions';
import TypingIndicator from './TypingIndicator';
import UserSidebar from './UserSidebar';
import SummaryPane from './SummaryPane';

const ChatRoom: React.FC = () => {
  const { currentUser, currentRoom, sendMessage, leaveRoom, isAIMuted, isAIResponding, toggleAIMute } = useChat();
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showUserSidebar, setShowUserSidebar] = useState(true);
  const [showSummaryPane, setShowSummaryPane] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    mentionState,
    detectMention,
    selectMention,
    navigateMentions,
    closeMentions,
    getSelectedOption
  } = useMentions({
    participants: currentRoom?.participants || [],
    isAIMuted
  });

  useEffect(() => {
    scrollToBottom();
  }, [currentRoom?.messages, isAIResponding]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 128; // 8 lines * 16px line height = 128px
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [newMessage]);

  // Monitor Supabase real-time connection status
  useEffect(() => {
    const checkConnection = () => {
      const channels = supabase.getChannels();
      const isConnected = channels.some(channel => channel.state === 'joined');
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    };

    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage('');
    setIsLoading(true);
    closeMentions();

    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    
    setNewMessage(value);
    setCursorPosition(cursor);
    
    if (textareaRef.current) {
      detectMention(value, cursor, textareaRef.current);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState.isOpen) {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigateMentions('up');
          return;
        case 'ArrowDown':
          e.preventDefault();
          navigateMentions('down');
          return;
        case 'Enter':
          e.preventDefault();
          const selectedOption = getSelectedOption();
          if (selectedOption) {
            handleMentionSelect(selectedOption);
          }
          return;
        case 'Escape':
          e.preventDefault();
          closeMentions();
          return;
        case 'Tab':
          e.preventDefault();
          const tabSelectedOption = getSelectedOption();
          if (tabSelectedOption) {
            handleMentionSelect(tabSelectedOption);
          }
          return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !mentionState.isOpen) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMentionSelect = (option: any) => {
    const result = selectMention(option, newMessage, cursorPosition);
    if (result && typeof result === 'object') {
      setNewMessage(result.newText);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const copyRoomLink = async () => {
    if (!currentRoom) return;
    const link = `${window.location.origin}?room=${currentRoom.id}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDateLabel = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    
    // Check if it's today
    if (messageDate.toDateString() === now.toDateString()) {
      return `Today at ${formatTime(messageDate)}`;
    }
    
    // Check if it's yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${formatTime(messageDate)}`;
    }
    
    // Check if it's within the last week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (messageDate > weekAgo) {
      const dayName = messageDate.toLocaleDateString([], { weekday: 'long' });
      return `${dayName} at ${formatTime(messageDate)}`;
    }
    
    // For older messages, show full date
    return messageDate.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }) + ` at ${formatTime(messageDate)}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // AI Booting Animation Component
  const AIBootingAnimation = () => (
    <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 shadow-gentle">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center shadow-gentle">
            <Brain className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center animate-bounce">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-indigo-800">ChatMind AI</span>
            <div className="typing-dots">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
          <div className="text-sm text-indigo-700">
            <span className="font-medium">AI is initializing...</span>
            <span className="ml-2 text-indigo-600">Preparing neural networks for intelligent assistance</span>
          </div>
          
          <div className="mt-2 bg-indigo-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full animate-pulse" style={{ width: '75%' }}></div>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <Cpu className="w-5 h-5 text-indigo-600 animate-spin" style={{ animationDuration: '2s' }} />
          <span className="text-xs text-indigo-600 font-medium">Loading</span>
        </div>
      </div>
    </div>
  );

  // Group messages by user and time proximity, with time labels
  const groupMessages = (messages: any[]) => {
    const groups: any[] = [];
    let currentGroup: any = null;

    messages.forEach((message, index) => {
      const prevMessage = messages[index - 1];
      const messageTime = new Date(message.timestamp);
      const prevMessageTime = prevMessage ? new Date(prevMessage.timestamp) : null;
      
      // Check if we need a time label
      const needsTimeLabel = !prevMessage || 
        (prevMessageTime && (messageTime.getTime() - prevMessageTime.getTime()) > 20 * 60 * 1000) || // 20 minutes gap
        (index > 0 && index % 10 === 0); // Every 10 messages

      // Check if messages should be grouped together
      const shouldGroup = prevMessage && 
        prevMessage.userId === message.userId && 
        prevMessage.isAI === message.isAI &&
        (messageTime.getTime() - (prevMessageTime?.getTime() || 0)) < 5 * 60 * 1000 && // 5 minutes
        !needsTimeLabel;

      // Add time label if needed
      if (needsTimeLabel) {
        groups.push({
          type: 'time-label',
          timestamp: messageTime,
          label: formatDateLabel(messageTime)
        });
      }

      if (shouldGroup && currentGroup && currentGroup.type === 'message-group') {
        currentGroup.messages.push(message);
      } else {
        currentGroup = {
          type: 'message-group',
          userId: message.userId,
          userName: message.userName,
          userColor: message.userColor,
          isAI: message.isAI,
          timestamp: message.timestamp,
          replyingTo: message.replyingTo,
          messages: [message]
        };
        groups.push(currentGroup);
      }
    });

    return groups;
  };

  if (!currentRoom || !currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessages(currentRoom.messages);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 bg-white shadow-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={leaveRoom}
                className="btn-ghost p-2"
                title="Leave room"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">{currentRoom.name}</h2>
                {connectionStatus === 'connected' ? (
                  <Wifi className="w-4 h-4 text-green-500" title="Connected" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" title="Disconnected" />
                )}
              </div>
              {connectionStatus !== 'connected' && (
                <div className="flex items-center gap-1 text-xs text-indigo-600">
                  <Brain className="w-3 h-3 animate-pulse" />
                  {connectionStatus === 'connecting' ? 'AI Reconnecting...' : 'AI Offline'}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* AI Toggle Button */}
              <button
                onClick={toggleAIMute}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 font-medium ${
                  isAIMuted 
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' 
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
                title={isAIMuted ? 'AI is muted for this room - click to activate' : 'AI is active for this room - click to mute'}
              >
                {isAIMuted ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span className="font-medium">AI Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span className="font-medium">🤖 AI Active</span>
                  </>
                )}
              </button>

              <button
                onClick={copyRoomLink}
                className="btn-ghost text-sm"
                title="Copy room link"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>

              {/* Summary Toggle */}
              <button
                onClick={() => setShowSummaryPane(!showSummaryPane)}
                className={`btn-ghost ${
                  showSummaryPane 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : ''
                }`}
                title="Toggle summary"
              >
                <FileText className="w-5 h-5" />
              </button>

              {/* User Sidebar Toggle */}
              <button
                onClick={() => setShowUserSidebar(!showUserSidebar)}
                className={`btn-ghost ${
                  showUserSidebar 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : ''
                }`}
                title="Toggle user list"
              >
                <Users className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* AI Status Banner */}
        {isAIMuted && currentRoom.settings.aiMutedByName && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-amber-600" />
                <p className="text-amber-800 text-sm font-medium">
                  AI is muted for this room by {currentRoom.settings.aiMutedByName}
                </p>
              </div>
              <button
                onClick={toggleAIMute}
                className="text-amber-700 hover:text-amber-900 text-sm font-medium underline"
              >
                Activate AI
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messageGroups.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gentle">
                <Hash className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to #{currentRoom.name}</h3>
              <p className="text-gray-600 max-w-md mx-auto mb-4">
                Start the conversation! Share your thoughts, ask questions, or mention @AI for assistance.
              </p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 max-w-md mx-auto shadow-subtle">
                <div className="flex items-start gap-2">
                  <Wifi className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div className="text-left">
                    <p className="text-indigo-800 text-sm font-medium">Real-time messaging is active</p>
                    <p className="text-indigo-700 text-sm mt-1">
                      Messages will appear instantly for all participants in this room.
                    </p>
                  </div>
                </div>
              </div>
              {!isAIMuted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto mt-4 shadow-subtle">
                  <div className="flex items-start gap-2">
                    <Bot className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-left">
                      <p className="text-green-800 text-sm font-medium">AI Assistant is active</p>
                      <p className="text-green-700 text-sm mt-1">
                        Type @ to see mention options, or mention @AI for intelligent assistance.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {messageGroups.map((group, groupIndex) => {
            if (group.type === 'time-label') {
              return (
                <div key={`time-${groupIndex}`} className="flex justify-center my-6">
                  <div className="bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1 rounded-full border shadow-subtle">
                    {group.label}
                  </div>
                </div>
              );
            }

            const isCurrentUser = group.userId === currentUser.id;
            const isAI = group.isAI;
            const isSystem = group.userId === 'system';

            return (
              <div key={`group-${groupIndex}`} className={`flex gap-3 group ${isCurrentUser && !isAI ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {isAI ? (
                    <div className="avatar-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-gentle">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  ) : isSystem ? (
                    <div className="avatar-lg bg-gray-400 shadow-gentle">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div
                      className="avatar-lg shadow-gentle"
                      style={{ backgroundColor: group.userColor }}
                    >
                      {getInitials(group.userName)}
                    </div>
                  )}
                </div>
                
                <div className={`flex-1 min-w-0 ${isCurrentUser && !isAI ? 'flex flex-col items-end' : ''}`}>
                  {/* User name and timestamp */}
                  <div className={`flex items-baseline gap-2 mb-2 ${isCurrentUser && !isAI ? 'flex-row-reverse' : ''}`}>
                    <span className={`font-medium text-sm ${
                      isAI ? 'text-indigo-700' : 
                      isSystem ? 'text-gray-600' :
                      isCurrentUser ? 'text-indigo-700' : 'text-gray-900'
                    }`}>
                      {group.userName}
                      {isCurrentUser && !isAI && (
                        <span className="text-xs text-indigo-600 font-medium ml-1">(You)</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(new Date(group.timestamp))}
                    </span>
                  </div>

                  {/* AI Reply Tag */}
                  {isAI && group.replyingTo && (
                    <div className={`mb-2 ${isCurrentUser && !isAI ? 'flex justify-end' : ''}`}>
                      <div className="flex items-center gap-2 text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">
                        <span className="font-medium">replying to @{group.replyingTo.userName}:</span>
                        <span className="text-indigo-600 italic">
                          "{group.replyingTo.content}"
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Messages in group */}
                  <div className={`space-y-1 ${isCurrentUser && !isAI ? 'flex flex-col items-end' : ''}`}>
                    {group.messages.map((message: any, messageIndex: number) => (
                      <div
                        key={message.id}
                        className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl ${
                          isAI 
                            ? 'chat-bubble-ai'
                            : isSystem
                            ? 'chat-bubble-system'
                            : isCurrentUser
                            ? 'bg-indigo-500 text-white rounded-2xl px-4 py-3 shadow-subtle'
                            : 'chat-bubble-user'
                        } ${
                          messageIndex === 0 
                            ? isCurrentUser && !isAI 
                              ? 'rounded-tr-md' 
                              : 'rounded-tl-md'
                            : ''
                        } ${
                          messageIndex === group.messages.length - 1
                            ? isCurrentUser && !isAI
                              ? 'rounded-br-md'
                              : 'rounded-bl-md'
                            : ''
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* AI Typing Indicator */}
          {isAIResponding && (
            <div className="flex gap-3">
              <div className="avatar-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-gentle">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-medium text-sm text-indigo-700">AI Assistant</span>
                </div>
                <TypingIndicator />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4 bg-white relative shadow-subtle">
          {connectionStatus !== 'connected' && (
            <AIBootingAnimation />
          )}
          
          {/* Mention Dropdown */}
          <MentionDropdown
            options={mentionState.options}
            selectedIndex={mentionState.selectedIndex}
            onSelect={handleMentionSelect}
            position={mentionState.position}
            visible={mentionState.isOpen}
          />
          
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                connectionStatus !== 'connected'
                  ? "AI is booting up... Please wait a moment"
                  : isAIMuted 
                  ? "Type a message... Type @ to mention users (AI is muted for this room)" 
                  : "Type a message... Type @ to mention users or AI"
              }
              className="flex-1 resize-none input-field min-h-[44px] max-h-32 overflow-y-auto calm-focus"
              rows={1}
              disabled={isLoading || connectionStatus !== 'connected'}
              style={{ lineHeight: '1.5' }}
            />
            
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isLoading || connectionStatus !== 'connected'}
              className="btn-primary h-[44px] w-[44px] flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            {connectionStatus !== 'connected' 
              ? "🤖 AI is initializing neural networks... Connection will be restored shortly"
              : `Press Enter to send • Shift+Enter for new line • Type @ to mention${!isAIMuted ? ' • @AI for assistance' : ' • AI is muted for this room'}`
            }
          </p>
        </div>
      </div>

      {/* User Sidebar */}
      {showUserSidebar && (
        <UserSidebar
          participants={currentRoom.participants}
          currentUser={currentUser}
          isAIMuted={isAIMuted}
          isAITyping={isAIResponding}
          onClose={() => setShowUserSidebar(false)}
        />
      )}

      {/* Summary Pane */}
      {showSummaryPane && (
        <SummaryPane
          onClose={() => setShowSummaryPane(false)}
        />
      )}
    </div>
  );
};

export default ChatRoom;