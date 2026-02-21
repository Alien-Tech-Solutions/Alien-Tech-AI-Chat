import React, { useState, useEffect } from 'react';
import { Plugin, PluginState } from '../../types';
import apiService from '../../services/api';

interface PluginSettingsProps {
  plugin: PluginState & { plugin: Plugin };
  isOpen: boolean;
  onClose: () => void;
}

interface ConfigField {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
  description?: string;
}

const PluginSettings: React.FC<PluginSettingsProps> = ({ plugin, isOpen, onClose }) => {
  const [config, setConfig] = useState<Record<string, any>>(plugin.config || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(plugin.config || {});
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, plugin.config]);

  const getConfigFields = (): ConfigField[] => {
    const fields: ConfigField[] = [];
    
    // Plugin-specific configuration fields
    switch (plugin.plugin_name) {
      case 'weather':
        fields.push(
          {
            key: 'apiKey',
            value: config.apiKey || '',
            type: 'string',
            description: 'OpenWeatherMap API key for weather data'
          },
          {
            key: 'defaultLocation',
            value: config.defaultLocation || 'New York',
            type: 'string',
            description: 'Default location for weather queries'
          },
          {
            key: 'units',
            value: config.units || 'metric',
            type: 'select',
            options: ['metric', 'imperial'],
            description: 'Temperature units (metric = Celsius, imperial = Fahrenheit)'
          }
        );
        break;
      
      case 'horoscope':
        fields.push(
          {
            key: 'defaultSign',
            value: config.defaultSign || '',
            type: 'select',
            options: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'],
            description: 'Default zodiac sign for horoscope queries'
          },
          {
            key: 'includeCompatibility',
            value: config.includeCompatibility !== false,
            type: 'boolean',
            description: 'Include compatibility information in horoscopes'
          },
          {
            key: 'includeLuckyDetails',
            value: config.includeLuckyDetails !== false,
            type: 'boolean',
            description: 'Include lucky numbers and colors'
          }
        );
        break;
      
      case 'poem-of-the-day':
        fields.push(
          {
            key: 'style',
            value: config.style || 'inspirational',
            type: 'select',
            options: ['inspirational', 'romantic', 'nature', 'philosophical', 'humorous'],
            description: 'Preferred style of daily poems'
          },
          {
            key: 'length',
            value: config.length || 'short',
            type: 'select',
            options: ['short', 'medium', 'long'],
            description: 'Preferred length of poems'
          }
        );
        break;
      
      default:
        // Generic configuration for unknown plugins
        Object.keys(config).forEach(key => {
          fields.push({
            key,
            value: config[key],
            type: typeof config[key] === 'boolean' ? 'boolean' : 
                  typeof config[key] === 'number' ? 'number' : 'string'
          });
        });
    }
    
    return fields;
  };

  const handleFieldChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await apiService.updatePluginConfig(plugin.plugin_name, config);
      
      setSuccess('Configuration saved successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to save plugin configuration:', err);
      setError('Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: ConfigField) => {
    switch (field.type) {
      case 'boolean':
        return (
          <div className="form-control" key={field.key}>
            <label className="label cursor-pointer justify-start space-x-3">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={field.value}
                onChange={(e) => handleFieldChange(field.key, e.target.checked)}
              />
              <div className="flex-1">
                <span className="label-text font-medium capitalize">
                  {field.key.replace(/([A-Z])/g, ' $1')}
                </span>
                {field.description && (
                  <div className="text-xs text-base-content/60 mt-1">
                    {field.description}
                  </div>
                )}
              </div>
            </label>
          </div>
        );
      
      case 'select':
        return (
          <div className="form-control" key={field.key}>
            <label className="label">
              <span className="label-text font-medium capitalize">
                {field.key.replace(/([A-Z])/g, ' $1')}
              </span>
            </label>
            <select
              className="select select-bordered w-full"
              value={field.value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            >
              {field.options?.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            {field.description && (
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  {field.description}
                </span>
              </label>
            )}
          </div>
        );
      
      case 'number':
        return (
          <div className="form-control" key={field.key}>
            <label className="label">
              <span className="label-text font-medium capitalize">
                {field.key.replace(/([A-Z])/g, ' $1')}
              </span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={field.value}
              onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
            />
            {field.description && (
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  {field.description}
                </span>
              </label>
            )}
          </div>
        );
      
      default: // string
        return (
          <div className="form-control" key={field.key}>
            <label className="label">
              <span className="label-text font-medium capitalize">
                {field.key.replace(/([A-Z])/g, ' $1')}
              </span>
            </label>
            <input
              type={field.key.toLowerCase().includes('password') || field.key.toLowerCase().includes('key') ? 'password' : 'text'}
              className="input input-bordered w-full"
              value={field.value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.description}
            />
            {field.description && (
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  {field.description}
                </span>
              </label>
            )}
          </div>
        );
    }
  };

  const fields = getConfigFields();

  return (
    <div className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box w-11/12 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg">Configure {plugin.plugin.name}</h3>
            <p className="text-sm text-base-content/70 mt-1">
              {plugin.plugin.description}
            </p>
          </div>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Plugin Info */}
        <div className="bg-base-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-base-content/60">Version:</span>
              <span className="ml-2 font-medium">{plugin.version}</span>
            </div>
            <div>
              <span className="text-base-content/60">Author:</span>
              <span className="ml-2 font-medium">{plugin.author}</span>
            </div>
            <div>
              <span className="text-base-content/60">Usage Count:</span>
              <span className="ml-2 font-medium">{plugin.usage_count}</span>
            </div>
            <div>
              <span className="text-base-content/60">Status:</span>
              <span className={`ml-2 font-medium ${plugin.enabled ? 'text-success' : 'text-error'}`}>
                {plugin.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Fields */}
        <div className="space-y-4 mb-6">
          {fields.length > 0 ? (
            fields.map(renderField)
          ) : (
            <div className="text-center py-8 text-base-content/50">
              No configuration options available for this plugin.
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button 
            className="btn btn-ghost" 
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={saving || fields.length === 0}
          >
            {saving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

export default PluginSettings;
