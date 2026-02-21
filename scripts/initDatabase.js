const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'chat.db');

// Create database connection
console.log('Creating database at:', dbPath);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enhanced schema with all tables from implementation plan
const schema = `
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    context_summary TEXT,
    message_count INTEGER DEFAULT 0
);

-- Enhanced conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_message TEXT,
    ai_response TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sentiment_score REAL DEFAULT 0.0,
    sentiment_label TEXT DEFAULT 'neutral',
    mood_impact REAL,
    context_tags TEXT DEFAULT '[]', -- JSON array
    message_type TEXT DEFAULT 'chat', -- chat, journal, command
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    model_used TEXT,
    plugin_data TEXT, -- JSON for plugin-specific data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Enhanced personality state
CREATE TABLE IF NOT EXISTS personality_state (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    traits TEXT, -- JSON
    current_mood TEXT, -- JSON
    energy_level INTEGER,
    empathy_level INTEGER,
    humor_level INTEGER,
    learning_data TEXT, -- JSON
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Memory contexts
CREATE TABLE IF NOT EXISTS memory_contexts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    context_type TEXT, -- active, long_term, episodic
    content TEXT, -- JSON
    importance_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Enhanced journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    entry_text TEXT NOT NULL,
    mood_snapshot TEXT, -- JSON
    sentiment_analysis TEXT, -- JSON
    reflective_prompts TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    tags TEXT, -- JSON array
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Plugin states and data
CREATE TABLE IF NOT EXISTS plugin_states (
    plugin_name TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT 1,
    config TEXT, -- JSON
    usage_stats TEXT, -- JSON
    last_used DATETIME,
    version TEXT
);

-- Learning and training data
CREATE TABLE IF NOT EXISTS training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    input_text TEXT,
    expected_output TEXT,
    actual_output TEXT,
    feedback_score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_sentiment ON conversations(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_conversations_message_type ON conversations(message_type);
CREATE INDEX IF NOT EXISTS idx_memory_contexts_session_id ON memory_contexts(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_contexts_type ON memory_contexts(context_type);
CREATE INDEX IF NOT EXISTS idx_personality_state_session_id ON personality_state(session_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_session_id ON journal_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_training_data_session_id ON training_data(session_id);
`;

try {
  // Execute schema creation
  db.exec(schema);
  
  // Handle migrations for existing databases
  console.log('Checking for schema updates...');
  
  try {
    // Check if sentiment_label column exists
    const columns = db.prepare("PRAGMA table_info(conversations)").all();
    const columnNames = columns.map(col => col.name);
    
    if (!columnNames.includes('sentiment_label')) {
      console.log('Adding sentiment_label column...');
      db.exec("ALTER TABLE conversations ADD COLUMN sentiment_label TEXT DEFAULT 'neutral'");
    }
    
    if (!columnNames.includes('tokens_used')) {
      console.log('Adding tokens_used column...');
      db.exec("ALTER TABLE conversations ADD COLUMN tokens_used INTEGER DEFAULT 0");
    }
    
    if (!columnNames.includes('response_time_ms')) {
      console.log('Adding response_time_ms column...');
      db.exec("ALTER TABLE conversations ADD COLUMN response_time_ms INTEGER DEFAULT 0");
    }
    
    if (!columnNames.includes('model_used')) {
      console.log('Adding model_used column...');
      db.exec("ALTER TABLE conversations ADD COLUMN model_used TEXT");
    }
    
    if (!columnNames.includes('created_at')) {
      console.log('Adding created_at column...');
      db.exec("ALTER TABLE conversations ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }
    
    if (!columnNames.includes('updated_at')) {
      console.log('Adding updated_at column...');
      db.exec("ALTER TABLE conversations ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }
    
    // Update sentiment_score to have default value if it's NULL
    if (columnNames.includes('sentiment_score')) {
      db.exec("UPDATE conversations SET sentiment_score = 0.0 WHERE sentiment_score IS NULL");
    }
    
    // Update context_tags to have default value if it's NULL
    if (columnNames.includes('context_tags')) {
      db.exec("UPDATE conversations SET context_tags = '[]' WHERE context_tags IS NULL");
    }
    
    console.log('✅ Schema migration completed!');
  } catch (migrationError) {
    console.log('ℹ️  Migration note:', migrationError.message);
  }

  // Insert some initial data
  console.log('Creating database schema...');
  
  // Create a default session
  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions (id, name, context_summary, message_count) 
    VALUES (?, ?, ?, ?)
  `);
  
  insertSession.run('default-session', 'Default Session', 'Initial session for testing', 0);
  
  // Initialize plugin states
  const insertPlugin = db.prepare(`
    INSERT OR IGNORE INTO plugin_states (plugin_name, enabled, config, version) 
    VALUES (?, ?, ?, ?)
  `);
  
  insertPlugin.run('weather', 1, '{}', '1.0.0');
  insertPlugin.run('horoscope', 1, '{}', '1.0.0');
  insertPlugin.run('poem-of-the-day', 1, '{}', '1.0.0');
  
  console.log('✅ Database created successfully!');
  console.log('📍 Location:', dbPath);
  console.log('📊 Tables created:');
  
  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  tables.forEach(table => {
    console.log(`   - ${table.name}`);
  });
  
  // Show session count
  const sessionCount = db.prepare("SELECT COUNT(*) as count FROM sessions").get();
  console.log(`🎯 Initial sessions: ${sessionCount.count}`);
  
} catch (error) {
  console.error('❌ Error creating database:', error);
  process.exit(1);
} finally {
  db.close();
  console.log('🔐 Database connection closed.');
}
