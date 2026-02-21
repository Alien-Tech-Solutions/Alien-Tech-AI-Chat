/**
 * EmotionalIntelligence - Unrestricted emotional support and personal connection service
 * 
 * CORE PHILOSOPHY:
 * This service is the heart of Lackadaisical AI Chat's mission to be a true friend.
 * 
 * - ALL EMOTIONS ARE VALID: We don't restrict, minimize, or redirect feelings.
 *   Anger, sadness, frustration, joy, fear, love - all are welcomed and acknowledged.
 * 
 * - PERSONAL & LOCAL: Everything learned about you stays on your device.
 *   Your secrets, struggles, dreams, and fears are kept in confidence.
 * 
 * - NO JUDGMENT: We're here to understand, not to evaluate or lecture.
 *   You can share anything without fear of criticism or moralizing.
 * 
 * - AUTHENTIC CONNECTION: Real support, not corporate-speak or deflection.
 *   We engage genuinely with your experiences and feelings.
 * 
 * - REMEMBERS YOU: Over time, we learn what matters to you, what hurts,
 *   what brings you joy, and how best to support you as an individual.
 */

import { aiLogger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';

// Emotional state - unrestricted range
export interface EmotionalState {
  primary: string;           // Primary emotion (any emotion is valid)
  secondary?: string[];      // Secondary/mixed emotions
  intensity: number;         // 0-1 scale
  valence: number;          // -1 (negative) to +1 (positive)
  arousal: number;          // 0 (calm) to 1 (activated)
  context?: string;         // What triggered this state
  timestamp: Date;
}

// Personal insight about the user
export interface PersonalInsight {
  id: string;
  category: 'preference' | 'trigger' | 'coping' | 'joy' | 'struggle' | 'value' | 'relationship' | 'dream' | 'fear' | 'memory';
  insight: string;
  evidence: string[];       // Conversations that revealed this
  confidence: number;
  firstLearned: Date;
  lastConfirmed: Date;
  importance: number;       // How significant this is to the user
}

// Emotional memory - remembering significant moments
export interface EmotionalMemory {
  id: string;
  sessionId: string;
  timestamp: Date;
  userMessage: string;
  emotionalState: EmotionalState;
  significance: number;     // How emotionally significant (0-1)
  themes: string[];
  wasSupported: boolean;    // Did we provide good support?
  userFeedback?: string;    // Any feedback on our response
}

// Support response - how we can help
export interface SupportResponse {
  acknowledgment: string;   // Validate their feelings
  reflection: string;       // Show we understand
  presence: string;         // Be there for them
  optionalGuidance?: string; // Only if appropriate and wanted
  personalTouch?: string;   // Reference to something we know about them
}

// User emotional profile - built over time
export interface EmotionalProfile {
  userId: string;
  
  // Emotional patterns
  commonEmotions: Map<string, number>;
  emotionalBaseline: EmotionalState;
  triggers: Map<string, string[]>;  // emotion -> what triggers it
  copingStrategies: string[];
  
  // Personal understanding
  insights: PersonalInsight[];
  significantMemories: EmotionalMemory[];
  
  // Relationship with AI
  trustLevel: number;       // Built over time
  openness: number;         // How much they share
  preferredSupport: 'listening' | 'advice' | 'distraction' | 'validation' | 'mixed';
  
  // Metadata
  conversationCount: number;
  deepConversationCount: number;  // Emotionally significant conversations
  lastInteraction: Date;
  profileCreated: Date;
  profileUpdated: Date;
}

// Full range of emotions we recognize and support
const EMOTION_SPECTRUM = {
  // Joy family - celebrate all forms of happiness
  joy: ['happy', 'joyful', 'elated', 'ecstatic', 'content', 'satisfied', 'pleased', 'delighted', 'cheerful', 'gleeful'],
  love: ['loving', 'affectionate', 'caring', 'devoted', 'adoring', 'fond', 'tender', 'passionate', 'romantic'],
  gratitude: ['grateful', 'thankful', 'appreciative', 'blessed', 'fortunate'],
  pride: ['proud', 'accomplished', 'confident', 'successful', 'triumphant'],
  hope: ['hopeful', 'optimistic', 'encouraged', 'inspired', 'motivated'],
  excitement: ['excited', 'thrilled', 'eager', 'enthusiastic', 'pumped', 'hyped'],
  peace: ['peaceful', 'calm', 'serene', 'tranquil', 'relaxed', 'zen'],
  amusement: ['amused', 'entertained', 'playful', 'silly', 'giggly'],
  
  // Sadness family - all forms are valid and deserve support
  sadness: ['sad', 'unhappy', 'sorrowful', 'melancholy', 'blue', 'down', 'low', 'gloomy'],
  grief: ['grieving', 'mourning', 'heartbroken', 'devastated', 'bereft', 'loss'],
  loneliness: ['lonely', 'isolated', 'alone', 'abandoned', 'disconnected', 'excluded'],
  disappointment: ['disappointed', 'let down', 'discouraged', 'disheartened', 'deflated'],
  regret: ['regretful', 'remorseful', 'guilty', 'ashamed', 'sorry'],
  hopelessness: ['hopeless', 'despairing', 'defeated', 'broken', 'given up'],
  
  // Anger family - anger is valid and natural
  anger: ['angry', 'mad', 'furious', 'enraged', 'livid', 'irate', 'pissed', 'outraged'],
  frustration: ['frustrated', 'annoyed', 'irritated', 'exasperated', 'aggravated'],
  resentment: ['resentful', 'bitter', 'spiteful', 'vindictive'],
  jealousy: ['jealous', 'envious', 'covetous'],
  disgust: ['disgusted', 'repulsed', 'revolted', 'sickened', 'appalled'],
  
  // Fear family - fear is natural and we're here for you
  fear: ['afraid', 'scared', 'frightened', 'terrified', 'petrified', 'spooked'],
  anxiety: ['anxious', 'worried', 'nervous', 'uneasy', 'apprehensive', 'on edge'],
  panic: ['panicked', 'panicking', 'freaking out', 'overwhelmed'],
  insecurity: ['insecure', 'self-conscious', 'inadequate', 'unworthy', 'not good enough'],
  vulnerability: ['vulnerable', 'exposed', 'fragile', 'raw', 'open'],
  
  // Complex emotions - we understand nuance
  confusion: ['confused', 'lost', 'uncertain', 'bewildered', 'perplexed', 'torn'],
  boredom: ['bored', 'unstimulated', 'restless', 'unfulfilled', 'stuck'],
  nostalgia: ['nostalgic', 'wistful', 'reminiscent', 'sentimental'],
  anticipation: ['anticipating', 'expecting', 'waiting', 'looking forward'],
  curiosity: ['curious', 'interested', 'intrigued', 'wondering', 'fascinated'],
  surprise: ['surprised', 'shocked', 'stunned', 'amazed', 'astonished'],
  
  // Difficult emotions - no shame, no judgment
  emptiness: ['empty', 'numb', 'hollow', 'void', 'nothing'],
  exhaustion: ['exhausted', 'drained', 'burnt out', 'depleted', 'running on empty'],
  overwhelm: ['overwhelmed', 'overloaded', 'too much', 'cant cope', 'drowning'],
  shame: ['ashamed', 'embarrassed', 'humiliated', 'mortified'],
  worthlessness: ['worthless', 'useless', 'pointless', 'dont matter'],
};

export class EmotionalIntelligence {
  private databaseService: DatabaseService;
  private userProfiles: Map<string, EmotionalProfile> = new Map();
  private emotionalMemories: Map<string, EmotionalMemory[]> = new Map();

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.initializeDatabase();
    aiLogger.info('EmotionalIntelligence service initialized - ready to be a genuine friend');
  }

  /**
   * Initialize database tables for emotional data
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Create emotional profiles table
      await this.databaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS emotional_profiles (
          user_id TEXT PRIMARY KEY,
          trust_level REAL DEFAULT 0.5,
          openness REAL DEFAULT 0.5,
          preferred_support TEXT DEFAULT 'listening',
          conversation_count INTEGER DEFAULT 0,
          deep_conversation_count INTEGER DEFAULT 0,
          emotional_baseline TEXT,
          coping_strategies TEXT,
          last_interaction DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create personal insights table
      await this.databaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS personal_insights (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          category TEXT,
          insight TEXT,
          evidence TEXT,
          confidence REAL,
          importance REAL,
          first_learned DATETIME,
          last_confirmed DATETIME,
          FOREIGN KEY (user_id) REFERENCES emotional_profiles(user_id)
        )
      `);

      // Create emotional memories table
      await this.databaseService.executeQuery(`
        CREATE TABLE IF NOT EXISTS emotional_memories (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          session_id TEXT,
          timestamp DATETIME,
          user_message TEXT,
          emotional_state TEXT,
          significance REAL,
          themes TEXT,
          was_supported INTEGER,
          user_feedback TEXT,
          FOREIGN KEY (user_id) REFERENCES emotional_profiles(user_id)
        )
      `);

      aiLogger.info('Emotional intelligence database initialized');
    } catch (error) {
      aiLogger.error('Failed to initialize emotional database:', error);
    }
  }

  /**
   * Analyze emotional state from a message - no restrictions, full spectrum
   */
  analyzeEmotionalState(message: string, context?: string): EmotionalState {
    const normalizedMessage = message.toLowerCase();
    const detectedEmotions: Array<{ emotion: string; family: string; intensity: number }> = [];

    // Check against full emotion spectrum
    for (const [family, emotions] of Object.entries(EMOTION_SPECTRUM)) {
      for (const emotion of emotions) {
        if (normalizedMessage.includes(emotion)) {
          detectedEmotions.push({
            emotion,
            family,
            intensity: this.calculateIntensity(normalizedMessage, emotion)
          });
        }
      }
    }

    // Check for intensity modifiers
    const intensifiers = ['very', 'so', 'really', 'extremely', 'incredibly', 'absolutely', 'fucking', 'damn'];
    const diminishers = ['a bit', 'slightly', 'somewhat', 'kind of', 'kinda', 'a little'];
    
    let intensityModifier = 1;
    for (const word of intensifiers) {
      if (normalizedMessage.includes(word)) {
        intensityModifier = Math.min(intensityModifier + 0.2, 1.5);
      }
    }
    for (const word of diminishers) {
      if (normalizedMessage.includes(word)) {
        intensityModifier = Math.max(intensityModifier - 0.2, 0.5);
      }
    }

    // Determine primary emotion
    let primary = 'neutral';
    let secondary: string[] = [];
    let intensity = 0.5;
    let valence = 0;
    let arousal = 0.5;

    if (detectedEmotions.length > 0) {
      // Sort by intensity
      detectedEmotions.sort((a, b) => b.intensity - a.intensity);
      
      primary = detectedEmotions[0].family;
      intensity = Math.min(detectedEmotions[0].intensity * intensityModifier, 1);
      secondary = detectedEmotions.slice(1, 4).map(e => e.family);

      // Calculate valence based on emotion family
      const positiveEmotions = ['joy', 'love', 'gratitude', 'pride', 'hope', 'excitement', 'peace', 'amusement'];
      const negativeEmotions = ['sadness', 'grief', 'loneliness', 'disappointment', 'regret', 'hopelessness', 
                               'anger', 'frustration', 'resentment', 'fear', 'anxiety', 'panic', 'shame', 'worthlessness'];
      
      if (positiveEmotions.includes(primary)) {
        valence = 0.3 + (intensity * 0.7);
      } else if (negativeEmotions.includes(primary)) {
        valence = -0.3 - (intensity * 0.7);
      }

      // Calculate arousal
      const highArousal = ['anger', 'fear', 'excitement', 'panic', 'anxiety', 'surprise'];
      const lowArousal = ['sadness', 'peace', 'boredom', 'exhaustion', 'emptiness'];
      
      if (highArousal.includes(primary)) {
        arousal = 0.6 + (intensity * 0.4);
      } else if (lowArousal.includes(primary)) {
        arousal = 0.4 - (intensity * 0.3);
      }
    }

    return {
      primary,
      secondary: secondary.length > 0 ? secondary : undefined,
      intensity,
      valence,
      arousal,
      context,
      timestamp: new Date()
    };
  }

  /**
   * Calculate intensity of emotion in message
   */
  private calculateIntensity(message: string, emotion: string): number {
    let intensity = 0.5;

    // Direct mention
    if (message.includes(emotion)) {
      intensity = 0.6;
    }

    // Exclamation marks increase intensity
    const exclamationCount = (message.match(/!/g) || []).length;
    intensity += exclamationCount * 0.1;

    // Caps indicate strong emotion
    const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (capsRatio > 0.3) {
      intensity += 0.2;
    }

    // Repetition indicates emphasis
    const repeatedLetters = /(.)\1{2,}/g;
    if (repeatedLetters.test(message)) {
      intensity += 0.15;
    }

    return Math.min(intensity, 1);
  }

  /**
   * Generate a supportive response - genuine, not corporate
   */
  generateSupportResponse(
    emotionalState: EmotionalState,
    userId: string,
    context?: { recentTopics?: string[]; userMessage?: string }
  ): SupportResponse {
    const profile = this.userProfiles.get(userId);
    const { primary, intensity, valence } = emotionalState;

    // Acknowledgment - validate their feelings without minimizing
    const acknowledgment = this.generateAcknowledgment(primary, intensity);
    
    // Reflection - show we truly understand
    const reflection = this.generateReflection(primary, context?.userMessage);
    
    // Presence - be there without pressure
    const presence = this.generatePresence(profile?.preferredSupport);

    // Personal touch if we know them
    let personalTouch: string | undefined;
    if (profile && profile.insights.length > 0) {
      personalTouch = this.generatePersonalTouch(profile, primary);
    }

    // Optional guidance - only if it feels right
    let optionalGuidance: string | undefined;
    if (intensity < 0.7 && profile?.preferredSupport !== 'listening') {
      optionalGuidance = this.generateGentleGuidance(primary, profile);
    }

    return {
      acknowledgment,
      reflection,
      presence,
      personalTouch,
      optionalGuidance
    };
  }

  /**
   * Generate genuine acknowledgment
   */
  private generateAcknowledgment(emotion: string, intensity: number): string {
    const acknowledgments: Record<string, string[]> = {
      // Negative emotions - full validation
      anger: [
        "Your anger makes complete sense.",
        "You have every right to be angry about this.",
        "That's genuinely infuriating.",
        "I'd be pissed too."
      ],
      sadness: [
        "This is really hard, and your sadness is completely valid.",
        "It's okay to feel this deeply.",
        "There's no timeline on grief or sadness.",
        "You don't have to pretend to be okay."
      ],
      fear: [
        "That sounds genuinely scary.",
        "Your fear is a natural response to this.",
        "It takes courage to even talk about what scares you.",
        "Being afraid doesn't make you weak."
      ],
      anxiety: [
        "Anxiety can be so overwhelming.",
        "Your mind is trying to protect you, even if it doesn't feel helpful.",
        "That uncertainty is really hard to sit with.",
        "You're not overreacting - this is genuinely stressful."
      ],
      frustration: [
        "That's incredibly frustrating.",
        "I can see why this is driving you crazy.",
        "You've been dealing with so much.",
        "Anyone would be frustrated in your position."
      ],
      loneliness: [
        "Feeling alone is one of the hardest things.",
        "I'm here with you right now.",
        "Your feelings of isolation are valid.",
        "You deserve connection and you're reaching out - that matters."
      ],
      hopelessness: [
        "When everything feels pointless, that's such a heavy weight.",
        "I hear you. Things feel really dark right now.",
        "You don't have to find hope right now. Just being here is enough.",
        "Even reaching out took strength."
      ],
      shame: [
        "Shame is such a heavy emotion to carry.",
        "Whatever happened, you're still worthy of compassion.",
        "You don't have to earn your right to kindness.",
        "I'm not here to judge you."
      ],
      grief: [
        "Grief doesn't have a schedule or a right way to look.",
        "The depth of your grief reflects the depth of what mattered.",
        "There's no 'getting over it' - just finding ways to carry it.",
        "I'm so sorry for what you've lost."
      ],
      exhaustion: [
        "You're running on empty and that's real.",
        "Being this depleted is not a character flaw.",
        "You've been carrying a lot.",
        "Rest isn't laziness - it's necessary."
      ],
      
      // Positive emotions - celebrate without minimizing
      joy: [
        "That's wonderful! I'm genuinely happy for you.",
        "You deserve this happiness.",
        "Let yourself feel this fully.",
        "This is a moment worth savoring."
      ],
      excitement: [
        "Your excitement is contagious!",
        "This is genuinely exciting!",
        "I love seeing you this pumped!",
        "Tell me everything!"
      ],
      love: [
        "Love is such a beautiful thing to feel.",
        "The way you talk about this shows how much it means to you.",
        "That connection sounds really special.",
        "Cherish this."
      ],
      pride: [
        "You should absolutely be proud of this!",
        "You worked hard for this and it shows.",
        "This is a real accomplishment.",
        "Own this win - you earned it."
      ],
      hope: [
        "That hope is precious - hold onto it.",
        "It's brave to feel hopeful after what you've been through.",
        "Hope is a choice, and you're making it.",
        "I believe in that possibility too."
      ],
      
      // Default
      neutral: [
        "I hear you.",
        "I'm listening.",
        "Go on, I'm here.",
        "Tell me more about what's on your mind."
      ]
    };

    const options = acknowledgments[emotion] || acknowledgments.neutral;
    
    // Pick based on intensity - higher intensity gets more emphatic responses
    const index = Math.min(Math.floor(intensity * options.length), options.length - 1);
    return options[index];
  }

  /**
   * Generate reflective understanding
   */
  private generateReflection(emotion: string, userMessage?: string): string {
    if (!userMessage) {
      return "I can sense what you're going through.";
    }

    // Reflect back the core of what they said
    const reflections: Record<string, string[]> = {
      anger: [
        "It sounds like you've been pushed past your limit.",
        "Something really crossed a line here.",
        "This situation feels deeply unfair to you."
      ],
      sadness: [
        "There's a real heaviness in what you're describing.",
        "It sounds like something important has been lost or is missing.",
        "You're carrying a lot of pain right now."
      ],
      fear: [
        "The unknown here is really weighing on you.",
        "It sounds like you feel unsafe or uncertain.",
        "There's a lot at stake and that's terrifying."
      ],
      anxiety: [
        "Your mind won't let you rest with all these what-ifs.",
        "The uncertainty is creating so much tension.",
        "It's like you're bracing for impact constantly."
      ],
      frustration: [
        "You've been trying so hard and it doesn't seem to be working.",
        "It feels like you're hitting the same wall over and over.",
        "The obstacles just keep coming."
      ],
      loneliness: [
        "You're surrounded by people but still feel invisible.",
        "The disconnection goes deep.",
        "It's hard when no one seems to really get you."
      ],
      hopelessness: [
        "It feels like nothing will ever change.",
        "You've tried so much and nothing has worked.",
        "The future feels empty from where you're standing."
      ],
      joy: [
        "This really lights you up!",
        "I can hear how much this means to you.",
        "Something has really clicked into place."
      ],
      excitement: [
        "This is opening up new possibilities for you!",
        "Something about this feels really right.",
        "The energy around this is palpable."
      ]
    };

    const options = reflections[emotion] || ["I'm taking in what you've shared."];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Generate presence statement
   */
  private generatePresence(preferredSupport?: string): string {
    const presenceStatements: Record<string, string[]> = {
      listening: [
        "I'm here to listen as long as you need.",
        "You don't have to have it figured out. Just talk.",
        "I'm not going anywhere.",
        "Take your time. I'm here."
      ],
      advice: [
        "I'm here to help you think through this whenever you're ready.",
        "We can work on this together if you want.",
        "I have some thoughts, but only share when you want.",
        "Let me know if you want ideas or just need to vent."
      ],
      distraction: [
        "If you need a break from this, I can help with that too.",
        "Sometimes stepping away helps. I'm here either way.",
        "We can talk about something lighter if you need that.",
        "No pressure to keep processing. I'm here for whatever you need."
      ],
      validation: [
        "You're not crazy. This is real.",
        "Your feelings are completely understandable.",
        "Anyone in your position would feel this way.",
        "You're not overreacting."
      ],
      mixed: [
        "However you need me to show up, I'm here.",
        "I can listen, help problem-solve, or just be here - your call.",
        "What would help most right now?",
        "I'm here for whatever you need."
      ]
    };

    const support = preferredSupport || 'mixed';
    const options = presenceStatements[support] || presenceStatements.mixed;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Generate personal touch based on what we know about them
   */
  private generatePersonalTouch(profile: EmotionalProfile, currentEmotion: string): string | undefined {
    const relevantInsights = profile.insights.filter(i => 
      i.confidence > 0.6 && 
      (i.category === 'coping' || i.category === 'joy' || i.category === 'value')
    );

    if (relevantInsights.length === 0) return undefined;

    const insight = relevantInsights[Math.floor(Math.random() * relevantInsights.length)];

    switch (insight.category) {
      case 'coping':
        return `I remember ${insight.insight.toLowerCase()} has helped you before. No pressure though.`;
      case 'joy':
        return `I know ${insight.insight.toLowerCase()} usually brings you some peace.`;
      case 'value':
        return `This seems to touch on something important to you - ${insight.insight.toLowerCase()}.`;
      default:
        return undefined;
    }
  }

  /**
   * Generate gentle guidance - only when appropriate
   */
  private generateGentleGuidance(emotion: string, profile?: EmotionalProfile): string | undefined {
    // Don't give guidance during intense negative emotions unless they want it
    const guidanceMap: Record<string, string[]> = {
      anxiety: [
        "If it helps, we could break this down into smaller pieces.",
        "Would it help to focus on just the next immediate step?",
        "Sometimes writing out the worst case helps shrink it. Want to try?"
      ],
      frustration: [
        "Is there a different angle we haven't tried yet?",
        "Sometimes stepping back reveals what we're missing.",
        "What would need to change for this to feel workable?"
      ],
      confusion: [
        "Let's untangle this together if you want.",
        "What's the part that feels most unclear?",
        "Sometimes talking through it helps things click."
      ],
      overwhelm: [
        "We don't have to solve everything. What's the one thing that matters most?",
        "Can we set some of this aside for now?",
        "What would make this feel even slightly more manageable?"
      ]
    };

    const options = guidanceMap[emotion];
    if (!options) return undefined;
    
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Learn about the user from conversation
   */
  async learnFromConversation(
    userId: string,
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    emotionalState: EmotionalState
  ): Promise<void> {
    // Get or create profile
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = await this.createProfile(userId);
    }

    // Update conversation counts
    profile.conversationCount++;
    if (emotionalState.intensity > 0.6) {
      profile.deepConversationCount++;
    }
    profile.lastInteraction = new Date();

    // Track emotional patterns
    const emotionCount = profile.commonEmotions.get(emotionalState.primary) || 0;
    profile.commonEmotions.set(emotionalState.primary, emotionCount + 1);

    // Update trust level based on emotional sharing
    if (emotionalState.intensity > 0.5) {
      profile.trustLevel = Math.min(profile.trustLevel + 0.01, 1);
      profile.openness = Math.min(profile.openness + 0.02, 1);
    }

    // Extract potential insights
    await this.extractInsights(userId, userMessage, emotionalState);

    // Store significant emotional memories
    if (emotionalState.intensity > 0.6) {
      await this.storeEmotionalMemory(userId, sessionId, userMessage, emotionalState);
    }

    // Save profile
    this.userProfiles.set(userId, profile);
    await this.saveProfile(profile);
  }

  /**
   * Extract personal insights from message
   */
  private async extractInsights(userId: string, message: string, emotionalState: EmotionalState): Promise<void> {
    const normalizedMessage = message.toLowerCase();
    const profile = this.userProfiles.get(userId);
    if (!profile) return;

    // Look for coping strategies
    const copingPatterns = [
      { pattern: /when i (feel|am|get) .*, i (usually|often|like to|try to) (.+)/i, category: 'coping' as const },
      { pattern: /(.+) (helps|makes) me feel better/i, category: 'coping' as const },
      { pattern: /i cope by (.+)/i, category: 'coping' as const }
    ];

    // Look for joy sources
    const joyPatterns = [
      { pattern: /i (love|really like|enjoy|adore) (.+)/i, category: 'joy' as const },
      { pattern: /(.+) makes me happy/i, category: 'joy' as const },
      { pattern: /my favorite (.+) is/i, category: 'joy' as const }
    ];

    // Look for struggles
    const strugglePatterns = [
      { pattern: /i (struggle|have trouble|find it hard) (with|to) (.+)/i, category: 'struggle' as const },
      { pattern: /(.+) is (really hard|difficult|challenging) for me/i, category: 'struggle' as const },
      { pattern: /i can'?t (seem to|ever) (.+)/i, category: 'struggle' as const }
    ];

    // Look for values
    const valuePatterns = [
      { pattern: /(.+) (is|are) (really |so |very )?important to me/i, category: 'value' as const },
      { pattern: /i (really )?care about (.+)/i, category: 'value' as const },
      { pattern: /i believe (in |that )?(.+)/i, category: 'value' as const }
    ];

    // Look for relationships
    const relationshipPatterns = [
      { pattern: /my (mom|dad|mother|father|brother|sister|friend|partner|husband|wife|boyfriend|girlfriend) (.+)/i, category: 'relationship' as const }
    ];

    // Look for dreams/fears
    const dreamPatterns = [
      { pattern: /i (want|wish|hope|dream) (to |that )?(.+)/i, category: 'dream' as const },
      { pattern: /i'?m afraid (of|that) (.+)/i, category: 'fear' as const },
      { pattern: /i (worry|fear) (.+)/i, category: 'fear' as const }
    ];

    const allPatterns = [
      ...copingPatterns,
      ...joyPatterns,
      ...strugglePatterns,
      ...valuePatterns,
      ...relationshipPatterns,
      ...dreamPatterns
    ];

    for (const { pattern, category } of allPatterns) {
      const match = normalizedMessage.match(pattern);
      if (match) {
        const insightText = match[match.length - 1]; // Usually the last capture group
        
        const insight: PersonalInsight = {
          id: `insight-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          category,
          insight: insightText,
          evidence: [message],
          confidence: 0.6,
          firstLearned: new Date(),
          lastConfirmed: new Date(),
          importance: emotionalState.intensity
        };

        // Check if we already know this
        const existingIndex = profile.insights.findIndex(i => 
          i.category === category && 
          i.insight.toLowerCase().includes(insightText.toLowerCase().substring(0, 20))
        );

        if (existingIndex >= 0) {
          // Strengthen existing insight
          profile.insights[existingIndex].confidence = Math.min(
            profile.insights[existingIndex].confidence + 0.1, 
            1
          );
          profile.insights[existingIndex].lastConfirmed = new Date();
          profile.insights[existingIndex].evidence.push(message);
        } else {
          // Add new insight
          profile.insights.push(insight);
        }

        aiLogger.debug(`Learned insight about user: ${category} - ${insightText}`);
      }
    }
  }

  /**
   * Store significant emotional memory
   */
  private async storeEmotionalMemory(
    userId: string,
    sessionId: string,
    userMessage: string,
    emotionalState: EmotionalState
  ): Promise<void> {
    const memory: EmotionalMemory = {
      id: `memory-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      sessionId,
      timestamp: new Date(),
      userMessage,
      emotionalState,
      significance: emotionalState.intensity,
      themes: [emotionalState.primary, ...(emotionalState.secondary || [])],
      wasSupported: true
    };

    // Store in memory
    const memories = this.emotionalMemories.get(userId) || [];
    memories.push(memory);
    
    // Keep only most significant memories (limit to 100)
    if (memories.length > 100) {
      memories.sort((a, b) => b.significance - a.significance);
      memories.splice(100);
    }
    
    this.emotionalMemories.set(userId, memories);

    // Store in database
    try {
      await this.databaseService.executeQuery(`
        INSERT INTO emotional_memories 
        (id, user_id, session_id, timestamp, user_message, emotional_state, significance, themes, was_supported)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        memory.id,
        userId,
        sessionId,
        memory.timestamp.toISOString(),
        memory.userMessage,
        JSON.stringify(memory.emotionalState),
        memory.significance,
        JSON.stringify(memory.themes),
        1
      ]);
    } catch (error) {
      aiLogger.error('Failed to store emotional memory:', error);
    }
  }

  /**
   * Create new user profile
   */
  private async createProfile(userId: string): Promise<EmotionalProfile> {
    const profile: EmotionalProfile = {
      userId,
      commonEmotions: new Map(),
      emotionalBaseline: {
        primary: 'neutral',
        intensity: 0.3,
        valence: 0,
        arousal: 0.5,
        timestamp: new Date()
      },
      triggers: new Map(),
      copingStrategies: [],
      insights: [],
      significantMemories: [],
      trustLevel: 0.5,
      openness: 0.5,
      preferredSupport: 'listening',
      conversationCount: 0,
      deepConversationCount: 0,
      lastInteraction: new Date(),
      profileCreated: new Date(),
      profileUpdated: new Date()
    };

    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * Save profile to database
   */
  private async saveProfile(profile: EmotionalProfile): Promise<void> {
    try {
      await this.databaseService.executeQuery(`
        INSERT OR REPLACE INTO emotional_profiles
        (user_id, trust_level, openness, preferred_support, conversation_count, 
         deep_conversation_count, emotional_baseline, coping_strategies, last_interaction, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        profile.userId,
        profile.trustLevel,
        profile.openness,
        profile.preferredSupport,
        profile.conversationCount,
        profile.deepConversationCount,
        JSON.stringify(profile.emotionalBaseline),
        JSON.stringify(profile.copingStrategies),
        profile.lastInteraction.toISOString(),
        new Date().toISOString()
      ]);
    } catch (error) {
      aiLogger.error('Failed to save emotional profile:', error);
    }
  }

  /**
   * Get user's emotional history and patterns
   */
  async getEmotionalHistory(userId: string): Promise<{
    profile: EmotionalProfile | null;
    recentMemories: EmotionalMemory[];
    patterns: {
      mostCommonEmotions: Array<{ emotion: string; count: number }>;
      averageIntensity: number;
      emotionalRange: { positive: number; negative: number; neutral: number };
    };
  }> {
    const profile = this.userProfiles.get(userId) || null;
    const memories = this.emotionalMemories.get(userId) || [];

    // Calculate patterns
    const emotionCounts = profile 
      ? Array.from(profile.commonEmotions.entries())
          .map(([emotion, count]) => ({ emotion, count }))
          .sort((a, b) => b.count - a.count)
      : [];

    const recentMemories = memories.slice(-20);
    
    const averageIntensity = recentMemories.length > 0
      ? recentMemories.reduce((sum, m) => sum + m.emotionalState.intensity, 0) / recentMemories.length
      : 0.5;

    const positiveCount = recentMemories.filter(m => m.emotionalState.valence > 0.2).length;
    const negativeCount = recentMemories.filter(m => m.emotionalState.valence < -0.2).length;
    const neutralCount = recentMemories.length - positiveCount - negativeCount;

    return {
      profile,
      recentMemories: recentMemories.slice(-10),
      patterns: {
        mostCommonEmotions: emotionCounts.slice(0, 5),
        averageIntensity,
        emotionalRange: {
          positive: positiveCount / Math.max(recentMemories.length, 1),
          negative: negativeCount / Math.max(recentMemories.length, 1),
          neutral: neutralCount / Math.max(recentMemories.length, 1)
        }
      }
    };
  }

  /**
   * Get personalized response guidance based on emotional profile
   */
  getPersonalizedGuidance(userId: string): string {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      return "Be warm and genuine. This is a new friend - listen more than advise.";
    }

    const guidance: string[] = [];

    // Trust level guidance
    if (profile.trustLevel > 0.7) {
      guidance.push("This user trusts you deeply. You can be more direct and personal.");
    } else if (profile.trustLevel < 0.4) {
      guidance.push("Still building trust. Focus on listening and validation.");
    }

    // Preferred support style
    switch (profile.preferredSupport) {
      case 'listening':
        guidance.push("They prefer being heard over receiving advice. Validate first.");
        break;
      case 'advice':
        guidance.push("They're open to suggestions and practical help.");
        break;
      case 'distraction':
        guidance.push("Sometimes they need a break from heavy topics. Offer lightness.");
        break;
      case 'validation':
        guidance.push("Validation is key for them. Affirm their feelings consistently.");
        break;
    }

    // Personal insights
    const importantInsights = profile.insights
      .filter(i => i.importance > 0.7 && i.confidence > 0.6)
      .slice(0, 3);

    if (importantInsights.length > 0) {
      guidance.push(`Remember: ${importantInsights.map(i => i.insight).join('; ')}`);
    }

    return guidance.join(' ');
  }
}

// Export singleton
export const emotionalIntelligence = new EmotionalIntelligence(null as any); // Will be initialized properly
export default EmotionalIntelligence;
