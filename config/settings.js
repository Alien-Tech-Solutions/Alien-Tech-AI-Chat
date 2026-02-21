"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateProductionSecrets = validateProductionSecrets;
exports.getDatabasePath = getDatabasePath;
exports.isExternalProviderConfigured = isExternalProviderConfigured;
const zod_1 = require("zod");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load environment variables
dotenv.config();
// Configuration schema validation
const ConfigSchema = zod_1.z.object({
    server: zod_1.z.object({
        frontendPort: zod_1.z.number().min(1000).max(65535).default(3000),
        backendPort: zod_1.z.number().min(1000).max(65535).default(3001),
        host: zod_1.z.string().default('localhost'),
        corsOrigin: zod_1.z.array(zod_1.z.string()).default(['http://localhost:3000']),
    }),
    database: zod_1.z.object({
        type: zod_1.z.enum(['sqlite', 'postgresql', 'mysql']).default('sqlite'),
        path: zod_1.z.string().optional().default('./database/chat.db'), // For SQLite
        host: zod_1.z.string().optional(), // For PostgreSQL/MySQL
        port: zod_1.z.number().optional(), // For PostgreSQL/MySQL
        name: zod_1.z.string().default('lackadaisical_chat'),
        username: zod_1.z.string().optional(), // For PostgreSQL/MySQL
        password: zod_1.z.string().optional(), // For PostgreSQL/MySQL
        encrypted: zod_1.z.boolean().default(false),
        passphrase: zod_1.z.string().optional(),
        ssl: zod_1.z.boolean().default(false), // For PostgreSQL/MySQL
        connectionPool: zod_1.z.object({
            min: zod_1.z.number().default(2),
            max: zod_1.z.number().default(10),
        }).optional(),
    }),
    ai: zod_1.z.object({
        primaryProvider: zod_1.z.enum(['ollama', 'openai', 'anthropic', 'google', 'xai']).default('ollama'),
        streamMode: zod_1.z.enum(['sse', 'ws', 'off']).default('sse'),
        models: zod_1.z.object({
            ollama: zod_1.z.object({
                default: zod_1.z.string().default('lackadaisical-uncensored:latest'),
                uncensored: zod_1.z.string().default('lackadaisical-uncensored:latest'),
                available: zod_1.z.array(zod_1.z.string()).default(['lackadaisical-assistant:latest', 'lackadaisical-uncensored:latest']),
            }),
            openai: zod_1.z.string().default('gpt-4'),
            anthropic: zod_1.z.string().default('claude-3-sonnet-20240229'),
            google: zod_1.z.string().default('gemini-pro'),
            xai: zod_1.z.string().default('grok-beta'),
        }),
        apiKeys: zod_1.z.object({
            openai: zod_1.z.string().optional(),
            anthropic: zod_1.z.string().optional(),
            google: zod_1.z.string().optional(),
            xai: zod_1.z.string().optional(),
        }),
        ollamaHost: zod_1.z.string().url().default('http://localhost:11434'),
        modelCreation: zod_1.z.object({
            enabled: zod_1.z.boolean().default(true),
            scriptPath: zod_1.z.string().default('./scripts/createUncentoredModel.js'),
            modelfilesPath: zod_1.z.string().default('./scripts/modelfiles'),
        }),
    }),
    personality: zod_1.z.object({
        name: zod_1.z.string().default('Lacky'),
        baseTraits: zod_1.z.array(zod_1.z.string()).default(['friendly', 'curious', 'helpful', 'witty']),
        moodVolatility: zod_1.z.number().min(0).max(1).default(0.3),
        empathyThreshold: zod_1.z.number().min(0).max(1).default(0.7),
    }),
    plugins: zod_1.z.object({
        enabled: zod_1.z.array(zod_1.z.string()).default(['weather', 'horoscope', 'poem-of-the-day']),
        autoLoad: zod_1.z.boolean().default(true),
    }),
    features: zod_1.z.object({
        journaling: zod_1.z.boolean().default(true),
        webSearch: zod_1.z.boolean().default(false),
        encryption: zod_1.z.boolean().default(false),
        dailyReminders: zod_1.z.boolean().default(false),
    }),
    security: zod_1.z.object({
        jwtSecret: zod_1.z.string().min(32),
        sessionSecret: zod_1.z.string().min(32),
        rateLimitWindowMs: zod_1.z.number().default(900000), // 15 minutes
        rateLimitMaxRequests: zod_1.z.number().default(100),
    }),
    logging: zod_1.z.object({
        level: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        file: zod_1.z.string().default('./logs/app.log'),
    }),
    development: zod_1.z.object({
        nodeEnv: zod_1.z.enum(['development', 'production', 'test']).default('development'),
        debugMode: zod_1.z.boolean().default(false),
    }),
    webSearch: zod_1.z.object({
        timeout: zod_1.z.number().default(30000),
        maxResults: zod_1.z.number().default(10),
    }),
    journal: zod_1.z.object({
        reminderTime: zod_1.z.string().default('21:00'),
        reminderTimezone: zod_1.z.string().default('America/New_York'),
    }),
});
/**
 * Parse and validate configuration from environment variables
 */
function parseConfig() {
    const rawConfig = {
        server: {
            frontendPort: parseInt(process.env.FRONTEND_PORT || '3000', 10),
            backendPort: parseInt(process.env.BACKEND_PORT || '3001', 10),
            host: process.env.BACKEND_HOST || 'localhost',
            corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        },
        database: {
            type: process.env.DB_TYPE || 'sqlite',
            path: process.env.DB_PATH || './database/chat.db',
            host: process.env.DB_HOST,
            port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
            name: process.env.DB_NAME || 'lackadaisical_chat',
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            encrypted: process.env.DB_ENCRYPTED === 'true',
            passphrase: process.env.DB_PASSPHRASE,
            ssl: process.env.DB_SSL === 'true',
            connectionPool: process.env.DB_POOL_MIN && process.env.DB_POOL_MAX ? {
                min: parseInt(process.env.DB_POOL_MIN, 10),
                max: parseInt(process.env.DB_POOL_MAX, 10),
            } : undefined,
        },
        ai: {
            primaryProvider: process.env.AI_PRIMARY_PROVIDER || 'ollama',
            streamMode: process.env.STREAM_MODE || 'sse',
            models: {
                ollama: {
                    default: process.env.OLLAMA_DEFAULT_MODEL || 'lackadaisical-uncensored:latest',
                    uncensored: process.env.OLLAMA_UNCENSORED_MODEL || 'lackadaisical-uncensored:latest',
                    available: (process.env.OLLAMA_AVAILABLE_MODELS?.split(',') || ['lackadaisical-assistant:latest', 'lackadaisical-uncensored:latest']),
                },
                openai: process.env.OPENAI_MODEL || 'gpt-4',
                anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
                google: process.env.GOOGLE_MODEL || 'gemini-pro',
                xai: process.env.XAI_MODEL || 'grok-beta',
            },
            apiKeys: {
                openai: process.env.OPENAI_API_KEY,
                anthropic: process.env.ANTHROPIC_API_KEY,
                google: process.env.GOOGLE_API_KEY,
                xai: process.env.XAI_API_KEY,
            },
            ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',
            ollamaModelsPath: process.env.OLLAMA_MODELS_PATH || './models',
            modelCreation: {
                enabled: process.env.MODEL_CREATION_ENABLED !== 'false',
                scriptPath: process.env.MODEL_CREATION_SCRIPT || './scripts/createUncentoredModel.js',
                modelfilesPath: process.env.MODELFILES_PATH || './scripts/modelfiles',
            },
        },
        personality: {
            name: process.env.PERSONALITY_NAME || 'Lacky',
            baseTraits: process.env.PERSONALITY_BASE_TRAITS?.split(',') || ['friendly', 'curious', 'helpful', 'witty'],
            moodVolatility: parseFloat(process.env.MOOD_VOLATILITY || '0.3'),
            empathyThreshold: parseFloat(process.env.EMPATHY_THRESHOLD || '0.7'),
        },
        plugins: {
            enabled: process.env.PLUGINS_ENABLED?.split(',') || ['weather', 'horoscope', 'poem-of-the-day'],
            autoLoad: process.env.PLUGINS_AUTO_LOAD !== 'false',
        },
        features: {
            journaling: process.env.FEATURE_JOURNALING !== 'false',
            webSearch: process.env.FEATURE_WEB_SEARCH === 'true',
            encryption: process.env.FEATURE_ENCRYPTION === 'true',
            dailyReminders: process.env.FEATURE_DAILY_REMINDERS === 'true',
        },
        security: {
            jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
            sessionSecret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this-in-production',
            rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
            rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        },
        logging: {
            level: process.env.LOG_LEVEL || 'info',
            file: process.env.LOG_FILE || './logs/app.log',
        },
        development: {
            nodeEnv: process.env.NODE_ENV || 'development',
            debugMode: process.env.DEBUG_MODE === 'true',
        },
        webSearch: {
            timeout: parseInt(process.env.WEBSEARCH_TIMEOUT || '30000', 10),
            maxResults: parseInt(process.env.WEBSEARCH_MAX_RESULTS || '10', 10),
        },
        journal: {
            reminderTime: process.env.JOURNAL_REMINDER_TIME || '21:00',
            reminderTimezone: process.env.JOURNAL_REMINDER_TIMEZONE || 'America/New_York',
        },
    };
    try {
        return ConfigSchema.parse(rawConfig);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('Configuration validation failed:');
            error.errors.forEach((err) => {
                console.error(`  ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
}
/**
 * Get validated configuration
 */
exports.config = parseConfig();
/**
 * Validate that required secrets are set for production
 */
function validateProductionSecrets() {
    if (exports.config.development.nodeEnv === 'production') {
        const requiredSecrets = [
            { key: 'JWT_SECRET', value: exports.config.security.jwtSecret },
            { key: 'SESSION_SECRET', value: exports.config.security.sessionSecret },
        ];
        const missingSecrets = requiredSecrets.filter(({ value }) => !value || value.includes('change-this-in-production'));
        if (missingSecrets.length > 0) {
            console.error('Production secrets validation failed:');
            missingSecrets.forEach(({ key }) => {
                console.error(`  ${key} must be set and not contain default values`);
            });
            process.exit(1);
        }
    }
}
/**
 * Get database path with proper resolution
 */
function getDatabasePath() {
    return path.resolve(exports.config.database.path);
}
/**
 * Check if external API provider is configured
 */
function isExternalProviderConfigured(provider) {
    switch (provider) {
        case 'openai':
            return !!exports.config.ai.apiKeys.openai;
        case 'anthropic':
            return !!exports.config.ai.apiKeys.anthropic;
        case 'google':
            return !!exports.config.ai.apiKeys.google;
        case 'xai':
            return !!exports.config.ai.apiKeys.xai;
        case 'ollama':
            return true; // Always available if Ollama is running
        default:
            return false;
    }
}
exports.default = exports.config;
//# sourceMappingURL=settings.js.map