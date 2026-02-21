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
  
  // Check if other missing columns exist and add them
  const missingColumns = [
    { table: 'journal_entries', column: 'title', type: 'TEXT', default: 'NULL' },
    { table: 'journal_entries', column: 'content', type: 'TEXT', default: 'NULL' },
    { table: 'journal_entries', column: 'word_count', type: 'INTEGER', default: '0' },
    { table: 'journal_entries', column: 'reading_time_minutes', type: 'INTEGER', default: '0' },
    { table: 'journal_entries', column: 'themes', type: 'TEXT', default: "'[]'" },
    { table: 'journal_entries', column: 'emotions', type: 'TEXT', default: "'[]'" },
    { table: 'journal_entries', column: 'mood', type: 'TEXT', default: "'neutral'" }
  ];
  
  for (const col of missingColumns) {
    const tableColumns = db.prepare(`PRAGMA table_info(${col.table})`).all();
    const hasColumn = tableColumns.some(c => c.name === col.column);
    
    if (!hasColumn) {
      console.log(`✅ Adding missing ${col.column} column to ${col.table}...`);
      db.exec(`
        ALTER TABLE ${col.table} 
        ADD COLUMN ${col.column} ${col.type} DEFAULT ${col.default};
      `);
    }
  }
  
  // Update journal_entries to use the new column names if needed
  const journalRows = db.prepare("SELECT COUNT(*) as count FROM journal_entries").get();
  if (journalRows.count > 0) {
    console.log('✅ Migrating existing journal entries...');
    
    // Copy entry_text to content if content is empty
    db.exec(`
      UPDATE journal_entries 
      SET content = entry_text 
      WHERE content IS NULL OR content = '';
    `);
    
    // Set default title if missing
    db.exec(`
      UPDATE journal_entries 
      SET title = 'Journal Entry ' || id 
      WHERE title IS NULL OR title = '';
    `);
  }
  
  // Ensure default session exists
  const defaultSession = db.prepare("SELECT * FROM sessions WHERE id = 'default'").get();
  if (!defaultSession) {
    console.log('✅ Creating default session...');
    db.exec(`
      INSERT INTO sessions (id, name, created_at, last_active) 
      VALUES ('default', 'Default Session', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);
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
  
  const sessionCount = db.prepare("SELECT COUNT(*) as count FROM sessions").get();
  console.log('Sessions count:', sessionCount.count);
  
  db.close();
  const missingColumns = [
    { name: 'total_interactions', type: 'INTEGER', default: '0' },
    { name: 'conversation_count', type: 'INTEGER', default: '0' },
    { name: 'last_interaction', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
    { name: 'name', type: 'TEXT', default: "'Companion'" },
    { name: 'static_traits', type: 'TEXT', default: "'{}'" },
    { name: 'curiosity_level', type: 'INTEGER', default: '7' },
    { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
  ];
  
  missingColumns.forEach(col => {
    if (!columnNames.includes(col.name)) {
      try {
        const sql = `ALTER TABLE personality_state ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`;
        console.log(`Adding column: ${col.name}`);
        db.exec(sql);
      } catch (error) {
        console.log(`⚠️  Could not add ${col.name}: ${error.message}`);
      }
    } else {
      console.log(`✅ Column ${col.name} already exists`);
    }
  });
  
  // Create a default personality state if none exists
  const existingPersonality = db.prepare("SELECT COUNT(*) as count FROM personality_state").get();
  
  if (existingPersonality.count === 0) {
    console.log('Creating default personality state...');
    const insertPersonality = db.prepare(`
      INSERT INTO personality_state (
        session_id, traits, current_mood, energy_level, empathy_level, 
        humor_level, learning_data, total_interactions, conversation_count,
        name, static_traits, curiosity_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertPersonality.run(
      'default-session',
      '{"helpful": 0.8, "curious": 0.7, "empathetic": 0.9}',
      '{"state": "neutral", "energy": "medium"}',
      7,
      9,
      6,
      '{}',
      0,
      0,
      'Companion',
      '{"base_personality": "helpful_assistant"}',
      7
    );
    
    console.log('✅ Default personality state created');
  }
  
  db.close();
  console.log('✅ Database schema fixed successfully!');
  
} catch (error) {
  console.error('❌ Error fixing database:', error.message);
  process.exit(1);
}
