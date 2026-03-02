/**
 * ThinkingPanel – a dedicated side panel that shows chain-of-thought reasoning
 * in a separate window alongside the chat messages.
 */
import React, { useEffect, useRef } from 'react';
import { Brain, X, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';

interface ThinkingPanelProps {
  /** Whether the panel is open/visible */
  isOpen: boolean;
  /** Callback to close/hide the panel */
  onClose: () => void;
  /** Accumulated thinking content (may still be growing while streaming) */
  thinkingContent: string;
  /** True while the AI is actively generating thinking tokens */
  isStreaming: boolean;
}

const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
  isOpen,
  onClose,
  thinkingContent,
  isStreaming,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while new thinking content is arriving
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinkingContent, isStreaming]);

  if (!isOpen) return null;

  return (
    <div
      className="w-80 flex-shrink-0 flex flex-col border-l border-base-300 bg-base-100"
      role="complementary"
      aria-label="Chain of thought panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-purple-400">
          <Brain className="w-4 h-4" />
          <span>Chain of Thought</span>
          {isStreaming && (
            <span className="flex gap-0.5 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-7 h-7 p-0"
          title="Close thinking panel"
          aria-label="Close chain-of-thought panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 text-xs text-purple-200/80 whitespace-pre-wrap leading-relaxed"
        role="region"
        aria-label="Chain of thought reasoning"
        aria-live="polite"
        aria-atomic="false"
      >
        {thinkingContent ? (
          thinkingContent
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-base-content/30">
            <ChevronRight className="w-6 h-6" />
            <p className="text-center">
              Reasoning steps will appear here when a thinking-capable model generates a response.
            </p>
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="px-4 py-2 border-t border-base-300 text-xs text-base-content/40">
        {isStreaming ? 'Reasoning in progress…' : thinkingContent ? 'Reasoning complete' : 'Waiting for response'}
      </div>
    </div>
  );
};

export default ThinkingPanel;
