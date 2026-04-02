// Run API Token Migration
// Adds api_token fields to dojo table

const db = require('./db');

console.log('🔧 Starting API Token Migration...');

const migrations = [
  {
    name: 'Add api_token column',
    sql: `ALTER TABLE dojo ADD COLUMN api_token VARCHAR(255) DEFAULT NULL`
  },
  {
    name: 'Add api_token_created_at column',
    sql: `ALTER TABLE dojo ADD COLUMN api_token_created_at DATETIME DEFAULT NULL`
  },
  {
    name: 'Add api_token_last_used column',
    sql: `ALTER TABLE dojo ADD COLUMN api_token_last_used DATETIME DEFAULT NULL`
  }
];

let completed = 0;

migrations.forEach((migration, index) => {
  db.query(migration.sql, (err, result) => {
    if (err) {
      console.error(`❌ Failed: ${migration.name}`, err.message);
    } else {
      console.log(`✅ Success: ${migration.name}`);
    }

    completed++;

    if (completed === migrations.length) {
      console.log('\n🎉 Migration completed!');
      console.log('You can now generate API tokens for your dojos.');
      process.exit(0);
    }
  });
});
