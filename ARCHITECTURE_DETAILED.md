# 🏗️ Architecture Documentation - Lackadaisical AI Chat

## System Architecture Overview

Lackadaisical AI Chat is a modular, privacy-first AI companion system built with modern web technologies and designed for extensibility and scalability.

---

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [System Components](#system-components)
3. [Data Flow](#data-flow)
4. [Technology Stack](#technology-stack)
5. [Database Schema](#database-schema)
6. [API Architecture](#api-architecture)
7. [Security Architecture](#security-architecture)
8. [Plugin System](#plugin-system)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         React Frontend (Vite + TypeScript)           │    │
│  │  • Chat Interface  • Settings  • Journal            │    │
│  │  • Plugin Manager  • Memory Dashboard               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↕ HTTP/REST + WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │      Express.js Backend (Node.js + TypeScript)      │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │    │
│  │  │   API    │  │WebSocket │  │Middleware│         │    │
│  │  │ Routes   │  │ Service  │  │  Layer   │         │    │
│  │  └──────────┘  └──────────┘  └──────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  AI        │  │  Memory    │  │ Personality│           │
│  │  Service   │  │  Service   │  │  Service   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Plugin    │  │ WebFetcher │  │  Backup    │           │
│  │  Service   │  │  Service   │  │  Service   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Logging   │  │   Config   │  │ Emotional  │           │
│  │  Service   │  │  Manager   │  │Intelligence│           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Database  │  │   Cache    │  │  File      │           │
│  │  Service   │  │   Layer    │  │  Storage   │           │
│  │ (SQLite/   │  │ (In-Memory)│  │ (Backups)  │           │
│  │ PostgreSQL/│  │            │  │            │           │
│  │   MySQL)   │  │            │  │            │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Ollama   │  │  OpenAI    │  │ Anthropic  │           │
│  │  (Local)   │  │   (API)    │  │   (API)    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Google   │  │    xAI     │  │   Web      │           │
│  │   (API)    │  │   (API)    │  │  Search    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## System Components

### Frontend Components

#### **1. Chat Interface**
- Real-time message streaming
- Markdown rendering with syntax highlighting
- File upload support
- Session management UI
- Context-aware suggestions

#### **2. Settings Panel**
- AI model configuration
- API key management
- Memory preferences
- Theme customization

#### **3. Journal Interface**
- Entry creation and editing
- Mood tracking
- Tag-based organization
- Search functionality

#### **4. Plugin Manager**
- Plugin installation/removal
- Configuration interface
- Enable/disable controls

### Backend Services

#### **1. AIService**
**Purpose**: Manages AI provider interactions and model switching

**Key Features**:
- Hot-swappable AI providers
- Streaming response support
- Automatic fallback handling
- Context window management

**Providers**:
- Ollama (local)
- OpenAI (GPT-3.5, GPT-4)
- Anthropic (Claude 3 family)
- Google (Gemini Pro/Flash)
- xAI (Grok)

#### **2. DatabaseService**
**Purpose**: Database abstraction layer supporting multiple engines

**Adapters**:
- **SQLiteAdapter**: Default, zero-configuration
- **PostgreSQLAdapter**: Production-ready, scalable
- **MySQLAdapter**: Alternative SQL database

**Features**:
- Connection pooling
- Transaction support
- Query optimization
- Migration system

#### **3. MemoryService / EnhancedMemoryService**
**Purpose**: Intelligent memory and context management

**Features**:
- Cross-session memory retrieval
- Semantic similarity search
- Context window optimization
- Memory consolidation
- Importance scoring

**Components**:
- Active context cache
- Long-term memory storage
- Session summaries
- Memory search indexing

#### **4. PersonalityService**
**Purpose**: Manages AI personality and emotional state

**Features**:
- Dynamic mood tracking
- Trait-based responses
- Conversation adaptation
- Personality evolution

#### **5. PluginService**
**Purpose**: Plugin lifecycle management

**Features**:
- Dynamic plugin loading
- Sandbox execution
- Permission management
- State persistence

#### **6. WebFetcher**
**Purpose**: Web content retrieval and search

**Providers**:
- DuckDuckGo (no API key)
- Brave Search (API)
- SerpAPI (Google proxy)

**Features**:
- Content extraction
- Result caching
- Rate limiting
- Error handling

#### **7. BackupService**
**Purpose**: Automated data backup and recovery

**Features**:
- Scheduled backups
- Compression support
- Retention policies
- One-click restore

#### **8. LoggingService**
**Purpose**: Centralized logging infrastructure

**Features**:
- Multiple log levels
- Category-based logging
- Log rotation
- Performance tracking
- Security event logging

#### **9. ConfigurationManager**
**Purpose**: Runtime configuration management

**Features**:
- Environment-specific configs
- Hot-reloading
- Validation
- Export/import

---

## Data Flow

### Message Processing Flow

```
1. User Input
   ↓
2. Frontend (ChatInterface)
   ↓ HTTP POST /api/v1/chat
3. Backend (chat route)
   ↓
4. Middleware Stack
   - Authentication
   - Rate Limiting
   - Sentiment Analysis
   ↓
5. ConversationManager
   - Context assembly
   - Memory retrieval
   ↓
6. AIService
   - Model selection
   - Prompt engineering
   ↓
7. AI Provider (Ollama/OpenAI/etc.)
   - Generate response
   ↓
8. Response Processing
   - Save to database
   - Update personality
   - Extract insights
   ↓
9. Frontend (streaming)
   - Display message
   - Update UI
```

### Memory Retrieval Flow

```
1. New Message Received
   ↓
2. EnhancedMemoryService.buildContext()
   ↓
3. Retrieve Recent Messages (session-specific)
   ↓
4. Cross-Session Memory Search
   - Keyword matching
   - Semantic similarity
   - Recency weighting
   ↓
5. Context Assembly
   - Prioritize by relevance
   - Respect token limits
   - Include session summaries
   ↓
6. Return Context Window
   ↓
7. Inject into AI Prompt
```

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: TailwindCSS + DaisyUI
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Markdown**: react-markdown + rehype-highlight

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: better-sqlite3, pg, mysql2
- **AI SDKs**: 
  - @anthropic-ai/sdk
  - openai
  - @google/generative-ai
- **Logging**: Winston
- **Validation**: Zod
- **Security**: Helmet, CORS, rate-limiter-flexible

### Infrastructure
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt
- **Monitoring**: PM2 Monit, Winston logs

---

## Database Schema

### Core Tables

#### **conversations**
Stores all user-AI interactions
```sql
- id: INTEGER (PK, AUTO_INCREMENT)
- session_id: TEXT
- user_message: TEXT
- ai_response: TEXT
- timestamp: DATETIME
- sentiment_score: REAL
- sentiment_label: TEXT
- context_tags: JSON
- tokens_used: INTEGER
- model_used: TEXT
```

#### **sessions**
Tracks conversation sessions
```sql
- id: TEXT (PK)
- name: TEXT
- created_at: DATETIME
- last_active: DATETIME
- context_summary: TEXT
- message_count: INTEGER
```

#### **personality_state**
Stores dynamic personality state
```sql
- id: INTEGER (PK, always 1)
- name: TEXT
- current_mood: JSON
- energy_level: INTEGER
- empathy_level: INTEGER
- conversation_count: INTEGER
- mood_history: JSON
```

#### **journal_entries**
User journal entries
```sql
- id: TEXT (PK)
- title: TEXT
- content: TEXT
- tags: JSON
- mood: TEXT
- session_id: TEXT
- created_at: DATETIME
```

#### **plugin_states**
Plugin configuration
```sql
- plugin_name: TEXT (PK)
- enabled: BOOLEAN
- config: JSON
- state_data: JSON
- usage_count: INTEGER
```

---

## API Architecture

### REST Endpoints

#### **Chat API**
```
POST   /api/v1/chat              - Send message
GET    /api/v1/chat/stream       - Stream response (SSE)
GET    /api/chat/context/:id     - Get session context
GET    /api/chat/analytics/:id   - Get analytics
```

#### **Session Management**
```
GET    /api/sessions             - List sessions
POST   /api/sessions             - Create session
GET    /api/sessions/:id         - Get session
DELETE /api/sessions/:id         - Delete session
```

#### **Model Management**
```
GET    /api/models               - List models
POST   /api/models/switch        - Switch model
GET    /api/models/current       - Get current model
```

#### **Plugin API**
```
GET    /api/plugins              - List plugins
POST   /api/plugins/:name/execute - Execute plugin
PUT    /api/plugins/:name/config - Update config
```

#### **Health & Monitoring**
```
GET    /api/health               - Health check
GET    /api/health/detailed      - Detailed metrics
```

### WebSocket API

```javascript
// Connect
ws://localhost:3001/ws

// Events
{
  type: 'message',
  payload: { sessionId, message }
}

{
  type: 'typing',
  payload: { sessionId }
}

{
  type: 'personality_update',
  payload: { mood, energy }
}
```

---

## Security Architecture

### Authentication
- JWT-based authentication
- Session management
- API key validation

### Authorization
- Role-based access control (planned)
- Plugin permissions
- Resource isolation

### Data Protection
- Database encryption (optional)
- HTTPS/TLS in production
- Secure API key storage
- Input validation (Zod)

### Rate Limiting
- Per-IP rate limiting
- Per-user rate limiting
- Sliding window algorithm

### Security Headers
- Helmet middleware
- CORS configuration
- Content Security Policy

---

## Plugin System

### Plugin Architecture

```typescript
interface Plugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  
  // Lifecycle
  initialize(context: PluginContext): Promise<void>;
  execute(input: any, context: PluginContext): Promise<any>;
  destroy?(): Promise<void>;
  
  // Configuration
  getConfig?(): Record<string, any>;
  setConfig?(config: Record<string, any>): void;
}
```

### Built-in Plugins

1. **Weather Plugin**
   - Real-time weather data
   - Forecast support
   - Simulated fallback

2. **Horoscope Plugin**
   - Daily horoscopes
   - Zodiac compatibility

3. **Poem of the Day Plugin**
   - Curated poems
   - Daily rotation

### Plugin Lifecycle

```
1. Plugin Discovery
   ↓
2. Load Plugin Module
   ↓
3. Validate Plugin Interface
   ↓
4. Initialize Plugin
   ↓
5. Register with PluginService
   ↓
6. Available for Execution
```

---

## Performance Considerations

### Caching Strategy
- In-memory context cache
- Response caching (configurable)
- Static asset caching (nginx)

### Database Optimization
- Indexed queries
- Connection pooling
- Query result caching

### Scalability
- Horizontal scaling (PM2 cluster)
- Load balancing (nginx)
- Stateless design

---

## Monitoring & Observability

### Logging Levels
- **ERROR**: Critical failures
- **WARN**: Important warnings
- **INFO**: General information
- **HTTP**: API requests
- **DEBUG**: Detailed debugging

### Metrics
- Response time
- Token usage
- Memory consumption
- Database query performance
- API hit rate

### Health Checks
- Database connectivity
- AI provider availability
- Memory usage
- Disk space

---

## Future Architecture Enhancements

### Planned Features
- Redis caching layer
- Message queue (RabbitMQ/Redis)
- Microservices architecture
- GraphQL API
- Real-time collaboration
- Mobile app support
- Vector database for semantic search

---

## References

- [API Documentation](API_DOCUMENTATION.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Plugin Development](PLUGIN_DEVELOPMENT.md)

---

**Made with 💙 by Lackadaisical Security**
