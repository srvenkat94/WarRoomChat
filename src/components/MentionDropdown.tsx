import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';

interface MentionOption {
  id: string;
  name: string;
  type: 'user' | 'ai';
  color?: string;
}

interface MentionDropdownProps {
  options: MentionOption[];
  selectedIndex: number;
  onSelect: (option: MentionOption) => void;
  position: { top: number; left: number };
  visible: boolean;
}

const MentionDropdown: React.FC<MentionDropdownProps> = ({
  options,
  selectedIndex,
  onSelect,
  position,
  visible
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (visible && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex + 1] as HTMLElement; // +1 for header
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex, visible]);

  if (!visible || options.length === 0) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getMentionText = (option: MentionOption) => {
    if (option.type === 'ai') {
      return 'AI';
    }
    return option.name.toLowerCase().replace(/\s+/g, '');
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 card py-1 min-w-48 max-w-64 max-h-48 overflow-y-auto scrollbar-thin"
      style={{
        top: Math.max(16, position.top), // Ensure it doesn't go above viewport
        left: position.left,
      }}
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100 bg-gray-50">
        People & AI
      </div>
      
      {options.map((option, index) => (
        <button
          key={option.id}
          onClick={() => onSelect(option)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
            index === selectedIndex ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
          }`}
        >
          {option.type === 'ai' ? (
            <div className="avatar bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-gentle">
              <Bot className="w-4 h-4 text-white" />
            </div>
          ) : (
            <div
              className="avatar shadow-gentle"
              style={{ backgroundColor: option.color || '#6B7280' }}
            >
              {getInitials(option.name)}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">
                {option.name}
              </span>
              {option.type === 'ai' && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium border border-indigo-200">
                  AI
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              @{getMentionText(option)}
            </div>
          </div>
        </button>
      ))}
      
      {options.length === 0 && (
        <div className="px-3 py-2 text-sm text-gray-500 text-center">
          No matches found
        </div>
      )}
      
      <div className="px-3 py-1 text-xs text-gray-400 border-t border-gray-100 mt-1 bg-gray-50">
        ↑↓ navigate • Enter/Tab select • Esc cancel
      </div>
    </div>
  );
};

export default MentionDropdown;