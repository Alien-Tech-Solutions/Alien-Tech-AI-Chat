/**
 * SmartAssistant - AI-beneficial features service
 * Provides intelligent suggestions, proactive assistance, and conversation insights
 * 
 * PHILOSOPHY: This assistant is designed to be a genuine friend and confidant.
 * - No emotional restrictions - all feelings are valid and welcomed
 * - Learns about you personally to provide better support
 * - All data stays local - your secrets are safe
 * - No judgment - only understanding and support
 * - Authentic connection over artificial politeness
 */

import { aiLogger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import { EnhancedMemoryService } from './EnhancedMemoryService';
import { WebFetcher, webFetcher } from './WebFetcher';

// Suggestion types
export type SuggestionType = 
  | 'topic_exploration'
  | 'clarification'
  | 'follow_up'
  | 'action_item'
  | 'resource'
  | 'reminder'
  | 'correction'
  | 'insight'
  | 'wellness_check';

// Smart suggestion interface
export interface SmartSuggestion {
  id: string;
  type: SuggestionType;
  content: string;
  context: string;
  confidence: number;
  actionable: boolean;
  action?: {
    type: 'send_message' | 'open_url' | 'set_reminder' | 'execute_plugin';
    payload: any;
  };
  timestamp: Date;
  sessionId?: string;
}

// Conversation insight
export interface ConversationInsight {
  id: string;
  sessionId: string;
  type: 'pattern' | 'preference' | 'topic_interest' | 'emotional_trend' | 'learning_opportunity';
  title: string;
  description: string;
  data: Record<string, any>;
  importance: 'low' | 'medium' | 'high';
  createdAt: Date;
}

// User preference detection
export interface DetectedPreference {
  category: string;
  preference: string;
  confidence: number;
  evidence: string[];
  firstDetected: Date;
  lastConfirmed: Date;
}

// Proactive assistance config
export interface ProactiveConfig {
  enabled: boolean;
  suggestFollowUps: boolean;
  suggestResources: boolean;
  wellnessChecks: boolean;
  learningReminders: boolean;
  maxSuggestionsPerSession: number;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
}

// Topic analysis result
interface TopicAnalysis {
  mainTopic: string;
  subTopics: string[];
  relatedConcepts: string[];
  questionAreas: string[];
  confidence: number;
}

// Sentiment tracking
interface SentimentTrack {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  triggers: string[];
}

export class SmartAssistant {
  private databaseService: DatabaseService;
  private memoryService: EnhancedMemoryService;
  private webFetcher: WebFetcher;
  private proactiveConfig: ProactiveConfig;
  private userPreferences: Map<string, DetectedPreference[]> = new Map();
  private sessionInsights: Map<string, ConversationInsight[]> = new Map();
  private suggestionHistory: Map<string, SmartSuggestion[]> = new Map();

  // Common topics and their related concepts
  private readonly topicGraph: Map<string, string[]> = new Map([
    ['programming', ['coding', 'software', 'development', 'algorithms', 'debugging', 'testing']],
    ['ai', ['machine learning', 'neural networks', 'deep learning', 'nlp', 'computer vision']],
    ['health', ['fitness', 'nutrition', 'mental health', 'exercise', 'sleep', 'wellness']],
    ['finance', ['investing', 'budgeting', 'savings', 'stocks', 'cryptocurrency', 'retirement']],
    ['productivity', ['time management', 'organization', 'focus', 'habits', 'goals', 'efficiency']],
    ['learning', ['education', 'studying', 'memory', 'reading', 'courses', 'skills']],
    ['creativity', ['writing', 'art', 'music', 'design', 'innovation', 'brainstorming']],
    ['relationships', ['communication', 'empathy', 'conflict resolution', 'boundaries', 'trust']],
    ['career', ['job search', 'interviews', 'networking', 'resume', 'promotion', 'skills']],
    ['technology', ['gadgets', 'apps', 'software', 'hardware', 'internet', 'security']]
  ]);

  // Follow-up question templates
  private readonly followUpTemplates: Record<string, string[]> = {
    explanation: [
      "Would you like me to explain any part of that in more detail?",
      "Is there a specific aspect you'd like to explore further?",
      "Would a practical example help clarify this?"
    ],
    how_to: [
      "Would you like step-by-step instructions?",
      "Should I break this down into smaller steps?",
      "Would you like tips for common pitfalls to avoid?"
    ],
    opinion: [
      "What aspects are most important to you?",
      "Would you like to hear alternative perspectives?",
      "Are there specific criteria you're considering?"
    ],
    problem: [
      "Have you tried any solutions yet?",
      "What outcome are you hoping for?",
      "Are there any constraints I should know about?"
    ],
    learning: [
      "What's your current level of experience with this?",
      "Would you like resource recommendations?",
      "Should I create a learning path for you?"
    ]
  };

  constructor(databaseService: DatabaseService, memoryService: EnhancedMemoryService) {
    this.databaseService = databaseService;
    this.memoryService = memoryService;
    this.webFetcher = webFetcher;

    this.proactiveConfig = {
      enabled: true,
      suggestFollowUps: true,
      suggestResources: true,
      wellnessChecks: true,
      learningReminders: true,
      maxSuggestionsPerSession: 10
    };

    aiLogger.info('SmartAssistant initialized');
  }

  /**
   * Generate smart suggestions based on conversation context
   */
  async generateSuggestions(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    options: {
      maxSuggestions?: number;
      types?: SuggestionType[];
    } = {}
  ): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];
    const maxSuggestions = options.maxSuggestions || 3;

    try {
      // Analyze the conversation turn
      const topicAnalysis = this.analyzeTopics(userMessage + ' ' + aiResponse);
      const messageIntent = this.detectIntent(userMessage);
      const emotionalTone = this.analyzeEmotionalTone(userMessage);

      // Generate topic exploration suggestions
      if (!options.types || options.types.includes('topic_exploration')) {
        const topicSuggestions = this.generateTopicSuggestions(topicAnalysis);
        suggestions.push(...topicSuggestions);
      }

      // Generate follow-up suggestions
      if (!options.types || options.types.includes('follow_up')) {
        const followUps = this.generateFollowUpSuggestions(messageIntent, topicAnalysis);
        suggestions.push(...followUps);
      }

      // Generate resource suggestions
      if (!options.types || options.types.includes('resource')) {
        const resources = await this.generateResourceSuggestions(topicAnalysis);
        suggestions.push(...resources);
      }

      // Generate wellness suggestions if emotional tone indicates need
      if ((!options.types || options.types.includes('wellness_check')) && 
          emotionalTone.needsSupport) {
        const wellness = this.generateWellnessSuggestions(emotionalTone);
        suggestions.push(...wellness);
      }

      // Detect and generate insight suggestions
      if (!options.types || options.types.includes('insight')) {
        const insights = this.generateInsightSuggestions(sessionId, userMessage, aiResponse);
        suggestions.push(...insights);
      }

      // Sort by confidence and limit
      const sortedSuggestions = suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxSuggestions);

      // Store suggestions for tracking
      const sessionSuggestions = this.suggestionHistory.get(sessionId) || [];
      sessionSuggestions.push(...sortedSuggestions);
      this.suggestionHistory.set(sessionId, sessionSuggestions);

      return sortedSuggestions;

    } catch (error) {
      aiLogger.error('Failed to generate suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze topics in text
   */
  private analyzeTopics(text: string): TopicAnalysis {
    const normalizedText = text.toLowerCase();
    const foundTopics: Map<string, number> = new Map();

    // Check for topic matches
    for (const [topic, related] of this.topicGraph) {
      let score = 0;
      
      if (normalizedText.includes(topic)) {
        score += 2;
      }
      
      for (const relatedTerm of related) {
        if (normalizedText.includes(relatedTerm)) {
          score += 1;
        }
      }

      if (score > 0) {
        foundTopics.set(topic, score);
      }
    }

    // Sort by score
    const sortedTopics = Array.from(foundTopics.entries())
      .sort((a, b) => b[1] - a[1]);

    const mainTopic = sortedTopics[0]?.[0] || 'general';
    const subTopics = sortedTopics.slice(1, 4).map(([topic]) => topic);
    const relatedConcepts = mainTopic !== 'general' 
      ? (this.topicGraph.get(mainTopic) || []).slice(0, 5)
      : [];

    // Identify question areas
    const questionAreas: string[] = [];
    const questionPatterns = [
      { pattern: /how (do|can|to)/i, area: 'how_to' },
      { pattern: /what (is|are|does)/i, area: 'definition' },
      { pattern: /why (do|does|is|are)/i, area: 'reasoning' },
      { pattern: /which (is|are|should)/i, area: 'comparison' },
      { pattern: /when (should|do|does)/i, area: 'timing' },
      { pattern: /where (can|do|does)/i, area: 'location' }
    ];

    for (const { pattern, area } of questionPatterns) {
      if (pattern.test(text)) {
        questionAreas.push(area);
      }
    }

    return {
      mainTopic,
      subTopics,
      relatedConcepts,
      questionAreas,
      confidence: sortedTopics.length > 0 ? Math.min(sortedTopics[0][1] / 5, 1) : 0.3
    };
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): string {
    const patterns: Array<{ pattern: RegExp; intent: string }> = [
      { pattern: /^(how|what|why|when|where|who|which)/i, intent: 'question' },
      { pattern: /(help|assist|support)/i, intent: 'help_request' },
      { pattern: /(explain|clarify|describe)/i, intent: 'explanation' },
      { pattern: /(create|make|build|write|generate)/i, intent: 'creation' },
      { pattern: /(fix|solve|resolve|debug)/i, intent: 'problem_solving' },
      { pattern: /(compare|vs|versus|difference)/i, intent: 'comparison' },
      { pattern: /(recommend|suggest|advice)/i, intent: 'recommendation' },
      { pattern: /(learn|understand|study)/i, intent: 'learning' },
      { pattern: /(opinion|think|feel)/i, intent: 'opinion' },
      { pattern: /(thank|thanks|appreciate)/i, intent: 'gratitude' }
    ];

    for (const { pattern, intent } of patterns) {
      if (pattern.test(message)) {
        return intent;
      }
    }

    return 'statement';
  }

  /**
   * Analyze emotional tone
   */
  private analyzeEmotionalTone(message: string): {
    primary: string;
    intensity: number;
    needsSupport: boolean;
  } {
    const normalizedMessage = message.toLowerCase();

    const emotionPatterns: Array<{
      emotions: string[];
      pattern: RegExp;
      intensity: number;
      needsSupport: boolean;
    }> = [
      {
        emotions: ['frustrated', 'angry', 'annoyed'],
        pattern: /(frustrated|angry|annoyed|irritated|mad|hate|ugh|argh)/i,
        intensity: 0.8,
        needsSupport: true
      },
      {
        emotions: ['sad', 'disappointed', 'down'],
        pattern: /(sad|disappointed|down|depressed|unhappy|miserable)/i,
        intensity: 0.7,
        needsSupport: true
      },
      {
        emotions: ['anxious', 'worried', 'stressed'],
        pattern: /(anxious|worried|stressed|nervous|overwhelmed|panic)/i,
        intensity: 0.75,
        needsSupport: true
      },
      {
        emotions: ['confused', 'lost', 'uncertain'],
        pattern: /(confused|lost|uncertain|don't understand|don't get)/i,
        intensity: 0.5,
        needsSupport: false
      },
      {
        emotions: ['excited', 'happy', 'enthusiastic'],
        pattern: /(excited|happy|great|awesome|amazing|love|wonderful)/i,
        intensity: 0.6,
        needsSupport: false
      },
      {
        emotions: ['curious', 'interested'],
        pattern: /(curious|interested|wondering|want to know|fascinating)/i,
        intensity: 0.5,
        needsSupport: false
      }
    ];

    for (const { emotions, pattern, intensity, needsSupport } of emotionPatterns) {
      if (pattern.test(normalizedMessage)) {
        return {
          primary: emotions[0],
          intensity,
          needsSupport
        };
      }
    }

    return {
      primary: 'neutral',
      intensity: 0.3,
      needsSupport: false
    };
  }

  /**
   * Generate topic exploration suggestions
   */
  private generateTopicSuggestions(analysis: TopicAnalysis): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    if (analysis.relatedConcepts.length > 0) {
      const concept = analysis.relatedConcepts[0];
      suggestions.push({
        id: `topic-${Date.now()}`,
        type: 'topic_exploration',
        content: `Would you like to explore ${concept} in relation to ${analysis.mainTopic}?`,
        context: `Related concept detected: ${concept}`,
        confidence: analysis.confidence * 0.7,
        actionable: true,
        action: {
          type: 'send_message',
          payload: { message: `Tell me more about ${concept}` }
        },
        timestamp: new Date()
      });
    }

    if (analysis.subTopics.length > 0) {
      suggestions.push({
        id: `subtopic-${Date.now()}`,
        type: 'topic_exploration',
        content: `I notice this relates to ${analysis.subTopics.join(', ')}. Want to explore any of these?`,
        context: `Multiple related topics detected`,
        confidence: analysis.confidence * 0.6,
        actionable: true,
        timestamp: new Date()
      });
    }

    return suggestions;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateFollowUpSuggestions(intent: string, analysis: TopicAnalysis): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Map intents to follow-up template categories
    const intentToCategory: Record<string, string> = {
      question: 'explanation',
      help_request: 'how_to',
      explanation: 'explanation',
      problem_solving: 'problem',
      recommendation: 'opinion',
      learning: 'learning'
    };

    const category = intentToCategory[intent] || 'explanation';
    const templates = this.followUpTemplates[category] || this.followUpTemplates.explanation;

    // Select a relevant follow-up
    const template = templates[Math.floor(Math.random() * templates.length)];

    suggestions.push({
      id: `followup-${Date.now()}`,
      type: 'follow_up',
      content: template,
      context: `Based on detected intent: ${intent}`,
      confidence: 0.6,
      actionable: false,
      timestamp: new Date()
    });

    return suggestions;
  }

  /**
   * Generate resource suggestions
   */
  private async generateResourceSuggestions(analysis: TopicAnalysis): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];

    if (analysis.mainTopic === 'general' || analysis.confidence < 0.3) {
      return suggestions;
    }

    try {
      // Search for relevant resources
      const searchResults = await this.webFetcher.search(
        `${analysis.mainTopic} guide tutorial`, 
        { maxResults: 3 }
      );

      if (searchResults.results.length > 0) {
        const topResult = searchResults.results[0];
        suggestions.push({
          id: `resource-${Date.now()}`,
          type: 'resource',
          content: `I found a helpful resource: "${topResult.title}"`,
          context: topResult.snippet,
          confidence: 0.5,
          actionable: true,
          action: {
            type: 'open_url',
            payload: { url: topResult.url }
          },
          timestamp: new Date()
        });
      }
    } catch (error) {
      // Resource suggestions are optional, continue without them
      aiLogger.debug('Resource suggestion generation skipped:', error);
    }

    return suggestions;
  }

  /**
   * Generate wellness suggestions
   */
  private generateWellnessSuggestions(emotionalTone: {
    primary: string;
    intensity: number;
    needsSupport: boolean;
  }): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    const wellnessResponses: Record<string, string[]> = {
      frustrated: [
        "I sense some frustration. Would you like to take a step back and approach this differently?",
        "Sometimes a fresh perspective helps. Want me to suggest an alternative approach?"
      ],
      sad: [
        "I'm here to listen if you'd like to talk about what's on your mind.",
        "Is there anything I can do to help lift your spirits?"
      ],
      anxious: [
        "Let's take this one step at a time. What's the most pressing concern right now?",
        "Would breaking this down into smaller parts help reduce the overwhelm?"
      ],
      stressed: [
        "That sounds stressful. Would you like some strategies for managing this?",
        "Remember to take breaks. Is there a way I can help prioritize this?"
      ]
    };

    const responses = wellnessResponses[emotionalTone.primary] || [];
    
    if (responses.length > 0) {
      suggestions.push({
        id: `wellness-${Date.now()}`,
        type: 'wellness_check',
        content: responses[Math.floor(Math.random() * responses.length)],
        context: `Detected emotional state: ${emotionalTone.primary}`,
        confidence: emotionalTone.intensity,
        actionable: false,
        timestamp: new Date()
      });
    }

    return suggestions;
  }

  /**
   * Generate insight suggestions
   */
  private generateInsightSuggestions(
    sessionId: string,
    userMessage: string,
    aiResponse: string
  ): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    // Track patterns in user behavior
    const sessionInsights = this.sessionInsights.get(sessionId) || [];

    // Check for learning patterns
    const learningKeywords = ['learn', 'understand', 'explain', 'how', 'why'];
    const isLearning = learningKeywords.some(kw => userMessage.toLowerCase().includes(kw));

    if (isLearning && sessionInsights.filter(i => i.type === 'learning_opportunity').length < 3) {
      suggestions.push({
        id: `insight-learning-${Date.now()}`,
        type: 'insight',
        content: "You seem interested in learning. Would you like me to create a structured learning path on this topic?",
        context: 'Learning pattern detected',
        confidence: 0.5,
        actionable: true,
        action: {
          type: 'send_message',
          payload: { message: 'Create a learning path for this topic' }
        },
        timestamp: new Date()
      });
    }

    return suggestions;
  }

  /**
   * Detect user preferences from conversation
   */
  async detectPreferences(
    userId: string,
    sessionId: string,
    conversationHistory: Array<{ user: string; ai: string }>
  ): Promise<DetectedPreference[]> {
    const existingPrefs = this.userPreferences.get(userId) || [];
    const newPrefs: DetectedPreference[] = [];

    // Analyze conversation for preferences
    for (const turn of conversationHistory) {
      const combined = `${turn.user} ${turn.ai}`.toLowerCase();

      // Communication style preferences
      if (/detailed|thorough|comprehensive/.test(combined)) {
        this.updateOrAddPreference(newPrefs, existingPrefs, {
          category: 'communication_style',
          preference: 'detailed_responses',
          confidence: 0.7,
          evidence: [turn.user]
        });
      }

      if (/brief|short|concise|quick/.test(combined)) {
        this.updateOrAddPreference(newPrefs, existingPrefs, {
          category: 'communication_style',
          preference: 'concise_responses',
          confidence: 0.7,
          evidence: [turn.user]
        });
      }

      // Technical level preferences
      if (/technical|advanced|in-depth/.test(combined)) {
        this.updateOrAddPreference(newPrefs, existingPrefs, {
          category: 'technical_level',
          preference: 'advanced',
          confidence: 0.6,
          evidence: [turn.user]
        });
      }

      if (/simple|basic|beginner|eli5/.test(combined)) {
        this.updateOrAddPreference(newPrefs, existingPrefs, {
          category: 'technical_level',
          preference: 'beginner',
          confidence: 0.6,
          evidence: [turn.user]
        });
      }

      // Format preferences
      if (/list|bullet|steps/.test(combined)) {
        this.updateOrAddPreference(newPrefs, existingPrefs, {
          category: 'format',
          preference: 'structured',
          confidence: 0.6,
          evidence: [turn.user]
        });
      }

      if (/example|show me|demonstrate/.test(combined)) {
        this.updateOrAddPreference(newPrefs, existingPrefs, {
          category: 'format',
          preference: 'examples_preferred',
          confidence: 0.7,
          evidence: [turn.user]
        });
      }
    }

    // Merge new preferences with existing
    const mergedPrefs = [...existingPrefs];
    for (const newPref of newPrefs) {
      const existingIndex = mergedPrefs.findIndex(
        p => p.category === newPref.category && p.preference === newPref.preference
      );
      if (existingIndex >= 0) {
        mergedPrefs[existingIndex] = {
          ...mergedPrefs[existingIndex],
          confidence: Math.min(mergedPrefs[existingIndex].confidence + 0.1, 1),
          evidence: [...mergedPrefs[existingIndex].evidence, ...newPref.evidence].slice(-10),
          lastConfirmed: new Date()
        };
      } else {
        mergedPrefs.push(newPref);
      }
    }

    this.userPreferences.set(userId, mergedPrefs);
    return mergedPrefs;
  }

  /**
   * Helper to update or add preference
   */
  private updateOrAddPreference(
    newPrefs: DetectedPreference[],
    existingPrefs: DetectedPreference[],
    pref: Omit<DetectedPreference, 'firstDetected' | 'lastConfirmed'>
  ): void {
    const existing = existingPrefs.find(
      p => p.category === pref.category && p.preference === pref.preference
    );

    if (existing) {
      return; // Already tracked
    }

    const alreadyNew = newPrefs.find(
      p => p.category === pref.category && p.preference === pref.preference
    );

    if (!alreadyNew) {
      newPrefs.push({
        ...pref,
        firstDetected: new Date(),
        lastConfirmed: new Date()
      });
    }
  }

  /**
   * Get personalized response guidance based on detected preferences
   */
  getResponseGuidance(userId: string): string {
    const prefs = this.userPreferences.get(userId) || [];
    const guidance: string[] = [];

    for (const pref of prefs) {
      if (pref.confidence < 0.5) continue;

      switch (`${pref.category}:${pref.preference}`) {
        case 'communication_style:detailed_responses':
          guidance.push('User prefers detailed, thorough explanations.');
          break;
        case 'communication_style:concise_responses':
          guidance.push('User prefers brief, to-the-point responses.');
          break;
        case 'technical_level:advanced':
          guidance.push('User is comfortable with technical terminology.');
          break;
        case 'technical_level:beginner':
          guidance.push('Keep explanations simple and accessible.');
          break;
        case 'format:structured':
          guidance.push('Use lists and structured formatting when possible.');
          break;
        case 'format:examples_preferred':
          guidance.push('Include practical examples when explaining concepts.');
          break;
      }
    }

    return guidance.join(' ');
  }

  /**
   * Generate conversation insights
   */
  async generateInsights(sessionId: string): Promise<ConversationInsight[]> {
    const insights: ConversationInsight[] = [];

    try {
      // Get session analytics from memory service
      const contextData = await this.memoryService.buildContextWindow(sessionId, 50000);

      // Analyze topic patterns
      const topicFrequency = this.analyzeTopicFrequency(contextData.recentMessages.map(m => m.content || ''));
      
      if (Object.keys(topicFrequency).length > 0) {
        const topTopics = Object.entries(topicFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        insights.push({
          id: `insight-topics-${Date.now()}`,
          sessionId,
          type: 'topic_interest',
          title: 'Your Main Interests',
          description: `Your most discussed topics are: ${topTopics.map(([t]) => t).join(', ')}`,
          data: { topicFrequency },
          importance: 'medium',
          createdAt: new Date()
        });
      }

      // Analyze emotional trends
      const messages = contextData.recentMessages;
      if (messages.length >= 5) {
        const recentEmotions = messages.slice(-10).map(m => 
          this.analyzeEmotionalTone(m.content || '').primary
        );
        
        const emotionCounts = recentEmotions.reduce((acc, e) => {
          acc[e] = (acc[e] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const dominantEmotion = Object.entries(emotionCounts)
          .sort((a, b) => b[1] - a[1])[0];

        if (dominantEmotion && dominantEmotion[0] !== 'neutral') {
          insights.push({
            id: `insight-emotion-${Date.now()}`,
            sessionId,
            type: 'emotional_trend',
            title: 'Emotional Trend',
            description: `Your recent conversations have had a ${dominantEmotion[0]} tone`,
            data: { emotionCounts },
            importance: 'low',
            createdAt: new Date()
          });
        }
      }

      // Store insights
      this.sessionInsights.set(sessionId, insights);

      return insights;

    } catch (error) {
      aiLogger.error('Failed to generate insights:', error);
      return [];
    }
  }

  /**
   * Analyze topic frequency in messages
   */
  private analyzeTopicFrequency(messages: string[]): Record<string, number> {
    const frequency: Record<string, number> = {};

    for (const message of messages) {
      const analysis = this.analyzeTopics(message);
      if (analysis.mainTopic !== 'general') {
        frequency[analysis.mainTopic] = (frequency[analysis.mainTopic] || 0) + 1;
      }
      for (const subTopic of analysis.subTopics) {
        frequency[subTopic] = (frequency[subTopic] || 0) + 0.5;
      }
    }

    return frequency;
  }

  /**
   * Get proactive suggestions (called periodically or on session events)
   */
  async getProactiveSuggestions(
    sessionId: string,
    context: {
      lastMessageTime: Date;
      messageCount: number;
      sessionDuration: number;
    }
  ): Promise<SmartSuggestion[]> {
    if (!this.proactiveConfig.enabled) {
      return [];
    }

    const suggestions: SmartSuggestion[] = [];
    const existingSuggestions = this.suggestionHistory.get(sessionId) || [];

    if (existingSuggestions.length >= this.proactiveConfig.maxSuggestionsPerSession) {
      return [];
    }

    // Session duration suggestion (after 30 minutes)
    if (context.sessionDuration > 30 * 60 * 1000) {
      suggestions.push({
        id: `proactive-break-${Date.now()}`,
        type: 'wellness_check',
        content: "You've been chatting for a while. Would you like to take a short break?",
        context: 'Extended session duration',
        confidence: 0.4,
        actionable: false,
        timestamp: new Date(),
        sessionId
      });
    }

    // Learning reminder (after deep topic exploration)
    if (context.messageCount > 20 && this.proactiveConfig.learningReminders) {
      suggestions.push({
        id: `proactive-summary-${Date.now()}`,
        type: 'reminder',
        content: "Would you like me to summarize the key points from our conversation?",
        context: 'Extended conversation',
        confidence: 0.5,
        actionable: true,
        action: {
          type: 'send_message',
          payload: { message: 'Please summarize our conversation' }
        },
        timestamp: new Date(),
        sessionId
      });
    }

    return suggestions;
  }

  /**
   * Update proactive assistance configuration
   */
  setProactiveConfig(config: Partial<ProactiveConfig>): void {
    this.proactiveConfig = {
      ...this.proactiveConfig,
      ...config
    };
  }

  /**
   * Get proactive configuration
   */
  getProactiveConfig(): ProactiveConfig {
    return { ...this.proactiveConfig };
  }

  /**
   * Clear suggestion history for a session
   */
  clearSuggestionHistory(sessionId: string): void {
    this.suggestionHistory.delete(sessionId);
    this.sessionInsights.delete(sessionId);
  }

  /**
   * Get suggestion history for a session
   */
  getSuggestionHistory(sessionId: string): SmartSuggestion[] {
    return this.suggestionHistory.get(sessionId) || [];
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string): DetectedPreference[] {
    return this.userPreferences.get(userId) || [];
  }
}

// Export for use in other services
export default SmartAssistant;
