import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { apiLogger } from '../utils/logger';
import { databaseService } from '../services/DatabaseService';
import { pluginService } from '../services/PluginService';
import { ApiError } from '../utils/ApiError';

const router = Router();

// Apply rate limiting to plugin endpoints
router.use(endpointRateLimiter('general'));

/**
 * GET /plugins - Get all plugins with their states and statistics
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const pluginStats = await pluginService.getPluginStats();
    
    res.json({
      success: true,
      data: pluginStats,
      message: 'Plugins retrieved successfully'
    });
  } catch (error) {
    apiLogger.error('Failed to get plugins:', error);
    throw new ApiError(500, 'Failed to retrieve plugins');
  }
}));

/**
 * GET /plugins/:name - Get specific plugin state and details
 */
router.get('/:name', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    const pluginState = await databaseService.getPluginState(name);
    const plugin = pluginService.getPlugin(name);
    
    if (!pluginState || !plugin) {
      throw new ApiError(404, `Plugin '${name}' not found`);
    }
    
    const pluginInfo = {
      ...pluginState,
      plugin: {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        permissions: plugin.permissions
      }
    };
    
    res.json({
      success: true,
      data: pluginInfo,
      message: `Plugin '${name}' retrieved successfully`
    });
  } catch (error) {
    apiLogger.error(`Failed to get plugin ${name}:`, error);
    throw error;
  }
}));

/**
 * POST /plugins/:name/enable - Enable a plugin
 */
router.post('/:name/enable', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    await pluginService.enablePlugin(name);
    
    res.json({
      success: true,
      message: `Plugin '${name}' enabled successfully`
    });
  } catch (error) {
    apiLogger.error(`Failed to enable plugin ${name}:`, error);
    throw new ApiError(500, `Failed to enable plugin '${name}'`);
  }
}));

/**
 * POST /plugins/:name/disable - Disable a plugin
 */
router.post('/:name/disable', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    await pluginService.disablePlugin(name);
    
    res.json({
      success: true,
      message: `Plugin '${name}' disabled successfully`
    });
  } catch (error) {
    apiLogger.error(`Failed to disable plugin ${name}:`, error);
    throw new ApiError(500, `Failed to disable plugin '${name}'`);
  }
}));

/**
 * PUT /plugins/:name/config - Update plugin configuration
 */
router.put('/:name/config', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const { config } = req.body;
  
  if (!config || typeof config !== 'object') {
    throw new ApiError(400, 'Invalid configuration provided');
  }
  
  try {
    await pluginService.updatePluginConfig(name, config);
    
    res.json({
      success: true,
      message: `Plugin '${name}' configuration updated successfully`
    });
  } catch (error) {
    apiLogger.error(`Failed to update plugin config for ${name}:`, error);
    throw new ApiError(500, `Failed to update plugin '${name}' configuration`);
  }
}));

/**
 * POST /plugins/:name/execute - Execute a plugin
 */
router.post('/:name/execute', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const { input, context } = req.body;
  
  try {
    // Validate plugin exists and is enabled
    const pluginState = await databaseService.getPluginState(name);
    
    if (!pluginState) {
      throw new ApiError(404, `Plugin '${name}' not found`);
    }
    
    if (!pluginState.enabled) {
      throw new ApiError(400, `Plugin '${name}' is disabled`);
    }
    
    // Execute the plugin
    const result = await pluginService.executePlugin(name, input, context);
    
    if (!result.success) {
      throw new ApiError(500, `Plugin execution failed: ${result.error}`);
    }
    
    res.json({
      success: true,
      data: result.data,
      metadata: {
        executionTime: result.executionTime,
        pluginName: name,
        pluginVersion: result.metadata?.pluginVersion
      },
      message: `Plugin '${name}' executed successfully`
    });
  } catch (error) {
    apiLogger.error(`Failed to execute plugin ${name}:`, error);
    throw error;
  }
}));

/**
 * GET /plugins/:name/stats - Get plugin usage statistics
 */
router.get('/:name/stats', asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    const pluginState = await databaseService.getPluginState(name);
    
    if (!pluginState) {
      throw new ApiError(404, `Plugin '${name}' not found`);
    }
    
    const stats = {
      name,
      enabled: pluginState.enabled,
      usageCount: pluginState.usage_count,
      lastUsed: pluginState.last_used,
      averageExecutionTime: pluginState.state_data?.averageExecutionTime || 0,
      totalExecutionTime: pluginState.state_data?.totalExecutionTime || 0,
      created: pluginState.created_at,
      updated: pluginState.updated_at
    };
    
    res.json({
      success: true,
      data: stats,
      message: `Plugin '${name}' statistics retrieved successfully`
    });
  } catch (error) {
    apiLogger.error(`Failed to get plugin stats for ${name}:`, error);
    throw error;
  }
}));

/**
 * POST /plugins/reload - Reload all plugins
 */
router.post('/reload', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Cleanup current plugins
    await pluginService.cleanup();
    
    // Reinitialize plugin service
    await pluginService.initialize();
    
    const pluginStats = await pluginService.getPluginStats();
    
    res.json({
      success: true,
      data: pluginStats,
      message: 'Plugins reloaded successfully'
    });
  } catch (error) {
    apiLogger.error('Failed to reload plugins:', error);
    throw new ApiError(500, 'Failed to reload plugins');
  }
}));

export default router; 