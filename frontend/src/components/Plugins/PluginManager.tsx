import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { Plugin, PluginState } from '../../types';
import PluginCard from './PluginCard';
import PluginSettings from './PluginSettings';

interface PluginStats {
  enabled: number;
  disabled: number;
  total: number;
  plugins: (PluginState & { plugin: Plugin })[];
}

const PluginManager: React.FC = () => {
  const [pluginStats, setPluginStats] = useState<PluginStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<(PluginState & { plugin: Plugin }) | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getPlugins();
      setPluginStats(response.data as any);
    } catch (err) {
      console.error('Failed to load plugins:', err);
      setError('Failed to load plugins. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlugin = async (pluginName: string, enabled: boolean) => {
    try {
      if (enabled) {
        await apiService.enablePlugin(pluginName);
      } else {
        await apiService.disablePlugin(pluginName);
      }
      
      // Refresh plugins list
      await loadPlugins();
    } catch (err) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin:`, err);
      setError(`Failed to ${enabled ? 'enable' : 'disable'} plugin. Please try again.`);
    }
  };

  const handleConfigurePlugin = (plugin: PluginState & { plugin: Plugin }) => {
    setSelectedPlugin(plugin);
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setSelectedPlugin(null);
    setIsSettingsOpen(false);
    loadPlugins(); // Refresh after potential changes
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-3 text-lg">Loading plugins...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
        <button 
          className="btn btn-sm btn-outline" 
          onClick={loadPlugins}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Plugin Manager</h1>
        <p className="text-base-content/70 mb-4">
          Manage and configure your AI companion's capabilities
        </p>
        
        {/* Stats */}
        {pluginStats && (
          <div className="stats stats-horizontal shadow">
            <div className="stat">
              <div className="stat-title">Total Plugins</div>
              <div className="stat-value text-primary">{pluginStats.total}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Enabled</div>
              <div className="stat-value text-success">{pluginStats.enabled}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Disabled</div>
              <div className="stat-value text-warning">{pluginStats.disabled}</div>
            </div>
          </div>
        )}
      </div>

      {/* Plugin Grid */}
      {pluginStats && pluginStats.plugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pluginStats.plugins.map((plugin) => (
            <PluginCard
              key={plugin.plugin_name}
              plugin={plugin}
              onToggle={handleTogglePlugin}
              onConfigure={handleConfigurePlugin}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-base-content/50 text-lg">
            No plugins available
          </div>
          <p className="text-base-content/30 mt-2">
            Check your plugin directory and configuration
          </p>
        </div>
      )}

      {/* Plugin Settings Modal */}
      {isSettingsOpen && selectedPlugin && (
        <PluginSettings
          plugin={selectedPlugin}
          isOpen={isSettingsOpen}
          onClose={handleSettingsClose}
        />
      )}
    </div>
  );
};

export default PluginManager;
