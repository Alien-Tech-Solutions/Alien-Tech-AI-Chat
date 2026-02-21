import React from 'react';
import { useNavigate } from 'react-router-dom';
import CompanionDashboard from './CompanionDashboard';
import { MessageSquare, BarChart3, Sparkles } from 'lucide-react';
import Button from '../ui/Button';

interface CompanionInterfaceProps {}

const CompanionInterface: React.FC<CompanionInterfaceProps> = () => {
  const navigate = useNavigate();

  const handleCommandSelect = (command: string) => {
    // Navigate to chat and send the command to the custom Ollama model
    navigate('/chat', { 
      state: { 
        prefilledMessage: command,
        companionMode: true 
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  AI Companion Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Your personal growth and wellness companion
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate('/chat')}
                className="flex items-center gap-2"
                variant="secondary"
              >
                <MessageSquare className="w-4 h-4" />
                Chat Mode
              </Button>
              
              <Button
                onClick={() => navigate('/journal')}
                className="flex items-center gap-2"
                variant="secondary"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pb-8">
        <CompanionDashboard onCommandSelect={handleCommandSelect} />
      </div>
    </div>
  );
};

export default CompanionInterface;
