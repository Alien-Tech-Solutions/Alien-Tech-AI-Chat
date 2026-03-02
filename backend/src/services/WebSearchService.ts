/**
 * WebSearchService - Ollama tool integration for real-time web search
 * Wraps WebFetcher as an Ollama tool and manages the tool-calling loop.
 */

import { aiLogger } from '../utils/logger';
import { WebFetcher, SearchResult } from './WebFetcher';
import OllamaWrapper from '../ai/ollama/customWrapper';
import { OllamaChatMessage, OllamaTool } from '../types';

// Re-export for convenience
export { SearchResult };

const WEB_SEARCH_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information on a topic. Returns relevant results with titles, URLs and snippets.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
          },
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
          url: {
            type: 'string',
            description: 'The URL to fetch content from',
          },
        },
      },
    },
  },
];

export class WebSearchService {
  constructor(
    private webFetcher: WebFetcher,
    private ollamaWrapper: OllamaWrapper
  ) {}

  /**
   * Returns the Ollama tool definitions for web search capabilities.
   */
  getSearchTools(): OllamaTool[] {
    return WEB_SEARCH_TOOLS;
  }

  /**
   * Execute a tool call by name and return its result as a JSON string.
   */
  async executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    try {
      if (toolName === 'web_search') {
        const query = String(args.query || '');
        const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 5;

        const { results, provider, searchTime } = await this.webFetcher.search(query, { maxResults });

        if (results.length === 0) {
          return JSON.stringify({ message: 'No search results found', query });
        }

        return JSON.stringify({
          query,
          provider,
          searchTimeMs: searchTime,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            source: r.source,
          })),
        });
      }

      if (toolName === 'fetch_url') {
        const url = String(args.url || '');
        const fetched = await this.webFetcher.fetchUrl(url, {
          extractMainContent: true,
          maxContentLength: 4000,
        });

        return JSON.stringify({
          url: fetched.url,
          title: fetched.title,
          content: fetched.content,
          wordCount: fetched.metadata.wordCount,
        });
      }

      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      aiLogger.warn('WebSearchService tool execution failed:', { toolName, error: message });
      return JSON.stringify({ error: message });
    }
  }

  /**
   * Run a full web-search-augmented chat completion using Ollama's tool-calling loop.
   * Continues calling tools until the model produces a final text answer or
   * maxToolRounds is reached.
   */
  async generateWithWebSearch(
    userMessage: string,
    conversationContext: unknown[],
    personalityState: unknown,
    options: {
      model?: string;
      maxToolRounds?: number;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<{
    content: string;
    model: string;
    tokensUsed: number;
    responseTimeMs: number;
    searchesPerformed: SearchResult[][];
  }> {
    const startTime = Date.now();
    const maxToolRounds = options.maxToolRounds ?? 3;
    const searchesPerformed: SearchResult[][] = [];

    const messages: OllamaChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful AI assistant with access to web search tools. ' +
          'Use the web_search tool to find current information when needed, ' +
          'and fetch_url to read specific pages. Synthesize the results into a clear answer.',
      },
      { role: 'user', content: userMessage },
    ];

    let totalTokensUsed = 0;
    let finalModel = options.model || '';

    for (let round = 0; round < maxToolRounds; round++) {
      const response = await this.ollamaWrapper.generateWithTools(
        messages,
        this.getSearchTools(),
        { model: options.model, modelOptions: { temperature: options.temperature, num_predict: options.maxTokens } }
      );

      finalModel = response.model;
      totalTokensUsed += (response.prompt_eval_count || 0) + (response.eval_count || 0);

      const assistantMsg = response.message as OllamaChatMessage;

      // No tool calls → final answer
      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        return {
          content: assistantMsg.content || '',
          model: finalModel,
          tokensUsed: totalTokensUsed,
          responseTimeMs: Date.now() - startTime,
          searchesPerformed,
        };
      }

      // Add assistant message with tool calls
      messages.push(assistantMsg);

      // Execute each tool call and append results
      for (const toolCall of assistantMsg.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments as Record<string, unknown>;

        aiLogger.info('WebSearchService executing tool:', { toolName, round });
        const toolResult = await this.executeToolCall(toolName, toolArgs);

        // Collect search results for metadata
        if (toolName === 'web_search') {
          try {
            const parsed = JSON.parse(toolResult);
            if (Array.isArray(parsed.results)) {
              searchesPerformed.push(parsed.results as SearchResult[]);
            }
          } catch {
            // ignore parse errors
          }
        }

        messages.push({ role: 'tool', content: toolResult });
      }
    }

    // Final completion after all tool rounds
    const finalResponse = await this.ollamaWrapper.generateChatCompletion(
      messages,
      { model: options.model, modelOptions: { temperature: options.temperature, num_predict: options.maxTokens } }
    );

    totalTokensUsed += (finalResponse.prompt_eval_count || 0) + (finalResponse.eval_count || 0);

    return {
      content: (finalResponse.message as OllamaChatMessage)?.content || '',
      model: finalResponse.model || finalModel,
      tokensUsed: totalTokensUsed,
      responseTimeMs: Date.now() - startTime,
      searchesPerformed,
    };
  }
}

export default WebSearchService;
