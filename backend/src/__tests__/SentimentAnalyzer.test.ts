/**
 * Sentiment Analysis Unit Tests
 * Tests for the sentiment middleware and analyzer
 */

import { SentimentAnalyzer } from '../middleware/sentiment';

// Mock the DatabaseService
jest.mock('../services/DatabaseService', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getPersonalityState: jest.fn().mockResolvedValue({
      id: 1,
      name: 'Lacky',
      current_mood: {
        energy: 75,
        empathy: 80,
        humor: 70,
        curiosity: 85,
        patience: 90,
      },
      total_interactions: 100,
    }),
    updatePersonalityState: jest.fn().mockResolvedValue(undefined),
  })),
  databaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getPersonalityState: jest.fn().mockResolvedValue({
      id: 1,
      name: 'Lacky',
      current_mood: {
        energy: 75,
        empathy: 80,
        humor: 70,
        curiosity: 85,
        patience: 90,
      },
      total_interactions: 100,
    }),
    updatePersonalityState: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  apiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('SentimentAnalyzer', () => {
  let analyzer: SentimentAnalyzer;

  beforeEach(() => {
    analyzer = SentimentAnalyzer.getInstance();
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment correctly', async () => {
      const result = await analyzer.analyzeSentiment('I love this amazing product! It\'s wonderful!');
      
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should analyze negative sentiment correctly', async () => {
      const result = await analyzer.analyzeSentiment('I hate this terrible product. It\'s awful!');
      
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should analyze neutral sentiment correctly', async () => {
      const result = await analyzer.analyzeSentiment('The weather is cloudy today.');
      
      expect(result.label).toBe('neutral');
      expect(Math.abs(result.score)).toBeLessThanOrEqual(0.1);
    });

    it('should extract positive emotional markers', async () => {
      const result = await analyzer.analyzeSentiment('I am so happy and excited about this!');
      
      // The analysis should detect positive sentiment
      expect(result.label).toBe('positive');
      // The details should be populated
      expect(result.details).toBeDefined();
    });

    it('should extract negative emotional markers', async () => {
      const result = await analyzer.analyzeSentiment('I feel terrible and awful about my situation.');
      
      // The analysis should detect negative sentiment
      expect(result.label).toBe('negative');
      // The details should be populated
      expect(result.details).toBeDefined();
    });

    it('should handle empty text gracefully', async () => {
      const result = await analyzer.analyzeSentiment('');
      
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
    });
  });

  describe('generateContextTags', () => {
    it('should generate sentiment-based tags', () => {
      const sentimentAnalysis = {
        score: 0.5,
        label: 'positive' as const,
        confidence: 0.8,
        details: {
          positiveWords: ['happy'],
          negativeWords: [],
          emotionalMarkers: ['positive:happy'],
        },
      };
      
      const tags = analyzer.generateContextTags('I am happy today!', sentimentAnalysis);
      
      expect(tags).toContain('sentiment:positive');
      expect(tags).toContain('high-confidence');
    });

    it('should detect questions', () => {
      const sentimentAnalysis = {
        score: 0,
        label: 'neutral' as const,
        confidence: 0.5,
        details: {},
      };
      
      const tags = analyzer.generateContextTags('How can I help you?', sentimentAnalysis);
      
      expect(tags).toContain('question');
    });

    it('should detect help requests', () => {
      const sentimentAnalysis = {
        score: 0,
        label: 'neutral' as const,
        confidence: 0.5,
        details: {},
      };
      
      const tags = analyzer.generateContextTags('Can you help me with this?', sentimentAnalysis);
      
      expect(tags).toContain('help-request');
    });

    it('should detect gratitude', () => {
      const sentimentAnalysis = {
        score: 0.3,
        label: 'positive' as const,
        confidence: 0.5,
        details: {},
      };
      
      const tags = analyzer.generateContextTags('Thank you so much for your help!', sentimentAnalysis);
      
      expect(tags).toContain('gratitude');
    });

    it('should detect technical content', () => {
      const sentimentAnalysis = {
        score: 0,
        label: 'neutral' as const,
        confidence: 0.5,
        details: {},
      };
      
      const tags = analyzer.generateContextTags('I need help debugging my code', sentimentAnalysis);
      
      expect(tags).toContain('technical');
    });

    it('should detect creative content', () => {
      const sentimentAnalysis = {
        score: 0,
        label: 'neutral' as const,
        confidence: 0.5,
        details: {},
      };
      
      const tags = analyzer.generateContextTags('Can you help me write a story?', sentimentAnalysis);
      
      expect(tags).toContain('creative');
    });
  });

  describe('updateMoodFromSentiment', () => {
    it('should update mood based on positive sentiment', async () => {
      const sentimentAnalysis = {
        score: 0.8,
        label: 'positive' as const,
        confidence: 0.9,
        details: {
          emotionalMarkers: ['positive:happy', 'humor:funny'],
        },
      };
      
      const updatedMood = await analyzer.updateMoodFromSentiment(sentimentAnalysis);
      
      expect(updatedMood).toBeTruthy();
      // Mood adjustments should have been applied
    });

    it('should update mood based on negative sentiment', async () => {
      const sentimentAnalysis = {
        score: -0.8,
        label: 'negative' as const,
        confidence: 0.9,
        details: {
          emotionalMarkers: ['negative:sad', 'empathy:struggle'],
        },
      };
      
      const updatedMood = await analyzer.updateMoodFromSentiment(sentimentAnalysis);
      
      expect(updatedMood).toBeTruthy();
    });
  });
});
