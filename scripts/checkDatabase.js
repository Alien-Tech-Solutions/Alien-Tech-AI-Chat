const Database = require('better-sqlite3');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'database', 'chat.db');

console.log('🔍 Checking database at:', dbPath);
console.log('');

try {
  const db = new Database(dbPath);
  
  // Get all tables
  console.log('📋 TABLES:');
  console.log('=' .repeat(50));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  
  if (tables.length === 0) {
    console.log('❌ No tables found in database!');
  } else {
    tables.forEach(table => {
      console.log(`📄 ${table.name}`);
    });
  }
  
  console.log('');
  
  // Check each table's columns
  console.log('🔧 TABLE SCHEMAS:');
  console.log('=' .repeat(50));
  
  tables.forEach(table => {
    console.log(`\n📄 Table: ${table.name}`);
    console.log('-'.repeat(30));
    
    try {
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
      columns.forEach(col => {
        const nullable = col.notnull ? 'NOT NULL' : 'NULL';
        const defaultVal = col.dflt_value ? ` DEFAULT ${col.dflt_value}` : '';
        console.log(`   ${col.name} (${col.type}) ${nullable}${defaultVal}`);
      });
      
      // Count rows
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      console.log(`   📊 Rows: ${count.count}`);
      
    } catch (error) {
      console.log(`   ❌ Error reading table: ${error.message}`);
    }
  });
  
  // Check for specific issues
  console.log('\n');
  console.log('🔍 CHECKING FOR COMMON ISSUES:');
  console.log('=' .repeat(50));
  
  // Check if chat_messages table exists (this might be the issue)
  const hasChatMessages = tables.some(t => t.name === 'chat_messages');
  const hasConversations = tables.some(t => t.name === 'conversations');
  
  if (!hasChatMessages && hasConversations) {
    console.log('✅ Using "conversations" table (correct)');
  } else if (hasChatMessages) {
    console.log('⚠️  Found "chat_messages" table - might cause conflicts');
  } else if (!hasConversations) {
    console.log('❌ Missing "conversations" table!');
  }
  
  // Check personality_state columns
  if (tables.some(t => t.name === 'personality_state')) {
    const personalityColumns = db.prepare("PRAGMA table_info(personality_state)").all();
    const columnNames = personalityColumns.map(col => col.name);
    
    const requiredColumns = ['total_interactions', 'conversation_count', 'last_interaction'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing personality_state columns: ${missingColumns.join(', ')}`);
    } else {
      console.log('✅ personality_state table has required columns');
    }
  }
  
  // Show recent conversations
  if (hasConversations) {
    console.log('\n');
    console.log('💬 RECENT CONVERSATIONS:');
    console.log('=' .repeat(50));
    
    try {
      const recent = db.prepare(`
        SELECT id, session_id, user_message, ai_response, timestamp 
        FROM conversations 
        ORDER BY timestamp DESC 
        LIMIT 5
      `).all();
      
      if (recent.length === 0) {
        console.log('📭 No conversations found');
      } else {
        recent.forEach(conv => {
          const userMsg = conv.user_message ? conv.user_message.substring(0, 50) + '...' : 'NULL';
          const aiMsg = conv.ai_response ? conv.ai_response.substring(0, 50) + '...' : 'NULL';
          console.log(`${conv.id}: ${conv.timestamp}`);
          console.log(`   User: ${userMsg}`);
          console.log(`   AI: ${aiMsg}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`❌ Error reading conversations: ${error.message}`);
    }
  }
  
  db.close();
  console.log('✅ Database check completed!');
  
} catch (error) {
  console.error('❌ Error accessing database:', error.message);
  process.exit(1);
}
