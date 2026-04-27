/**
 * Fix: Fehlende Beiträge für alle aktiven Mitglieder auffüllen
 * Generiert alle Monate von MAX(vorhandener Beitrag)+1 bis Vertragsende/Mindestlaufzeit
 */
const db = require('../db');
const { generateInitialBeitraege } = require('../routes/vertraege/shared');

const pool = db.promise ? db.promise() : db;

async function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
  });
}

async function run() {
  console.log('🔍 Suche Mitglieder mit fehlenden Beiträgen...\n');

  const members = await queryAsync(`
    SELECT
      m.mitglied_id, m.vorname, m.nachname, m.dojo_id,
      v.vertragsbeginn, v.vertragsende, v.mindestlaufzeit_monate,
      COALESCE(v.monatsbeitrag, v.monatlicher_beitrag) as monatsbeitrag,
      t.aufnahmegebuehr_cents,
      MAX(b.zahlungsdatum) as letzter_beitrag,
      COUNT(b.beitrag_id) as anzahl_beitraege
    FROM mitglieder m
    JOIN vertraege v ON v.mitglied_id = m.mitglied_id
      AND v.status IN ('aktiv', 'gekuendigt')
    LEFT JOIN tarife t ON v.tarif_id = t.id
    LEFT JOIN beitraege b ON b.mitglied_id = m.mitglied_id
      AND b.art = 'mitgliedsbeitrag' AND b.bezahlt = 0
    WHERE m.aktiv = 1
      AND v.vertragsbeginn IS NOT NULL
      AND COALESCE(v.monatsbeitrag, v.monatlicher_beitrag) > 0
    GROUP BY m.mitglied_id, v.id
  `);

  const today = new Date();
  let fixed = 0, skipped = 0, errors = 0;

  for (const m of members) {
    const beginn = new Date(m.vertragsbeginn);
    const mindestlaufzeit = m.mindestlaufzeit_monate || 12;

    // Vertragsende: explizit oder mindestlaufzeit ab Beginn
    let ende;
    if (m.vertragsende) {
      ende = new Date(m.vertragsende);
    } else {
      ende = new Date(beginn.getFullYear(), beginn.getMonth() + mindestlaufzeit, 0);
    }

    // Wenn Vertragsende in der Vergangenheit — noch 1 Monat Puffer
    if (ende < today) {
      skipped++;
      continue;
    }

    // Letzter vorhandener Beitrag
    const letzter = m.letzter_beitrag ? new Date(m.letzter_beitrag) : null;

    // Prüfen ob Beiträge bis mindestens 1 Monat nach heute vorhanden sind
    const minTarget = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    if (letzter && letzter >= Math.min(ende, minTarget)) {
      skipped++;
      continue;
    }

    try {
      // generateInitialBeitraege hat eingebaute Duplikat-Prüfung
      const result = await generateInitialBeitraege(
        m.mitglied_id,
        m.dojo_id,
        m.vertragsbeginn,
        parseFloat(m.monatsbeitrag),
        0, // Aufnahmegebühr nicht nochmal anlegen
        m.vertragsende || null,
        mindestlaufzeit
      );

      if (result.insertedIds.length > 0) {
        console.log(`✅ ${m.vorname} ${m.nachname} (ID ${m.mitglied_id}): +${result.insertedIds.length} Beiträge eingefügt (${result.skippedCount} bereits vorhanden)`);
        fixed++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.error(`❌ Fehler bei ${m.vorname} ${m.nachname} (ID ${m.mitglied_id}):`, e.message);
      errors++;
    }
  }

  console.log(`\n✅ Fertig: ${fixed} Mitglieder repariert, ${skipped} übersprungen, ${errors} Fehler`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
