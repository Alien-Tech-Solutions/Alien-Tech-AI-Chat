import React from 'react';
import { Heart, MessageSquare, Sparkles } from 'lucide-react';

interface CompanionModeToggleProps {
  isCompanionMode: boolean;
  onToggle: (mode: boolean) => void;
  className?: string;
}

const CompanionModeToggle: React.FC<CompanionModeToggleProps> = ({
  isCompanionMode,
  onToggle,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Mode:
      </span>
      
      <div className="relative flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {/* Chat Mode Button */}
        <button
          onClick={() => onToggle(false)}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            !isCompanionMode
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>

        {/* Companion Mode Button */}
        <button
          onClick={() => onToggle(true)}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            isCompanionMode
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Companion</span>
          {isCompanionMode && (
            <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
          )}
        </button>
      </div>

      {/* Mode Description */}
      <div className="hidden md:block">
        {isCompanionMode ? (
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
            <Heart className="w-3 h-3" />
            <span>Empathetic companion mode active</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-3 h-3" />
            <span>Standard chat mode</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanionModeToggle;
