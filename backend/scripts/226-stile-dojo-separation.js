/**
 * Phase 1 — Mandantentrennung stile/graduierungen nach dojo_id (Duplizieren-pro-Dojo).
 * ================================================================================
 * - Dojo 3 (ORIGIN) behält die Original-`stil_id`s → keine Ummappung seiner Daten.
 * - Jedes Dojo in COPY_DOJOS bekommt EIGENE Kopien der Stile, die es real nutzt,
 *   inkl. Gürtel (graduierungen) und Prüfungs-Anforderungen. Seine `pruefungen`
 *   und `mitglied_stil_data` werden per alt→neu-Mapping (stil_id + graduierung_id)
 *   auf die Dojo-Kopie umgehängt.
 * - NICHTS wird gelöscht. Namensbasierte Tabellen (mitglied_stile.stil, kurse.stil)
 *   bleiben unverändert (Name bleibt gleich; dojo-Auflösung passiert im Code).
 *
 * Nutzung:
 *   node scripts/226-stile-dojo-separation.js            # DRY RUN (nur Anzeige)
 *   node scripts/226-stile-dojo-separation.js --execute  # führt die Migration aus
 *
 * WICHTIG: Vor --execute ein vollständiges DB-Backup ziehen.
 */
const db = require('../db');
const pool = db.promise();

const ORIGIN_DOJO = 3;          // behält Original-stil_ids
const COPY_DOJOS = [2, 4];      // bekommen eigene Kopien der genutzten Stile

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`, [table, col]);
  return r[0].n > 0;
}
async function indexExists(table, idx) {
  const [r] = await pool.query(
    `SELECT COUNT(*) n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?`, [table, idx]);
  return r[0].n > 0;
}

// Original-Stile (dojo_id = ORIGIN oder noch NULL), die Dojo D real nutzt.
async function stylesUsedByDojo(conn, D) {
  const [rows] = await conn.query(`
    SELECT s.stil_id, s.name FROM stile s
     WHERE (s.dojo_id = ? OR s.dojo_id IS NULL)
       AND s.stil_id IN (
        SELECT msd.stil_id FROM mitglied_stil_data msd
          JOIN mitglieder m ON m.mitglied_id=msd.mitglied_id WHERE m.dojo_id=?
        UNION SELECT p.stil_id FROM pruefungen p WHERE p.dojo_id=?
        UNION SELECT s2.stil_id FROM kurse k
          JOIN stile s2 ON s2.name=k.stil AND (s2.dojo_id=? OR s2.dojo_id IS NULL)
          WHERE k.dojo_id=? AND k.stil IS NOT NULL AND k.stil<>''
       )
     ORDER BY s.stil_id`, [ORIGIN_DOJO, D, D, ORIGIN_DOJO, D]);
  return rows;
}

// Baut CASE-Ausdruck alt→neu für eine graduierung-Spalte; NULL/unbekannt bleibt unverändert.
function gradCase(col, map) {
  const e = Object.entries(map);
  if (!e.length) return col;
  return `CASE ${col} ${e.map(([o, n]) => `WHEN ${parseInt(o)} THEN ${parseInt(n)}`).join(' ')} ELSE ${col} END`;
}

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(`\n=== Phase 1 Stil-Trennung — ${execute ? 'EXECUTE ⚠️' : 'DRY RUN'} ===`);
  console.log(`ORIGIN (behält Originale): Dojo ${ORIGIN_DOJO} | Kopien für Dojos: ${COPY_DOJOS.join(', ')}\n`);

  // --- 1. Schema: stile.dojo_id + Backfill = ORIGIN -------------------------
  if (!await columnExists('stile', 'dojo_id')) {
    console.log('• stile.dojo_id fehlt → ADD COLUMN + Index + Backfill aller Bestandszeilen = ' + ORIGIN_DOJO);
    if (execute) {
      await pool.query(`ALTER TABLE stile ADD COLUMN dojo_id INT NULL DEFAULT NULL AFTER stil_id`);
      if (!await indexExists('stile', 'idx_stile_dojo'))
        await pool.query(`ALTER TABLE stile ADD INDEX idx_stile_dojo (dojo_id)`);
      const [u] = await pool.query(`UPDATE stile SET dojo_id=? WHERE dojo_id IS NULL`, [ORIGIN_DOJO]);
      console.log(`  → ${u.affectedRows} Bestandsstile Dojo ${ORIGIN_DOJO} zugeordnet`);
    }
  } else {
    console.log('• stile.dojo_id existiert bereits (Schema-Schritt übersprungen)');
  }

  // --- 1b. ENUM → VARCHAR: mitglied_stile.stil / trainer_stile.stil ---------
  // Sonst schlägt das Speichern beliebiger (pro-Dojo) Stil-Namen mit "Data truncated" fehl.
  for (const t of ['mitglied_stile', 'trainer_stile']) {
    const [col] = await pool.query(
      `SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='stil'`, [t]);
    if (col.length && String(col[0].DATA_TYPE).toLowerCase() === 'enum') {
      console.log(`• ${t}.stil ENUM → VARCHAR(50)`);
      if (execute) await pool.query(`ALTER TABLE ${t} MODIFY stil VARCHAR(50) NOT NULL`);
    } else {
      console.log(`• ${t}.stil ist kein ENUM (übersprungen)`);
    }
  }

  // --- Snapshot: genutzte Stile pro Copy-Dojo VOR jeder Duplizierung --------
  const plan = {};
  {
    const conn = await pool.getConnection();
    try { for (const D of COPY_DOJOS) plan[D] = await stylesUsedByDojo(conn, D); }
    finally { conn.release(); }
  }

  // --- 2. Duplizierung + Remap (transaktional) -----------------------------
  const conn = await pool.getConnection();
  try {
    if (execute) await conn.beginTransaction();
    let totNewStile = 0, totGrad = 0, totMsd = 0, totPruef = 0;

    for (const D of COPY_DOJOS) {
      const styles = plan[D];
      console.log(`\n--- Dojo ${D}: ${styles.length} Stile kopieren ---`);
      for (const s of styles) {
        const [grads] = await conn.query(`SELECT * FROM graduierungen WHERE stil_id=?`, [s.stil_id]);
        const [anf] = await conn.query(`SELECT * FROM pruefung_anforderungen WHERE stil_id=?`, [s.stil_id]);
        const [[msd]] = await conn.query(
          `SELECT COUNT(*) n FROM mitglied_stil_data msd JOIN mitglieder m ON m.mitglied_id=msd.mitglied_id
            WHERE m.dojo_id=? AND msd.stil_id=?`, [D, s.stil_id]);
        const [[pr]] = await conn.query(
          `SELECT COUNT(*) n FROM pruefungen WHERE dojo_id=? AND stil_id=?`, [D, s.stil_id]);
        console.log(`  Stil ${s.stil_id} "${s.name}": ${grads.length} Gürtel, ${anf.length} Anford., remap ${msd.n} msd + ${pr.n} Prüfungen`);
        totNewStile++; totGrad += grads.length; totMsd += msd.n; totPruef += pr.n;
        if (!execute) continue;

        // 2a. neue stile-Zeile (Kopie, dojo_id=D)
        const [ins] = await conn.query(
          `INSERT INTO stile (dojo_id,name,beschreibung,aktiv,reihenfolge,wartezeit_grundstufe,wartezeit_mittelstufe,wartezeit_oberstufe,wartezeit_schwarzgurt_traditionell)
           SELECT ?,name,beschreibung,aktiv,reihenfolge,wartezeit_grundstufe,wartezeit_mittelstufe,wartezeit_oberstufe,wartezeit_schwarzgurt_traditionell
             FROM stile WHERE stil_id=?`, [D, s.stil_id]);
        const newStil = ins.insertId;

        // 2b. graduierungen kopieren + alt→neu-Mapping
        const gradMap = {};
        for (const g of grads) {
          const [gi] = await conn.query(
            `INSERT INTO graduierungen (stil_id,name,reihenfolge,trainingsstunden_min,mindestzeit_monate,farbe_hex,farbe_sekundaer,aktiv,kategorie,dan_grad,pruefungsgebuehr_default)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [newStil, g.name, g.reihenfolge, g.trainingsstunden_min, g.mindestzeit_monate, g.farbe_hex, g.farbe_sekundaer, g.aktiv, g.kategorie, g.dan_grad, g.pruefungsgebuehr_default]);
          gradMap[g.graduierung_id] = gi.insertId;
        }

        // 2c. pruefung_anforderungen kopieren (falls vorhanden)
        for (const a of anf) {
          await conn.query(
            `INSERT INTO pruefung_anforderungen (graduierung_id,stil_id,anforderungstyp,bezeichnung,beschreibung,min_punktzahl,max_punktzahl,gewichtung,reihenfolge,pflichtanforderung,aktiv)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [gradMap[a.graduierung_id] || null, newStil, a.anforderungstyp, a.bezeichnung, a.beschreibung, a.min_punktzahl, a.max_punktzahl, a.gewichtung, a.reihenfolge, a.pflichtanforderung, a.aktiv]);
        }

        // 2d. mitglied_stil_data umhängen (nur Mitglieder von D)
        await conn.query(
          `UPDATE mitglied_stil_data msd JOIN mitglieder m ON m.mitglied_id=msd.mitglied_id
              SET msd.stil_id=?, msd.current_graduierung_id=${gradCase('msd.current_graduierung_id', gradMap)}
            WHERE m.dojo_id=? AND msd.stil_id=?`, [newStil, D, s.stil_id]);

        // 2e. pruefungen umhängen (dojo D, stil S) inkl. Gürtel-Referenzen
        await conn.query(
          `UPDATE pruefungen SET stil_id=?,
              graduierung_vorher_id=${gradCase('graduierung_vorher_id', gradMap)},
              graduierung_nachher_id=${gradCase('graduierung_nachher_id', gradMap)},
              graduierung_zwischen_id=${gradCase('graduierung_zwischen_id', gradMap)}
            WHERE dojo_id=? AND stil_id=?`, [newStil, D, s.stil_id]);
      }
    }

    console.log(`\n=== Summe: ${totNewStile} Stil-Kopien, ${totGrad} Gürtel, remap ${totMsd} msd + ${totPruef} Prüfungen ===`);

    if (execute) {
      await conn.commit();
      console.log('✓ Transaktion committed.');
    }
  } catch (e) {
    if (execute) { await conn.rollback(); console.error('✗ Rollback wegen Fehler:', e.message); }
    throw e;
  } finally {
    conn.release();
  }

  // --- 3. UNIQUE(name) → UNIQUE(dojo_id,name) ------------------------------
  if (execute) {
    if (await indexExists('stile', 'name')) { await pool.query(`ALTER TABLE stile DROP INDEX name`); console.log('• UNIQUE(name) entfernt'); }
    if (!await indexExists('stile', 'uk_dojo_name')) { await pool.query(`ALTER TABLE stile ADD UNIQUE KEY uk_dojo_name (dojo_id, name)`); console.log('• UNIQUE(dojo_id,name) angelegt'); }
  } else {
    console.log('\n• (DRY RUN) Danach: DROP INDEX name; ADD UNIQUE KEY uk_dojo_name (dojo_id,name)');
  }

  console.log(`\n${execute ? '✅ Migration abgeschlossen.' : 'ℹ️  DRY RUN – keine Änderungen geschrieben. Mit --execute ausführen (nach Backup).'}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
