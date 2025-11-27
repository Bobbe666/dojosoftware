/**
 * Migration Runner: Create zahllaeufe table
 *
 * This script creates the zahllaeufe table if it doesn't exist
 * and populates it with sample data for testing.
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojosoftware',
  multipleStatements: true
};

console.log('🚀 Starting Zahlläufe Table Migration...');
console.log('📊 Database:', dbConfig.database);

// Create connection
const connection = mysql.createConnection(dbConfig);

// Read SQL file
const sqlFile = path.join(__dirname, 'create_zahllaeufe_table.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Execute migration
connection.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  console.log('✅ Connected to database');

  connection.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Migration failed:', err.message);
      connection.end();
      process.exit(1);
    }

    console.log('✅ Zahlläufe table created/verified successfully');

    // Verify table structure
    connection.query('DESCRIBE zahllaeufe', (err, columns) => {
      if (err) {
        console.error('❌ Failed to verify table structure:', err.message);
      } else {
        console.log('\n📋 Table Structure:');
        columns.forEach(col => {
          console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? '[' + col.Key + ']' : ''}`);
        });
      }

      // Count records
      connection.query('SELECT COUNT(*) as count FROM zahllaeufe', (err, result) => {
        if (!err && result.length > 0) {
          console.log(`\n📊 Sample data: ${result[0].count} Zahlläufe in database`);
        }

        connection.end();
        console.log('\n✅ Migration completed successfully!');
      });
    });
  });
});
