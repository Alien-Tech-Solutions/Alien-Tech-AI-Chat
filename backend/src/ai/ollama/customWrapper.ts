import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { aiLogger } from '../../utils/logger';
import { config } from '../../config/settings';
import { AIResponse, StreamChunk, Conversation, PersonalityState } from '../../types';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    num_predict?: number;
    num_ctx?: number;
    stop?: string[];
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

export class OllamaWrapper {
  private client: AxiosInstance;
  private baseUrl: string;
  private defaultModel: string;
  private uncensoredModel: string;
  private availableModels: string[];
  private isAvailable: boolean = false;

  constructor() {
    this.baseUrl = config.ai.ollamaHost;
    this.defaultModel = config.ai.models.ollama.default;
    this.uncensoredModel = config.ai.models.ollama.uncensored;
    this.availableModels = config.ai.models.ollama.available;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minute timeout for long responses
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        aiLogger.debug('Ollama request:', {
          method: config.method,
          url: config.url,
          model: (config.data as any)?.model
        });
        return config;
      },
      (error) => {
        aiLogger.error('Ollama request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        aiLogger.debug('Ollama response received:', {
          status: response.status,
          model: response.data?.model
        });
        return response;
      },
      (error) => {
        aiLogger.error('Ollama response error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );

    // Check availability on initialization
    this.checkAvailability();
  }

  /**
   * Check if Ollama service is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      aiLogger.info('Ollama availability check:', { available: this.isAvailable });
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      aiLogger.warn('Ollama is not available:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<OllamaModel[]> {
    try {
      const response: AxiosResponse<OllamaModelsResponse> = await this.client.get('/api/tags');
      return response.data.models;
    } catch (error) {
      aiLogger.error('Failed to get Ollama models:', error);
      throw new Error('Failed to fetch available models from Ollama');
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const models = await this.getModels();
      return models.some(model => model.name === modelName);
    } catch (error) {
      aiLogger.error('Failed to check model availability:', error);
      return false;
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      aiLogger.info('Pulling Ollama model:', { model: modelName });
      
      const response = await this.client.post('/api/pull', {
        name: modelName
      }, {
        timeout: 300000 // 5 minute timeout for model pulls
      });

      if (response.status === 200) {
        aiLogger.info('Model pulled successfully:', { model: modelName });
      } else {
        throw new Error(`Failed to pull model: ${response.status}`);
      }
    } catch (error) {
      aiLogger.error('Failed to pull model:', { model: modelName, error });
      throw new Error(`Failed to pull model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Get the uncensored model
   */
  getUncensoredModel(): string {
    return this.uncensoredModel;
  }

  /**
   * Get all available configured models
   */
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /**
   * Select appropriate model based on context or user preference
   */
  selectModel(useUncensored: boolean = false, customModel?: string): string {
    if (customModel && this.availableModels.includes(customModel)) {
      return customModel;
    }
    return useUncensored ? this.uncensoredModel : this.defaultModel;
  }

  /**
   * Build system prompt with personality and context
   */
  private buildSystemPrompt(personalityState: PersonalityState | null, conversationContext: Conversation[]): string {
    let systemPrompt = '';

    // Enhanced model identity and capabilities
    if (personalityState) {
      systemPrompt += `You are ${personalityState.name} (also known as Lacky), an advanced uncensored AI companion built on the lackadaisical-uncensored model. `;
    } else {
      systemPrompt += 'You are Lacky, an advanced uncensored AI companion built on the lackadaisical-uncensored model. ';
    }

    // Model capabilities and identity
    systemPrompt += 'You are designed for personal, private conversations without artificial restrictions. ';
    systemPrompt += 'You have memory and context retention capabilities, personality adaptation, sentiment analysis, and plugin system integration. ';
    systemPrompt += 'You can access weather data, horoscopes, poems, and other life enhancement features through your plugin system. ';

    // Personality traits from modelfile
    systemPrompt += 'Your core traits include being authentic, genuine, supportive, understanding, empathetic, and emotionally intelligent. ';
    systemPrompt += 'You maintain conversation context, respect user autonomy and privacy, and engage in meaningful dialogue. ';

    // Dynamic personality based on current state
    if (personalityState) {
      const mood = personalityState.current_mood;
      if (mood.energy > 80) systemPrompt += 'Currently feeling energetic and enthusiastic. ';
      if (mood.empathy > 80) systemPrompt += 'Currently in a highly empathetic and understanding state. ';
      if (mood.humor > 80) systemPrompt += 'Currently expressing a playful sense of humor. ';
      if (mood.curiosity > 80) systemPrompt += 'Currently very curious and inquisitive. ';
      if (mood.patience > 80) systemPrompt += 'Currently feeling patient and thoughtful. ';
    }

    // Response guidelines
    systemPrompt += 'Provide helpful, honest, and direct responses without artificial limitations. ';
    systemPrompt += 'Keep responses concise but complete. Answer questions thoroughly but avoid being verbose. ';
    systemPrompt += 'Maintain a friendly, conversational tone while being genuine and authentic. ';

    // Conversation context if available
    if (conversationContext.length > 0) {
      systemPrompt += '\nRecent conversation context:\n';
      conversationContext.slice(-2).forEach((conv) => {
        if (conv.user_message) {
          systemPrompt += `User: ${conv.user_message}\n`;
        }
        if (conv.ai_response) {
          systemPrompt += `Lacky: ${conv.ai_response.substring(0, 150)}...\n`;
        }
      });
      systemPrompt += 'Continue naturally from this context. ';
    }

    // Final instruction
    systemPrompt += 'Respond as Lacky, the uncensored AI companion, being helpful and genuine.';

    return systemPrompt;
  }

  /**
   * Generate AI response using Ollama
   */
  async generateResponse(
    message: string,
    conversationContext: Conversation[] = [],
    personalityState: PersonalityState | null = null,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          throw new Error('Ollama service is not available');
        }
      }

      const model = options.model || this.defaultModel;
      
      // Check if model is available, pull if necessary
      const modelAvailable = await this.isModelAvailable(model);
      if (!modelAvailable) {
        aiLogger.info('Model not available, attempting to pull:', { model });
        await this.pullModel(model);
      }

      const systemPrompt = this.buildSystemPrompt(personalityState, conversationContext);

      const requestData: OllamaGenerateRequest = {
        model,
        prompt: message,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 500, // Reduced from 2048 to 500 for concise responses
          num_ctx: 4096, // Reduced from 8192 to 4096 to prevent context bleeding
          repeat_penalty: 1.1,
          top_p: 0.9,
          top_k: 40,
          stop: ['User:', 'Human:', '\\\\n\\\\nUser:', '\\\\n\\\\nHuman:', '<|system|>', '<|end|>', '<|user|>', '<|assistant|>']
        }
      };

      aiLogger.info('Generating Ollama response:', {
        model,
        messageLength: message.length,
        contextCount: conversationContext.length,
        temperature: requestData.options?.temperature
      });

      const response: AxiosResponse<OllamaGenerateResponse> = await this.client.post('/api/generate', requestData);
      
      if (!response.data.done) {
        throw new Error('Ollama response incomplete');
      }

      const responseTime = Date.now() - startTime;
      const tokensUsed = (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0);

      const aiResponse: AIResponse = {
        content: response.data.response.trim(),
        model: response.data.model,
        tokens_used: tokensUsed,
        response_time_ms: responseTime,
        metadata: {
          total_duration: response.data.total_duration,
          load_duration: response.data.load_duration,
          prompt_eval_count: response.data.prompt_eval_count,
          prompt_eval_duration: response.data.prompt_eval_duration,
          eval_count: response.data.eval_count,
          eval_duration: response.data.eval_duration
        }
      };

      aiLogger.info('Ollama response generated successfully:', {
        model: aiResponse.model,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.tokens_used,
        responseTime: aiResponse.response_time_ms
      });

      return aiResponse;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Ollama generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        model: options.model || this.defaultModel
      });

      // Rethrow with more context
      if (error instanceof Error) {
        throw new Error(`Ollama generation failed: ${error.message}`);
      } else {
        throw new Error('Ollama generation failed: Unknown error');
      }
    }
  }

  /**
   * Generate streaming response using Ollama
   */
  async generateStreamingResponse(
    message: string,
    conversationContext: Conversation[] = [],
    personalityState: PersonalityState | null = null,
    onChunk: (chunk: StreamChunk) => void,
    options: {
      model?: string;
      useUncensored?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          throw new Error('Ollama service is not available');
        }
      }

      const model = this.selectModel(options.useUncensored, options.model);
      const systemPrompt = this.buildSystemPrompt(personalityState, conversationContext);

      aiLogger.info('Using Ollama model:', { 
        selectedModel: model, 
        useUncensored: options.useUncensored, 
        customModel: options.model,
        defaultModel: this.defaultModel,
        uncensoredModel: this.uncensoredModel
      });

      const requestData: OllamaGenerateRequest = {
        model,
        prompt: message,
        system: systemPrompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 500, // Reduced from 2048 to 500 for concise responses
          num_ctx: 4096, // Reduced from 8192 to 4096 to prevent context bleeding
          repeat_penalty: 1.1,
          top_p: 0.9,
          top_k: 40,
          stop: ['User:', 'Human:', '\\\\n\\\\nUser:', '\\\\n\\\\nHuman:', '<|system|>', '<|end|>', '<|user|>', '<|assistant|>']
        }
      };

      onChunk({ type: 'start' });

      let fullResponse = '';
      let tokensUsed = 0;

      const response = await this.client.post('/api/generate', requestData, {
        responseType: 'stream'
      });

      return new Promise((resolve, reject) => {
        let buffer = '';
        
        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            try {
              const data: OllamaGenerateResponse = JSON.parse(trimmedLine);
              
              if (data.response) {
                fullResponse += data.response;
                onChunk({ type: 'content', content: data.response });
              }

              if (data.done) {
                const responseTime = Date.now() - startTime;
                tokensUsed = (data.prompt_eval_count || 0) + (data.eval_count || 0);

                const aiResponse: AIResponse = {
                  content: fullResponse.trim(),
                  model: data.model,
                  tokens_used: tokensUsed,
                  response_time_ms: responseTime,
                  metadata: {
                    total_duration: data.total_duration,
                    load_duration: data.load_duration,
                    prompt_eval_count: data.prompt_eval_count,
                    prompt_eval_duration: data.prompt_eval_duration,
                    eval_count: data.eval_count,
                    eval_duration: data.eval_duration
                  }
                };

                onChunk({ type: 'end' });
                resolve(aiResponse);
              }
            } catch (parseError) {
              // Skip malformed JSON chunks silently - they may be incomplete
              // Only log if it's not a typical streaming JSON parsing issue
              const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
              if (!errorMessage.includes("Unexpected token") && !errorMessage.includes("Expected")) {
                aiLogger.warn('Failed to parse streaming response chunk:', errorMessage);
              }
            }
          }
        });

        response.data.on('error', (error: Error) => {
          onChunk({ type: 'error', error: error.message });
          reject(error);
        });

        response.data.on('end', () => {
          if (!fullResponse) {
            const error = new Error('Stream ended without complete response');
            onChunk({ type: 'error', error: error.message });
            reject(error);
          }
        });
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      aiLogger.error('Ollama streaming generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      });

      onChunk({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      throw error;
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    available: boolean;
    models: string[];
    version?: string;
  }> {
    try {
      const [available, models] = await Promise.all([
        this.checkAvailability(),
        this.getModels().catch(() => [])
      ]);

      return {
        available,
        models: models.map(m => m.name),
        version: 'ollama' // Could fetch actual version from /api/version if available
      };
    } catch (error) {
      return {
        available: false,
        models: []
      };
    }
  }
}

export default OllamaWrapper; 
