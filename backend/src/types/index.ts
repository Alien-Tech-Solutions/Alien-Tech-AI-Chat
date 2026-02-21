// Core type definitions for Lackadaisical AI Chat
// These types are used throughout the backend application

export interface Conversation {
  id: number;
  session_id: string;
  user_message: string | null;
  ai_response: string | null;
  timestamp: string;
  sentiment_score: number;
  sentiment_label: string;
  context_tags: string[];
  message_type: 'chat' | 'command' | 'journal' | 'system';
  tokens_used: number;
  response_time_ms: number;
  model_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonalityState {
  id: number;
  name: string;
  static_traits: string[];
  current_mood: MoodState;
  energy_level: number;
  empathy_level: number;
  humor_level: number;
  curiosity_level: number;
  patience_level: number;
  conversation_count: number;
  total_interactions: number;
  last_interaction: string | null;
  mood_history: MoodSnapshot[];
  learning_data: Record<string, any>;
  personality_version: string;
  created_at: string;
  last_updated: string;
}

export interface MoodState {
  energy: number;
  empathy: number;
  humor: number;
  curiosity: number;
  patience: number;
  factors?: Record<string, number>;
}

export interface MoodSnapshot {
  timestamp: string;
  mood: MoodState;
  trigger?: string;
  context?: string;
}

// Extended JournalEntry to support both the schema and code usage
export interface JournalEntry {
  id: number;
  user_id?: string;
  title?: string;
  content?: string;
  entry_text?: string;
  mood_snapshot?: MoodState;
  mood?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  tags: string[];
  themes?: string[];
  emotions?: string[];
  reflection_prompts?: string[];
  ai_insights?: string | null;
  privacy_level: 'private' | 'shared' | 'public' | 'deleted';
  word_count?: number;
  reading_time_seconds?: number;
  reading_time_minutes?: number;
  session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PluginState {
  plugin_name: string;
  enabled: boolean;
  config: Record<string, any>;
  state_data: Record<string, any>;
  last_used: string | null;
  usage_count: number;
  version: string;
  author: string | null;
  description: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface MemoryTag {
  id: number;
  tag_name: string;
  category: string;
  priority: 1 | 2 | 3;
  usage_count: number;
  description: string | null;
  created_at: string;
  last_used: string | null;
}

export interface Session {
  id: string;
  name: string | null;
  description?: string | null;
  message_count: number;
  total_tokens?: number;
  start_time?: string;
  last_activity?: string;
  last_active?: string;
  context_summary?: string;
  status?: 'active' | 'archived' | 'deleted';
  metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface LearningData {
  id: number;
  user_id: string;
  data_type: 'preference' | 'pattern' | 'feedback' | 'correction';
  key_name: string;
  value_data: Record<string, any>;
  confidence_score: number;
  source: 'user_interaction' | 'system_inference' | 'explicit_feedback';
  created_at: string;
  expires_at: string | null;
}

// Sentiment analysis types
export interface SentimentAnalysis {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
  details?: {
    positiveWords?: string[];
    negativeWords?: string[];
    emotionalMarkers?: string[];
  };
}

// AI Provider types
export type AIProviderType = 'ollama' | 'openai' | 'anthropic' | 'google' | 'xai';

export interface AIProvider {
  name: string;
  type: AIProviderType;
  available: boolean;
  models: string[];
}

export interface AIResponse {
  content: string;
  model: string;
  tokens_used?: number;
  response_time_ms: number;
  metadata?: Record<string, any>;
}

export interface StreamChunk {
  type: 'start' | 'content' | 'end' | 'error';
  content?: string;
  metadata?: Record<string, any>;
  error?: string;
}

// Plugin system types
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: string[];
  enabled: boolean;
  config: Record<string, any>;
  
  // Plugin lifecycle methods
  init?(config: Record<string, any>): Promise<void>;
  execute?(input: any, context: PluginContext): Promise<any>;
  cleanup?(): Promise<void>;
}

export interface PluginContext {
  user_id: string;
  session_id: string;
  conversation_history: Conversation[];
  personality_state: PersonalityState;
  config: Record<string, any>;
}

// API Request/Response types
export interface ChatRequest {
  message: string;
  session_id?: string;
  context?: Record<string, any>;
  stream?: boolean;
  useUncensored?: boolean;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  conversation_id: number;
  model_used: string;
  tokens_used: number;
  response_time_ms: number;
  sentiment?: SentimentAnalysis;
  mood_update?: MoodState;
}

export interface JournalRequest {
  title?: string;
  content?: string;
  entry_text?: string;
  tags?: string[];
  mood?: string;
  session_id?: string;
  privacy_level?: 'private' | 'shared' | 'public' | 'deleted';
}

export interface JournalResponse {
  entry: JournalEntry;
  insights?: {
    themes?: string[];
    emotions?: string[];
    wordCount?: number;
    readingTime?: number;
  } | string;
  ai_insights?: string;
  suggested_tags?: string[];
  metadata?: {
    response_time_ms?: number;
    [key: string]: any;
  };
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Database operation types
export interface DatabaseOptions {
  transaction?: boolean;
  timeout?: number;
}

export interface QueryResult<T = any> {
  data: T;
  affected_rows?: number;
  last_insert_id?: number;
}

// Memory and context types
export interface ContextWindow {
  conversations: Conversation[];
  personality_snapshot: PersonalityState;
  session_info: Session;
  relevant_tags: MemoryTag[];
  token_count: number;
}

export interface MemoryRetrieval {
  conversations: Conversation[];
  relevance_scores: number[];
  context_summary: string;
  total_retrieved: number;
}

// Nostalgia feature types
export interface NostalgiaQuery {
  date_range?: {
    start: string;
    end: string;
  };
  sentiment_filter?: 'positive' | 'negative' | 'neutral';
  tag_filter?: string[];
  limit?: number;
}

export interface NostalgiaResult {
  conversations: Conversation[];
  highlights: string[];
  mood_progression: MoodSnapshot[];
  summary: string;
}

// Configuration types will be defined locally to avoid path issues
export interface AppConfig {
  server: {
    frontendPort: number;
    backendPort: number;
    host: string;
    corsOrigin: string[];
  };
  database: {
    path: string;
    encrypted: boolean;
    passphrase?: string;
  };
  ai: {
    primaryProvider: 'ollama' | 'openai' | 'anthropic' | 'google' | 'xai';
    streamMode: 'sse' | 'ws' | 'off';
    models: Record<string, string>;
    apiKeys: Record<string, string>;
    ollamaHost: string;
  };
  personality: {
    name: string;
    baseTraits: string[];
    moodVolatility: number;
    empathyThreshold: number;
  };
  plugins: {
    enabled: string[];
    autoLoad: boolean;
  };
  features: {
    journaling: boolean;
    webSearch: boolean;
    encryption: boolean;
    dailyReminders: boolean;
  };
}

// Express middleware types
export interface AuthenticatedRequest {
  user?: {
    id: string;
    session_id: string;
  };
  // Will extend Express.Request when express is available
  params: any;
  query: any;
  body: any;
  headers: any;
}

// Rate limiting types
export interface RateLimitInfo {
  remaining: number;
  reset_time: number;
  limit: number;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    ai_providers: Record<string, 'up' | 'down'>;
    plugins: Record<string, 'up' | 'down'>;
  };
  version: string;
}

// Export all types as a namespace as well
export * as Types from './index';