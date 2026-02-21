import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { MemoryService } from '../services/MemoryService';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { JournalEntry, JournalRequest, JournalResponse } from '../types';
import { apiLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

// Export factory function for dependency injection
export function createJournalRoutes(db: DatabaseService): Router {
  const router = Router();
  const memoryService = new MemoryService(db);

  // Apply rate limiting to journal endpoints
  router.use(endpointRateLimiter('journal'));

/**
 * Validate journal request
 */
function validateJournalRequest(body: any): JournalRequest {
  if (!body.title || typeof body.title !== 'string') {
    throw createValidationError('Title is required and must be a string');
  }

  if (!body.content || typeof body.content !== 'string') {
    throw createValidationError('Content is required and must be a string');
  }

  if (body.title.trim().length === 0) {
    throw createValidationError('Title cannot be empty');
  }

  if (body.content.trim().length === 0) {
    throw createValidationError('Content cannot be empty');
  }

  if (body.title.length > 200) {
    throw createValidationError('Title too long (max 200 characters)');
  }

  if (body.content.length > 50000) {
    throw createValidationError('Content too long (max 50,000 characters)');
  }

  return {
    title: body.title.trim(),
    content: body.content.trim(),
    tags: Array.isArray(body.tags) ? body.tags.filter(tag => typeof tag === 'string').slice(0, 10) : [],
    mood: body.mood || 'neutral',
    session_id: body.session_id || 'default',
    privacy_level: body.privacy_level || 'private'
  };
}

/**
 * Extract insights from journal entry
 */
function extractInsights(content: string): {
  themes: string[];
  emotions: string[];
  wordCount: number;
  readingTime: number;
} {
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed

  // Simple keyword extraction for themes
  const themeKeywords = {
    'work': ['work', 'job', 'career', 'office', 'colleague', 'boss', 'project', 'meeting'],
    'relationships': ['friend', 'family', 'love', 'relationship', 'partner', 'dating', 'marriage'],
    'health': ['health', 'exercise', 'diet', 'sleep', 'medical', 'fitness', 'wellness'],
    'personal_growth': ['learn', 'growth', 'goal', 'achievement', 'success', 'progress', 'improve'],
    'travel': ['travel', 'trip', 'vacation', 'explore', 'adventure', 'journey'],
    'creativity': ['create', 'art', 'music', 'write', 'design', 'creative', 'inspiration'],
    'finance': ['money', 'budget', 'save', 'spend', 'invest', 'financial', 'income'],
    'technology': ['tech', 'computer', 'internet', 'digital', 'software', 'online', 'app']
  };

  const emotionKeywords = {
    'happy': ['happy', 'joy', 'excited', 'pleased', 'delighted', 'cheerful', 'grateful'],
    'sad': ['sad', 'depressed', 'down', 'melancholy', 'upset', 'disappointed'],
    'angry': ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'irritated'],
    'anxious': ['anxious', 'worried', 'nervous', 'stressed', 'concerned', 'uneasy'],
    'calm': ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'content'],
    'confused': ['confused', 'uncertain', 'puzzled', 'lost', 'unclear'],
    'motivated': ['motivated', 'inspired', 'determined', 'driven', 'enthusiastic']
  };

  const contentLower = content.toLowerCase();
  
  const themes = Object.entries(themeKeywords)
    .filter(([theme, keywords]) => 
      keywords.some(keyword => contentLower.includes(keyword))
    )
    .map(([theme]) => theme)
    .slice(0, 5);

  const emotions = Object.entries(emotionKeywords)
    .filter(([emotion, keywords]) => 
      keywords.some(keyword => contentLower.includes(keyword))
    )
    .map(([emotion]) => emotion)
    .slice(0, 3);

  return { themes, emotions, wordCount, readingTime };
}

/**
 * POST /journal - Create a new journal entry
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const journalRequest = validateJournalRequest(req.body);
    
    apiLogger.info('Creating journal entry', {
      title: journalRequest.title,
      contentLength: journalRequest.content.length,
      tags: journalRequest.tags,
      sessionId: journalRequest.session_id
    });

    // Extract insights
    const insights = extractInsights(journalRequest.content);

    // Create journal entry
    const entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> = {
      title: journalRequest.title,
      content: journalRequest.content,
      tags: journalRequest.tags,
      mood: journalRequest.mood,
      session_id: journalRequest.session_id,
      privacy_level: journalRequest.privacy_level,
      word_count: insights.wordCount,
      reading_time_minutes: insights.readingTime,
      themes: insights.themes,
      emotions: insights.emotions
    };

    const entryId = await db.createJournalEntry(entry);
    const createdEntry = await db.getJournalEntry(entryId);

    if (!createdEntry) {
      throw new Error('Failed to retrieve created journal entry');
    }

    const responseTime = Date.now() - startTime;

    const response: JournalResponse = {
      entry: createdEntry,
      insights: {
        themes: insights.themes,
        emotions: insights.emotions,
        wordCount: insights.wordCount,
        readingTime: insights.readingTime
      },
      metadata: {
        entryId,
        responseTime,
        timestamp: new Date().toISOString()
      }
    };

    apiLogger.info('Journal entry created successfully', {
      entryId,
      title: journalRequest.title,
      wordCount: insights.wordCount,
      themes: insights.themes,
      responseTime
    });

    res.status(201).json(response);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiLogger.error('Failed to create journal entry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    throw error;
  }
}));

/**
 * GET /journal - Get journal entries with filtering and pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const offset = (page - 1) * limit;

  const sessionId = req.query.session_id as string;
  const mood = req.query.mood as string;
  const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
  const search = req.query.search as string;
  const sortBy = (req.query.sort_by as string) || 'created_at';
  const sortOrder = (req.query.sort_order as string) || 'desc';

  try {
    const entries = await db.getJournalEntries({
      sessionId,
      mood,
      tags,
      search,
      sortBy,
      sortOrder,
      limit,
      offset
    });

    const totalCount = await db.getJournalEntriesCount({
      sessionId,
      mood,
      tags,
      search
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    apiLogger.info('Retrieved journal entries', {
      count: entries.length,
      totalCount,
      page,
      totalPages,
      sessionId,
      filters: { mood, tags, search }
    });

    res.json({
      entries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        sessionId,
        mood,
        tags,
        search,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    apiLogger.error('Failed to retrieve journal entries', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query
    });
    throw error;
  }
}));

/**
 * GET /journal/:id - Get a specific journal entry
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const entryId = req.params.id;

  if (!entryId || entryId.trim().length === 0) {
    throw createValidationError('Entry ID is required');
  }

  try {
    const entry = await db.getJournalEntry(entryId);

    if (!entry) {
      throw createNotFoundError('Journal entry not found');
    }

    apiLogger.info('Retrieved journal entry', {
      entryId,
      title: entry.title,
      wordCount: entry.word_count
    });

    res.json({ entry });

  } catch (error) {
    apiLogger.error('Failed to retrieve journal entry', {
      entryId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}));

/**
 * PUT /journal/:id - Update a journal entry
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const entryId = req.params.id;
  const startTime = Date.now();

  if (!entryId || entryId.trim().length === 0) {
    throw createValidationError('Entry ID is required');
  }

  try {
    // Check if entry exists
    const existingEntry = await db.getJournalEntry(entryId);
    if (!existingEntry) {
      throw createNotFoundError('Journal entry not found');
    }

    const journalRequest = validateJournalRequest(req.body);
    const insights = extractInsights(journalRequest.content);

    // Update entry
    const updatedEntry: Partial<JournalEntry> = {
      title: journalRequest.title,
      content: journalRequest.content,
      tags: journalRequest.tags,
      mood: journalRequest.mood,
      privacy_level: journalRequest.privacy_level,
      word_count: insights.wordCount,
      reading_time_minutes: insights.readingTime,
      themes: insights.themes,
      emotions: insights.emotions
    };

    await db.updateJournalEntry(entryId, updatedEntry);
    const entry = await db.getJournalEntry(entryId);

    if (!entry) {
      throw new Error('Failed to retrieve updated journal entry');
    }

    const responseTime = Date.now() - startTime;

    const response: JournalResponse = {
      entry,
      insights: {
        themes: insights.themes,
        emotions: insights.emotions,
        wordCount: insights.wordCount,
        readingTime: insights.readingTime
      },
      metadata: {
        entryId,
        responseTime,
        timestamp: new Date().toISOString()
      }
    };

    apiLogger.info('Journal entry updated successfully', {
      entryId,
      title: journalRequest.title,
      wordCount: insights.wordCount,
      responseTime
    });

    res.json(response);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    apiLogger.error('Failed to update journal entry', {
      entryId,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    throw error;
  }
}));

/**
 * DELETE /journal/:id - Delete a journal entry
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const entryId = req.params.id;
  const permanent = req.query.permanent === 'true';

  if (!entryId || entryId.trim().length === 0) {
    throw createValidationError('Entry ID is required');
  }

  try {
    // Check if entry exists
    const existingEntry = await db.getJournalEntry(entryId);
    if (!existingEntry) {
      throw createNotFoundError('Journal entry not found');
    }

    if (permanent) {
      await db.deleteJournalEntry(entryId);
      apiLogger.info('Journal entry permanently deleted', { entryId });
    } else {
      // Soft delete - mark as deleted but keep in database
      await db.updateJournalEntry(entryId, { privacy_level: 'deleted' });
      apiLogger.info('Journal entry soft deleted', { entryId });
    }

    res.json({
      success: true,
      message: permanent ? 'Journal entry permanently deleted' : 'Journal entry deleted',
      entryId,
      permanent
    });

  } catch (error) {
    apiLogger.error('Failed to delete journal entry', {
      entryId,
      permanent,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}));

/**
 * GET /journal/analytics/summary - Get journal analytics
 */
router.get('/analytics/summary', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

  try {
    const analytics = await db.getJournalAnalytics(sessionId, days);

    apiLogger.info('Retrieved journal analytics', {
      sessionId,
      days,
      totalEntries: analytics.totalEntries
    });

    res.json(analytics);

  } catch (error) {
    apiLogger.error('Failed to retrieve journal analytics', {
      sessionId,
      days,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}));

/**
 * POST /journal/export - Export journal entries
 */
router.post('/export', asyncHandler(async (req: Request, res: Response) => {
  const { format = 'json', sessionId, dateRange } = req.body;

  if (!['json', 'csv', 'txt', 'markdown'].includes(format)) {
    throw createValidationError('Invalid export format. Supported: json, csv, txt, markdown');
  }

  try {
    const entries = await db.getJournalEntriesForExport(sessionId, dateRange);
    
    let exportData: string;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(entries, null, 2);
        contentType = 'application/json';
        fileExtension = 'json';
        break;

      case 'csv':
        const csvHeader = 'Date,Title,Content,Mood,Tags,Word Count,Themes,Emotions\n';
        const csvRows = entries.map(entry => {
          const date = new Date(entry.created_at).toISOString().split('T')[0];
          const content = `"${entry.content.replace(/"/g, '""')}"`;
          const title = `"${entry.title.replace(/"/g, '""')}"`;
          const tags = `"${entry.tags.join(', ')}"`;
          const themes = `"${entry.themes.join(', ')}"`;
          const emotions = `"${entry.emotions.join(', ')}"`;
          return `${date},${title},${content},${entry.mood},${tags},${entry.word_count},${themes},${emotions}`;
        }).join('\n');
        exportData = csvHeader + csvRows;
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;

      case 'txt':
        exportData = entries.map(entry => {
          const date = new Date(entry.created_at).toLocaleDateString();
          return `Date: ${date}\nTitle: ${entry.title}\nMood: ${entry.mood}\nTags: ${entry.tags.join(', ')}\n\n${entry.content}\n\n${'='.repeat(50)}\n`;
        }).join('\n');
        contentType = 'text/plain';
        fileExtension = 'txt';
        break;

      case 'markdown':
        exportData = entries.map(entry => {
          const date = new Date(entry.created_at).toLocaleDateString();
          return `# ${entry.title}\n\n**Date:** ${date}  \n**Mood:** ${entry.mood}  \n**Tags:** ${entry.tags.join(', ')}  \n**Word Count:** ${entry.word_count}\n\n${entry.content}\n\n---\n`;
        }).join('\n');
        contentType = 'text/markdown';
        fileExtension = 'md';
        break;

      default:
        throw createValidationError('Unsupported export format');
    }

    const filename = `journal_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

    apiLogger.info('Journal export completed', {
      format,
      sessionId,
      entryCount: entries.length,
      filename
    });

  } catch (error) {
    apiLogger.error('Failed to export journal entries', {
      format,
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}));

  return router;
}

// For backward compatibility - use a default router that will be replaced by dependency injection
const router = Router();
export default router; 