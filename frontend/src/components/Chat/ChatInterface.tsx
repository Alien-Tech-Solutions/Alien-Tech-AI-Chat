import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { Bot, Settings, Plus, StopCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { Message } from '../../types';
import Button from '../ui/Button';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ChatSidebar from './ChatSidebar';
import TypingIndicator from '../ui/TypingIndicator';
import useStreamingResponse from '../../hooks/useStreamingResponse';

// Simple toast function for error handling
const toast = ({ title, description }: { 
  title: string; 
  description: string; 
}) => {
  console.error(`${title}: ${description}`);
  alert(`${title}: ${description}`);
};

const ChatInterface: React.FC = () => {
  const location = useLocation();
  const {
    currentSession,
    messages,
    setCurrentSession,
    addMessage,
    sidebarOpen,
    setSidebarOpen,
    updateAssistantMessage,
    loadSessionMessages,
  } = useAppStore();

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Handle pre-filled message from companion dashboard
  useEffect(() => {
    const state = location.state as { prefilledMessage?: string; companionMode?: boolean } | null;
    if (state?.prefilledMessage && inputValue === '') {
      setInputValue(state.prefilledMessage);
      // Clear the state to avoid re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Streaming response hook
  const {
    isStreaming,
    streamContent,
    stopStreaming,
    cleanup
  } = useStreamingResponse({
    onChunkReceived: (chunk) => {
      if (chunk.type === 'content' && chunk.content && currentAssistantMessageId) {
        // Update the assistant message in real-time
        updateAssistantMessage(currentAssistantMessageId, streamContent + (chunk.content || ''));
      }
    },
    onComplete: (fullResponse, metadata) => {
      console.log('Streaming completed:', { fullResponse, metadata });
      setIsLoading(false);
      setCurrentAssistantMessageId(null);
    },
    onError: (error) => {
      console.error('Streaming error:', error);
      setIsLoading(false);
      setCurrentAssistantMessageId(null);
    }
  });

  // Cleanup streaming on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const messageText = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Ensure we have a session
      const sessionId = currentSession?.id || 'default';

      // Create user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: messageText,
        timestamp: new Date().toISOString(),
      };

      addMessage(userMessage);

      // Create placeholder assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };

      addMessage(assistantMessage);
      setCurrentAssistantMessageId(assistantMessage.id);

      // Use the API service for streaming (FIXED)
      let accumulatedContent = '';
      await api.streamMessage(
        messageText,
        sessionId,
        (chunk) => {
          if (chunk.type === 'content' && chunk.content) {
            // Accumulate content and update the message
            accumulatedContent += chunk.content;
            updateAssistantMessage(assistantMessage.id, accumulatedContent);
          }
        }
      );

      setIsLoading(false);
      setCurrentAssistantMessageId(null);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again."
      });
      setIsLoading(false);
      setCurrentAssistantMessageId(null);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Create new session
  const handleNewSession = async () => {
    const sessionName = `Chat ${Date.now()}`;
    try {
      const res = await api.createSession(sessionName);
      if (res.data) {
        setCurrentSession(res.data);
      }
    } catch (err) {
      console.error('Failed to create session', err);
    }
  };

  return (
    <div className="flex h-screen bg-base-100">
      {/* Sidebar */}
      <ChatSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-base-200">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {currentSession?.name || 'New Chat'}
              </h1>
              <p className="text-sm text-base-content/60">
                {messages.length} messages
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewSession}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-16 w-16 text-base-content/40 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Lackadaisical AI Chat</h2>
              <p className="text-base-content/60 max-w-md">
                Start a conversation with your AI companion. I'm here to chat, help, and learn with you.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          
          {isStreaming && (
            <div className="flex items-center justify-between space-x-2 p-4 bg-base-100 rounded-lg border border-base-300">
              <TypingIndicator 
                variant="processing" 
                isVisible={isStreaming}
                text="AI is generating response..."
              />
              <Button
                onClick={stopStreaming}
                variant="outline"
                size="sm"
                className="text-error hover:bg-error hover:text-error-content"
              >
                <StopCircle className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-base-300 bg-base-200">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            onKeyPress={handleKeyPress}
            disabled={isLoading || isStreaming}
            placeholder="Type your message..."
          />
        </div>
      </div>
    </div>
  );
};

export default ChatInterface; 