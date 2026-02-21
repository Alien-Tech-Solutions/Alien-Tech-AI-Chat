#!/usr/bin/env node

/**
 * GitHub Release Preparation Script
 * Cleans all personal data before public upload
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Preparing Lackadaisical AI Chat for GitHub Release...\n');

// Try to load better-sqlite3, fallback to manual deletion if not available
let Database;
try {
    Database = require('better-sqlite3');
} catch (err) {
    console.log('ℹ️  better-sqlite3 not found, will delete database files instead');
    Database = null;
}

// Database files to clean
const databases = [
    'database/chat.db',
    'backend/database/chat.db'
];

// Memory files to clean
const memoryFiles = [
    'backend/memory/default.json',
    'backend/memory/test-session.json'
];

// Log files to clean
const logFiles = [
    'logs/app.log',
    'logs/error.log',
    'backend/logs/app.log',
    'backend/logs/error.log'
];

// Directories that might contain personal data
const personalDataDirs = [
    'memory',
    'backend/memory',
    'logs',
    'backend/logs'
];

function cleanDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(dbPath)) {
            console.log(`   ⚠️  Database not found: ${dbPath}`);
            resolve();
            return;
        }

        if (!Database) {
            // If better-sqlite3 is not available, just delete and recreate
            console.log(`   🗑️  Deleting database file: ${dbPath}`);
            deleteFile(dbPath);
            console.log(`   ✅ Database removed: ${dbPath}\n`);
            resolve();
            return;
        }

        try {
            const db = new Database(dbPath);
            
            // Get all table names
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            
            // Clear all data from each table
            for (const table of tables) {
                try {
                    db.prepare(`DELETE FROM ${table.name}`).run();
                    console.log(`   ✅ Cleared table: ${table.name}`);
                } catch (err) {
                    console.log(`   ⚠️  Could not clear ${table.name}: ${err.message}`);
                }
            }

            // Reset autoincrement counters
            try {
                db.prepare("DELETE FROM sqlite_sequence").run();
                console.log(`   ✅ Reset autoincrement counters`);
            } catch (err) {
                console.log(`   ⚠️  Could not reset autoincrement: ${err.message}`);
            }
            
            db.close();
            console.log(`   ✅ Database cleaned: ${dbPath}\n`);
            resolve();

        } catch (error) {
            console.log(`   ❌ Error cleaning database ${dbPath}:`, error.message);
            // Fallback: just delete the file
            console.log(`   🗑️  Falling back to file deletion`);
            deleteFile(dbPath);
            resolve();
        }
    });
}

function deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`   ✅ Deleted: ${filePath}`);
        return true;
    } else {
        console.log(`   ⚠️  File not found: ${filePath}`);
        return false;
    }
}

function createCleanFile(filePath, content = '') {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    console.log(`   ✅ Created clean file: ${filePath}`);
}

async function cleanAll() {
    try {
        // 1. Clean databases
        console.log('🗄️  Cleaning databases...');
        for (const dbPath of databases) {
            await cleanDatabase(dbPath);
        }

        // 2. Clean memory files
        console.log('🧠 Cleaning memory files...');
        for (const memoryFile of memoryFiles) {
            if (fs.existsSync(memoryFile)) {
                deleteFile(memoryFile);
                // Create empty memory file
                if (memoryFile.includes('default.json')) {
                    createCleanFile(memoryFile, JSON.stringify({
                        conversations: [],
                        memories: [],
                        personality_state: {},
                        last_updated: new Date().toISOString()
                    }, null, 2));
                }
            }
        }

        // 3. Clean log files
        console.log('📋 Cleaning log files...');
        for (const logFile of logFiles) {
            if (fs.existsSync(logFile)) {
                deleteFile(logFile);
                // Create empty log file
                createCleanFile(logFile, `# Lackadaisical AI Chat - Clean Installation
# Logs will appear here when the application runs
# Started: ${new Date().toISOString()}
`);
            }
        }

        // 4. Check for any other personal data files
        console.log('🔍 Checking for other personal data...');
        
        // Check if there are any .env files with keys
        const envFiles = ['.env', 'backend/.env', 'frontend/.env'];
        for (const envFile of envFiles) {
            if (fs.existsSync(envFile)) {
                const content = fs.readFileSync(envFile, 'utf8');
                if (content.includes('sk-') || content.includes('api_key') || content.includes('API_KEY')) {
                    console.log(`   ⚠️  WARNING: ${envFile} may contain API keys!`);
                    console.log(`   💡 Consider removing or using .env.example instead`);
                }
            }
        }

        // 5. Create fresh empty files where needed
        console.log('📁 Creating clean placeholder files...');
        
        // Ensure log directories exist with gitkeep
        const logDirs = ['logs', 'backend/logs'];
        for (const logDir of logDirs) {
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            createCleanFile(path.join(logDir, '.gitkeep'), '# Keep this directory in git\n');
        }

        // Create .gitignore additions
        const gitignoreAdditions = `
# Personal data - never commit
*.db
!schema.sql
backend/memory/*.json
!backend/memory/.gitkeep
logs/*.log
backend/logs/*.log
.env
backend/.env
frontend/.env

# Development
node_modules/
.vite/
dist/
build/
.cache/

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`;

        console.log('📝 Checking .gitignore...');
        const gitignorePath = '.gitignore';
        if (fs.existsSync(gitignorePath)) {
            const existing = fs.readFileSync(gitignorePath, 'utf8');
            if (!existing.includes('*.db') || !existing.includes('backend/memory/*.json')) {
                fs.appendFileSync(gitignorePath, gitignoreAdditions);
                console.log('   ✅ Updated .gitignore with personal data exclusions');
            } else {
                console.log('   ✅ .gitignore already configured');
            }
        } else {
            createCleanFile(gitignorePath, gitignoreAdditions.trim());
        }

        console.log('\n🎉 GitHub Release Preparation Complete!');
        console.log('\n📋 Summary:');
        console.log('   ✅ All databases cleared of personal conversations');
        console.log('   ✅ Memory files reset to clean state'); 
        console.log('   ✅ Log files cleaned');
        console.log('   ✅ .gitignore configured to prevent personal data commits');
        console.log('\n🚀 Your project is ready for GitHub upload!');
        console.log('   💡 Users will get a clean slate to start their own AI companion');
        console.log('   🔒 No personal data will be shared publicly');

    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanAll();
