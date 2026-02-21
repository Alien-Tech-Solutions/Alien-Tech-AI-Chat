/**
 * WebFetcher - Real-time web search and content extraction service
 * Provides intelligent web fetching, search, and content summarization
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { aiLogger } from '../utils/logger';
import { config } from '../config/settings';

// Search result interface
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp?: Date;
  relevanceScore?: number;
}

// Fetched content interface
export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  summary?: string;
  metadata: {
    author?: string;
    publishDate?: string;
    lastModified?: string;
    description?: string;
    keywords?: string[];
    language?: string;
    wordCount: number;
    readingTimeMinutes: number;
  };
  links: Array<{ text: string; href: string }>;
  images: Array<{ src: string; alt: string }>;
  fetchedAt: Date;
}

// Search options
export interface SearchOptions {
  maxResults?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  language?: string;
  safeSearch?: boolean;
  includeNews?: boolean;
}

// Fetch options
export interface FetchOptions {
  extractMainContent?: boolean;
  includeLinks?: boolean;
  includeImages?: boolean;
  maxContentLength?: number;
  timeout?: number;
}

// Search provider interface
interface SearchProvider {
  name: string;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  isAvailable(): Promise<boolean>;
}

export class WebFetcher {
  private httpClient: AxiosInstance;
  private searchProviders: Map<string, SearchProvider> = new Map();
  private cache: Map<string, { data: FetchedContent; expiry: Date }> = new Map();
  private readonly cacheExpiryMinutes = 30;
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor() {
    this.httpClient = axios.create({
      timeout: config.webSearch?.timeout || 30000,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    this.initializeSearchProviders();
    aiLogger.info('WebFetcher initialized');
  }

  /**
   * Initialize search providers
   */
  private initializeSearchProviders(): void {
    // DuckDuckGo (no API key required)
    this.searchProviders.set('duckduckgo', {
      name: 'DuckDuckGo',
      search: this.searchDuckDuckGo.bind(this),
      isAvailable: async () => true
    });

    // Brave Search (if API key is available)
    if (process.env.BRAVE_SEARCH_API_KEY) {
      this.searchProviders.set('brave', {
        name: 'Brave Search',
        search: this.searchBrave.bind(this),
        isAvailable: async () => !!process.env.BRAVE_SEARCH_API_KEY
      });
    }

    // SerpAPI (if API key is available)
    if (process.env.SERPAPI_KEY) {
      this.searchProviders.set('serpapi', {
        name: 'SerpAPI',
        search: this.searchSerpAPI.bind(this),
        isAvailable: async () => !!process.env.SERPAPI_KEY
      });
    }

    aiLogger.info(`Search providers initialized: ${Array.from(this.searchProviders.keys()).join(', ')}`);
  }

  /**
   * Search the web using available providers
   */
  async search(query: string, options: SearchOptions = {}): Promise<{
    results: SearchResult[];
    provider: string;
    totalResults: number;
    searchTime: number;
  }> {
    const startTime = Date.now();
    const maxResults = options.maxResults || config.webSearch?.maxResults || 10;

    // Try providers in order of preference
    const providerOrder = ['brave', 'serpapi', 'duckduckgo'];
    
    for (const providerName of providerOrder) {
      const provider = this.searchProviders.get(providerName);
      if (!provider) continue;

      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) continue;

        aiLogger.info(`Searching with ${provider.name}:`, { query, options });
        
        const results = await provider.search(query, options);
        
        return {
          results: results.slice(0, maxResults),
          provider: provider.name,
          totalResults: results.length,
          searchTime: Date.now() - startTime
        };
      } catch (error) {
        aiLogger.warn(`Search failed with ${provider.name}:`, error);
        continue;
      }
    }

    // Fallback: return empty results
    return {
      results: [],
      provider: 'none',
      totalResults: 0,
      searchTime: Date.now() - startTime
    };
  }

  /**
   * Search using DuckDuckGo (HTML scraping - no API key required)
   */
  private async searchDuckDuckGo(query: string, options: SearchOptions): Promise<SearchResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await this.httpClient.get(
        `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
        {
          headers: {
            'User-Agent': this.userAgent
          }
        }
      );

      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.result').each((index, element) => {
        if (index >= (options.maxResults || 10)) return;

        const $result = $(element);
        const title = $result.find('.result__title a').text().trim();
        const url = $result.find('.result__url').text().trim();
        const snippet = $result.find('.result__snippet').text().trim();

        if (title && url) {
          results.push({
            title,
            url: url.startsWith('http') ? url : `https://${url}`,
            snippet,
            source: 'DuckDuckGo'
          });
        }
      });

      return results;
    } catch (error) {
      aiLogger.error('DuckDuckGo search failed:', error);
      throw error;
    }
  }

  /**
   * Search using Brave Search API
   */
  private async searchBrave(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) throw new Error('Brave Search API key not configured');

    try {
      const params: Record<string, string> = {
        q: query,
        count: (options.maxResults || 10).toString()
      };

      if (options.timeRange && options.timeRange !== 'all') {
        params.freshness = options.timeRange === 'day' ? 'pd' :
                          options.timeRange === 'week' ? 'pw' :
                          options.timeRange === 'month' ? 'pm' : 'py';
      }

      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json'
        },
        params
      });

      const webResults = response.data?.web?.results || [];
      
      return webResults.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.description,
        source: 'Brave Search',
        timestamp: result.age ? new Date(result.age) : undefined
      }));
    } catch (error) {
      aiLogger.error('Brave Search failed:', error);
      throw error;
    }
  }

  /**
   * Search using SerpAPI
   */
  private async searchSerpAPI(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error('SerpAPI key not configured');

    try {
      const params: Record<string, string> = {
        q: query,
        api_key: apiKey,
        engine: 'google',
        num: (options.maxResults || 10).toString()
      };

      if (options.timeRange && options.timeRange !== 'all') {
        params.tbs = options.timeRange === 'day' ? 'qdr:d' :
                    options.timeRange === 'week' ? 'qdr:w' :
                    options.timeRange === 'month' ? 'qdr:m' : 'qdr:y';
      }

      const response = await axios.get('https://serpapi.com/search', { params });
      const organicResults = response.data?.organic_results || [];

      return organicResults.map((result: any) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        source: 'SerpAPI (Google)',
        timestamp: result.date ? new Date(result.date) : undefined
      }));
    } catch (error) {
      aiLogger.error('SerpAPI search failed:', error);
      throw error;
    }
  }

  /**
   * Fetch and extract content from a URL
   */
  async fetchUrl(url: string, options: FetchOptions = {}): Promise<FetchedContent> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached && cached.expiry > new Date()) {
      aiLogger.debug('Returning cached content for:', url);
      return cached.data;
    }

    const timeout = options.timeout || 30000;
    const maxLength = options.maxContentLength || 50000;

    try {
      aiLogger.info('Fetching URL:', url);

      const response = await this.httpClient.get(url, { timeout });
      const $ = cheerio.load(response.data);

      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .ads, .advertisement, .social-share, .comments').remove();

      // Extract metadata
      const title = $('title').text().trim() || 
                   $('meta[property="og:title"]').attr('content') || 
                   $('h1').first().text().trim() || 
                   'Untitled';

      const description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content') ||
                         '';

      const author = $('meta[name="author"]').attr('content') ||
                    $('[rel="author"]').text().trim() ||
                    $('[class*="author"]').first().text().trim();

      const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                         $('time[datetime]').attr('datetime') ||
                         $('[class*="date"]').first().text().trim();

      const keywords = ($('meta[name="keywords"]').attr('content') || '')
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const language = $('html').attr('lang') || 'en';

      // Extract main content
      let content = '';
      if (options.extractMainContent !== false) {
        // Try common content containers
        const contentSelectors = [
          'article',
          '[role="main"]',
          '.content',
          '.post-content',
          '.article-content',
          '.entry-content',
          '#content',
          'main',
          '.main'
        ];

        for (const selector of contentSelectors) {
          const $content = $(selector);
          if ($content.length > 0) {
            content = $content.text().trim();
            if (content.length > 100) break;
          }
        }

        // Fallback to body if no content found
        if (content.length < 100) {
          content = $('body').text().trim();
        }
      } else {
        content = $('body').text().trim();
      }

      // Clean and truncate content
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim()
        .substring(0, maxLength);

      // Extract links if requested
      const links: Array<{ text: string; href: string }> = [];
      if (options.includeLinks !== false) {
        // Dangerous URL schemes to filter out
        const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:'];
        
        $('a[href]').each((i, el) => {
          if (i >= 50) return; // Limit to 50 links
          const $a = $(el);
          const href = $a.attr('href');
          const text = $a.text().trim();
          
          // Filter out dangerous URLs
          const isDangerous = !href || href.startsWith('#') || 
            dangerousSchemes.some(scheme => href.toLowerCase().startsWith(scheme));
          
          if (href && text && !isDangerous) {
            links.push({
              text: text.substring(0, 100),
              href: href.startsWith('http') ? href : new URL(href, url).href
            });
          }
        });
      }

      // Extract images if requested
      const images: Array<{ src: string; alt: string }> = [];
      if (options.includeImages) {
        $('img[src]').each((i, el) => {
          if (i >= 20) return; // Limit to 20 images
          const $img = $(el);
          const src = $img.attr('src');
          const alt = $img.attr('alt') || '';
          if (src) {
            images.push({
              src: src.startsWith('http') ? src : new URL(src, url).href,
              alt
            });
          }
        });
      }

      // Calculate reading time (assuming 200 words per minute)
      const wordCount = content.split(/\s+/).length;
      const readingTimeMinutes = Math.ceil(wordCount / 200);

      const fetchedContent: FetchedContent = {
        url,
        title,
        content,
        metadata: {
          author: author || undefined,
          publishDate: publishDate || undefined,
          description: description || undefined,
          keywords: keywords.length > 0 ? keywords : undefined,
          language,
          wordCount,
          readingTimeMinutes
        },
        links,
        images,
        fetchedAt: new Date()
      };

      // Cache the result
      this.cache.set(url, {
        data: fetchedContent,
        expiry: new Date(Date.now() + this.cacheExpiryMinutes * 60 * 1000)
      });

      return fetchedContent;

    } catch (error) {
      aiLogger.error('Failed to fetch URL:', { url, error });
      throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search and fetch: Perform a search and optionally fetch top results
   */
  async searchAndFetch(
    query: string,
    options: SearchOptions & { 
      fetchTopN?: number;
      fetchOptions?: FetchOptions;
    } = {}
  ): Promise<{
    searchResults: SearchResult[];
    fetchedContent: FetchedContent[];
    provider: string;
    totalTime: number;
  }> {
    const startTime = Date.now();
    const fetchTopN = options.fetchTopN || 3;

    // Perform search
    const searchResult = await this.search(query, options);

    // Fetch top N results
    const fetchedContent: FetchedContent[] = [];
    const topResults = searchResult.results.slice(0, fetchTopN);

    for (const result of topResults) {
      try {
        const content = await this.fetchUrl(result.url, options.fetchOptions);
        fetchedContent.push(content);
      } catch (error) {
        aiLogger.warn(`Failed to fetch ${result.url}:`, error);
        // Continue with other results
      }
    }

    return {
      searchResults: searchResult.results,
      fetchedContent,
      provider: searchResult.provider,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Quick lookup: Search and return a summarized answer
   */
  async quickLookup(query: string): Promise<{
    answer: string;
    sources: Array<{ title: string; url: string }>;
    confidence: number;
  }> {
    try {
      const { searchResults, fetchedContent } = await this.searchAndFetch(query, {
        maxResults: 5,
        fetchTopN: 2
      });

      if (fetchedContent.length === 0) {
        return {
          answer: 'I could not find relevant information for your query.',
          sources: searchResults.map(r => ({ title: r.title, url: r.url })),
          confidence: 0
        };
      }

      // Combine content from fetched pages
      const combinedContent = fetchedContent
        .map(c => `Source: ${c.title}\n${c.content.substring(0, 2000)}`)
        .join('\n\n---\n\n');

      // Extract key information (simplified - in production, use AI summarization)
      const sentences = combinedContent
        .split(/[.!?]+/)
        .filter(s => s.trim().length > 20)
        .slice(0, 5);

      const answer = sentences.join('. ').trim() + '.';

      return {
        answer: answer.substring(0, 1000),
        sources: fetchedContent.map(c => ({ title: c.title, url: c.url })),
        confidence: Math.min(fetchedContent.length / 2, 1)
      };

    } catch (error) {
      aiLogger.error('Quick lookup failed:', error);
      return {
        answer: 'I encountered an error while searching. Please try again.',
        sources: [],
        confidence: 0
      };
    }
  }

  /**
   * Extract structured data from a URL
   */
  async extractStructuredData(url: string): Promise<{
    url: string;
    jsonLd: any[];
    openGraph: Record<string, string>;
    twitterCard: Record<string, string>;
    microdata: any[];
  }> {
    try {
      const response = await this.httpClient.get(url);
      const $ = cheerio.load(response.data);

      // Extract JSON-LD
      const jsonLd: any[] = [];
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const data = JSON.parse($(el).html() || '');
          jsonLd.push(data);
        } catch (parseError) {
          // Skip invalid JSON
        }
      });

      // Extract Open Graph data
      const openGraph: Record<string, string> = {};
      $('meta[property^="og:"]').each((i, el) => {
        const property = $(el).attr('property')?.replace('og:', '') || '';
        const content = $(el).attr('content') || '';
        if (property && content) {
          openGraph[property] = content;
        }
      });

      // Extract Twitter Card data
      const twitterCard: Record<string, string> = {};
      $('meta[name^="twitter:"]').each((i, el) => {
        const name = $(el).attr('name')?.replace('twitter:', '') || '';
        const content = $(el).attr('content') || '';
        if (name && content) {
          twitterCard[name] = content;
        }
      });

      // Extract microdata (simplified)
      const microdata: any[] = [];
      $('[itemscope]').each((i, el) => {
        if (i >= 10) return;
        const $item = $(el);
        const itemType = $item.attr('itemtype');
        const props: Record<string, string> = {};
        
        $item.find('[itemprop]').each((j, prop) => {
          const name = $(prop).attr('itemprop') || '';
          const value = $(prop).attr('content') || $(prop).text().trim();
          if (name && value) {
            props[name] = value;
          }
        });

        if (itemType || Object.keys(props).length > 0) {
          microdata.push({ type: itemType, properties: props });
        }
      });

      return {
        url,
        jsonLd,
        openGraph,
        twitterCard,
        microdata
      };

    } catch (error) {
      aiLogger.error('Failed to extract structured data:', { url, error });
      throw error;
    }
  }

  /**
   * Get news on a topic
   */
  async getNews(topic: string, options: {
    maxResults?: number;
    timeRange?: 'day' | 'week' | 'month';
  } = {}): Promise<SearchResult[]> {
    return this.search(`${topic} news`, {
      maxResults: options.maxResults || 10,
      timeRange: options.timeRange || 'week',
      includeNews: true
    }).then(r => r.results);
  }

  /**
   * Get weather information for a location
   */
  async getWeatherInfo(location: string): Promise<{
    location: string;
    data: any;
    source: string;
  }> {
    try {
      // Use wttr.in for free weather data
      const response = await this.httpClient.get(
        `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
        { timeout: 10000 }
      );

      return {
        location,
        data: response.data,
        source: 'wttr.in'
      };
    } catch (error) {
      aiLogger.error('Weather fetch failed:', { location, error });
      throw new Error('Failed to fetch weather information');
    }
  }

  /**
   * Get current time for a location
   */
  async getTimeInfo(location: string): Promise<{
    location: string;
    time: string;
    timezone: string;
  }> {
    try {
      // Use worldtimeapi.org for time data (HTTPS for security)
      const response = await this.httpClient.get(
        `https://worldtimeapi.org/api/timezone/${encodeURIComponent(location)}`,
        { timeout: 10000 }
      );

      return {
        location,
        time: response.data.datetime,
        timezone: response.data.timezone
      };
    } catch (error) {
      // Fallback - return current time
      return {
        location,
        time: new Date().toISOString(),
        timezone: 'UTC'
      };
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    aiLogger.info('WebFetcher cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ url: string; expiry: Date }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([url, data]) => ({
      url,
      expiry: data.expiry
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Get available search providers
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.searchProviders) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }

    return available;
  }
}

// Export singleton instance
export const webFetcher = new WebFetcher();
export default WebFetcher;
