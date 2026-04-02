/**
 * Verbandsmitgliedschaften Shared Functions
 * Gemeinsame Hilfsfunktionen
 */
const logger = require('../../utils/logger');
const db = require('../../db');

// Default-Werte
const DEFAULT_BEITRAG_DOJO = 99.00;
const DEFAULT_BEITRAG_EINZEL = 49.00;

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

/**
 * Generiert eine fortlaufende Rechnungsnummer im Format YYYY/MM/DD-XXXX
 */
const generateFortlaufendeRechnungsnummer = () => {
  return new Promise((resolve, reject) => {
    const heute = new Date();
    const jahr = heute.getFullYear();
    const monat = String(heute.getMonth() + 1).padStart(2, '0');
    const tag = String(heute.getDate()).padStart(2, '0');
    const datumPrefix = `${jahr}/${monat}/${tag}`;

    const query = `
      SELECT
        (SELECT COUNT(*) FROM rechnungen WHERE YEAR(datum) = ?) +
        (SELECT COUNT(*) FROM verbandsmitgliedschaft_zahlungen WHERE YEAR(rechnungsdatum) = ?)
      AS total_count
    `;

    db.query(query, [jahr, jahr], (err, results) => {
      if (err) return reject(err);
      const count = results[0].total_count || 0;
      const laufnummer = 1000 + count;
      resolve(`${datumPrefix}-${laufnummer}`);
    });
  });
};

/**
 * Holt eine Einstellung aus der Datenbank
 */
const getEinstellung = (key, defaultValue = null) => {
  return new Promise((resolve) => {
    db.query(
      'SELECT einstellung_value, einstellung_typ FROM verband_einstellungen WHERE einstellung_key = ?',
      [key],
      (err, results) => {
        if (err || results.length === 0) return resolve(defaultValue);
        const { einstellung_value, einstellung_typ } = results[0];
        if (einstellung_typ === 'number') {
          resolve(parseFloat(einstellung_value) || defaultValue);
        } else if (einstellung_typ === 'boolean') {
          resolve(einstellung_value === 'true' || einstellung_value === '1');
        } else {
          resolve(einstellung_value);
        }
      }
    );
  });
};

module.exports = {
  DEFAULT_BEITRAG_DOJO,
  DEFAULT_BEITRAG_EINZEL,
  queryAsync,
  generateFortlaufendeRechnungsnummer,
  getEinstellung
};
