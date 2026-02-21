import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Tag, 
  Edit3, 
  Trash2, 
  Download, 
  Eye, 
  EyeOff,
  BookOpen,
  Clock,
  TrendingUp,
  FileText,
  Download as DownloadIcon,
  BarChart3
} from 'lucide-react';
import { useAppStore } from '../../store';
import { JournalEntry } from '../../types';
import Button from '../ui/Button';
import api from '../../services/api';

const JournalInterface: React.FC = () => {
  const {
    journalEntries,
    currentJournalEntry,
    setJournalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    setCurrentJournalEntry,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'mood'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    mood: '',
    privacy_level: 'private' as 'private' | 'shared' | 'public',
  });
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Load journal entries on mount
  useEffect(() => {
    loadJournalEntries();
    loadAnalytics();
  }, []);

  const loadJournalEntries = async () => {
    try {
      const response = await api.getJournalEntries({
        search: searchTerm || undefined,
        mood: selectedMood || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sortBy,
        sortOrder,
      });
      if (response.success && response.data) {
        setJournalEntries(response.data);
      }
    } catch (error) {
      console.error('Failed to load journal entries:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await api.getJournalAnalytics();
      if (response.success && response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleCreateEntry = () => {
    setEditingEntry(null);
    setFormData({
      title: '',
      content: '',
      tags: [],
      mood: '',
      privacy_level: 'private',
    });
    setShowEditor(true);
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      mood: entry.mood,
      privacy_level: entry.privacy_level,
    });
    setShowEditor(true);
  };

  const handleSaveEntry = async () => {
    try {
      if (editingEntry) {
        const response = await api.updateJournalEntry(editingEntry.id, formData);
        if (response.success && response.data) {
          updateJournalEntry(editingEntry.id, formData);
        }
      } else {
        const response = await api.createJournalEntry({
          ...formData,
          session_id: 'default',
        });
        if (response.success && response.data) {
          addJournalEntry(response.data);
        }
      }
      setShowEditor(false);
      setEditingEntry(null);
      loadJournalEntries();
    } catch (error) {
      console.error('Failed to save journal entry:', error);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await api.deleteJournalEntry(entryId);
      deleteJournalEntry(entryId);
      loadJournalEntries();
    } catch (error) {
      console.error('Failed to delete journal entry:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv' | 'txt' | 'markdown') => {
    try {
      const blob = await api.exportJournal(format, {
        dateRange: { from: '', to: '' }, // Add date range if needed
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `journal-export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export journal:', error);
    }
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim();
      if (!formData.tags.includes(newTag)) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, newTag],
        }));
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const filteredEntries = journalEntries.filter(entry =>
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableTags = Array.from(new Set(journalEntries.flatMap(entry => entry.tags)));
  const availableMoods = Array.from(new Set(journalEntries.map(entry => entry.mood)));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-base-300">
        <div>
          <h1 className="text-2xl font-bold">Journal</h1>
          <p className="text-base-content/60">Reflect on your thoughts and experiences</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            title="Toggle analytics"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateEntry}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && analytics && (
        <div className="p-4 bg-base-200 border-b border-base-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold">Total Entries</span>
              </div>
              <p className="text-2xl font-bold">{analytics.totalEntries || 0}</p>
            </div>
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-secondary" />
                <span className="font-semibold">This Month</span>
              </div>
              <p className="text-2xl font-bold">{analytics.entriesThisMonth || 0}</p>
            </div>
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                <span className="font-semibold">Avg. Words</span>
              </div>
              <p className="text-2xl font-bold">{analytics.averageWordsPerEntry || 0}</p>
            </div>
            <div className="bg-base-100 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-success" />
                <span className="font-semibold">Unique Tags</span>
              </div>
              <p className="text-2xl font-bold">{analytics.uniqueTags || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="p-4 border-b border-base-300 bg-base-200">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/50" />
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Moods</option>
              {availableMoods.map(mood => (
                <option key={mood} value={mood}>{mood}</option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'title' | 'mood')}
              className="px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="mood">Sort by Mood</option>
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title="Toggle sort order"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Entries List */}
        <div className="w-1/2 border-r border-base-300 overflow-y-auto">
          <div className="p-4">
            {filteredEntries.length === 0 ? (
              <div className="text-center text-base-content/60 py-8">
                {searchTerm ? 'No entries found' : 'No journal entries yet'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      currentJournalEntry?.id === entry.id
                        ? 'bg-primary text-primary-content border-primary'
                        : 'bg-base-100 border-base-300 hover:bg-base-200'
                    }`}
                    onClick={() => setCurrentJournalEntry(entry)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-2">{entry.title}</h3>
                        <p className="text-sm opacity-70 line-clamp-2 mb-2">
                          {entry.content}
                        </p>
                        <div className="flex items-center space-x-4 text-xs opacity-60">
                          <span>{formatDate(entry.created_at)}</span>
                          <span>•</span>
                          <span>{entry.word_count} words</span>
                          <span>•</span>
                          <span>{entry.reading_time_minutes} min read</span>
                        </div>
                        {entry.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {entry.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-base-300 rounded-full text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span className="px-2 py-1 bg-base-300 rounded-full text-xs">
                                +{entry.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEntry(entry);
                          }}
                          className="w-6 h-6 p-0"
                          title="Edit entry"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(entry.id);
                          }}
                          className="w-6 h-6 p-0 text-error"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Entry Detail */}
        <div className="w-1/2 p-4 overflow-y-auto">
          {currentJournalEntry ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{currentJournalEntry.title}</h2>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditEntry(currentJournalEntry)}
                    title="Edit entry"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteEntry(currentJournalEntry.id)}
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
              
              <div className="mb-4 text-sm text-base-content/60">
                <span>{formatDate(currentJournalEntry.created_at)}</span>
                <span className="mx-2">•</span>
                <span>{currentJournalEntry.word_count} words</span>
                <span className="mx-2">•</span>
                <span>{currentJournalEntry.reading_time_minutes} min read</span>
              </div>
              
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/20 text-primary">
                  {currentJournalEntry.mood}
                </span>
              </div>
              
              {currentJournalEntry.tags.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {currentJournalEntry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-base-300 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap">{currentJournalEntry.content}</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-base-content/60 py-8">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p>Select an entry to view its details</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-base-300">
              <h2 className="text-xl font-bold">
                {editingEntry ? 'Edit Entry' : 'New Entry'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Entry title..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-32"
                  placeholder="Write your thoughts..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Mood</label>
                <select
                  value={formData.mood}
                  onChange={(e) => setFormData(prev => ({ ...prev, mood: e.target.value }))}
                  className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select mood...</option>
                  <option value="Happy">Happy</option>
                  <option value="Sad">Sad</option>
                  <option value="Excited">Excited</option>
                  <option value="Calm">Calm</option>
                  <option value="Anxious">Anxious</option>
                  <option value="Grateful">Grateful</option>
                  <option value="Frustrated">Frustrated</option>
                  <option value="Inspired">Inspired</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <input
                  type="text"
                  onKeyDown={handleTagInput}
                  className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Press Enter to add tags..."
                />
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm flex items-center space-x-1"
                      >
                        <span>{tag}</span>
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-primary/70"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Privacy</label>
                <select
                  value={formData.privacy_level}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    privacy_level: e.target.value as 'private' | 'shared' | 'public' 
                  }))}
                  className="w-full px-3 py-2 bg-base-100 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="private">Private</option>
                  <option value="shared">Shared</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 border-t border-base-300 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleExport('json')}
                  title="Export as JSON"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExport('markdown')}
                  title="Export as Markdown"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export MD
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowEditor(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveEntry}
                  disabled={!formData.title.trim() || !formData.content.trim()}
                >
                  {editingEntry ? 'Update' : 'Create'} Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalInterface; 