/**
 * Service: Automatische Rechnungserstellung aus Beiträgen
 *
 * Dieser Service erstellt automatisch Rechnungen für Beiträge mit Zahlungsart "Lastschrift",
 * die noch keine Rechnung haben. Dies ermöglicht die Nachverfolgung und Status-Synchronisation
 * zwischen Beiträgen und Rechnungen.
 */

const db = require('../db');

/**
 * Erstellt Rechnungen für alle unbezahlten Lastschrift-Beiträge ohne Rechnung
 * @param {number} dojo_id - Optional: Nur für bestimmtes Dojo
 * @returns {Promise<{success: boolean, rechnungen: number, positionen: number}>}
 */
async function createRechnungenFromBeitraege(dojo_id = null) {
  return new Promise((resolve, reject) => {
    // Schritt 1: Finde alle Beiträge ohne Rechnung gruppiert nach Mitglied
    let query = `
      SELECT
        b.mitglied_id,
        CONCAT(m.vorname, ' ', m.nachname) as mitglied_name,
        m.email,
        b.dojo_id,
        COUNT(*) as anzahl_beitraege,
        SUM(b.betrag) as gesamt_betrag,
        MIN(b.zahlungsdatum) as faelligkeitsdatum
      FROM beitraege b
      JOIN mitglieder m ON b.mitglied_id = m.mitglied_id
      WHERE b.rechnung_id IS NULL
        AND b.bezahlt = 0
        AND b.zahlungsart = 'Lastschrift'
    `;

    const params = [];
    if (dojo_id) {
      query += ' AND b.dojo_id = ?';
      params.push(dojo_id);
    }

    query += ' GROUP BY b.mitglied_id, b.dojo_id';

    db.query(query, params, async (err, mitgliederMitBeitraegen) => {
      if (err) return reject(err);

      if (mitgliederMitBeitraegen.length === 0) {
        return resolve({
          success: true,
          message: 'Keine offenen Beiträge gefunden',
          rechnungen: 0,
          positionen: 0
        });
      }

      let rechnungenCount = 0;
      let positionenCount = 0;

      // Schritt 2: Für jedes Mitglied eine Rechnung erstellen
      for (const mg of mitgliederMitBeitraegen) {
        try {
          const rechnungData = await createRechnungForMitglied(mg);
          rechnungenCount++;
          positionenCount += rechnungData.positionen;
        } catch (error) {
          console.error(`Fehler beim Erstellen der Rechnung für Mitglied ${mg.mitglied_id}:`, error);
        }
      }

      resolve({
        success: true,
        message: `${rechnungenCount} Rechnungen mit ${positionenCount} Positionen erstellt`,
        rechnungen: rechnungenCount,
        positionen: positionenCount
      });
    });
  });
}

/**
 * Erstellt eine Rechnung für ein Mitglied basierend auf dessen offenen Beiträgen
 * @private
 */
async function createRechnungForMitglied(mitgliedData) {
  return new Promise((resolve, reject) => {
    // Schritt 1: Hole alle Beiträge für dieses Mitglied
    const beitraegeQuery = `
      SELECT
        beitrag_id,
        betrag,
        zahlungsdatum,
        magicline_description,
        COALESCE(magicline_description, 'Beitrag') as beschreibung
      FROM beitraege
      WHERE mitglied_id = ?
        AND rechnung_id IS NULL
        AND bezahlt = 0
        AND zahlungsart = 'Lastschrift'
      ORDER BY zahlungsdatum ASC
    `;

    db.query(beitraegeQuery, [mitgliedData.mitglied_id], async (err, beitraege) => {
      if (err) return reject(err);

      // Schritt 2: Generiere Rechnungsnummer (async)
      const heute = new Date();
      const rechnungsnummer = await generateRechnungsnummer(heute);

      // Schritt 3: Erstelle Rechnung
      const rechnungQuery = `
        INSERT INTO rechnungen (
          rechnungsnummer,
          mitglied_id,
          datum,
          faelligkeitsdatum,
          betrag,
          status,
          zahlungsart,
          art,
          beschreibung,
          dojo_id,
          erstellt_am
        ) VALUES (?, ?, NOW(), ?, ?, 'offen', 'Lastschrift', 'mitgliedsbeitrag', ?, ?, NOW())
      `;

      const beschreibung = `Artikel aus Verkauf${beitraege.length > 1 ? ` (${beitraege.length} Positionen)` : ''}`;

      db.query(
        rechnungQuery,
        [
          rechnungsnummer,
          mitgliedData.mitglied_id,
          mitgliedData.faelligkeitsdatum,
          mitgliedData.gesamt_betrag,
          beschreibung,
          mitgliedData.dojo_id
        ],
        (err, rechnungResult) => {
          if (err) return reject(err);

          const rechnungId = rechnungResult.insertId;

          // Schritt 4: Erstelle Rechnungspositionen
          createRechnungspositionenFromBeitraege(rechnungId, beitraege)
            .then(() => {
              // Schritt 5: Verknüpfe Beiträge mit Rechnung
              const updateQuery = `UPDATE beitraege SET rechnung_id = ? WHERE beitrag_id IN (?)`;
              const beitragIds = beitraege.map(b => b.beitrag_id);

              db.query(updateQuery, [rechnungId, beitragIds], (err) => {
                if (err) return reject(err);
                resolve({ rechnungId, positionen: beitraege.length });
              });
            })
            .catch(reject);
        }
      );
    });
  });
}

/**
 * Erstellt Rechnungspositionen aus Beiträgen
 * @private
 */
async function createRechnungspositionenFromBeitraege(rechnungId, beitraege) {
  return new Promise((resolve, reject) => {
    const positionenQueries = beitraege.map((beitrag, index) => {
      return new Promise((res, rej) => {
        const query = `
          INSERT INTO rechnungspositionen (
            rechnung_id,
            position_nr,
            bezeichnung,
            menge,
            einzelpreis,
            gesamtpreis,
            mwst_satz,
            beschreibung,
            erstellt_am
          ) VALUES (?, ?, ?, 1, ?, ?, 19.00, ?, NOW())
        `;

        const bezeichnung = extractBezeichnungFromDescription(beitrag.magicline_description || 'Artikel aus Verkauf');

        db.query(
          query,
          [
            rechnungId,
            index + 1,
            bezeichnung,
            beitrag.betrag,
            beitrag.betrag,
            beitrag.magicline_description
          ],
          (err) => {
            if (err) rej(err);
            else res();
          }
        );
      });
    });

    Promise.all(positionenQueries)
      .then(() => resolve())
      .catch(reject);
  });
}

/**
 * Extrahiert Artikelname aus der Beschreibung
 * @private
 */
function extractBezeichnungFromDescription(description) {
  if (!description) return 'Artikel aus Verkauf';

  // Format: "Artikelverkauf (Bon: XXXXX): Artikelname (Menge x)"
  const match = description.match(/:\s*(.+?)\s*\(/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return description;
}

/**
 * Generiert eine fortlaufende Rechnungsnummer im Format YYYY/MM/DD-XXXX
 * Zählt aus beiden Tabellen (rechnungen + verbandsmitgliedschaft_zahlungen)
 * @private
 */
async function generateRechnungsnummer(datum) {
  return new Promise((resolve, reject) => {
    const jahr = datum.getFullYear();
    const monat = String(datum.getMonth() + 1).padStart(2, '0');
    const tag = String(datum.getDate()).padStart(2, '0');
    const datumPrefix = `${jahr}/${monat}/${tag}`;

    const query = `
      SELECT
        (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
        (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
      AS count
    `;

    db.query(query, [jahr, jahr], (err, results) => {
      if (err) return reject(err);
      const count = results[0].count;
      const laufnummer = 1000 + count;
      resolve(`${datumPrefix}-${laufnummer}`);
    });
  });
}

/**
 * Synchronisiert den Status einer Rechnung basierend auf den verknüpften Beiträgen
 * @param {number} rechnungId - ID der Rechnung
 * @returns {Promise<{success: boolean, newStatus: string}>}
 */
async function syncRechnungStatus(rechnungId) {
  return new Promise((resolve, reject) => {
    // Prüfe Status aller verknüpften Beiträge
    const query = `
      SELECT
        COUNT(*) as gesamt,
        SUM(bezahlt = 1) as bezahlt_count
      FROM beitraege
      WHERE rechnung_id = ?
    `;

    db.query(query, [rechnungId], (err, results) => {
      if (err) return reject(err);

      const { gesamt, bezahlt_count } = results[0];
      let newStatus = 'offen';

      // Konvertiere zu Number für korrekten Vergleich
      const bezahltNum = Number(bezahlt_count);
      const gesamtNum = Number(gesamt);

      if (bezahltNum === gesamtNum && gesamtNum > 0) {
        newStatus = 'bezahlt';
      } else if (bezahltNum > 0) {
        newStatus = 'teilweise_bezahlt';
      }

      // Aktualisiere Rechnungsstatus
      const updateQuery = `UPDATE rechnungen SET status = ?, aktualisiert_am = NOW() WHERE rechnung_id = ?`;

      db.query(updateQuery, [newStatus, rechnungId], (err) => {
        if (err) return reject(err);
        resolve({ success: true, newStatus });
      });
    });
  });
}

module.exports = {
  createRechnungenFromBeitraege,
  syncRechnungStatus
};
