import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 max-w-xs shadow-subtle">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-indigo-700">AI is thinking</span>
        <div className="typing-dots">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;