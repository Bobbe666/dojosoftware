// ============================================================================
// Runner für Migration 185: Tabelle manuelle_erstattungen
// Ausführen:  node scripts/run-migration-185.js
// ============================================================================
const db = require('../db');
const pool = db.promise();

const SQL = `
CREATE TABLE IF NOT EXISTS manuelle_erstattungen (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  transaktion_id  INT NULL,
  mitglied_id     INT NOT NULL,
  dojo_id         INT NOT NULL,
  betrag          DECIMAL(10,2) NOT NULL,
  erstattet_am    DATE NOT NULL,
  quelle          VARCHAR(255) NULL,
  bemerkung       TEXT NULL,
  erstellt_von    VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_me_tx (transaktion_id),
  INDEX idx_me_mitglied (mitglied_id),
  INDEX idx_me_dojo (dojo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

(async () => {
  try {
    console.log('→ Lege Tabelle manuelle_erstattungen an ...');
    await pool.query(SQL);
    const [cols] = await pool.query('SHOW COLUMNS FROM manuelle_erstattungen');
    console.log('✅ Migration 185 erfolgreich — Spalten:', cols.map(c => c.Field).join(', '));
  } catch (err) {
    console.error('❌ Fehler bei Migration 185:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
})();
