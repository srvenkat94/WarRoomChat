import { useState, useEffect, useCallback } from 'react';

interface MentionOption {
  id: string;
  name: string;
  type: 'user' | 'ai';
  color?: string;
}

interface UseMentionsProps {
  participants: Array<{ id: string; name: string; color: string }>;
  isAIMuted: boolean;
}

interface MentionState {
  isOpen: boolean;
  query: string;
  options: MentionOption[];
  selectedIndex: number;
  position: { top: number; left: number };
  mentionStart: number;
}

export const useMentions = ({ participants, isAIMuted }: UseMentionsProps) => {
  const [mentionState, setMentionState] = useState<MentionState>({
    isOpen: false,
    query: '',
    options: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 },
    mentionStart: -1
  });

  const getAllMentionOptions = useCallback((): MentionOption[] => {
    const options: MentionOption[] = [];
    
    // Add AI option if not muted
    if (!isAIMuted) {
      options.push({
        id: 'ai',
        name: 'AI Assistant',
        type: 'ai'
      });
    }
    
    // Add participants (exclude current user to avoid self-mentions)
    participants.forEach(participant => {
      options.push({
        id: participant.id,
        name: participant.name,
        type: 'user',
        color: participant.color
      });
    });
    
    return options;
  }, [participants, isAIMuted]);

  const filterOptions = useCallback((query: string): MentionOption[] => {
    const allOptions = getAllMentionOptions();
    
    if (!query.trim()) return allOptions;
    
    const lowerQuery = query.toLowerCase().trim();
    return allOptions.filter(option => {
      const name = option.name.toLowerCase();
      const nameNoSpaces = name.replace(/\s+/g, '');
      
      return name.includes(lowerQuery) || 
             nameNoSpaces.includes(lowerQuery) ||
             name.startsWith(lowerQuery) ||
             nameNoSpaces.startsWith(lowerQuery);
    });
  }, [getAllMentionOptions]);

  const detectMention = useCallback((
    text: string, 
    cursorPosition: number,
    textareaElement: HTMLTextAreaElement
  ) => {
    // Find the last @ before cursor position
    let mentionStart = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      if (text[i] === '@') {
        // Check if this @ is at the start or preceded by whitespace
        if (i === 0 || /\s/.test(text[i - 1])) {
          mentionStart = i;
          break;
        }
      } else if (/\s/.test(text[i])) {
        // Hit whitespace before finding @, no mention
        break;
      }
    }

    if (mentionStart === -1) {
      setMentionState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    // Extract the query after @
    const query = text.slice(mentionStart + 1, cursorPosition);
    
    // Don't show dropdown if query contains spaces (invalid mention)
    if (query.includes(' ')) {
      setMentionState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    const filteredOptions = filterOptions(query);

    // Calculate position for dropdown - always above the textarea
    const position = calculateDropdownPosition(textareaElement);

    setMentionState({
      isOpen: true,
      query,
      options: filteredOptions,
      selectedIndex: 0,
      position,
      mentionStart
    });
  }, [filterOptions]);

  const calculateDropdownPosition = (textareaElement: HTMLTextAreaElement) => {
    const rect = textareaElement.getBoundingClientRect();
    const style = window.getComputedStyle(textareaElement);
    const paddingLeft = parseInt(style.paddingLeft) || 0;
    
    // Position dropdown above the textarea
    // Add some spacing (8px) between dropdown and textarea
    const dropdownHeight = 200; // Approximate max height of dropdown
    const spacing = 8;
    
    return {
      top: rect.top - dropdownHeight - spacing,
      left: Math.max(16, Math.min(rect.left + paddingLeft, window.innerWidth - 250)) // Ensure it stays within viewport
    };
  };

  const selectMention = useCallback((option: MentionOption, text: string, cursorPosition: number) => {
    if (mentionState.mentionStart === -1) return text;

    // Create mention text based on option type
    let mentionText: string;
    if (option.type === 'ai') {
      mentionText = '@AI ';
    } else {
      // For users, use a clean version of their name
      const cleanName = option.name.toLowerCase().replace(/\s+/g, '');
      mentionText = `@${cleanName} `;
    }
    
    const beforeMention = text.slice(0, mentionState.mentionStart);
    const afterCursor = text.slice(cursorPosition);
    
    const newText = beforeMention + mentionText + afterCursor;
    const newCursorPosition = mentionState.mentionStart + mentionText.length;

    setMentionState(prev => ({ ...prev, isOpen: false }));
    
    return { newText, newCursorPosition };
  }, [mentionState.mentionStart]);

  const navigateMentions = useCallback((direction: 'up' | 'down') => {
    setMentionState(prev => {
      if (!prev.isOpen || prev.options.length === 0) return prev;
      
      let newIndex;
      if (direction === 'up') {
        newIndex = prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.options.length - 1;
      } else {
        newIndex = prev.selectedIndex < prev.options.length - 1 ? prev.selectedIndex + 1 : 0;
      }
      
      return { ...prev, selectedIndex: newIndex };
    });
  }, []);

  const closeMentions = useCallback(() => {
    setMentionState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const getSelectedOption = useCallback(() => {
    if (!mentionState.isOpen || mentionState.options.length === 0) return null;
    return mentionState.options[mentionState.selectedIndex];
  }, [mentionState]);

  // Close mentions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (mentionState.isOpen) {
        closeMentions();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mentionState.isOpen, closeMentions]);

  return {
    mentionState,
    detectMention,
    selectMention,
    navigateMentions,
    closeMentions,
    getSelectedOption
  };
};