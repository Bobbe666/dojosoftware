/**
 * Migration Runner: Create sepa_mandate table
 *
 * This script creates the sepa_mandate table if it doesn't exist
 * and ensures all required columns are present with correct types.
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojosoftware',
  multipleStatements: true
};

console.log('🚀 Starting SEPA Mandate Table Migration...');
console.log('📊 Database:', dbConfig.database);

// Create connection
const connection = mysql.createConnection(dbConfig);

// Read SQL file
const sqlFile = path.join(__dirname, 'create_sepa_mandate_table.sql');
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

    console.log('✅ SEPA Mandate table created/verified successfully');

    // Verify table structure
    connection.query('DESCRIBE sepa_mandate', (err, columns) => {
      if (err) {
        console.error('❌ Failed to verify table structure:', err.message);
      } else {
        console.log('\n📋 Table Structure:');
        columns.forEach(col => {
          console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? '[' + col.Key + ']' : ''}`);
        });
      }

      connection.end();
      console.log('\n✅ Migration completed successfully!');
    });
  });
});
