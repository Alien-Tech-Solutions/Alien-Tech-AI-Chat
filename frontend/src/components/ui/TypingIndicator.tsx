import React from 'react';
import { Loader2, Brain } from 'lucide-react';

interface TypingIndicatorProps {
  isVisible: boolean;
  text?: string;
  variant?: 'default' | 'thinking' | 'processing';
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isVisible, 
  text = 'AI is thinking...', 
  variant = 'default',
  className = ''
}) => {
  if (!isVisible) return null;

  const getIcon = () => {
    switch (variant) {
      case 'thinking':
        return <Brain className="w-4 h-4 animate-pulse" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  const getIndicatorDots = () => (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0ms]"></div>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:150ms]"></div>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:300ms]"></div>
    </div>
  );

  return (
    <div className={`flex items-center space-x-3 p-4 rounded-lg bg-base-100 border border-base-300 shadow-sm ${className}`}>
      <div className="flex items-center space-x-2 text-base-content/60">
        {getIcon()}
        <span className="text-sm font-medium">{text}</span>
      </div>
      {getIndicatorDots()}
    </div>
  );
};

export default TypingIndicator;
