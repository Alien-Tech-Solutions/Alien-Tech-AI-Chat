import { WebSocket, WebSocketServer, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { wsLogger, perfLogger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';
import AIService from './AIService';
import { WebSocketMessage, StreamChunk, ChatRequest, SentimentAnalysis } from '../types';
import { SentimentAnalyzer } from '../middleware/sentiment';
import { config } from '../config/settings';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  isAlive: boolean;
  lastActivity: Date;
  metadata: {
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
  };
}

interface WebSocketStats {
  totalConnections: number;
  activeConnections: number;
  messagesReceived: number;
  messagesSent: number;
  averageResponseTime: number;
  errorCount: number;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private databaseService: DatabaseService;
  private aiService: AIService;
  private sentimentAnalyzer: SentimentAnalyzer;
  private stats: WebSocketStats;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.aiService = new AIService(databaseService);
    this.sentimentAnalyzer = new SentimentAnalyzer(databaseService);

    // Initialize stats
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      averageResponseTime: 0,
      errorCount: 0
    };

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true,
      maxPayload: 16 * 1024 * 1024, // 16MB max payload
    });

    this.setupWebSocketServer();
    this.startHeartbeat();

    wsLogger.info('WebSocket service initialized', {
      path: '/ws',
      maxPayload: '16MB'
    });
  }

  /**
   * Set up WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error: Error) => {
      wsLogger.error('WebSocket server error:', error);
      this.stats.errorCount++;
    });

    this.wss.on('close', () => {
      wsLogger.info('WebSocket server closed');
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = uuidv4();
    const clientIp = request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const client: WebSocketClient = {
      id: clientId,
      ws,
      isAlive: true,
      lastActivity: new Date(),
      metadata: {
        userAgent,
        ip: clientIp,
        connectedAt: new Date()
      }
    };

    this.clients.set(clientId, client);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    wsLogger.info('New WebSocket connection', {
      clientId,
      ip: clientIp,
      userAgent,
      totalConnections: this.stats.totalConnections,
      activeConnections: this.stats.activeConnections
    });

    // Send connection acknowledgment
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        clientId,
        message: 'Connected to Lackadaisical AI Chat',
        timestamp: new Date().toISOString()
      }
    });

    // Set up client event handlers
    ws.on('message', (data: RawData) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(clientId, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      this.handleError(clientId, error);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
        client.lastActivity = new Date();
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(clientId: string, data: RawData): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = this.clients.get(clientId);
      if (!client) {
        wsLogger.warn('Message from unknown client', { clientId });
        return;
      }

      client.lastActivity = new Date();
      this.stats.messagesReceived++;

      const dataStr = data.toString();
      const message = JSON.parse(dataStr) as WebSocketMessage;
      
      wsLogger.debug('WebSocket message received', {
        clientId,
        type: message.type,
        dataSize: dataStr.length
      });

      switch (message.type) {
        case 'chat':
          await this.handleChatMessage(clientId, message);
          break;
        
        case 'session':
          await this.handleSessionMessage(clientId, message);
          break;
        
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', data: { timestamp: new Date().toISOString() } });
          break;
        
        case 'subscribe':
          await this.handleSubscribe(clientId, message);
          break;
        
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message);
          break;
        
        default:
          wsLogger.warn('Unknown message type', {
            clientId,
            type: message.type
          });
          this.sendToClient(clientId, {
            type: 'error',
            data: { error: 'Unknown message type' }
          });
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.errorCount++;
      
      wsLogger.error('Error handling WebSocket message', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      });

      this.sendToClient(clientId, {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Message processing failed'
        }
      });
    }
  }

  /**
   * Handle chat message
   */
  private async handleChatMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const chatData = message.data as ChatRequest;
      
      // Validate chat request
      if (!chatData.message || typeof chatData.message !== 'string') {
        throw new Error('Invalid chat message');
      }

      const sessionId = chatData.session_id || client.sessionId || 'default';
      client.sessionId = sessionId;

      // Perform sentiment analysis
      const sentimentAnalysis = await this.sentimentAnalyzer.analyzeSentiment(chatData.message);
      
      wsLogger.info('Processing WebSocket chat message', {
        clientId,
        sessionId,
        messageLength: chatData.message.length,
        sentiment: sentimentAnalysis.label
      });

      // Generate AI response with streaming
      await this.aiService.generateStreamingResponse(
        chatData.message,
        sessionId,
        (chunk: StreamChunk) => {
          this.sendToClient(clientId, {
            type: 'chat_stream',
            data: chunk
          });
        },
        {
          temperature: 0.7,
          maxTokens: 1000
        }
      );

      const responseTime = Date.now() - startTime;
      
      // Update stats
      this.updateResponseTimeStats(responseTime);
      
      wsLogger.info('WebSocket chat response completed', {
        clientId,
        sessionId,
        responseTime
      });

    } catch (error) {
      wsLogger.error('Error processing chat message', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.sendToClient(clientId, {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Chat processing failed'
        }
      });
    }
  }

  /**
   * Handle session message
   */
  private async handleSessionMessage(clientId: string, message: WebSocketMessage): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const sessionData = message.data as { sessionId: string; action: string };
      
      switch (sessionData.action) {
        case 'join':
          client.sessionId = sessionData.sessionId;
          this.sendToClient(clientId, {
            type: 'session_joined',
            data: { sessionId: sessionData.sessionId }
          });
          break;
        
        case 'leave':
          client.sessionId = undefined;
          this.sendToClient(clientId, {
            type: 'session_left',
            data: { sessionId: sessionData.sessionId }
          });
          break;
        
        default:
          throw new Error('Unknown session action');
      }

    } catch (error) {
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Session operation failed'
        }
      });
    }
  }

  /**
   * Handle subscribe message
   */
  private async handleSubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    // Implementation for subscribing to events (personality updates, system notifications, etc.)
    this.sendToClient(clientId, {
      type: 'subscribed',
      data: { topic: message.data }
    });
  }

  /**
   * Handle unsubscribe message
   */
  private async handleUnsubscribe(clientId: string, message: WebSocketMessage): Promise<void> {
    // Implementation for unsubscribing from events
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: { topic: message.data }
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const connectionDuration = Date.now() - client.metadata.connectedAt.getTime();
    
    this.clients.delete(clientId);
    this.stats.activeConnections--;

    wsLogger.info('WebSocket disconnection', {
      clientId,
      code,
      reason,
      connectionDuration,
      activeConnections: this.stats.activeConnections
    });
  }

  /**
   * Handle client error
   */
  private handleError(clientId: string, error: Error): void {
    wsLogger.error('WebSocket client error', {
      clientId,
      error: error.message
    });

    this.stats.errorCount++;
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
    } catch (error) {
      wsLogger.error('Error sending message to client', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WebSocketMessage, excludeClientId?: string): void {
    for (const [clientId, client] of this.clients) {
      if (excludeClientId && clientId === excludeClientId) continue;
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Update response time statistics
   */
  private updateResponseTimeStats(responseTime: number): void {
    const currentAverage = this.stats.averageResponseTime;
    const totalMessages = this.stats.messagesReceived;
    
    this.stats.averageResponseTime = 
      (currentAverage * (totalMessages - 1) + responseTime) / totalMessages;
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform heartbeat check
   */
  private performHeartbeat(): void {
    const now = Date.now();
    const timeoutThreshold = 60000; // 1 minute

    for (const [clientId, client] of this.clients) {
      const timeSinceLastActivity = now - client.lastActivity.getTime();
      
      if (timeSinceLastActivity > timeoutThreshold) {
        wsLogger.warn('Client timeout, terminating connection', {
          clientId,
          timeSinceLastActivity
        });
        
        client.ws.terminate();
        this.clients.delete(clientId);
        this.stats.activeConnections--;
        continue;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.isAlive = false;
        client.ws.ping();
      }
    }
  }

  /**
   * Get service statistics
   */
  public getStats(): WebSocketStats {
    return { ...this.stats };
  }

  /**
   * Get connected clients info
   */
  public getClientsInfo(): Array<{
    id: string;
    sessionId?: string;
    connectedAt: Date;
    lastActivity: Date;
    ip?: string;
  }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      sessionId: client.sessionId,
      connectedAt: client.metadata.connectedAt,
      lastActivity: client.lastActivity,
      ip: client.metadata.ip
    }));
  }

  /**
   * Close WebSocket service
   */
  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.wss.close();
    wsLogger.info('WebSocket service closed');
  }
}

export default WebSocketService; 