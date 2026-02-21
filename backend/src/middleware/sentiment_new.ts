import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple sentiment analysis using keyword-based approach
// Could be enhanced with external services or ML models

interface SentimentAnalysis {
  score: number; // -1 to 1
  magnitude: number; // 0 to 1
  label: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  emotions: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
  };
}

// Sentiment keyword dictionaries
const POSITIVE_WORDS = [
  'happy', 'joy', 'love', 'excellent', 'amazing', 'wonderful', 'great', 'good', 'awesome',
  'fantastic', 'brilliant', 'perfect', 'beautiful', 'nice', 'pleasant', 'delighted',
  'excited', 'thrilled', 'grateful', 'thankful', 'appreciate', 'enjoy', 'fun', 'smile',
  'laugh', 'celebration', 'success', 'achievement', 'proud', 'confident', 'optimistic',
  'hope', 'blessed', 'lucky', 'satisfied', 'content', 'peaceful', 'relaxed'
];

const NEGATIVE_WORDS = [
  'sad', 'angry', 'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'disgusting',
  'annoying', 'frustrated', 'disappointed', 'upset', 'worried', 'stressed', 'anxious',
  'depressed', 'lonely', 'hurt', 'pain', 'suffering', 'cry', 'tears', 'fear', 'scared',
  'terrified', 'nightmare', 'disaster', 'failure', 'mistake', 'problem', 'issue',
  'difficult', 'hard', 'struggle', 'tired', 'exhausted', 'overwhelmed'
];

const EMOTION_KEYWORDS = {
  joy: ['happy', 'joy', 'excited', 'thrilled', 'delighted', 'cheerful', 'laugh', 'smile', 'fun'],
  sadness: ['sad', 'cry', 'tears', 'disappointed', 'lonely', 'grief', 'sorrow', 'melancholy'],
  anger: ['angry', 'mad', 'furious', 'rage', 'hate', 'frustrated', 'annoyed', 'irritated'],
  fear: ['scared', 'afraid', 'terrified', 'anxious', 'worried', 'nervous', 'panic', 'fear'],
  surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected', 'sudden', 'wow']
};

export class SentimentAnalyzer {
  /**
   * Analyze sentiment of text
   */
  analyze(text: string): SentimentAnalysis {
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = cleanText.split(/\s+/).filter(word => word.length > 2);
    
    let positiveScore = 0;
    let negativeScore = 0;
    let totalWords = words.length;
    
    const foundKeywords: string[] = [];
    const emotions = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0
    };

    // Calculate sentiment scores
    for (const word of words) {
      // Check positive words
      if (POSITIVE_WORDS.includes(word)) {
        positiveScore += 1;
        foundKeywords.push(`+${word}`);
      }
      
      // Check negative words
      if (NEGATIVE_WORDS.includes(word)) {
        negativeScore += 1;
        foundKeywords.push(`-${word}`);
      }

      // Check emotion keywords
      for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        if (keywords.includes(word)) {
          emotions[emotion as keyof typeof emotions] += 1;
        }
      }
    }

    // Apply modifiers for intensity
    const intensifiers = ['very', 'really', 'extremely', 'absolutely', 'totally', 'completely'];
    const diminishers = ['slightly', 'somewhat', 'little', 'barely', 'hardly'];
    
    let intensityMultiplier = 1;
    for (const word of words) {
      if (intensifiers.includes(word)) {
        intensityMultiplier += 0.3;
      } else if (diminishers.includes(word)) {
        intensityMultiplier -= 0.3;
      }
    }
    
    // Apply negations
    const negations = ['not', 'no', 'never', 'nothing', 'nobody', 'nowhere', 'neither', 'nor'];
    let negationCount = 0;
    for (const word of words) {
      if (negations.includes(word)) {
        negationCount++;
      }
    }
    
    // Flip sentiment if odd number of negations
    if (negationCount % 2 === 1) {
      [positiveScore, negativeScore] = [negativeScore, positiveScore];
    }

    // Calculate final scores
    positiveScore *= intensityMultiplier;
    negativeScore *= intensityMultiplier;
    
    // Normalize scores
    const maxScore = Math.max(positiveScore, negativeScore, 1);
    const normalizedPositive = positiveScore / maxScore;
    const normalizedNegative = negativeScore / maxScore;
    
    // Calculate sentiment score (-1 to 1)
    const sentimentScore = normalizedPositive - normalizedNegative;
    
    // Calculate magnitude (0 to 1)
    const magnitude = Math.min((positiveScore + negativeScore) / Math.max(totalWords, 1), 1);
    
    // Determine label
    let label: 'positive' | 'negative' | 'neutral';
    if (sentimentScore > 0.1) {
      label = 'positive';
    } else if (sentimentScore < -0.1) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    // Normalize emotions
    const totalEmotions = Object.values(emotions).reduce((sum, val) => sum + val, 0);
    if (totalEmotions > 0) {
      for (const emotion of Object.keys(emotions) as Array<keyof typeof emotions>) {
        emotions[emotion] = emotions[emotion] / totalEmotions;
      }
    }

    return {
      score: Number(sentimentScore.toFixed(3)),
      magnitude: Number(magnitude.toFixed(3)),
      label,
      keywords: foundKeywords,
      emotions
    };
  }

  /**
   * Analyze sentiment with context from conversation history
   */
  analyzeWithContext(text: string, recentMessages: string[] = []): SentimentAnalysis {
    const baseAnalysis = this.analyze(text);
    
    // Analyze context for mood continuity
    let contextSentiment = 0;
    if (recentMessages.length > 0) {
      const contextAnalyses = recentMessages.map(msg => this.analyze(msg));
      contextSentiment = contextAnalyses.reduce((sum, analysis) => sum + analysis.score, 0) / contextAnalyses.length;
    }
    
    // Blend current sentiment with context (70% current, 30% context)
    const contextAdjustedScore = (baseAnalysis.score * 0.7) + (contextSentiment * 0.3);
    
    // Update label based on adjusted score
    let adjustedLabel: 'positive' | 'negative' | 'neutral';
    if (contextAdjustedScore > 0.1) {
      adjustedLabel = 'positive';
    } else if (contextAdjustedScore < -0.1) {
      adjustedLabel = 'negative';
    } else {
      adjustedLabel = 'neutral';
    }

    return {
      ...baseAnalysis,
      score: Number(contextAdjustedScore.toFixed(3)),
      label: adjustedLabel
    };
  }
}

const sentimentAnalyzer = new SentimentAnalyzer();

/**
 * Express middleware for sentiment analysis
 */
export const sentimentMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only analyze POST requests with message content
    if (req.method === 'POST' && req.body?.message) {
      const message = req.body.message;
      const sessionId = req.body.sessionId || req.headers['session-id'];
      
      // Analyze sentiment
      const analysis = sentimentAnalyzer.analyze(message);
      
      // Attach sentiment data to request
      req.sentiment = analysis;
      
      logger.debug('Sentiment analysis completed:', {
        sessionId,
        score: analysis.score,
        label: analysis.label,
        magnitude: analysis.magnitude,
        keywords: analysis.keywords.slice(0, 5) // Log first 5 keywords only
      });
    }
    
    next();
  } catch (error) {
    logger.error('Sentiment analysis failed:', error);
    // Continue without sentiment data rather than blocking the request
    next();
  }
};

/**
 * Get detailed sentiment analysis for a message
 */
export const analyzeSentiment = (text: string, context?: string[]): SentimentAnalysis => {
  return sentimentAnalyzer.analyzeWithContext(text, context);
};

/**
 * Batch analyze sentiment for multiple messages
 */
export const batchAnalyzeSentiment = (messages: string[]): SentimentAnalysis[] => {
  return messages.map(message => sentimentAnalyzer.analyze(message));
};

// Extend Express Request type to include sentiment
declare global {
  namespace Express {
    interface Request {
      sentiment?: SentimentAnalysis;
    }
  }
}

export default sentimentMiddleware;
