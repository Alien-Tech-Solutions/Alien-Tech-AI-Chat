import React, { useState, useEffect } from 'react';
import { Heart, Brain, BookOpen, Target, Coffee, Sparkles, Clock, TrendingUp, Calendar, Zap } from 'lucide-react';
import Button from '../ui/Button';
import { useQuery } from 'react-query';

interface MoodData {
  date: string;
  mood: number;
  sentiment: number;
}

interface CompanionStats {
  totalSessions: number;
  journalEntries: number;
  goalsSet: number;
  gratitudePractices: number;
  averageMood: number;
  streakDays: number;
}

interface CompanionCommand {
  id: string;
  command: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'wellness' | 'reflection' | 'memory' | 'goals';
  color: string;
  shortcut?: string;
  lastUsed?: string;
}

const companionCommands: CompanionCommand[] = [
  {
    id: 'checkin',
    command: '/checkin',
    title: 'Daily Check-in',
    description: 'Share how you\'re feeling and track your emotional wellness',
    icon: <Heart className="w-6 h-6" />,
    category: 'wellness',
    color: 'from-pink-500 to-rose-500',
    shortcut: 'Ctrl+1'
  },
  {
    id: 'journal',
    command: '/journal',
    title: 'Journal Entry',
    description: 'Write reflective entries and track your personal growth',
    icon: <BookOpen className="w-6 h-6" />,
    category: 'reflection',
    color: 'from-blue-500 to-indigo-500',
    shortcut: 'Ctrl+2'
  },
  {
    id: 'reflect',
    command: '/reflect',
    title: 'Guided Reflection',
    description: 'Deep thinking sessions with AI-guided prompts',
    icon: <Brain className="w-6 h-6" />,
    category: 'reflection',
    color: 'from-purple-500 to-violet-500',
    shortcut: 'Ctrl+3'
  },
  {
    id: 'goals',
    command: '/goals',
    title: 'Goal Setting',
    description: 'Set, track, and achieve your personal aspirations',
    icon: <Target className="w-6 h-6" />,
    category: 'goals',
    color: 'from-orange-500 to-amber-500',
    shortcut: 'Ctrl+4'
  },
  {
    id: 'gratitude',
    command: '/gratitude',
    title: 'Gratitude Practice',
    description: 'Cultivate positivity and appreciate life\'s blessings',
    icon: <Sparkles className="w-6 h-6" />,
    category: 'wellness',
    color: 'from-yellow-500 to-orange-500',
    shortcut: 'Ctrl+5'
  },
  {
    id: 'memory',
    command: '/memory',
    title: 'Memory Lane',
    description: 'Explore past conversations and meaningful moments',
    icon: <Clock className="w-6 h-6" />,
    category: 'memory',
    color: 'from-green-500 to-emerald-500',
    shortcut: 'Ctrl+6'
  },
  {
    id: 'mood',
    command: '/mood',
    title: 'Mood Tracking',
    description: 'Monitor emotional patterns and mental wellness',
    icon: <Coffee className="w-6 h-6" />,
    category: 'wellness',
    color: 'from-teal-500 to-cyan-500',
    shortcut: 'Ctrl+7'
  },
  {
    id: 'nostalgia',
    command: '/nostalgia',
    title: 'Nostalgic Moments',
    description: 'Revisit happy memories and comforting experiences',
    icon: <Sparkles className="w-6 h-6" />,
    category: 'memory',
    color: 'from-indigo-500 to-purple-500',
    shortcut: 'Ctrl+8'
  }
];

interface CompanionDashboardProps {
  onCommandSelect: (command: string) => void;
}

const CompanionDashboard: React.FC<CompanionDashboardProps> = ({ onCommandSelect }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');

  // Determine time of day for personalized greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setTimeOfDay('morning');
    else if (hour >= 12 && hour < 17) setTimeOfDay('afternoon');
    else if (hour >= 17 && hour < 21) setTimeOfDay('evening');
    else setTimeOfDay('night');
  }, []);

  // Fetch companion stats
  const { data: stats } = useQuery<CompanionStats>('companion-stats', async () => {
    const response = await fetch('/api/companion/stats');
    return response.json();
  }, {
    initialData: {
      totalSessions: 0,
      journalEntries: 0,
      goalsSet: 0,
      gratitudePractices: 0,
      averageMood: 7.5,
      streakDays: 0
    }
  });

  // Fetch recent mood data
  const { data: moodData } = useQuery<MoodData[]>('mood-history', async () => {
    const response = await fetch('/api/companion/mood-history');
    return response.json();
  }, {
    initialData: []
  });

  const getGreeting = () => {
    const greetings = {
      morning: "🌅 Good morning! Ready to start your day with intention?",
      afternoon: "☀️ Good afternoon! How's your day unfolding?",
      evening: "🌆 Good evening! Time to reflect on today's journey?",
      night: "🌙 Good night! Perhaps some peaceful reflection before rest?"
    };
    return greetings[timeOfDay];
  };

  const categories = {
    wellness: { name: 'Wellness', icon: <Heart className="w-4 h-4" />, color: 'text-pink-600' },
    reflection: { name: 'Reflection', icon: <Brain className="w-4 h-4" />, color: 'text-blue-600' },
    memory: { name: 'Memory', icon: <Clock className="w-4 h-4" />, color: 'text-green-600' },
    goals: { name: 'Goals', icon: <Target className="w-4 h-4" />, color: 'text-orange-600' }
  };

  const filteredCommands = selectedCategory
    ? companionCommands.filter(cmd => cmd.category === selectedCategory)
    : companionCommands;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Welcome to Your AI Companion</h1>
          <p className="text-xl opacity-90 mb-6">{getGreeting()}</p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
              <div className="text-sm opacity-80">Sessions</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stats?.journalEntries || 0}</div>
              <div className="text-sm opacity-80">Journal Entries</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stats?.averageMood?.toFixed(1) || '7.5'}</div>
              <div className="text-sm opacity-80">Avg Mood</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stats?.streakDays || 0}</div>
              <div className="text-sm opacity-80">Day Streak</div>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'primary' : 'secondary'}
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          All Commands
        </Button>
        {Object.entries(categories).map(([key, category]) => (
          <Button
            key={key}
            variant={selectedCategory === key ? 'primary' : 'secondary'}
            onClick={() => setSelectedCategory(key)}
            className={`flex items-center gap-2 ${category.color}`}
          >
            {category.icon}
            {category.name}
          </Button>
        ))}
      </div>

      {/* Companion Commands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCommands.map((command) => (
          <div
            key={command.id}
            onClick={() => onCommandSelect(command.command)}
            className="group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:-translate-y-1"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden">
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${command.color} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${command.color} text-white shadow-lg`}>
                    {command.icon}
                  </div>
                  {command.shortcut && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-gray-600 dark:text-gray-400">
                      {command.shortcut}
                    </span>
                  )}
                </div>
                
                <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
                  {command.title}
                </h3>
                
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                  {command.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                    {command.command}
                  </span>
                  
                  {command.lastUsed && (
                    <span className="text-xs text-gray-500">
                      {command.lastUsed}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => onCommandSelect('/checkin')}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600"
          >
            <Heart className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Daily Check-in</div>
              <div className="text-sm opacity-90">How are you feeling?</div>
            </div>
          </Button>
          
          <Button
            onClick={() => onCommandSelect('/journal')}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
          >
            <BookOpen className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Quick Journal</div>
              <div className="text-sm opacity-90">Capture your thoughts</div>
            </div>
          </Button>
          
          <Button
            onClick={() => onCommandSelect('/memory')}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
          >
            <Clock className="w-5 h-5" />
            <div className="text-left">
              <div className="font-medium">Memory Lane</div>
              <div className="text-sm opacity-90">Explore our journey</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Mood Trends (if data available) */}
      {moodData && moodData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Your Wellness Journey
          </h2>
          
          <div className="grid grid-cols-7 gap-2">
            {moodData.slice(-14).map((mood, index) => (
              <div
                key={index}
                className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-sm relative group"
                style={{
                  backgroundColor: `hsl(${mood.mood * 12}, 70%, ${50 + mood.mood * 3}%)`
                }}
              >
                <span className="text-white font-medium">{mood.mood}</span>
                
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                  {mood.date}: Mood {mood.mood}/10
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            Your mood journey over the last two weeks. Each square represents a day.
          </p>
        </div>
      )}
    </div>
  );
};

export default CompanionDashboard;
