/**
 * OllamaWrapper Unit Tests
 * Tests for the Ollama API wrapper covering chat completions,
 * embeddings, vision, tool calling, structured outputs, and operational endpoints.
 */

import OllamaWrapper from '../ai/ollama/customWrapper';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    __mockInstance: mockAxiosInstance,
  };
});

// Mock config
jest.mock('../config/settings', () => ({
  config: {
    ai: {
      ollamaHost: 'http://localhost:11434',
      models: {
        ollama: {
          default: 'llama3.2:latest',
          uncensored: 'lackadaisical-uncensored:latest',
          available: ['llama3.2:latest', 'lackadaisical-uncensored:latest', 'mistral:latest'],
        },
      },
    },
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  aiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Helper to retrieve the mocked axios instance
function getMockClient() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');
  return axios.__mockInstance;
}

describe('OllamaWrapper', () => {
  let wrapper: OllamaWrapper;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = getMockClient();
    // Default: availability check succeeds
    mockClient.get.mockResolvedValue({ status: 200, data: { models: [] } });
    wrapper = new OllamaWrapper();
  });

  // -------------------------------------------------------------------------
  // Existing method tests
  // -------------------------------------------------------------------------

  describe('checkAvailability', () => {
    it('should return true when Ollama is reachable', async () => {
      mockClient.get.mockResolvedValueOnce({ status: 200, data: { models: [] } });
      const result = await wrapper.checkAvailability();
      expect(result).toBe(true);
    });

    it('should return false when Ollama is not reachable', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await wrapper.checkAvailability();
      expect(result).toBe(false);
    });
  });

  describe('getModels', () => {
    it('should return available models from /api/tags', async () => {
      const mockModels = [
        { name: 'llama3.2:latest', modified_at: '2024-01-01', size: 1000, digest: 'abc', details: { format: 'gguf', family: 'llama', parameter_size: '3B', quantization_level: 'Q4' } },
        { name: 'mistral:latest', modified_at: '2024-01-01', size: 2000, digest: 'def', details: { format: 'gguf', family: 'mistral', parameter_size: '7B', quantization_level: 'Q4' } },
      ];
      mockClient.get.mockResolvedValueOnce({ status: 200, data: { models: mockModels } });
      const models = await wrapper.getModels();
      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('llama3.2:latest');
    });

    it('should throw error when fetch fails', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Network error'));
      await expect(wrapper.getModels()).rejects.toThrow('Failed to fetch available models from Ollama');
    });
  });

  describe('isModelAvailable', () => {
    it('should return true when model exists', async () => {
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: { models: [{ name: 'llama3.2:latest' }] },
      });
      const result = await wrapper.isModelAvailable('llama3.2:latest');
      expect(result).toBe(true);
    });

    it('should return false when model does not exist', async () => {
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: { models: [{ name: 'other-model:latest' }] },
      });
      const result = await wrapper.isModelAvailable('llama3.2:latest');
      expect(result).toBe(false);
    });
  });

  describe('pullModel', () => {
    it('should successfully pull a model', async () => {
      mockClient.post.mockResolvedValueOnce({ status: 200 });
      await expect(wrapper.pullModel('llama3.2:latest')).resolves.toBeUndefined();
    });

    it('should throw on pull failure', async () => {
      mockClient.post.mockRejectedValueOnce(new Error('pull failed'));
      await expect(wrapper.pullModel('bad-model')).rejects.toThrow('Failed to pull model bad-model');
    });
  });

  describe('getDefaultModel / getUncensoredModel / getAvailableModels', () => {
    it('should return configured default model', () => {
      expect(wrapper.getDefaultModel()).toBe('llama3.2:latest');
    });

    it('should return configured uncensored model', () => {
      expect(wrapper.getUncensoredModel()).toBe('lackadaisical-uncensored:latest');
    });

    it('should return a copy of available models', () => {
      const models = wrapper.getAvailableModels();
      expect(models).toContain('llama3.2:latest');
      expect(models).toContain('lackadaisical-uncensored:latest');
    });
  });

  describe('selectModel', () => {
    it('should return default model when no options', () => {
      expect(wrapper.selectModel()).toBe('llama3.2:latest');
    });

    it('should return uncensored model when requested', () => {
      expect(wrapper.selectModel(true)).toBe('lackadaisical-uncensored:latest');
    });

    it('should return custom model when in available list', () => {
      expect(wrapper.selectModel(false, 'mistral:latest')).toBe('mistral:latest');
    });

    it('should fall back to default when custom model not in list', () => {
      expect(wrapper.selectModel(false, 'nonexistent:latest')).toBe('llama3.2:latest');
    });
  });

  // -------------------------------------------------------------------------
  // generateResponse – now uses /api/chat
  // -------------------------------------------------------------------------

  describe('generateResponse', () => {
    it('should send a chat completion request and return AIResponse', async () => {
      // Ensure availability passes
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: { models: [{ name: 'llama3.2:latest' }] },
      });

      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          created_at: '2024-01-01T00:00:00Z',
          message: { role: 'assistant', content: 'Hello there!' },
          done: true,
          total_duration: 1000000,
          prompt_eval_count: 10,
          eval_count: 5,
        },
      });

      const result = await wrapper.generateResponse('Hi', [], null, {});

      expect(result.content).toBe('Hello there!');
      expect(result.model).toBe('llama3.2:latest');
      expect(result.tokens_used).toBe(15); // 10 + 5

      // Verify /api/chat was called (not /api/generate)
      const postCalls = mockClient.post.mock.calls;
      const chatCall = postCalls.find((c: any[]) => c[0] === '/api/chat');
      expect(chatCall).toBeDefined();
      expect(chatCall[1].messages).toBeDefined();
      expect(chatCall[1].messages[0].role).toBe('system');
      expect(chatCall[1].messages[1].role).toBe('user');
      expect(chatCall[1].messages[1].content).toBe('Hi');
    });

    it('should throw when Ollama is not available', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(wrapper.generateResponse('test', [], null)).rejects.toThrow('Ollama generation failed');
    });
  });

  // -------------------------------------------------------------------------
  // New capability: generateChatCompletion
  // -------------------------------------------------------------------------

  describe('generateChatCompletion', () => {
    it('should send messages to /api/chat and return response', async () => {
      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          created_at: '2024-01-01T00:00:00Z',
          message: { role: 'assistant', content: 'Direct chat response' },
          done: true,
        },
      });

      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const result = await wrapper.generateChatCompletion(messages);
      expect(result.message.content).toBe('Direct chat response');
      expect(result.done).toBe(true);
    });

    it('should pass format parameter for JSON mode', async () => {
      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          message: { role: 'assistant', content: '{"key":"value"}' },
          done: true,
        },
      });

      const messages = [{ role: 'user' as const, content: 'Return JSON' }];
      await wrapper.generateChatCompletion(messages, { format: 'json' });

      const postCalls = mockClient.post.mock.calls;
      const chatCall = postCalls.find((c: any[]) => c[0] === '/api/chat');
      expect(chatCall[1].format).toBe('json');
    });

    it('should pass tools parameter for function calling', async () => {
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather',
          parameters: {
            type: 'object' as const,
            properties: { city: { type: 'string', description: 'City name' } },
            required: ['city'],
          },
        },
      }];

      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Tokyo' } } }],
          },
          done: true,
        },
      });

      const messages = [{ role: 'user' as const, content: 'What is the weather in Tokyo?' }];
      const result = await wrapper.generateChatCompletion(messages, { tools });

      expect(result.message.tool_calls).toBeDefined();
      expect(result.message.tool_calls![0].function.name).toBe('get_weather');

      const postCalls = mockClient.post.mock.calls;
      const chatCall = postCalls.find((c: any[]) => c[0] === '/api/chat');
      expect(chatCall[1].tools).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // New capability: generateEmbeddings
  // -------------------------------------------------------------------------

  describe('generateEmbeddings', () => {
    it('should generate embeddings for a single input', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3, 0.4, 0.5]];
      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          embeddings: mockEmbeddings,
          total_duration: 5000,
        },
      });

      const result = await wrapper.generateEmbeddings('Hello world');
      expect(result.embeddings).toEqual(mockEmbeddings);
      expect(result.model).toBe('llama3.2:latest');

      const postCalls = mockClient.post.mock.calls;
      const embedCall = postCalls.find((c: any[]) => c[0] === '/api/embed');
      expect(embedCall).toBeDefined();
      expect(embedCall[1].input).toBe('Hello world');
    });

    it('should generate embeddings for multiple inputs', async () => {
      const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];
      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          embeddings: mockEmbeddings,
        },
      });

      const result = await wrapper.generateEmbeddings(['Hello', 'World']);
      expect(result.embeddings).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // New capability: generateStructuredOutput
  // -------------------------------------------------------------------------

  describe('generateStructuredOutput', () => {
    it('should send a schema in the format parameter', async () => {
      const schema = {
        type: 'object',
        properties: { age: { type: 'integer' }, name: { type: 'string' } },
        required: ['age', 'name'],
      };

      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          message: { role: 'assistant', content: '{"age":30,"name":"Alice"}' },
          done: true,
        },
      });

      const result = await wrapper.generateStructuredOutput('Extract info: Alice is 30', schema);
      expect(result.message.content).toBe('{"age":30,"name":"Alice"}');

      const postCalls = mockClient.post.mock.calls;
      const chatCall = postCalls.find((c: any[]) => c[0] === '/api/chat');
      expect(chatCall[1].format).toEqual(schema);
    });
  });

  // -------------------------------------------------------------------------
  // New capability: generateWithVision
  // -------------------------------------------------------------------------

  describe('generateWithVision', () => {
    it('should include images in the user message', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUg==';

      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llava:latest',
          message: { role: 'assistant', content: 'I see a cat.' },
          done: true,
        },
      });

      const result = await wrapper.generateWithVision(
        'What is in this image?',
        [base64Image],
        { model: 'llava:latest' }
      );
      expect(result.message.content).toBe('I see a cat.');

      const postCalls = mockClient.post.mock.calls;
      const chatCall = postCalls.find((c: any[]) => c[0] === '/api/chat');
      const userMsg = chatCall[1].messages.find((m: any) => m.role === 'user');
      expect(userMsg.images).toEqual([base64Image]);
    });
  });

  // -------------------------------------------------------------------------
  // New capability: generateWithTools
  // -------------------------------------------------------------------------

  describe('generateWithTools', () => {
    it('should pass tools to /api/chat', async () => {
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'search',
          description: 'Search the web',
          parameters: {
            type: 'object' as const,
            properties: { query: { type: 'string', description: 'Search query' } },
            required: ['query'],
          },
        },
      }];

      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          model: 'llama3.2:latest',
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{ function: { name: 'search', arguments: { query: 'Ollama API' } } }],
          },
          done: true,
        },
      });

      const messages = [{ role: 'user' as const, content: 'Search for Ollama API docs' }];
      const result = await wrapper.generateWithTools(messages, tools);
      expect(result.message.tool_calls).toBeDefined();
      expect(result.message.tool_calls![0].function.arguments).toEqual({ query: 'Ollama API' });
    });
  });

  // -------------------------------------------------------------------------
  // New capability: getModelInfo
  // -------------------------------------------------------------------------

  describe('getModelInfo', () => {
    it('should return model details from /api/show', async () => {
      mockClient.post.mockResolvedValueOnce({
        status: 200,
        data: {
          modelfile: '# Modelfile',
          parameters: 'temperature 0.7',
          template: '{{ .Prompt }}',
          details: {
            format: 'gguf',
            family: 'llama',
            parameter_size: '3B',
            quantization_level: 'Q4_K_M',
          },
          model_info: { 'general.architecture': 'llama' },
          capabilities: ['completion', 'chat'],
        },
      });

      const info = await wrapper.getModelInfo('llama3.2:latest');
      expect(info.details.family).toBe('llama');
      expect(info.capabilities).toContain('completion');

      const postCalls = mockClient.post.mock.calls;
      const showCall = postCalls.find((c: any[]) => c[0] === '/api/show');
      expect(showCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // New capability: getVersion
  // -------------------------------------------------------------------------

  describe('getVersion', () => {
    it('should return version string from /api/version', async () => {
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: { version: '0.5.1' },
      });

      const version = await wrapper.getVersion();
      expect(version).toBe('0.5.1');
    });
  });

  // -------------------------------------------------------------------------
  // New capability: getRunningModels
  // -------------------------------------------------------------------------

  describe('getRunningModels', () => {
    it('should return running models from /api/ps', async () => {
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: {
          models: [{
            name: 'llama3.2:latest',
            model: 'llama3.2:latest',
            size: 2000000000,
            digest: 'abc123',
            details: { format: 'gguf', family: 'llama', parameter_size: '3B', quantization_level: 'Q4_K_M' },
            expires_at: '2024-01-01T00:00:00Z',
            size_vram: 2000000000,
          }],
        },
      });

      const models = await wrapper.getRunningModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('llama3.2:latest');
    });
  });

  // -------------------------------------------------------------------------
  // getStatus – updated to include real version
  // -------------------------------------------------------------------------

  describe('getStatus', () => {
    it('should return availability, models, and version', async () => {
      // checkAvailability
      mockClient.get.mockResolvedValueOnce({ status: 200, data: { models: [] } });
      // getModels
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: { models: [{ name: 'llama3.2:latest' }] },
      });
      // getVersion
      mockClient.get.mockResolvedValueOnce({
        status: 200,
        data: { version: '0.5.1' },
      });

      const status = await wrapper.getStatus();
      expect(status.available).toBe(true);
      expect(status.models).toContain('llama3.2:latest');
      expect(status.version).toBe('0.5.1');
    });

    it('should return graceful fallback when Ollama is down', async () => {
      mockClient.get.mockRejectedValue(new Error('Connection refused'));

      const status = await wrapper.getStatus();
      expect(status.available).toBe(false);
      expect(status.models).toEqual([]);
    });
  });
});
