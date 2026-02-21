import React, { useState } from 'react';
import { Heart, BookOpen, Brain, Target, Coffee, Sparkles, Clock, HelpCircle } from 'lucide-react';

interface CompanionCommand {
  command: string;
  description: string;
  icon: React.ReactNode;
  category: 'wellness' | 'reflection' | 'memory' | 'goals';
  examples?: string[];
}

interface CompanionCommandPanelProps {
  onCommandSelect: (command: string) => void;
  isVisible: boolean;
  onClose: () => void;
}

const companionCommands: CompanionCommand[] = [
  {
    command: '/checkin',
    description: 'Daily emotional check-in and mood tracking',
    icon: <Heart className="w-4 h-4" />,
    category: 'wellness',
    examples: ['How are you feeling today?', 'Let me know about your mood']
  },
  {
    command: '/journal',
    description: 'Create a reflective journal entry',
    icon: <BookOpen className="w-4 h-4" />,
    category: 'reflection',
    examples: ['/journal Today was amazing!', '/journal Reflecting on my growth']
  },
  {
    command: '/reflect',
    description: 'Start a guided reflection session',
    icon: <Brain className="w-4 h-4" />,
    category: 'reflection',
    examples: ['Deep thinking and self-awareness', 'Guided introspection']
  },
  {
    command: '/goals',
    description: 'Set and track personal goals',
    icon: <Target className="w-4 h-4" />,
    category: 'goals',
    examples: ['/goals Learn guitar', '/goals Complete project']
  },
  {
    command: '/gratitude',
    description: 'Practice gratitude and positive thinking',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'wellness',
    examples: ['Count your blessings', 'Appreciate the good things']
  },
  {
    command: '/memory',
    description: 'Explore past conversations and memories',
    icon: <Clock className="w-4 h-4" />,
    category: 'memory',
    examples: ['Remember our talks', 'Recall important moments']
  },
  {
    command: '/mood',
    description: 'Track and understand your emotions',
    icon: <Coffee className="w-4 h-4" />,
    category: 'wellness',
    examples: ['Emotional awareness', 'Mood monitoring']
  },
  {
    command: '/nostalgia',
    description: 'Explore pleasant memories and experiences',
    icon: <Sparkles className="w-4 h-4" />,
    category: 'memory',
    examples: ['Happy memories', 'Comfort and joy']
  }
];

const CompanionCommandPanel: React.FC<CompanionCommandPanelProps> = ({
  onCommandSelect,
  isVisible,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!isVisible) return null;

  const categories = {
    wellness: { name: 'Wellness', color: 'bg-green-100 text-green-800' },
    reflection: { name: 'Reflection', color: 'bg-blue-100 text-blue-800' },
    memory: { name: 'Memory', color: 'bg-purple-100 text-purple-800' },
    goals: { name: 'Goals', color: 'bg-orange-100 text-orange-800' }
  };

  const filteredCommands = selectedCategory 
    ? companionCommands.filter(cmd => cmd.category === selectedCategory)
    : companionCommands;

  return (
    <div className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Companion Commands
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ×
        </button>
      </div>

      {/* Category Filter */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {Object.entries(categories).map(([key, { name, color }]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === key
                  ? 'bg-blue-500 text-white'
                  : `${color} hover:opacity-80`
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Commands List */}
      <div className="p-2">
        {filteredCommands.map((cmd) => (
          <button
            key={cmd.command}
            onClick={() => {
              onCommandSelect(cmd.command);
              onClose();
            }}
            className="w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                {cmd.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                    {cmd.command}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categories[cmd.category].color}`}>
                    {categories[cmd.category].name}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {cmd.description}
                </p>
                {cmd.examples && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {cmd.examples.map((example, idx) => (
                      <span key={idx}>
                        {example}
                        {idx < cmd.examples!.length - 1 && ' • '}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Type <span className="font-mono">/help</span> for more information or click any command above
        </p>
      </div>
    </div>
  );
};

export default CompanionCommandPanel;
