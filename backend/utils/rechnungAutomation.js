// =====================================================================================
// AUTOMATISCHE RECHNUNGSERSTELLUNG - HELPER FUNCTIONS
// =====================================================================================
// Erstellt automatisch Rechnungen für:
// 1. Kassenverkäufe
// 2. Mitgliedsbeiträge (nur payment_method='invoice')
// =====================================================================================

const db = require('../db');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Generiere Rechnungsnummer (fortlaufend über beide Tabellen)
const generateRechnungsnummer = async () => {
  const heute = new Date();
  const jahr = heute.getFullYear();
  const monat = String(heute.getMonth() + 1).padStart(2, '0');
  const tag = String(heute.getDate()).padStart(2, '0');
  const datumPrefix = `${jahr}/${monat}/${tag}`;

  const query = `
    SELECT
      (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
      (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
    AS count
  `;
  const results = await queryAsync(query, [jahr, jahr]);
  const count = results[0].count;
  const laufnummer = 1000 + count;
  return `${datumPrefix}-${laufnummer}`;
};

// =====================================================================================
// RECHNUNG FÜR KASSENVERKAUF ERSTELLEN
// =====================================================================================
/**
 * Erstellt automatisch eine Rechnung für einen Kassenverkauf
 * @param {number} verkauf_id - ID des Verkaufs
 * @param {object} verkaufData - Verkaufsdaten { mitglied_id, artikel[], gesamt_betrag_cent, ... }
 * @returns {Promise<{rechnung_id, rechnungsnummer}>}
 */
async function createRechnungForVerkauf(verkauf_id, verkaufData) {
  try {
    const {
      mitglied_id,
      kunde_name,
      artikel, // Array: [{ name, menge, einzelpreis_cent }]
      gesamt_betrag_cent,
      zahlungsart,
      mwst_gesamt_cent,
      netto_gesamt_cent
    } = verkaufData;

    // Validierung
    if (!mitglied_id && !kunde_name) {
      throw new Error('Entweder mitglied_id oder kunde_name muss angegeben sein');
    }

    // Rechnungsnummer generieren
    const rechnungsnummer = await generateRechnungsnummer();

    // Berechne Beträge (falls nicht übergeben)
    const netto_betrag = netto_gesamt_cent ? (netto_gesamt_cent / 100) : (gesamt_betrag_cent / 119);
    const mwst_betrag = mwst_gesamt_cent ? (mwst_gesamt_cent / 100) : (gesamt_betrag_cent / 100) - netto_betrag;
    const brutto_betrag = gesamt_betrag_cent / 100;

    const heute = new Date().toISOString().slice(0, 10);
    const faelligkeit = new Date();
    faelligkeit.setDate(faelligkeit.getDate() + 14); // 14 Tage Zahlungsziel
    const faelligkeitsdatum = faelligkeit.toISOString().slice(0, 10);

    // Rechnung erstellen
    const insertRechnungQuery = `
      INSERT INTO rechnungen (
        rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
        betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag,
        art, beschreibung, status, zahlungsart, bezahlt_am
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Beschreibung aus Artikeln erstellen
    const beschreibung = kunde_name
      ? `Verkauf an ${kunde_name}`
      : `Verkauf - Kassenbon`;

    // Status: Wenn Barzahlung, direkt bezahlt
    const status = (zahlungsart === 'bar' || zahlungsart === 'kreditkarte') ? 'bezahlt' : 'offen';
    const bezahlt_am = status === 'bezahlt' ? heute : null;

    const rechnungValues = [
      rechnungsnummer,
      mitglied_id || null,
      heute,
      faelligkeitsdatum,
      brutto_betrag,
      netto_betrag,
      brutto_betrag,
      19.00, // MwSt-Satz
      mwst_betrag,
      'ausruestung', // Art: Ausrüstung für Kassenverkauf
      beschreibung,
      status,
      zahlungsart,
      bezahlt_am
    ];

    const rechnungResult = await queryAsync(insertRechnungQuery, rechnungValues);
    const rechnung_id = rechnungResult.insertId;

    // Rechnungspositionen erstellen
    let position_nr = 1;
    for (const item of artikel) {
      const insertPositionQuery = `
        INSERT INTO rechnungspositionen (
          rechnung_id, position_nr, bezeichnung, menge, einzelpreis, gesamtpreis, mwst_satz
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const einzelpreis = item.einzelpreis_cent / 100;
      const gesamtpreis = (item.einzelpreis_cent * item.menge) / 100;

      await queryAsync(insertPositionQuery, [
        rechnung_id,
        position_nr,
        item.name,
        item.menge,
        einzelpreis,
        gesamtpreis,
        19.00
      ]);

      position_nr++;
    }

    // Wenn bereits bezahlt, Zahlung erfassen
    if (status === 'bezahlt') {
      const insertZahlungQuery = `
        INSERT INTO zahlungen (
          rechnung_id, betrag, zahlungsdatum, zahlungsart, referenz
        ) VALUES (?, ?, ?, ?, ?)
      `;

      await queryAsync(insertZahlungQuery, [
        rechnung_id,
        brutto_betrag,
        heute,
        zahlungsart,
        `Verkauf #${verkauf_id}`
      ]);
    }

    logger.info('Rechnung ${rechnungsnummer} für Verkauf #${verkauf_id} erstellt');

    return {
      rechnung_id,
      rechnungsnummer,
      betrag: brutto_betrag,
      status
    };

  } catch (error) {
    logger.error('Fehler beim Erstellen der Rechnung für Verkauf:', error);
    throw error;
  }
}

// =====================================================================================
// RECHNUNG FÜR MITGLIEDSBEITRAG ERSTELLEN (NUR payment_method='invoice')
// =====================================================================================
/**
 * Erstellt automatisch eine Rechnung für einen Mitgliedsbeitrag
 * @param {number} vertrag_id - ID des Vertrags
 * @param {number} mitglied_id - ID des Mitglieds
 * @param {number} monat - Monat (1-12)
 * @param {number} jahr - Jahr
 * @returns {Promise<{rechnung_id, rechnungsnummer}>}
 */
async function createRechnungForBeitrag(vertrag_id, mitglied_id, monat, jahr) {
  try {
    // Vertrag laden
    const vertragQuery = `
      SELECT v.*, t.name as tarif_name
      FROM vertraege v
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE v.id = ?
    `;
    const vertraege = await queryAsync(vertragQuery, [vertrag_id]);

    if (vertraege.length === 0) {
      throw new Error(`Vertrag #${vertrag_id} nicht gefunden`);
    }

    const vertrag = vertraege[0];

    // Prüfe, ob payment_method = 'invoice'
    if (vertrag.payment_method !== 'invoice') {
      console.log(`⚠️  Vertrag #${vertrag_id} hat payment_method='${vertrag.payment_method}' - keine Rechnung erstellt`);
      return null;
    }

    // Prüfe, ob bereits Rechnung für diesen Monat existiert
    const existingQuery = `
      SELECT rechnung_id
      FROM rechnungen
      WHERE mitglied_id = ?
        AND art = 'mitgliedsbeitrag'
        AND MONTH(datum) = ?
        AND YEAR(datum) = ?
      LIMIT 1
    `;
    const existing = await queryAsync(existingQuery, [mitglied_id, monat, jahr]);

    if (existing.length > 0) {
      logger.debug('⚠️  Rechnung für Mitglied #${mitglied_id} (${monat}/${jahr}) existiert bereits');
      return null;
    }

    // Rechnungsnummer generieren
    const rechnungsnummer = await generateRechnungsnummer();

    // Beträge berechnen
    const monatsbeitrag = parseFloat(vertrag.monatsbeitrag || vertrag.monatlicher_beitrag);
    const netto_betrag = monatsbeitrag / 1.19;
    const mwst_betrag = monatsbeitrag - netto_betrag;

    const datum = `${jahr}-${String(monat).padStart(2, '0')}-${vertrag.faelligkeit_tag || 1}`;
    const faelligkeit = new Date(datum);
    faelligkeit.setDate(faelligkeit.getDate() + 14);
    const faelligkeitsdatum = faelligkeit.toISOString().slice(0, 10);

    // Rechnung erstellen
    const insertRechnungQuery = `
      INSERT INTO rechnungen (
        rechnungsnummer, mitglied_id, datum, faelligkeitsdatum,
        betrag, netto_betrag, brutto_betrag, mwst_satz, mwst_betrag,
        art, beschreibung, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const beschreibung = `Mitgliedsbeitrag ${monat}/${jahr} - ${vertrag.tarif_name || 'Mitgliedschaft'}`;

    const rechnungValues = [
      rechnungsnummer,
      mitglied_id,
      datum,
      faelligkeitsdatum,
      monatsbeitrag,
      netto_betrag,
      monatsbeitrag,
      19.00,
      mwst_betrag,
      'mitgliedsbeitrag',
      beschreibung,
      'offen'
    ];

    const rechnungResult = await queryAsync(insertRechnungQuery, rechnungValues);
    const rechnung_id = rechnungResult.insertId;

    // Rechnungsposition erstellen
    const insertPositionQuery = `
      INSERT INTO rechnungspositionen (
        rechnung_id, position_nr, bezeichnung, menge, einzelpreis, gesamtpreis, mwst_satz, beschreibung
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await queryAsync(insertPositionQuery, [
      rechnung_id,
      1,
      `Mitgliedsbeitrag ${monat}/${jahr}`,
      1.00,
      monatsbeitrag,
      monatsbeitrag,
      19.00,
      vertrag.tarif_name || 'Mitgliedschaft'
    ]);

    logger.info('Rechnung ${rechnungsnummer} für Beitrag ${monat}/${jahr} erstellt');

    return {
      rechnung_id,
      rechnungsnummer,
      betrag: monatsbeitrag,
      status: 'offen'
    };

  } catch (error) {
    logger.error('Fehler beim Erstellen der Rechnung für Beitrag:', error);
    throw error;
  }
}

module.exports = {
  createRechnungForVerkauf,
  createRechnungForBeitrag
};
