// Add columns for Kündigung and Ruhepause to vertraege table
const db = require('./db');

const queries = [
    {
        column: 'kuendigung_eingegangen',
        sql: `ALTER TABLE vertraege ADD COLUMN kuendigung_eingegangen DATE NULL COMMENT 'Datum an dem die Kündigung eingegangen ist'`
    },
    {
        column: 'kuendigungsgrund',
        sql: `ALTER TABLE vertraege ADD COLUMN kuendigungsgrund VARCHAR(255) NULL COMMENT 'Grund für die Kündigung'`
    },
    {
        column: 'kuendigungsdatum',
        sql: `ALTER TABLE vertraege ADD COLUMN kuendigungsdatum DATE NULL COMMENT 'Kündigungsdatum'`
    },
    {
        column: 'ruhepause_von',
        sql: `ALTER TABLE vertraege ADD COLUMN ruhepause_von DATE NULL COMMENT 'Startdatum der Ruhepause'`
    },
    {
        column: 'ruhepause_bis',
        sql: `ALTER TABLE vertraege ADD COLUMN ruhepause_bis DATE NULL COMMENT 'Enddatum der Ruhepause'`
    },
    {
        column: 'ruhepause_dauer_monate',
        sql: `ALTER TABLE vertraege ADD COLUMN ruhepause_dauer_monate INT NULL COMMENT 'Dauer der Ruhepause in Monaten'`
    }
];

async function addColumns() {
    for (const query of queries) {
        try {
            await new Promise((resolve, reject) => {
                db.query(query.sql, (err, result) => {
                    if (err) {
                        // Ignore error if column already exists
                        if (err.code === 'ER_DUP_FIELDNAME') {
                            console.log(`✓ Column '${query.column}' already exists, skipping...`);
                            resolve();
                        } else {
                            console.error(`✗ Error adding column '${query.column}':`, err.message);
                            reject(err);
                        }
                    } else {
                        console.log(`✓ Column '${query.column}' added successfully`);
                        resolve(result);
                    }
                });
            });
        } catch (error) {
            // Continue with next column even if this one fails
            console.error('Error:', error.message);
        }
    }

    console.log('\n✅ Migration completed!');
    process.exit(0);
}

addColumns();
