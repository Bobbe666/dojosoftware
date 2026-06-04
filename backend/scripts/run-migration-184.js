// ============================================================================
// Runner für Migration 184: DB-Guard gegen Löschen referenzierter Beiträge
// Legt den BEFORE-DELETE-Trigger trg_beitraege_block_referenced_delete an.
//
// Ausführen:  node scripts/run-migration-184.js
// ============================================================================
const db = require('../db');

const pool = db.promise();

const DROP = 'DROP TRIGGER IF EXISTS trg_beitraege_block_referenced_delete';

const CREATE = `
CREATE TRIGGER trg_beitraege_block_referenced_delete
BEFORE DELETE ON beitraege
FOR EACH ROW
BEGIN
  DECLARE v_ref INT DEFAULT 0;
  IF COALESCE(@allow_beitrag_delete, 0) = 0 THEN
    SELECT COUNT(*) INTO v_ref
    FROM stripe_lastschrift_transaktion t
    WHERE t.status IN ('processing', 'succeeded')
      AND t.beitrag_ids IS NOT NULL
      AND JSON_VALID(t.beitrag_ids)
      AND JSON_CONTAINS(t.beitrag_ids, CAST(OLD.beitrag_id AS CHAR), '$');
    IF v_ref > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'GUARD: Beitrag ist von einer aktiven oder abgeschlossenen Stripe-Lastschrift referenziert und darf nicht geloescht werden.';
    END IF;
  END IF;
END
`;

(async () => {
  try {
    console.log('→ Entferne evtl. vorhandenen Trigger ...');
    await pool.query(DROP);
    console.log('→ Lege Trigger trg_beitraege_block_referenced_delete an ...');
    await pool.query(CREATE);

    // Verifizieren
    const [rows] = await pool.query(
      "SHOW TRIGGERS WHERE `Trigger` = 'trg_beitraege_block_referenced_delete'"
    );
    if (rows.length) {
      console.log('✅ Migration 184 erfolgreich: Trigger aktiv auf', rows[0].Table, '/', rows[0].Event, rows[0].Timing);
    } else {
      console.error('❌ Trigger wurde nicht gefunden — Migration prüfen!');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Fehler bei Migration 184:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit(process.exitCode || 0);
  }
})();
