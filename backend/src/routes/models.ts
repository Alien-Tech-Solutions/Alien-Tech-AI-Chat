/**
 * Model management routes
 * Hot-swappable model management, Ollama cloud services, and model registry
 */

import { Router, Request, Response, NextFunction } from 'express';
import { modelManager, ModelInfo, OllamaEndpoint } from '../services/ModelManager';
import { aiLogger } from '../utils/logger';
import { optionalAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting and optional auth to all routes
router.use(rateLimiter);
router.use(optionalAuth);

/**
 * GET /api/models
 * Get all registered models
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, available, capability } = req.query;
    
    let models = modelManager.getModels();
    
    // Filter by provider
    if (provider && typeof provider === 'string') {
      models = models.filter(m => m.provider === provider);
    }
    
    // Filter by availability
    if (available === 'true') {
      models = models.filter(m => m.isAvailable);
    }
    
    // Filter by capability
    if (capability && typeof capability === 'string') {
      models = models.filter(m => m.capabilities.includes(capability as any));
    }

    res.json({
      success: true,
      data: {
        models,
        total: models.length,
        available: models.filter(m => m.isAvailable).length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/models/current
 * Get current active model
 */
router.get('/current', (req: Request, res: Response) => {
  const current = modelManager.getCurrentModel();
  const modelInfo = current.model ? modelManager.getModel(current.model) : null;
  
  res.json({
    success: true,
    data: {
      modelId: current.model,
      provider: current.provider,
      modelInfo
    }
  });
});

/**
 * POST /api/models/switch
 * Hot-swap to a different model
 */
router.post('/switch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelId, reason } = req.body;
    
    if (!modelId) {
      res.status(400).json({
        success: false,
        error: 'modelId is required'
      });
      return;
    }

    const result = await modelManager.switchModel(modelId, reason || 'user_request');
    
    if (result.success) {
      aiLogger.info('Model switched via API:', result);
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: result
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/models/:modelId
 * Get specific model information
 */
router.get('/:modelId', (req: Request, res: Response) => {
  const { modelId } = req.params;
  const model = modelManager.getModel(modelId);
  
  if (!model) {
    res.status(404).json({
      success: false,
      error: `Model ${modelId} not found`
    });
    return;
  }

  const metrics = modelManager.getMetrics(modelId);

  res.json({
    success: true,
    data: {
      model,
      metrics
    }
  });
});

/**
 * POST /api/models/:modelId/check
 * Check availability of a specific model
 */
router.post('/:modelId/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelId } = req.params;
    const available = await modelManager.checkModelAvailability(modelId);
    const model = modelManager.getModel(modelId);

    res.json({
      success: true,
      data: {
        modelId,
        available,
        lastChecked: model?.lastChecked
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/models/by-provider/:provider
 * Get models by provider
 */
router.get('/by-provider/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;
  const models = modelManager.getModelsByProvider(provider as any);

  res.json({
    success: true,
    data: {
      provider,
      models,
      total: models.length
    }
  });
});

/**
 * POST /api/models/select-best
 * Select the best model based on criteria
 */
router.post('/select-best', (req: Request, res: Response) => {
  const criteria = req.body;
  const model = modelManager.selectBestModel(criteria);

  if (!model) {
    res.status(404).json({
      success: false,
      error: 'No model matches the specified criteria'
    });
    return;
  }

  res.json({
    success: true,
    data: model
  });
});

/**
 * GET /api/models/metrics
 * Get metrics for all models
 */
router.get('/stats/metrics', (req: Request, res: Response) => {
  const metrics = modelManager.getAllMetrics();

  res.json({
    success: true,
    data: {
      metrics,
      total: metrics.length
    }
  });
});

// ==================== OLLAMA ENDPOINTS ====================

/**
 * GET /api/models/ollama/endpoints
 * Get all Ollama endpoints
 */
router.get('/ollama/endpoints', (req: Request, res: Response) => {
  const endpoints = modelManager.getOllamaEndpoints();

  res.json({
    success: true,
    data: {
      endpoints,
      total: endpoints.length,
      healthy: endpoints.filter(e => e.isHealthy).length
    }
  });
});

/**
 * POST /api/models/ollama/endpoints
 * Add a new Ollama endpoint
 */
router.post('/ollama/endpoints', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, url, type, priority, apiKey } = req.body;

    if (!name || !url) {
      res.status(400).json({
        success: false,
        error: 'name and url are required'
      });
      return;
    }

    const endpoint: OllamaEndpoint = {
      id: `custom-${Date.now()}`,
      name,
      url,
      type: type || 'custom',
      priority: priority || 50,
      isHealthy: false,
      lastHealthCheck: new Date(),
      models: [],
      apiKey
    };

    modelManager.addOllamaEndpoint(endpoint);

    // Check health immediately
    modelManager.checkOllamaEndpointHealth(endpoint.id);

    res.status(201).json({
      success: true,
      data: endpoint
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/models/ollama/endpoints/:endpointId
 * Remove an Ollama endpoint
 */
router.delete('/ollama/endpoints/:endpointId', (req: Request, res: Response) => {
  const { endpointId } = req.params;
  const removed = modelManager.removeOllamaEndpoint(endpointId);

  if (removed) {
    res.json({
      success: true,
      message: `Endpoint ${endpointId} removed`
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Endpoint ${endpointId} not found`
    });
  }
});

/**
 * POST /api/models/ollama/pull
 * Pull a model to an Ollama endpoint
 */
router.post('/ollama/pull', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelName, endpointId } = req.body;

    if (!modelName) {
      res.status(400).json({
        success: false,
        error: 'modelName is required'
      });
      return;
    }

    const result = await modelManager.pullModel(modelName, endpointId);

    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: result
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/models/ollama/health-check
 * Trigger health check for all Ollama endpoints
 */
router.post('/ollama/health-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await modelManager.performHealthChecks();
    const endpoints = modelManager.getOllamaEndpoints();

    res.json({
      success: true,
      data: {
        endpoints: endpoints.map(e => ({
          id: e.id,
          name: e.name,
          isHealthy: e.isHealthy,
          latency: e.latency,
          modelCount: e.models.length
        })),
        checkedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/models/ollama/best
 * Get the best available Ollama endpoint
 */
router.get('/ollama/best', (req: Request, res: Response) => {
  const best = modelManager.getBestOllamaEndpoint();

  if (best) {
    res.json({
      success: true,
      data: best
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'No healthy Ollama endpoint available'
    });
  }
});

// ==================== MODEL REGISTRATION ====================

/**
 * POST /api/models/register
 * Register a new model in the registry
 */
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const modelInfo: ModelInfo = req.body;

    // Validate required fields
    if (!modelInfo.id || !modelInfo.name || !modelInfo.provider) {
      res.status(400).json({
        success: false,
        error: 'id, name, and provider are required'
      });
      return;
    }

    // Set defaults
    modelInfo.isAvailable = modelInfo.isAvailable ?? false;
    modelInfo.lastChecked = new Date();
    modelInfo.capabilities = modelInfo.capabilities || ['chat'];
    modelInfo.tags = modelInfo.tags || [];

    modelManager.registerModel(modelInfo);

    res.status(201).json({
      success: true,
      data: modelInfo
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/models/register/:modelId
 * Unregister a model from the registry
 */
router.delete('/register/:modelId', (req: Request, res: Response) => {
  const { modelId } = req.params;
  const removed = modelManager.unregisterModel(modelId);

  if (removed) {
    res.json({
      success: true,
      message: `Model ${modelId} unregistered`
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Model ${modelId} not found`
    });
  }
});

export default router;
