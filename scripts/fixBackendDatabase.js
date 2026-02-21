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
    
    // Check and add description column if missing
    const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
    const hasDescription = sessionColumns.some(col => col.name === 'description');
    
    if (!hasDescription) {
      console.log('✅ Adding missing description column...');
      db.exec('ALTER TABLE sessions ADD COLUMN description TEXT;');
    } else {
      console.log('✅ Description column already exists');
    }
    
    // Verify
    const updatedColumns = db.prepare("PRAGMA table_info(sessions)").all();
    console.log('📋 Sessions columns:', updatedColumns.map(c => c.name).join(', '));
    
    db.close();
    console.log('✅ Database fix completed\n');
    
  } catch (error) {
    console.log(`⚠️ Could not fix database at ${dbPath}: ${error.message}\n`);
  }
}
