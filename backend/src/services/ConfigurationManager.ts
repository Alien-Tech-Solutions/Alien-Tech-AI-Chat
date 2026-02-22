/**
 * ConfigurationManager - Advanced configuration management with validation and hot-reloading
 * Provides centralized configuration management for the entire application
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// Configuration schema with validation
const ConfigSchema = z.object({
  server: z.object({
    frontendPort: z.number().int().min(1).max(65535),
    backendPort: z.number().int().min(1).max(65535),
    host: z.string(),
    corsOrigin: z.string().or(z.array(z.string())),
    nodeEnv: z.enum(['development', 'production', 'test'])
  }),
  
  database: z.object({
    type: z.enum(['sqlite', 'postgresql', 'mysql']),
    path: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional(),
    poolMin: z.number().int().optional(),
    poolMax: z.number().int().optional(),
    encrypted: z.boolean().optional()
  }),
  
  ai: z.object({
    primaryProvider: z.enum(['ollama', 'openai', 'anthropic', 'google', 'xai']),
    fallbackProvider: z.enum(['ollama', 'openai', 'anthropic', 'google', 'xai']).optional(),
    ollamaHost: z.string().optional(),
    ollamaDefaultModel: z.string().optional(),
    openaiApiKey: z.string().optional(),
    anthropicApiKey: z.string().optional(),
    googleApiKey: z.string().optional(),
    xaiApiKey: z.string().optional(),
    mockResponses: z.boolean().optional()
  }),
  
  security: z.object({
    jwtSecret: z.string().min(32),
    sessionSecret: z.string().min(32),
    rateLimitWindowMs: z.number().int().optional(),
    rateLimitMaxRequests: z.number().int().optional(),
    enableHelmet: z.boolean().optional(),
    enableCors: z.boolean().optional()
  }),
  
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'http', 'debug']),
    toConsole: z.boolean(),
    toFile: z.boolean(),
    maxFiles: z.number().int().optional(),
    maxSize: z.string().optional()
  }),
  
  memory: z.object({
    maxContextMessages: z.number().int().min(1).max(1000),
    crossSessionEnabled: z.boolean(),
    autoSummarize: z.boolean(),
    contextTokenLimit: z.number().int().optional()
  }),
  
  performance: z.object({
    enableCaching: z.boolean(),
    cacheTtlSeconds: z.number().int(),
    enableCompression: z.boolean().optional()
  }),
  
  backup: z.object({
    enabled: z.boolean(),
    schedule: z.string().optional(),
    retentionDays: z.number().int().optional(),
    maxBackups: z.number().int().optional(),
    compress: z.boolean().optional()
  }),
  
  features: z.object({
    enableHotReload: z.boolean().optional(),
    enableDebugEndpoints: z.boolean().optional(),
    enableHealthChecks: z.boolean().optional(),
    fastMode: z.boolean().optional()
  }).optional()
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigurationManager extends EventEmitter {
  private config: AppConfig | null = null;
  private configPath: string;
  private watchHandle?: fs.FileChangeInfo<string>;
  private isWatching: boolean = false;

  constructor() {
    super();
    const projectRoot = path.resolve(__dirname, '../../../..');
    this.configPath = path.resolve(projectRoot, '.env');
  }

  /**
   * Load configuration from environment and files
   */
  async load(environment?: string): Promise<AppConfig> {
    try {
      // Determine which environment to load
      const env = environment || process.env.NODE_ENV || 'development';
      logger.info('Loading configuration:', { environment: env });

      // Load environment-specific config if it exists
      const configPresetPath = path.resolve(
        __dirname,
        '../../../..',
        'config',
        `${env}.env`
      );

      try {
        const preset = await fs.readFile(configPresetPath, 'utf-8');
        this.parseEnvFile(preset);
      } catch {
        logger.debug(`No preset found for ${env}, using default .env`);
      }

      // Parse configuration from environment variables
      this.config = this.parseConfig();

      // Validate configuration
      const validated = ConfigSchema.parse(this.config);
      this.config = validated;

      logger.info('Configuration loaded and validated successfully');
      this.emit('loaded', this.config);

      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  /**
   * Parse environment variables into configuration object
   */
  private parseConfig(): AppConfig {
    return {
      server: {
        frontendPort: parseInt(process.env.FRONTEND_PORT || '3000'),
        backendPort: parseInt(process.env.BACKEND_PORT || '3001'),
        host: process.env.BACKEND_HOST || 'localhost',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        nodeEnv: (process.env.NODE_ENV as any) || 'development'
      },
      
      database: {
        type: (process.env.DB_TYPE as any) || 'sqlite',
        path: process.env.DB_PATH || './database/chat.db',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
        name: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true',
        poolMin: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 2,
        poolMax: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
        encrypted: process.env.DB_ENCRYPTED === 'true'
      },
      
      ai: {
        primaryProvider: (process.env.AI_PRIMARY_PROVIDER as any) || 'ollama',
        fallbackProvider: process.env.AI_FALLBACK_PROVIDER as any,
        ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
        ollamaDefaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:latest',
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        googleApiKey: process.env.GOOGLE_API_KEY,
        xaiApiKey: process.env.XAI_API_KEY,
        mockResponses: process.env.MOCK_AI_RESPONSES === 'true'
      },
      
      security: {
        jwtSecret: process.env.JWT_SECRET || 'INSECURE_DEFAULT_SECRET_CHANGE_IN_PRODUCTION_' + Math.random(),
        sessionSecret: process.env.SESSION_SECRET || 'INSECURE_DEFAULT_SECRET_CHANGE_IN_PRODUCTION_' + Math.random(),
        rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 900000,
        rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100,
        enableHelmet: process.env.ENABLE_HELMET !== 'false',
        enableCors: process.env.ENABLE_CORS !== 'false'
      },
      
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        toConsole: process.env.LOG_TO_CONSOLE !== 'false',
        toFile: process.env.LOG_TO_FILE !== 'false',
        maxFiles: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES) : 14,
        maxSize: process.env.LOG_MAX_SIZE || '20m'
      },
      
      memory: {
        maxContextMessages: parseInt(process.env.MEMORY_MAX_CONTEXT_MESSAGES || '100'),
        crossSessionEnabled: process.env.MEMORY_CROSS_SESSION_ENABLED !== 'false',
        autoSummarize: process.env.MEMORY_AUTO_SUMMARIZE === 'true',
        contextTokenLimit: process.env.MEMORY_CONTEXT_TOKEN_LIMIT ? parseInt(process.env.MEMORY_CONTEXT_TOKEN_LIMIT) : 128000
      },
      
      performance: {
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600'),
        enableCompression: process.env.ENABLE_COMPRESSION !== 'false'
      },
      
      backup: {
        enabled: process.env.BACKUP_ENABLED === 'true',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
        retentionDays: process.env.BACKUP_RETENTION_DAYS ? parseInt(process.env.BACKUP_RETENTION_DAYS) : 30,
        maxBackups: process.env.BACKUP_MAX_BACKUPS ? parseInt(process.env.BACKUP_MAX_BACKUPS) : 60,
        compress: process.env.BACKUP_COMPRESS !== 'false'
      },
      
      features: {
        enableHotReload: process.env.ENABLE_HOT_RELOAD === 'true',
        enableDebugEndpoints: process.env.ENABLE_DEBUG_ENDPOINTS === 'true',
        enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
        fastMode: process.env.FAST_MODE === 'true'
      }
    };
  }

  /**
   * Parse .env file content
   */
  private parseEnvFile(content: string): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      if (!key || valueParts.length === 0) continue;
      
      const value = valueParts.join('=').trim();
      process.env[key.trim()] = value;
    }
  }

  /**
   * Get current configuration
   */
  get(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.get()[section];
  }

  /**
   * Update configuration at runtime
   */
  async update(updates: Partial<AppConfig>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Merge updates
    const newConfig = { ...this.config, ...updates };

    // Validate
    const validated = ConfigSchema.parse(newConfig);

    // Update
    this.config = validated;
    this.emit('updated', this.config);

    logger.info('Configuration updated');
  }

  /**
   * Reload configuration from disk
   */
  async reload(): Promise<AppConfig> {
    logger.info('Reloading configuration...');
    const env = process.env.NODE_ENV;
    return await this.load(env);
  }

  /**
   * Watch configuration file for changes
   */
  async watch(): Promise<void> {
    if (this.isWatching) return;

    try {
      const configDir = path.dirname(this.configPath);
      
      // Watch for file changes
      const watcher = fs.watch(configDir, { persistent: false });
      
      for await (const event of watcher) {
        if (event.filename && (event.filename.endsWith('.env') || event.filename.endsWith('.env.local'))) {
          logger.info('Configuration file changed, reloading...');
          
          try {
            await this.reload();
            this.emit('reloaded', this.config);
          } catch (error) {
            logger.error('Failed to reload configuration:', error);
            this.emit('error', error);
          }
        }
      }
      
      this.isWatching = true;
      logger.info('Configuration watcher started');
    } catch (error) {
      logger.error('Failed to start configuration watcher:', error);
    }
  }

  /**
   * Stop watching configuration file
   */
  stopWatch(): void {
    this.isWatching = false;
    logger.info('Configuration watcher stopped');
  }

  /**
   * Validate current configuration
   */
  validate(): { valid: boolean; errors?: string[] } {
    try {
      if (!this.config) {
        return { valid: false, errors: ['Configuration not loaded'] };
      }

      ConfigSchema.parse(this.config);
      return { valid: true };
    } catch (error: any) {
      const errors = error.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [error.message];
      return { valid: false, errors };
    }
  }

  /**
   * Export configuration to file
   */
  async export(filePath: string): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const content = JSON.stringify(this.config, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.info('Configuration exported:', { filePath });
  }

  /**
   * Get configuration as environment variables format
   */
  toEnvFormat(): string {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const lines: string[] = [];
    const cfg = this.config;

    // Server
    lines.push('# Server Configuration');
    lines.push(`FRONTEND_PORT=${cfg.server.frontendPort}`);
    lines.push(`BACKEND_PORT=${cfg.server.backendPort}`);
    lines.push(`BACKEND_HOST=${cfg.server.host}`);
    lines.push(`CORS_ORIGIN=${cfg.server.corsOrigin}`);
    lines.push(`NODE_ENV=${cfg.server.nodeEnv}`);
    lines.push('');

    // Database
    lines.push('# Database Configuration');
    lines.push(`DB_TYPE=${cfg.database.type}`);
    if (cfg.database.path) lines.push(`DB_PATH=${cfg.database.path}`);
    if (cfg.database.host) lines.push(`DB_HOST=${cfg.database.host}`);
    if (cfg.database.port) lines.push(`DB_PORT=${cfg.database.port}`);
    if (cfg.database.name) lines.push(`DB_NAME=${cfg.database.name}`);
    if (cfg.database.username) lines.push(`DB_USERNAME=${cfg.database.username}`);
    if (cfg.database.password) lines.push(`DB_PASSWORD=${cfg.database.password}`);
    lines.push('');

    // Add more sections as needed...

    return lines.join('\n');
  }
}

// Export singleton instance
export const configManager = new ConfigurationManager();
export default ConfigurationManager;
