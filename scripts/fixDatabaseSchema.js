const Database = require('better-sqlite3');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'database', 'chat.db');

console.log('🔧 Fixing database schema at:', dbPath);
console.log('');

try {
  const db = new Database(dbPath);
  
  console.log('📋 Running database fixes...');
  
  // Check if privacy_level column exists in journal_entries
  const journalColumns = db.prepare("PRAGMA table_info(journal_entries)").all();
  const hasPrivacyLevel = journalColumns.some(col => col.name === 'privacy_level');
  
  if (!hasPrivacyLevel) {
    console.log('✅ Adding missing privacy_level column to journal_entries...');
    db.exec(`
      ALTER TABLE journal_entries 
      ADD COLUMN privacy_level TEXT DEFAULT 'private';
    `);
  } else {
    console.log('✅ privacy_level column already exists');
  }
  
  // Check sessions table for missing description column
  const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
  const hasDescription = sessionColumns.some(col => col.name === 'description');
  
  if (!hasDescription) {
    console.log('✅ Adding missing description column to sessions...');
    db.exec(`
      ALTER TABLE sessions 
      ADD COLUMN description TEXT;
    `);
  } else {
    console.log('✅ description column already exists in sessions');
  }

  // Check if other missing columns exist and add them
  const missingColumns = [
    // Journal entries columns
    { table: 'journal_entries', column: 'title', type: 'TEXT', default: 'NULL' },
    { table: 'journal_entries', column: 'content', type: 'TEXT', default: 'NULL' },
    { table: 'journal_entries', column: 'word_count', type: 'INTEGER', default: '0' },
    { table: 'journal_entries', column: 'reading_time_minutes', type: 'INTEGER', default: '0' },
    { table: 'journal_entries', column: 'themes', type: 'TEXT', default: "'[]'" },
    { table: 'journal_entries', column: 'emotions', type: 'TEXT', default: "'[]'" },
    { table: 'journal_entries', column: 'mood', type: 'TEXT', default: "'neutral'" },
    
    // Sessions columns
    { table: 'sessions', column: 'name', type: 'TEXT', default: 'NULL' },
    { table: 'sessions', column: 'message_count', type: 'INTEGER', default: '0' },
    { table: 'sessions', column: 'total_tokens', type: 'INTEGER', default: '0' },
    { table: 'sessions', column: 'status', type: 'TEXT', default: "'active'" },
    { table: 'sessions', column: 'metadata', type: 'TEXT', default: "'{}'" },
    
    // Conversations columns
    { table: 'conversations', column: 'session_id', type: 'TEXT', default: "'default'" },
    { table: 'conversations', column: 'sentiment_score', type: 'REAL', default: '0.0' },
    { table: 'conversations', column: 'sentiment_label', type: 'TEXT', default: "'neutral'" },
    { table: 'conversations', column: 'context_tags', type: 'TEXT', default: "'[]'" },
    { table: 'conversations', column: 'message_type', type: 'TEXT', default: "'chat'" },
    { table: 'conversations', column: 'tokens_used', type: 'INTEGER', default: '0' },
    { table: 'conversations', column: 'response_time_ms', type: 'INTEGER', default: '0' },
    { table: 'conversations', column: 'model_used', type: 'TEXT', default: 'NULL' }
  ];
  
  for (const col of missingColumns) {
    try {
      const tableColumns = db.prepare(`PRAGMA table_info(${col.table})`).all();
      const hasColumn = tableColumns.some(c => c.name === col.column);
      
      if (!hasColumn) {
        console.log(`✅ Adding missing ${col.column} column to ${col.table}...`);
        db.exec(`
          ALTER TABLE ${col.table} 
          ADD COLUMN ${col.column} ${col.type} DEFAULT ${col.default};
        `);
      }
    } catch (error) {
      console.log(`⚠️  Could not check/add ${col.column} to ${col.table}: ${error.message}`);
    }
  }
  
  // Handle datetime columns separately (they need special handling)
  const datetimeColumns = [
    { table: 'sessions', column: 'start_time', type: 'DATETIME' },
    { table: 'sessions', column: 'last_activity', type: 'DATETIME' },
    { table: 'sessions', column: 'created_at', type: 'DATETIME' },
    { table: 'sessions', column: 'updated_at', type: 'DATETIME' }
  ];
  
  for (const col of datetimeColumns) {
    try {
      const tableColumns = db.prepare(`PRAGMA table_info(${col.table})`).all();
      const hasColumn = tableColumns.some(c => c.name === col.column);
      
      if (!hasColumn) {
        console.log(`✅ Adding missing ${col.column} column to ${col.table}...`);
        db.exec(`
          ALTER TABLE ${col.table} 
          ADD COLUMN ${col.column} ${col.type};
        `);
        
        // Set current timestamp for existing rows
        db.exec(`
          UPDATE ${col.table} 
          SET ${col.column} = CURRENT_TIMESTAMP 
          WHERE ${col.column} IS NULL;
        `);
      }
    } catch (error) {
      console.log(`⚠️  Could not check/add ${col.column} to ${col.table}: ${error.message}`);
    }
  }
  
  // Ensure all core tables exist with proper schema
  console.log('✅ Ensuring all core tables exist...');
  
  // Create missing core tables if they don't exist
  const coreTableSql = `
    -- Create memory_contexts table if missing
    CREATE TABLE IF NOT EXISTS memory_contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER,
      context_type TEXT NOT NULL,
      content TEXT NOT NULL,
      relevance_score REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      metadata TEXT DEFAULT '{}',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
    
    -- Create memory_tags table if missing
    CREATE TABLE IF NOT EXISTS memory_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_name TEXT UNIQUE NOT NULL,
      category TEXT DEFAULT 'general',
      priority INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME
    );
    
    -- Create conversation_tags junction table if missing
    CREATE TABLE IF NOT EXISTS conversation_tags (
      conversation_id INTEGER,
      tag_id INTEGER,
      relevance_score REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, tag_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES memory_tags(id) ON DELETE CASCADE
    );
    
    -- Create learning_data table if missing
    CREATE TABLE IF NOT EXISTS learning_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      data_type TEXT NOT NULL,
      key_name TEXT NOT NULL,
      value_data TEXT NOT NULL,
      confidence_score REAL DEFAULT 1.0,
      source TEXT DEFAULT 'user_interaction',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      UNIQUE(user_id, data_type, key_name)
    );
  `;
  
  db.exec(coreTableSql);
  
  // Update journal_entries to use the new column names if needed
  const journalRows = db.prepare("SELECT COUNT(*) as count FROM journal_entries").get();
  if (journalRows.count > 0) {
    console.log('✅ Migrating existing journal entries...');
    
    // Check if entry_text column exists and migrate to content
    const hasEntryText = db.prepare("PRAGMA table_info(journal_entries)")
      .all()
      .some(col => col.name === 'entry_text');
    
    if (hasEntryText) {
      // Copy entry_text to content if content is empty
      db.exec(`
        UPDATE journal_entries 
        SET content = entry_text 
        WHERE (content IS NULL OR content = '') AND entry_text IS NOT NULL;
      `);
    }
    
    // Set default title if missing
    db.exec(`
      UPDATE journal_entries 
      SET title = 'Journal Entry ' || id 
      WHERE title IS NULL OR title = '';
    `);
  }
  
  // Ensure default session exists (check if we have the required columns first)
  try {
    const defaultSession = db.prepare("SELECT * FROM sessions WHERE id = 'default'").get();
    if (!defaultSession) {
      console.log('✅ Creating default session...');
      
      // Check which columns exist in sessions table
      const sessionCols = db.prepare("PRAGMA table_info(sessions)").all();
      const hasName = sessionCols.some(c => c.name === 'name');
      const hasDescription = sessionCols.some(c => c.name === 'description');
      const hasCreatedAt = sessionCols.some(c => c.name === 'created_at');
      const hasLastActivity = sessionCols.some(c => c.name === 'last_activity');
      
      let insertSql = `INSERT INTO sessions (id`;
      let valuesSql = `VALUES ('default'`;
      
      if (hasName) {
        insertSql += `, name`;
        valuesSql += `, 'Default Session'`;
      }
      if (hasDescription) {
        insertSql += `, description`;
        valuesSql += `, 'The main conversation session'`;
      }
      if (hasCreatedAt) {
        insertSql += `, created_at`;
        valuesSql += `, CURRENT_TIMESTAMP`;
      }
      if (hasLastActivity) {
        insertSql += `, last_activity`;
        valuesSql += `, CURRENT_TIMESTAMP`;
      }
      
      insertSql += `)`;
      valuesSql += `)`;
      
      db.exec(`${insertSql} ${valuesSql};`);
    }
  } catch (error) {
    console.log(`⚠️  Could not create default session: ${error.message}`);
  }
  
  // Insert default memory tags if they don't exist
  const defaultTags = [
    { name: 'greeting', category: 'interaction', priority: 2, description: 'Initial greetings and introductions' },
    { name: 'question', category: 'interaction', priority: 2, description: 'User asking questions' },
    { name: 'help_request', category: 'interaction', priority: 3, description: 'User requesting assistance' },
    { name: 'emotional_support', category: 'emotion', priority: 3, description: 'Conversations involving emotional support' },
    { name: 'personal_sharing', category: 'interaction', priority: 3, description: 'User sharing personal information' },
    { name: 'problem_solving', category: 'activity', priority: 3, description: 'Working through problems together' }
  ];
  
  for (const tag of defaultTags) {
    try {
      db.exec(`
        INSERT OR IGNORE INTO memory_tags (tag_name, category, priority, description) 
        VALUES (?, ?, ?, ?)
      `, [tag.name, tag.category, tag.priority, tag.description]);
    } catch (error) {
      console.log(`⚠️  Could not insert tag ${tag.name}: ${error.message}`);
    }
  }
  
  // Check memory_contexts table structure
  const memoryColumns = db.prepare("PRAGMA table_info(memory_contexts)").all();
  console.log('✅ Memory contexts table structure verified');
  
  console.log('');
  console.log('🎉 Database fixes completed successfully!');
  console.log('');
  
  // Verify the fixes
  console.log('📋 VERIFICATION:');
  console.log('=' .repeat(50));
  
  const updatedJournalColumns = db.prepare("PRAGMA table_info(journal_entries)").all();
  console.log('journal_entries columns:', updatedJournalColumns.map(c => c.name).join(', '));
  
  const updatedSessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
  console.log('sessions columns:', updatedSessionColumns.map(c => c.name).join(', '));
  
  const conversationColumns = db.prepare("PRAGMA table_info(conversations)").all();
  console.log('conversations columns:', conversationColumns.map(c => c.name).join(', '));
  
  const sessionCount = db.prepare("SELECT COUNT(*) as count FROM sessions").get();
  console.log('Sessions count:', sessionCount.count);
  
  const tagCount = db.prepare("SELECT COUNT(*) as count FROM memory_tags").get();
  console.log('Memory tags count:', tagCount.count);
  
  // List all tables to ensure everything exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Database tables:', tables.map(t => t.name).join(', '));
  
  db.close();
  
} catch (error) {
  console.error('❌ Error fixing database:', error);
  process.exit(1);
}
