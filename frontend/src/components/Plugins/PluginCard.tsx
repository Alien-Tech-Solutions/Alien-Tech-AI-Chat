import React from 'react';
import { Plugin, PluginState } from '../../types';

interface PluginCardProps {
  plugin: PluginState & { plugin: Plugin };
  onToggle: (pluginName: string, enabled: boolean) => void;
  onConfigure: (plugin: PluginState & { plugin: Plugin }) => void;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onToggle, onConfigure }) => {
  const formatLastUsed = (lastUsed: string | null) => {
    if (!lastUsed) return 'Never';
    const date = new Date(lastUsed);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPluginIcon = (pluginName: string) => {
    switch (pluginName) {
      case 'weather':
        return '🌤️';
      case 'horoscope':
        return '🔮';
      case 'poem-of-the-day':
        return '📝';
      default:
        return '🔌';
    }
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled ? 'badge-success' : 'badge-error';
  };

  return (
    <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-200">
      <div className="card-body">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getPluginIcon(plugin.plugin_name)}</span>
            <div>
              <h3 className="card-title text-lg">{plugin.plugin.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`badge badge-sm ${getStatusColor(plugin.enabled)}`}>
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <span className="text-xs text-base-content/50">
                  v{plugin.version}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-base-content/70 mb-4 line-clamp-2">
          {plugin.description || plugin.plugin.description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-base-200 rounded-lg p-2 text-center">
            <div className="text-xs text-base-content/50">Usage Count</div>
            <div className="font-semibold text-sm">{plugin.usage_count}</div>
          </div>
          <div className="bg-base-200 rounded-lg p-2 text-center">
            <div className="text-xs text-base-content/50">Last Used</div>
            <div className="font-semibold text-xs truncate">
              {formatLastUsed(plugin.last_used)}
            </div>
          </div>
        </div>

        {/* Author & Permissions */}
        <div className="mb-4">
          <div className="text-xs text-base-content/50 mb-1">
            By {plugin.author || plugin.plugin.author}
          </div>
          {plugin.permissions && plugin.permissions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {plugin.permissions.map((permission) => (
                <span 
                  key={permission} 
                  className="badge badge-outline badge-xs"
                >
                  {permission}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions justify-between">
          <div className="form-control">
            <label className="label cursor-pointer space-x-2">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={plugin.enabled}
                onChange={(e) => onToggle(plugin.plugin_name, e.target.checked)}
              />
              <span className="label-text text-sm">
                {plugin.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
          
          <button
            className="btn btn-sm btn-outline"
            onClick={() => onConfigure(plugin)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure
          </button>
        </div>
      </div>
    </div>
  );
};

export default PluginCard;
