import { Request, Response, NextFunction } from 'express';
import * as natural from 'natural';
import Sentiment from 'sentiment';
import { apiLogger as logger } from '../utils/logger';
import { SentimentAnalysis, MoodState, PersonalityState } from '../types';
import { DatabaseService } from '../services/DatabaseService';

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Emotional marker patterns
const emotionalMarkers = {
  positive: [
    'love', 'amazing', 'wonderful', 'fantastic', 'great', 'excellent', 'awesome',
    'happy', 'joy', 'excited', 'thrilled', 'delighted', 'pleased', 'grateful',
    'confident', 'optimistic', 'hopeful', 'blessed', 'lucky', 'proud'
  ],
  negative: [
    'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'disappointed',
    'sad', 'angry', 'frustrated', 'upset', 'depressed', 'worried', 'anxious',
    'stressed', 'overwhelmed', 'helpless', 'lonely', 'tired', 'exhausted'
  ],
  empathy: [
    'understand', 'feel', 'emotion', 'heart', 'soul', 'pain', 'struggle',
    'difficult', 'hard', 'tough', 'challenge', 'support', 'care', 'concern'
  ],
  curiosity: [
    'wonder', 'curious', 'interesting', 'fascinating', 'learn', 'discover',
    'explore', 'question', 'why', 'how', 'what', 'research', 'study', 'investigate'
  ],
  humor: [
    'funny', 'hilarious', 'joke', 'laugh', 'lol', 'haha', 'silly', 'amusing',
    'witty', 'clever', 'sarcastic', 'ironic', 'ridiculous', 'absurd'
  ]
};

/**
 * Advanced sentiment analysis class
 */
class SentimentAnalyzer {
  private static instance: SentimentAnalyzer;
  private database: DatabaseService;

  constructor(database?: DatabaseService) {
    this.database = database || new DatabaseService();
  }

  static getInstance(database?: DatabaseService): SentimentAnalyzer {
    if (!SentimentAnalyzer.instance) {
      SentimentAnalyzer.instance = new SentimentAnalyzer(database);
    }
    return SentimentAnalyzer.instance;
  }

  /**
   * Analyze sentiment of text with enhanced emotional detection
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      // Basic sentiment analysis
      const result = sentiment.analyze(text);
      
      // Normalize score to -1 to 1 range
      const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));
      
      // Determine label based on score
      let label: 'positive' | 'negative' | 'neutral';
      if (normalizedScore > 0.1) {
        label = 'positive';
      } else if (normalizedScore < -0.1) {
        label = 'negative';
      } else {
        label = 'neutral';
      }

      // Calculate confidence based on absolute score and word count
      const confidence = Math.min(1, Math.abs(normalizedScore) + (result.words.length / 100));

      // Extract emotional markers
      const details = this.extractEmotionalMarkers(text);

      return {
        score: normalizedScore,
        label,
        confidence,
        details
      };

    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      
      // Return neutral sentiment on error
      return {
        score: 0,
        label: 'neutral',
        confidence: 0,
        details: {}
      };
    }
  }

  /**
   * Extract emotional markers from text
   */
  private extractEmotionalMarkers(text: string): any {
    const lowerText = text.toLowerCase();
    const words = natural.WordTokenizer.prototype.tokenize(lowerText) || [];
    
    const markers = {
      positiveWords: [] as string[],
      negativeWords: [] as string[],
      emotionalMarkers: [] as string[]
    };

    // Find emotional markers
    for (const word of words) {
      if (emotionalMarkers.positive.includes(word)) {
        markers.positiveWords.push(word);
        markers.emotionalMarkers.push(`positive:${word}`);
      }
      
      if (emotionalMarkers.negative.includes(word)) {
        markers.negativeWords.push(word);
        markers.emotionalMarkers.push(`negative:${word}`);
      }
      
      if (emotionalMarkers.empathy.includes(word)) {
        markers.emotionalMarkers.push(`empathy:${word}`);
      }
      
      if (emotionalMarkers.curiosity.includes(word)) {
        markers.emotionalMarkers.push(`curiosity:${word}`);
      }
      
      if (emotionalMarkers.humor.includes(word)) {
        markers.emotionalMarkers.push(`humor:${word}`);
      }
    }

    return markers;
  }

  /**
   * Update mood state based on sentiment analysis
   */
  async updateMoodFromSentiment(sentimentAnalysis: SentimentAnalysis): Promise<MoodState | null> {
    try {
      // Get current personality state
      const personalityState = await this.database.getPersonalityState();
      if (!personalityState) return null;

      const currentMood = personalityState.current_mood;
      const newMood = { ...currentMood };

      // Sentiment-based mood adjustments
      const sentimentImpact = sentimentAnalysis.score * sentimentAnalysis.confidence;
      
      if (sentimentAnalysis.label === 'positive') {
        newMood.energy = Math.min(100, newMood.energy + sentimentImpact * 20);
        newMood.humor = Math.min(100, newMood.humor + sentimentImpact * 15);
        newMood.curiosity = Math.min(100, newMood.curiosity + sentimentImpact * 10);
      } else if (sentimentAnalysis.label === 'negative') {
        newMood.empathy = Math.min(100, newMood.empathy + Math.abs(sentimentImpact) * 25);
        newMood.patience = Math.min(100, newMood.patience + Math.abs(sentimentImpact) * 15);
        newMood.humor = Math.max(0, newMood.humor - Math.abs(sentimentImpact) * 10);
      }

      // Emotional marker adjustments
      if (sentimentAnalysis.details?.emotionalMarkers) {
        for (const marker of sentimentAnalysis.details.emotionalMarkers) {
          const [category, word] = marker.split(':');
          
          switch (category) {
            case 'empathy':
              newMood.empathy = Math.min(100, newMood.empathy + 5);
              break;
            case 'curiosity':
              newMood.curiosity = Math.min(100, newMood.curiosity + 8);
              break;
            case 'humor':
              newMood.humor = Math.min(100, newMood.humor + 10);
              break;
          }
        }
      }

      // Apply volatility damping
      const volatility = 0.3; // Could be configurable
      Object.keys(newMood).forEach(key => {
        if (key !== 'factors') {
          const currentValue = currentMood[key as keyof MoodState] as number;
          const newValue = newMood[key as keyof MoodState] as number;
          (newMood as any)[key] = currentValue + (newValue - currentValue) * volatility;
        }
      });

      // Update personality state in database
      await this.database.updatePersonalityState({
        current_mood: newMood,
        total_interactions: personalityState.total_interactions + 1,
        last_interaction: new Date().toISOString()
      });

      logger.debug('Mood updated based on sentiment', { 
        sentiment: sentimentAnalysis.label, 
        score: sentimentAnalysis.score,
        moodChanges: this.calculateMoodDifference(currentMood, newMood)
      });

      return newMood;

    } catch (error) {
      logger.error('Failed to update mood from sentiment:', error);
      return null;
    }
  }

  /**
   * Calculate mood difference for logging
   */
  private calculateMoodDifference(oldMood: MoodState, newMood: MoodState): Record<string, number> {
    const diff: Record<string, number> = {};
    
    Object.keys(oldMood).forEach(key => {
      if (key !== 'factors' && typeof oldMood[key as keyof MoodState] === 'number') {
        const oldValue = oldMood[key as keyof MoodState] as number;
        const newValue = newMood[key as keyof MoodState] as number;
        diff[key] = Math.round((newValue - oldValue) * 100) / 100;
      }
    });
    
    return diff;
  }

  /**
   * Generate context tags based on sentiment and content
   */
  generateContextTags(text: string, sentimentAnalysis: SentimentAnalysis): string[] {
    const tags: string[] = [];
    
    // Sentiment-based tags
    tags.push(`sentiment:${sentimentAnalysis.label}`);
    
    if (sentimentAnalysis.confidence > 0.7) {
      tags.push('high-confidence');
    }

    // Emotional marker tags
    if (sentimentAnalysis.details?.emotionalMarkers) {
      sentimentAnalysis.details.emotionalMarkers.forEach((marker: string) => {
        tags.push(marker);
      });
    }

    // Content-based tags
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('?')) {
      tags.push('question');
    }
    
    if (lowerText.includes('help') || lowerText.includes('assist')) {
      tags.push('help-request');
    }
    
    if (lowerText.includes('thank') || lowerText.includes('appreciate')) {
      tags.push('gratitude');
    }

    // Technical content detection
    const technicalKeywords = ['code', 'program', 'software', 'computer', 'algorithm', 'debug', 'error'];
    if (technicalKeywords.some(keyword => lowerText.includes(keyword))) {
      tags.push('technical');
    }

    // Creative content detection
    const creativeKeywords = ['creative', 'art', 'design', 'write', 'story', 'poem', 'music'];
    if (creativeKeywords.some(keyword => lowerText.includes(keyword))) {
      tags.push('creative');
    }

    return tags;
  }
}

/**
 * Express middleware factory for sentiment analysis
 */
export const createSentimentMiddleware = (database: DatabaseService) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only analyze POST requests with message content
      if (req.method !== 'POST' || !req.body?.message) {
        return next();
      }

      const analyzer = SentimentAnalyzer.getInstance(database);
      const message = req.body.message;

      // Perform sentiment analysis
      const sentimentAnalysis = await analyzer.analyzeSentiment(message);
      
      // Update mood state
      const updatedMood = await analyzer.updateMoodFromSentiment(sentimentAnalysis);
      
      // Generate context tags
      const contextTags = analyzer.generateContextTags(message, sentimentAnalysis);

      // Attach analysis results to request
      (req as any).sentimentAnalysis = sentimentAnalysis;
      (req as any).updatedMood = updatedMood;
      (req as any).contextTags = contextTags;

      logger.debug('Sentiment analysis completed', {
        sentiment: sentimentAnalysis.label,
        score: sentimentAnalysis.score,
        confidence: sentimentAnalysis.confidence,
        tagsCount: contextTags.length
      });

      next();
    } catch (error) {
      logger.error('Failed to update mood from sentiment:', error);
      // Continue without sentiment analysis on error
      next();
    }
  };
};

/**
 * Express middleware for sentiment analysis
 */
export const sentimentMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Only analyze POST requests with message content
    if (req.method !== 'POST' || !req.body?.message) {
      return next();
    }

    const analyzer = SentimentAnalyzer.getInstance();
    const message = req.body.message;

    // Perform sentiment analysis
    const sentimentAnalysis = await analyzer.analyzeSentiment(message);
    
    // Update mood state
    const updatedMood = await analyzer.updateMoodFromSentiment(sentimentAnalysis);
    
    // Generate context tags
    const contextTags = analyzer.generateContextTags(message, sentimentAnalysis);

    // Attach analysis results to request
    (req as any).sentimentAnalysis = sentimentAnalysis;
    (req as any).updatedMood = updatedMood;
    (req as any).contextTags = contextTags;

    logger.debug('Sentiment analysis completed', {
      sentiment: sentimentAnalysis.label,
      score: sentimentAnalysis.score,
      confidence: sentimentAnalysis.confidence,
      tagsCount: contextTags.length
    });

    next();

  } catch (error) {
    logger.error('Sentiment middleware error:', error);
    
    // Continue with neutral sentiment on error
    (req as any).sentimentAnalysis = {
      score: 0,
      label: 'neutral',
      confidence: 0,
      details: {}
    };
    (req as any).contextTags = [];
    
    next();
  }
};

/**
 * Export the sentiment analyzer for direct use
 */
export { SentimentAnalyzer };
export default sentimentMiddleware; 