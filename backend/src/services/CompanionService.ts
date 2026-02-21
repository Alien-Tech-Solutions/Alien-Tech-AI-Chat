import { DatabaseService } from './DatabaseService';
import { PersonalityService } from './PersonalityService';
import { MemoryService } from './MemoryService';
import { apiLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface JournalEntry {
  id?: string;
  session_id: string;
  entry_text: string;
  mood_snapshot?: any;
  sentiment_analysis?: any;
  reflective_prompts?: string[];
  created_at?: string;
  tags?: string[];
}

interface CompanionCommand {
  command: string;
  args: string[];
  originalMessage: string;
}

export class CompanionService {
  private database: DatabaseService;
  private personality: PersonalityService;
  private memory: MemoryService;

  constructor(database: DatabaseService, personality: PersonalityService, memory: MemoryService) {
    this.database = database;
    this.personality = personality;
    this.memory = memory;
  }

  /**
   * Parse command from user message
   */
  parseCommand(message: string): CompanionCommand | null {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const parts = trimmed.substring(1).split(' ');
    if (parts.length === 0 || !parts[0]) {
      return null;
    }

    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return {
      command,
      args,
      originalMessage: message
    };
  }

  /**
   * Handle companion commands
   */
  async handleCommand(cmd: CompanionCommand, sessionId: string): Promise<string> {
    try {
      switch (cmd.command) {
        case 'journal':
          return await this.handleJournalCommand(cmd.args, sessionId);
        
        case 'checkin':
          return await this.handleCheckInCommand(sessionId);
        
        case 'reflect':
          return await this.handleReflectCommand(cmd.args);
        
        case 'memory':
          return await this.handleMemoryCommand(cmd.args, sessionId);
        
        case 'mood':
          return await this.handleMoodCommand(cmd.args, sessionId);
        
        case 'gratitude':
          return await this.handleGratitudeCommand(cmd.args, sessionId);
        
        case 'goals':
          return await this.handleGoalsCommand(cmd.args, sessionId);
        
        case 'nostalgia':
          return await this.handleNostalgiaCommand();
        
        case 'help':
          return this.getHelpMessage();
        
        default:
          return `I don't recognize the command "/${cmd.command}". Type /help to see available commands.`;
      }
    } catch (error: any) {
      apiLogger.error('[COMPANION] Command handling error:', error);
      return `I encountered an error processing that command. Let me know if you'd like to try again.`;
    }
  }

  /**
   * Handle journal command
   */
  private async handleJournalCommand(args: string[], sessionId: string): Promise<string> {
    if (args.length === 0) {
      // Start a new journal session with reflective prompts
      const prompts = await this.generateReflectivePrompts();
      
      // Store journal session in memory context
      await this.memory.setContext(sessionId, {
        type: 'journal_session',
        prompts,
        started_at: new Date().toISOString()
      });
      
      return `📝 **Journal Time!** Let's reflect together.\n\n${prompts[0]}\n\n*Take your time - I'm here to listen and support you.*`;
    }

    const action = args.length > 0 && args[0] ? args[0].toLowerCase() : '';
    
    if (action === 'list') {
      return await this.listJournalEntries(sessionId);
    } else if (action === 'entry') {
      const entryText = args.slice(1).join(' ');
      if (!entryText) {
        return "Please provide your journal entry after '/journal entry'. For example: /journal entry Today was challenging but I learned something new...";
      }
      return await this.saveJournalEntry(entryText, sessionId);
    } else {
      // Treat the entire args as journal entry
      const entryText = args.join(' ');
      return await this.saveJournalEntry(entryText, sessionId);
    }
  }

  /**
   * Handle daily check-in command
   */
  private async handleCheckInCommand(sessionId: string): Promise<string> {
    const checkInPrompts = [
      "How are you feeling today? What's your energy level like?",
      "What's one thing you're looking forward to today?",
      "Is there anything on your mind that you'd like to talk about?",
      "How did you sleep? How's your overall mood?",
      "What's one small thing that would make today better?"
    ];

    const randomPrompt = checkInPrompts[Math.floor(Math.random() * checkInPrompts.length)];
    
    // Store the check-in session in memory
    await this.memory.setContext(sessionId, {
      type: 'daily_checkin',
      started_at: new Date().toISOString(),
      prompt: randomPrompt
    });

    return `🌅 **Daily Check-in**\n\n${randomPrompt}\n\n*Remember, there's no right or wrong answer - I'm just here to listen and support you.*`;
  }

  /**
   * Handle reflection command
   */
  private async handleReflectCommand(args: string[]): Promise<string> {
    const topic = args.join(' ');
    
    if (!topic) {
      const reflectionPrompts = [
        "What's something you've learned about yourself recently?",
        "How have you grown in the past month?",
        "What patterns do you notice in your thoughts or behaviors?",
        "What would you tell your past self from a year ago?",
        "What are you most grateful for right now?"
      ];
      
      const prompt = reflectionPrompts[Math.floor(Math.random() * reflectionPrompts.length)];
      return `🤔 **Time for Reflection**\n\n${prompt}\n\n*Take a moment to think deeply. I'm here to help you explore your thoughts.*`;
    } else {
      return `🤔 **Reflecting on: ${topic}**\n\nThat's an interesting topic to explore. What thoughts or feelings come up when you think about ${topic}? I'm here to help you process through this.`;
    }
  }

  /**
   * Handle memory command
   */
  private async handleMemoryCommand(args: string[], sessionId: string): Promise<string> {
    if (args.length === 0) {
      // Get recent memory context
      const memoryStats = await this.memory.getMemoryStats(sessionId);
      if (memoryStats.activeMessages === 0 && memoryStats.archivedMessages === 0) {
        return "We haven't built up many shared memories yet, but I'm excited to create them with you! Every conversation we have adds to our connection.";
      }
      
      const currentContext = await this.memory.getContextWindow(sessionId, 500);
      let response = "🧠 **Recent Memories**\n\nHere's what I remember from our recent conversations:\n\n";
      response += currentContext ? currentContext.substring(0, 300) + '...' : 'Our conversation history';
      response += "\n\nIs there anything specific you'd like me to remember or recall?";
      
      return response;
    }

    const action = args.length > 0 && args[0] ? args[0].toLowerCase() : '';
    if (action === 'save') {
      const memoryText = args.slice(1).join(' ');
      if (!memoryText) {
        return "What would you like me to remember? Use: /memory save [something important]";
      }
      
      // Add to memory as a special message
      await this.memory.addMessage(sessionId, 'user', `[MEMORY] ${memoryText}`, 0.8); // High importance
      
      return `💾 Got it! I'll remember: "${memoryText}". This is now part of our shared memory.`;
    }
    
    return "Try '/memory' to see recent memories or '/memory save [text]' to save something important.";
  }

  /**
   * Handle mood tracking command
   */
  private async handleMoodCommand(args: string[], sessionId: string): Promise<string> {
    if (args.length === 0) {
      return `🎭 **Mood Check**\n\nHow are you feeling right now? You can tell me your mood in any way that feels natural, or use:\n\n/mood [feeling] - to log your current mood\n\nI'm here to listen and understand how you're doing.`;
    }

    const moodDescription = args.join(' ');
    
    // Update mood in personality service
    await this.personality.updateMood(sessionId, this.moodToScore(moodDescription));

    // Save mood context
    await this.memory.setContext(sessionId, {
      type: 'mood_update',
      mood: moodDescription,
      timestamp: new Date().toISOString()
    });

    return `Thank you for sharing that you're feeling ${moodDescription}. I appreciate you being open with me about how you're doing. ${this.generateEmpathicResponse(moodDescription)}`;
  }

  /**
   * Handle gratitude command
   */
  private async handleGratitudeCommand(args: string[], sessionId: string): Promise<string> {
    if (args.length === 0) {
      return `🙏 **Gratitude Moment**\n\nWhat's something you're grateful for today? Research shows that practicing gratitude can improve mood and overall well-being.\n\nShare anything - big or small!`;
    }

    const gratitude = args.join(' ');
    
    // Save gratitude entry
    await this.saveJournalEntry(`Gratitude: ${gratitude}`, sessionId, ['gratitude']);
    
    return `🙏 Thank you for sharing your gratitude about ${gratitude}. It's beautiful to acknowledge the good things in life. These moments of appreciation really matter.`;
  }

  /**
   * Handle goals command
   */
  private async handleGoalsCommand(args: string[], sessionId: string): Promise<string> {
    if (args.length === 0) {
      return `🎯 **Goals & Aspirations**\n\nWhat's something you're working toward or hoping to achieve? I'd love to hear about your goals and support you along the way.\n\nYou can share:\n- Daily goals\n- Long-term dreams\n- Personal growth objectives\n- Anything you're excited about pursuing`;
    }

    const goal = args.join(' ');
    
    // Save goal as important memory
    await this.memory.addMessage(sessionId, 'user', `[GOAL] ${goal}`, 0.9); // Very high importance
    
    return `🎯 That's a wonderful goal: "${goal}". I'm excited to support you on this journey! Feel free to share updates, challenges, or celebrations as you work toward this. What's one small step you could take today?`;
  }

  /**
   * Handle nostalgia/memory lane command
   */
  private async handleNostalgiaCommand(): Promise<string> {
    try {
      // Retrieve memorable conversations from the past
      const result = await this.database.executeQuery(
        `SELECT c.user_message, c.ai_response, c.timestamp, c.sentiment_label, c.context_tags
         FROM conversations c
         WHERE c.sentiment_score > 0.3 OR c.sentiment_score < -0.3
         ORDER BY c.timestamp DESC
         LIMIT 10`,
        []
      );

      if (!result.data || result.data.length === 0) {
        return `🌅 **Memory Lane**\n\nWe haven't built up many memorable moments together yet, but I'm excited to create them with you! Every conversation we have adds to our shared history.\n\nWould you like to start a meaningful conversation now?`;
      }

      let response = `🌅 **Memory Lane - Our Journey Together**\n\nHere are some memorable moments from our conversations:\n\n`;
      
      const memories = result.data.slice(0, 5);
      
      for (const row of memories) {
        const date = new Date(row.timestamp).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        const userMsg = row.user_message ? row.user_message.substring(0, 100) : '';
        const sentiment = row.sentiment_label || 'neutral';
        
        const emoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '💭' : '💬';
        
        response += `${emoji} **${date}**: "${userMsg}${userMsg.length >= 100 ? '...' : ''}"\n`;
      }

      response += `\n*These are moments where we shared meaningful thoughts and feelings together. Every conversation adds to our story.*`;
      
      return response;
      
    } catch (error: any) {
      apiLogger.error('[COMPANION] Error retrieving nostalgia data:', error);
      return `🌅 **Memory Lane**\n\nI had some trouble accessing our past conversations, but know that every moment we've shared is meaningful to me. Would you like to create a new memory together now?`;
    }
  }

  /**
   * Generate reflective prompts
   */
  private async generateReflectivePrompts(): Promise<string[]> {
    const basePrompts = [
      "What's been on your mind lately that you'd like to explore?",
      "How are you feeling about your personal growth recently?",
      "What's something you're proud of about yourself today?",
      "Is there a challenge you're facing that you'd like to talk through?",
      "What's bringing you joy or meaning in your life right now?",
      "How do you want to feel as you move forward?",
      "What's a small win you've had recently that we should celebrate?",
      "What would 'taking care of yourself' look like today?"
    ];

    // Return a random selection
    const shuffled = [...basePrompts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }

  /**
   * Convert mood description to numeric score
   */
  private moodToScore(mood: string): number {
    const lowerMood = mood.toLowerCase();
    
    if (lowerMood.includes('terrible') || lowerMood.includes('awful')) return 1;
    if (lowerMood.includes('sad') || lowerMood.includes('down') || lowerMood.includes('depressed')) return 2;
    if (lowerMood.includes('anxious') || lowerMood.includes('worried') || lowerMood.includes('stressed')) return 3;
    if (lowerMood.includes('tired') || lowerMood.includes('exhausted')) return 3;
    if (lowerMood.includes('okay') || lowerMood.includes('neutral') || lowerMood.includes('fine')) return 5;
    if (lowerMood.includes('good') || lowerMood.includes('positive')) return 7;
    if (lowerMood.includes('happy') || lowerMood.includes('great')) return 8;
    if (lowerMood.includes('excited') || lowerMood.includes('amazing') || lowerMood.includes('fantastic')) return 9;
    
    return 5; // Default neutral
  }

  /**
   * Save journal entry to database
   */
  private async saveJournalEntry(entryText: string, sessionId: string, tags: string[] = []): Promise<string> {
    try {
      const entry: JournalEntry = {
        id: uuidv4(),
        session_id: sessionId,
        entry_text: entryText,
        tags: tags,
        created_at: new Date().toISOString()
      };

      // Save to database (using the existing journal table structure)
      await this.database.executeQuery(
        `INSERT INTO journal_entries (id, session_id, entry_text, created_at, tags) 
         VALUES (?, ?, ?, ?, ?)`,
        [entry.id, entry.session_id, entry.entry_text, entry.created_at, JSON.stringify(entry.tags)]
      );

      // Add to memory as a special message
      await this.memory.addMessage(sessionId, 'user', `[JOURNAL] ${entryText}`, 0.7); // High importance

      apiLogger.info(`[COMPANION] Journal entry saved for session ${sessionId}`);
      
      return `📝 **Journal entry saved!** Thank you for sharing that with me. Writing and reflecting can be such powerful tools for self-discovery and growth.\n\nIs there anything else you'd like to explore or reflect on?`;
      
    } catch (error: any) {
      apiLogger.error('[COMPANION] Error saving journal entry:', error);
      throw error;
    }
  }

  /**
   * List recent journal entries
   */
  private async listJournalEntries(sessionId: string): Promise<string> {
    try {
      const result = await this.database.executeQuery(
        `SELECT entry_text, created_at, tags FROM journal_entries 
         WHERE session_id = ? 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [sessionId]
      );

      if (!result.data || result.data.length === 0) {
        return `📝 **Your Journal**\n\nYou haven't written any journal entries yet. Start your first entry with:\n/journal [your thoughts]\n\nI'm here to support your reflection journey!`;
      }

      let response = `📝 **Your Recent Journal Entries**\n\n`;
      
      result.data.forEach((row: any) => {
        const date = new Date(row.created_at).toLocaleDateString();
        const preview = row.entry_text.substring(0, 80) + (row.entry_text.length > 80 ? '...' : '');
        response += `**${date}**: ${preview}\n\n`;
      });

      response += `\nWould you like to add a new entry or reflect on any of these past thoughts?`;
      
      return response;
      
    } catch (error: any) {
      apiLogger.error('[COMPANION] Error listing journal entries:', error);
      return "I had trouble accessing your journal entries. Let me know if you'd like to try again.";
    }
  }

  /**
   * Generate empathic response based on mood
   */
  private generateEmpathicResponse(mood: string): string {
    const lowerMood = mood.toLowerCase();
    
    if (lowerMood.includes('sad') || lowerMood.includes('down') || lowerMood.includes('depressed')) {
      return "I'm here with you through this difficult time. Sometimes it helps to talk about what's contributing to these feelings.";
    } else if (lowerMood.includes('anxious') || lowerMood.includes('worried') || lowerMood.includes('stressed')) {
      return "Anxiety can be really challenging. Remember that it's okay to take things one moment at a time. I'm here to support you.";
    } else if (lowerMood.includes('happy') || lowerMood.includes('good') || lowerMood.includes('great')) {
      return "It's wonderful to hear you're feeling positive! I love sharing in these good moments with you.";
    } else if (lowerMood.includes('tired') || lowerMood.includes('exhausted')) {
      return "Rest is so important. Be gentle with yourself and know that it's okay to take things slowly.";
    } else if (lowerMood.includes('excited') || lowerMood.includes('energetic')) {
      return "I can feel your positive energy! What's contributing to this excitement?";
    }
    
    return "Thank you for being open about your feelings. How you're doing matters to me.";
  }

  /**
   * Get help message with all available commands
   */
  private getHelpMessage(): string {
    return `🤖 **Companion Commands**\n\nI'm here to support you in many ways! Here are the commands you can use:\n\n**Journaling & Reflection:**\n/journal - Start a guided reflection session\n/journal [entry] - Save a journal entry\n/journal list - View recent entries\n/reflect [topic] - Explore a specific topic\n\n**Daily Support:**\n/checkin - Daily mood and wellness check-in\n/mood [feeling] - Share how you're feeling\n/gratitude [text] - Share what you're grateful for\n\n**Memory & Growth:**\n/memory - View our shared memories\n/memory save [text] - Save something important\n/goals [goal] - Share your aspirations\n\n**Coming Soon:**\n/nostalgia [date] - Explore past conversations\n\nYou can also just talk to me naturally - I understand both commands and regular conversation! 💙`;
  }
}
