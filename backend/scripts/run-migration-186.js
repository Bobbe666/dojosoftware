// ============================================================================
// Runner für Migration 186: Zentrale erstattungen-Tabelle
// Ausführen:  node scripts/run-migration-186.js
// ============================================================================
const fs = require('fs');
const path = require('path');
const db = require('../db');
const pool = db.promise();

const file = path.join(__dirname, '..', 'migrations', '186_erstattungen_zentral.sql');

(async () => {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    // Kommentarzeilen entfernen, dann nach ; splitten (keine Trigger/DELIMITER hier)
    const sql = raw.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);

    for (const stmt of statements) {
      const kind = stmt.slice(0, 40).replace(/\s+/g, ' ');
      console.log(`→ ${kind} ...`);
      const [res] = await pool.query(stmt);
      if (res && res.affectedRows != null) console.log(`   ✓ ${res.affectedRows} Zeile(n)`);
    }

    const [cols] = await pool.query('SHOW COLUMNS FROM erstattungen');
    const [[cnt]] = await pool.query('SELECT COUNT(*) AS n FROM erstattungen');
    console.log(`✅ Migration 186 erfolgreich — ${cols.length} Spalten, ${cnt.n} Erstattung(en) übernommen`);
  } catch (err) {
    console.error('❌ Fehler bei Migration 186:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
})();
