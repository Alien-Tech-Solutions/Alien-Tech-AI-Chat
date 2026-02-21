import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Brain, 
  Clock, 
  Search,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '../../store';
import Button from '../ui/Button';
import api from '../../services/api';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onToggle }) => {
  const {
    currentSession,
    sessions,
    contextWindow,
    contextLoading,
    contextError,
    memoryStats,
    memoryStatsLoading,
    setCurrentSession,
    addSession,
    deleteSession,
    updateSession,
    fetchContext,
    clearContext,
    fetchMemoryStats,
    clearMemoryStats,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [memorySearchTerm, setMemorySearchTerm] = useState('');
  const [memorySearchResults, setMemorySearchResults] = useState<any[]>([]);
  const [memorySearchLoading, setMemorySearchLoading] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load context when session changes
  useEffect(() => {
    if (currentSession && showContext) {
      fetchContext(currentSession.id);
    }
  }, [currentSession, showContext]);

  // Load memory stats when session changes
  useEffect(() => {
    if (currentSession) {
      fetchMemoryStats(currentSession.id);
    } else {
      clearMemoryStats();
    }
  }, [currentSession]);

  const loadSessions = async () => {
    try {
      const response = await api.getSessions();
      if (response.success && response.data) {
        response.data.forEach(session => {
          addSession(session);
        });
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleCreateSession = async () => {
    const sessionName = `Chat ${new Date().toLocaleString()}`;
    try {
      const response = await api.createSession(sessionName);
      if (response.success && response.data) {
        addSession(response.data);
        setCurrentSession(response.data);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      deleteSession(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleUpdateSession = async (sessionId: string, name: string) => {
    try {
      const response = await api.updateSession(sessionId, { name });
      if (response.success && response.data) {
        updateSession(sessionId, { name });
        setEditingSession(null);
        setEditName('');
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  const handleClearContext = async () => {
    if (currentSession) {
      try {
        await clearContext(currentSession.id);
      } catch (error) {
        console.error('Failed to clear context:', error);
      }
    }
  };

  const handleMemorySearch = async () => {
    if (!currentSession || !memorySearchTerm.trim()) return;
    
    setMemorySearchLoading(true);
    try {
      // For now, we'll use a simple context search
      // In a real implementation, this would search through archived memories
      const response = await api.getSessionContext(currentSession.id);
      if (response.data) {
        const results = response.data.filter((item: any) => 
          JSON.stringify(item).toLowerCase().includes(memorySearchTerm.toLowerCase())
        );
        setMemorySearchResults(results);
      }
    } catch (error) {
      console.error('Failed to search memories:', error);
      setMemorySearchResults([]);
    } finally {
      setMemorySearchLoading(false);
    }
  };

  const filteredSessions = (sessions || []).filter(session =>
    session.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-base-200 border-r border-base-300
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h2 className="text-lg font-semibold">Chat Sessions</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSessions}
              title="Refresh sessions"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="lg:hidden"
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-base-300">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/50" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Context Toggle */}
        <div className="p-4 border-b border-base-300">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowContext(!showContext)}
            className="w-full justify-start"
            title="Toggle context panel"
          >
            <Brain className="w-4 h-4 mr-2" />
            {showContext ? 'Hide' : 'Show'} Context
          </Button>
        </div>

        {/* Memory Stats Panel */}
        {currentSession && (
          <div className="p-4 border-b border-base-300 bg-base-50">
            <h3 className="text-sm font-medium mb-3 flex items-center">
              <Brain className="w-4 h-4 mr-2" />
              Memory Statistics
            </h3>
            
            {memoryStatsLoading ? (
              <div className="flex items-center text-sm text-base-content/60">
                <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                Loading stats...
              </div>
            ) : memoryStats ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/70">Active Messages:</span>
                  <span className="font-medium">{memoryStats.activeMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/70">Archived Messages:</span>
                  <span className="font-medium">{memoryStats.archivedMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/70">Total Context:</span>
                  <span className="font-medium">{memoryStats.totalContext}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/70">Avg Sentiment:</span>
                  <span className="font-medium">
                    {memoryStats.averageSentiment.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-base-content/60">
                No memory stats available
              </div>
            )}
          </div>
        )}

        {/* Context Panel */}
        {showContext && currentSession && (
          <div className="p-4 border-b border-base-300 bg-base-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Session Context</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearContext}
                disabled={contextLoading}
                title="Clear context"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            
            {contextLoading ? (
              <div className="text-sm text-base-content/60">Loading context...</div>
            ) : contextError ? (
              <div className="text-sm text-error">{contextError}</div>
            ) : contextWindow && contextWindow.length > 0 ? (
              <div className="text-sm text-base-content/70 max-h-32 overflow-y-auto">
                {contextWindow.map((item: any, index: number) => (
                  <div key={index} className="mb-1 p-2 bg-base-200 rounded text-xs">
                    {typeof item === 'string' ? item : JSON.stringify(item)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-base-content/60">No context available</div>
            )}
          </div>
        )}

        {/* Memory Recall Interface */}
        {currentSession && (
          <div className="p-4 border-b border-base-300 bg-base-50">
            <h3 className="text-sm font-medium mb-3 flex items-center">
              <Search className="w-4 h-4 mr-2" />
              Memory Recall
            </h3>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search memories..."
                  value={memorySearchTerm}
                  onChange={(e) => setMemorySearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleMemorySearch()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMemorySearch}
                  disabled={memorySearchLoading || !memorySearchTerm.trim()}
                  className="px-3"
                >
                  {memorySearchLoading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Search className="w-3 h-3" />
                  )}
                </Button>
              </div>
              
              {memorySearchResults.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {memorySearchResults.slice(0, 3).map((result, index) => (
                    <div key={index} className="p-2 bg-base-200 rounded text-xs">
                      {typeof result === 'string' ? result.slice(0, 100) + '...' : 
                       JSON.stringify(result).slice(0, 100) + '...'}
                    </div>
                  ))}
                  {memorySearchResults.length > 3 && (
                    <div className="text-xs text-base-content/60 text-center">
                      +{memorySearchResults.length - 3} more results
                    </div>
                  )}
                </div>
              )}
              
              {memorySearchTerm && memorySearchResults.length === 0 && !memorySearchLoading && (
                <div className="text-xs text-base-content/60">No memories found</div>
              )}
            </div>
          </div>
        )}

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateSession}
              className="w-full mb-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>

            {filteredSessions.length === 0 ? (
              <div className="text-center text-base-content/60 py-8">
                {searchTerm ? 'No sessions found' : 'No sessions yet'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`
                      group relative p-3 rounded-lg cursor-pointer transition-colors
                      ${currentSession?.id === session.id 
                        ? 'bg-primary text-primary-content' 
                        : 'bg-base-100 hover:bg-base-300'
                      }
                    `}
                    onClick={() => setCurrentSession(session)}
                  >
                    {/* Session Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                                                 {editingSession === session.id ? (
                           <input
                             type="text"
                             value={editName}
                             onChange={(e) => setEditName(e.target.value)}
                             onKeyDown={(e) => {
                               if (e.key === 'Enter') {
                                 handleUpdateSession(session.id, editName);
                               } else if (e.key === 'Escape') {
                                 setEditingSession(null);
                                 setEditName('');
                               }
                             }}
                             onBlur={() => {
                               setEditingSession(null);
                               setEditName('');
                             }}
                             className="w-full bg-transparent border-none outline-none text-sm"
                             placeholder="Enter session name"
                             aria-label="Edit session name"
                             autoFocus
                           />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">
                              {session.name}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2 mt-1 text-xs opacity-70">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(session.updatedAt)}</span>
                          <span>•</span>
                          <span>{session.messageCount} messages</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center space-x-1">
                                                     <Button
                             variant="ghost"
                             size="sm"
                             onClick={(e?: React.MouseEvent) => {
                               e?.stopPropagation();
                               setEditingSession(session.id);
                               setEditName(session.name);
                             }}
                             className="w-6 h-6 p-0"
                             title="Edit session name"
                           >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e?: React.MouseEvent) => {
                              e?.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="w-6 h-6 p-0 text-error"
                            title="Delete session"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatSidebar; 