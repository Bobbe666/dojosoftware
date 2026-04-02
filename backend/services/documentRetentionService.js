/**
 * Document Retention Service
 *
 * Implementiert die automatische Löschung von Dokumenten und Rechnungen
 * nach Ablauf der gesetzlichen Aufbewahrungsfrist (10 Jahre nach § 147 AO)
 */

const db = require('../db');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * Berechnet das Ablaufdatum der Aufbewahrungsfrist
 * @param {Date} erstellDatum - Das Erstelldatum des Dokuments/der Rechnung
 * @returns {Date} - Das Ablaufdatum (31.12. des 10. Jahres nach Erstellung)
 */
function berechneAblaufDatum(erstellDatum) {
  const datum = new Date(erstellDatum);
  const jahr = datum.getFullYear();
  const ablaufJahr = jahr + 10;
  // Ende des Kalenderjahres: 31.12. um 23:59:59
  return new Date(ablaufJahr, 11, 31, 23, 59, 59);
}

/**
 * Löscht eine Datei vom Dateisystem
 * @param {string} dateipfad - Relativer Pfad zur Datei
 */
async function loescheDatei(dateipfad) {
  try {
    const absoluterPfad = path.join(__dirname, '..', dateipfad);
    await fs.unlink(absoluterPfad);
    logger.info(`Datei gelöscht: ${dateipfad}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn(`Datei existiert nicht mehr: ${dateipfad}`);
      return true; // Datei ist schon weg, also erfolgreich
    }
    logger.error(`Fehler beim Löschen der Datei ${dateipfad}:`, { error: error.message });
    return false;
  }
}

/**
 * Löscht abgelaufene Mitgliedsdokumente
 */
async function loescheAbgelaufeneDokumente() {
  return new Promise((resolve, reject) => {
    // Finde alle Dokumente, deren Aufbewahrungsfrist abgelaufen ist
    const query = `
      SELECT id, dokumentname, dateipfad, erstellt_am,
             YEAR(erstellt_am) + 10 AS ablauf_jahr
      FROM mitglied_dokumente
      WHERE CURRENT_DATE > DATE(CONCAT(YEAR(erstellt_am) + 10, '-12-31'))
    `;

    db.query(query, async (err, dokumente) => {
      if (err) {
        logger.error('Fehler beim Abrufen abgelaufener Dokumente:', { error: err.message });
        reject(err);
        return;
      }

      if (dokumente.length === 0) {
        logger.info('Keine abgelaufenen Dokumente zum Löschen gefunden');
        resolve({ geloescht: 0, fehler: 0 });
        return;
      }

      logger.info(`Gefunden: ${dokumente.length} abgelaufene(s) Dokument(e)`);

      let geloescht = 0;
      let fehler = 0;

      // Lösche jedes Dokument
      for (const dok of dokumente) {
        try {
          // 1. Lösche Datei vom Dateisystem
          const dateiGeloescht = await loescheDatei(dok.dateipfad);

          if (dateiGeloescht) {
            // 2. Lösche Datenbank-Eintrag
            await new Promise((res, rej) => {
              db.query('DELETE FROM mitglied_dokumente WHERE id = ?', [dok.id], (delErr) => {
                if (delErr) rej(delErr);
                else res();
              });
            });

            logger.info(`Dokument gelöscht: ${dok.dokumentname} (ID: ${dok.id})`);
            geloescht++;
          } else {
            fehler++;
          }
        } catch (error) {
          logger.error(`Fehler beim Löschen von Dokument ${dok.id}:`, { error: error.message });
          fehler++;
        }
      }

      logger.info(`Dokumente-Löschung abgeschlossen: ${geloescht} gelöscht, ${fehler} Fehler`);
      resolve({ geloescht, fehler });
    });
  });
}

/**
 * Löscht abgelaufene Rechnungen
 */
async function loescheAbgelaufeneRechnungen() {
  return new Promise((resolve, reject) => {
    // Finde alle Rechnungen, deren Aufbewahrungsfrist abgelaufen ist
    const query = `
      SELECT rechnung_id, rechnungsnummer, datum, pdf_pfad,
             YEAR(datum) + 10 AS ablauf_jahr
      FROM rechnungen
      WHERE CURRENT_DATE > DATE(CONCAT(YEAR(datum) + 10, '-12-31'))
    `;

    db.query(query, async (err, rechnungen) => {
      if (err) {
        logger.error('Fehler beim Abrufen abgelaufener Rechnungen:', { error: err.message });
        reject(err);
        return;
      }

      if (rechnungen.length === 0) {
        logger.info('Keine abgelaufenen Rechnungen zum Löschen gefunden');
        resolve({ geloescht: 0, fehler: 0 });
        return;
      }

      logger.info(`Gefunden: ${rechnungen.length} abgelaufene Rechnung(en)`);

      let geloescht = 0;
      let fehler = 0;

      // Lösche jede Rechnung
      for (const rechnung of rechnungen) {
        try {
          // 1. Lösche PDF-Datei (falls vorhanden)
          if (rechnung.pdf_pfad) {
            await loescheDatei(rechnung.pdf_pfad);
          }

          // 2. Lösche Rechnungspositionen
          await new Promise((res, rej) => {
            db.query('DELETE FROM rechnung_positionen WHERE rechnung_id = ?', [rechnung.rechnung_id], (delErr) => {
              if (delErr) rej(delErr);
              else res();
            });
          });

          // 3. Lösche Rechnung aus Datenbank
          await new Promise((res, rej) => {
            db.query('DELETE FROM rechnungen WHERE rechnung_id = ?', [rechnung.rechnung_id], (delErr) => {
              if (delErr) rej(delErr);
              else res();
            });
          });

          logger.info(`Rechnung gelöscht: ${rechnung.rechnungsnummer} (ID: ${rechnung.rechnung_id})`);
          geloescht++;
        } catch (error) {
          logger.error(`Fehler beim Löschen von Rechnung ${rechnung.rechnung_id}:`, { error: error.message });
          fehler++;
        }
      }

      logger.info(`Rechnungen-Löschung abgeschlossen: ${geloescht} gelöscht, ${fehler} Fehler`);
      resolve({ geloescht, fehler });
    });
  });
}

/**
 * Hauptfunktion: Führt die komplette Aufbewahrungsfristen-Prüfung durch
 */
async function pruefeDokumentenAufbewahrung() {
  logger.info('Starte automatische Aufbewahrungsfristen-Prüfung (§ 147 AO, 10 Jahre)');

  try {
    // Lösche abgelaufene Dokumente
    const dokumenteResult = await loescheAbgelaufeneDokumente();

    // Lösche abgelaufene Rechnungen
    const rechnungenResult = await loescheAbgelaufeneRechnungen();

    // Zusammenfassung
    const gesamtGeloescht = dokumenteResult.geloescht + rechnungenResult.geloescht;
    const gesamtFehler = dokumenteResult.fehler + rechnungenResult.fehler;

    if (gesamtFehler > 0) {
      logger.warn(`Aufbewahrungsfristen-Prüfung: ${gesamtGeloescht} gelöscht, ${gesamtFehler} Fehler`);
    } else {
      logger.info(`Aufbewahrungsfristen-Prüfung abgeschlossen: ${gesamtGeloescht} gelöscht (${dokumenteResult.geloescht} Dokumente, ${rechnungenResult.geloescht} Rechnungen)`);
    }

    return {
      dokumente: dokumenteResult,
      rechnungen: rechnungenResult,
      gesamt: { geloescht: gesamtGeloescht, fehler: gesamtFehler }
    };
  } catch (error) {
    console.error('❌ Fehler bei Aufbewahrungsfristen-Prüfung:', error);
    throw error;
  }
}

module.exports = {
  pruefeDokumentenAufbewahrung,
  berechneAblaufDatum
};
