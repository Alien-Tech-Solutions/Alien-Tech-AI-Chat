const Database = require('better-sqlite3');
const path = require('path');

// Fix both database paths
const dbPaths = [
  path.join(__dirname, '..', 'backend', 'database', 'chat.db'),
  'C:\\Users\\lankyroo\\Desktop\\database\\chat.db'
];

for (const dbPath of dbPaths) {
  try {
    console.log('🔧 Fixing database at:', dbPath);
    const db = new Database(dbPath);
    
    // Check and add metadata column to sessions
    const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
    const hasMetadata = sessionColumns.some(col => col.name === 'metadata');
    
    if (!hasMetadata) {
      console.log('✅ Adding missing metadata column to sessions...');
      db.exec(`ALTER TABLE sessions ADD COLUMN metadata TEXT DEFAULT '{}';`);
    } else {
      console.log('✅ metadata column already exists in sessions');
    }
    
    // Check and add privacy_level column to journal_entries
    const journalColumns = db.prepare("PRAGMA table_info(journal_entries)").all();
    const hasPrivacyLevel = journalColumns.some(col => col.name === 'privacy_level');
    
    if (!hasPrivacyLevel) {
      console.log('✅ Adding missing privacy_level column to journal_entries...');
      db.exec(`ALTER TABLE journal_entries ADD COLUMN privacy_level TEXT DEFAULT 'private';`);
    } else {
      console.log('✅ privacy_level column already exists in journal_entries');
    }
    
    // Add other missing columns that might be needed
    const missingSessionCols = [
      { name: 'total_tokens', type: 'INTEGER', default: '0' },
      { name: 'status', type: 'TEXT', default: "'active'" },
      { name: 'start_time', type: 'DATETIME' },
      { name: 'last_activity', type: 'DATETIME' },
      { name: 'updated_at', type: 'DATETIME' }
    ];
    
    for (const col of missingSessionCols) {
      const hasColumn = sessionColumns.some(c => c.name === col.name);
      if (!hasColumn) {
        console.log(`✅ Adding missing ${col.name} column to sessions...`);
        if (col.default) {
          db.exec(`ALTER TABLE sessions ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default};`);
        } else {
          db.exec(`ALTER TABLE sessions ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    }
    
    // Verify final structure
    const finalSessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
    console.log('📋 Final sessions columns:', finalSessionColumns.map(c => c.name).join(', '));
    
    const finalJournalColumns = db.prepare("PRAGMA table_info(journal_entries)").all();
    console.log('📋 Final journal_entries columns:', finalJournalColumns.map(c => c.name).join(', '));
    
    db.close();
    console.log('✅ Database fix completed\n');
    
  } catch (error) {
    console.log(`⚠️ Could not fix database at ${dbPath}: ${error.message}\n`);
  }
}

console.log('🎉 All database fixes completed!');
