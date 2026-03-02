/**
 * WebSearchService - Ollama tool integration for real-time web search
 *
 * This is the canonical interface definition for the WebSearchService.
 * The compiled backend implementation lives at:
 *   backend/src/services/WebSearchService.ts
 *
 * This service wraps WebFetcher as an Ollama tool and manages the
 * full tool-calling loop so the model can search the web in real time.
 */

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      required?: string[];
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
    };
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp?: Date;
  relevanceScore?: number;
}

export interface WebSearchResult {
  content: string;
  model: string;
  tokensUsed: number;
  responseTimeMs: number;
  searchesPerformed: SearchResult[][];
}

export interface WebSearchOptions {
  model?: string;
  maxToolRounds?: number;
  temperature?: number;
  maxTokens?: number;
}

/** Minimal interface for the WebFetcher dependency. */
export interface IWebFetcher {
  search(query: string, options?: Record<string, unknown>): Promise<{ results: SearchResult[]; provider: string; totalResults: number; searchTime: number }>;
  fetchUrl(url: string, options?: Record<string, unknown>): Promise<{ content: string; title: string; url: string; metadata: Record<string, unknown> }>;
}

/** Minimal interface for the OllamaWrapper dependency. */
export interface IOllamaWrapper {
  generateChatCompletion(messages: Array<{ role: string; content: string; tool_calls?: unknown[]; tool_name?: string }>, options?: Record<string, unknown>): Promise<{ model: string; message: { role: string; content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> }; done: boolean }>;
}

/**
 * WebSearchService provides web search as an Ollama tool capability.
 *
 * Usage:
 *   const service = new WebSearchService(webFetcher, ollamaWrapper);
 *   const tools = service.getSearchTools();
 *   const result = await service.generateWithWebSearch(userMessage, context, personality, options);
 */
export class WebSearchService {
  constructor(
    private webFetcher: IWebFetcher,
    private ollamaWrapper: IOllamaWrapper
  ) {}

  /** Returns the Ollama tool definitions for web search capabilities. */
  getSearchTools(): OllamaTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description:
            'Search the web for current information on a topic. Returns relevant results with titles, URLs, and snippets.',
          parameters: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string', description: 'The search query' },
              maxResults: { type: 'number', description: 'Maximum results to return (default: 5)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_url',
          description: 'Fetch and extract the main content from a specific web URL.',
          parameters: {
            type: 'object',
            required: ['url'],
            properties: {
              url: { type: 'string', description: 'The URL to fetch content from' },
            },
          },
        },
      },
    ];
  }

  /** Execute a named tool call and return its result as a JSON string. */
  async executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (toolName === 'web_search') {
      const query = String(args.query || '');
      const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 5;
      const { results, provider, searchTime } = await this.webFetcher.search(query, { maxResults });
      return JSON.stringify({ query, provider, searchTimeMs: searchTime, results });
    }
    if (toolName === 'fetch_url') {
      const url = String(args.url || '');
      const fetched = await this.webFetcher.fetchUrl(url, {
        extractMainContent: true,
        maxContentLength: 4000,
      });
      return JSON.stringify({ url: fetched.url, title: fetched.title, content: fetched.content });
    }
    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }

  /**
   * Run a full web-search-augmented chat completion using Ollama's tool-calling loop.
   * Iterates tool rounds until the model produces a final answer.
   */
  async generateWithWebSearch(
    userMessage: string,
    conversationContext: any[],
    personalityState: any,
    options: WebSearchOptions = {}
  ): Promise<WebSearchResult> {
    const maxToolRounds = options.maxToolRounds ?? 3;
    const startTime = Date.now();
    const searchesPerformed: SearchResult[][] = [];

    const messages: any[] = [
      {
        role: 'system',
        content:
          'You are a helpful AI assistant with access to web search tools. ' +
          'Use web_search to find current information when needed, and fetch_url to read specific pages.',
      },
      { role: 'user', content: userMessage },
    ];

    let totalTokens = 0;
    let finalModel = options.model || '';

    for (let round = 0; round < maxToolRounds; round++) {
      const response = await this.ollamaWrapper.generateWithTools(messages, this.getSearchTools(), {
        model: options.model,
        modelOptions: { temperature: options.temperature, num_predict: options.maxTokens },
      });

      finalModel = response.model;
      totalTokens += (response.prompt_eval_count || 0) + (response.eval_count || 0);

      const assistantMsg = response.message;
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        return {
          content: assistantMsg.content || '',
          model: finalModel,
          tokensUsed: totalTokens,
          responseTimeMs: Date.now() - startTime,
          searchesPerformed,
        };
      }

      messages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        const toolResult = await this.executeToolCall(
          toolCall.function.name,
          toolCall.function.arguments as Record<string, unknown>
        );
        if (toolCall.function.name === 'web_search') {
          try {
            const parsed = JSON.parse(toolResult);
            if (Array.isArray(parsed.results)) searchesPerformed.push(parsed.results);
          } catch { /* ignore */ }
        }
        messages.push({ role: 'tool', content: toolResult });
      }
    }

    // Final completion after tool rounds
    const final = await this.ollamaWrapper.generateChatCompletion(messages, {
      model: options.model,
      modelOptions: { temperature: options.temperature, num_predict: options.maxTokens },
    });
    totalTokens += (final.prompt_eval_count || 0) + (final.eval_count || 0);

    return {
      content: final.message?.content || '',
      model: final.model || finalModel,
      tokensUsed: totalTokens,
      responseTimeMs: Date.now() - startTime,
      searchesPerformed,
    };
  }
}

export default WebSearchService;
