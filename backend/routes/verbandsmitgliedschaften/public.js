/**
 * Verbandsmitgliedschaften Public Routes
 * Öffentliche Endpunkte ohne Authentifizierung
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const { DEFAULT_BEITRAG_DOJO, DEFAULT_BEITRAG_EINZEL, getEinstellung } = require('./shared');

// Ländercode-Mapping (ISO 3166-1 Alpha-2)
const LAENDER_CODES = {
  'deutschland': 'DE',
  'germany': 'DE',
  'österreich': 'AT',
  'oesterreich': 'AT',
  'austria': 'AT',
  'schweiz': 'CH',
  'switzerland': 'CH',
  'italien': 'IT',
  'italy': 'IT',
  'frankreich': 'FR',
  'france': 'FR',
  'spanien': 'ES',
  'spain': 'ES',
  'niederlande': 'NL',
  'netherlands': 'NL',
  'belgien': 'BE',
  'belgium': 'BE',
  'polen': 'PL',
  'poland': 'PL',
  'tschechien': 'CZ',
  'czech republic': 'CZ',
  'ungarn': 'HU',
  'hungary': 'HU',
  'slowenien': 'SI',
  'slovenia': 'SI',
  'kroatien': 'HR',
  'croatia': 'HR',
  'usa': 'US',
  'united states': 'US',
  'vereinigte staaten': 'US',
  'großbritannien': 'GB',
  'grossbritannien': 'GB',
  'united kingdom': 'GB',
  'england': 'GB'
};

const getLaenderCode = (land) => {
  if (!land) return 'XX'; // Unbekannt
  const normalized = land.toLowerCase().trim();
  return LAENDER_CODES[normalized] || land.substring(0, 2).toUpperCase();
};

// GET /public/config - Öffentliche Konfiguration
router.get('/public/config', async (req, res) => {
  try {
    const config = {
      preis_dojo: await getEinstellung('preis_dojo_mitgliedschaft', DEFAULT_BEITRAG_DOJO),
      preis_einzel: await getEinstellung('preis_einzel_mitgliedschaft', DEFAULT_BEITRAG_EINZEL),
      mwst_satz: await getEinstellung('mwst_satz', 19),
      verband_name: await getEinstellung('verband_name', 'Tiger & Dragon Association International'),
      verband_kurzname: await getEinstellung('verband_kurzname', 'TDA Int\'l'),
      laufzeit_monate: await getEinstellung('laufzeit_monate', 12)
    };
    res.json(config);
  } catch (err) {
    logger.error('Fehler beim Laden der öffentlichen Config:', { error: err });
    res.json({ preis_dojo: DEFAULT_BEITRAG_DOJO, preis_einzel: DEFAULT_BEITRAG_EINZEL, verband_name: 'Tiger & Dragon Association International' });
  }
});

// GET /public/vorteile - Öffentliche Vorteile-Liste
router.get('/public/vorteile', (req, res) => {
  db.query(
    'SELECT id, titel, beschreibung, rabatt_prozent, kategorie FROM verbandsmitgliedschaft_vorteile WHERE ist_aktiv = 1 ORDER BY sortierung',
    (err, results) => {
      if (err) {
        logger.error('Fehler beim Laden der Vorteile:', { error: err });
        return res.json([]);
      }
      res.json(results);
    }
  );
});

// POST /public/anmeldung - Öffentliche Anmeldung
router.post('/public/anmeldung', async (req, res) => {
  const {
    typ, dojo_name, dojo_inhaber, dojo_strasse, dojo_plz, dojo_ort, dojo_land, dojo_email, dojo_telefon, dojo_website, dojo_mitglieder_anzahl,
    vorname, nachname, geburtsdatum, strasse, plz, ort, land, email, telefon,
    zahlungsart, iban, bic, kontoinhaber, bank_name,
    agb_accepted, dsgvo_accepted, widerrufsrecht_acknowledged, unterschrift_digital, unterschrift_datum, notizen
  } = req.body;

  if (!typ || !['dojo', 'einzel'].includes(typ)) return res.status(400).json({ success: false, error: 'Ungültiger Mitgliedschaftstyp' });
  if (typ === 'dojo' && (!dojo_name || !dojo_email)) return res.status(400).json({ success: false, error: 'Dojo-Name und E-Mail sind erforderlich' });
  if (typ === 'einzel' && (!vorname || !nachname || !email)) return res.status(400).json({ success: false, error: 'Vorname, Nachname und E-Mail sind erforderlich' });
  if (!agb_accepted || !dsgvo_accepted) return res.status(400).json({ success: false, error: 'AGB und Datenschutz müssen akzeptiert werden' });

  try {
    const preis_dojo = await getEinstellung('preis_dojo_mitgliedschaft', DEFAULT_BEITRAG_DOJO);
    const preis_einzel = await getEinstellung('preis_einzel_mitgliedschaft', DEFAULT_BEITRAG_EINZEL);
    const laufzeit = await getEinstellung('laufzeit_monate', 12);
    const jahresbeitrag = typ === 'dojo' ? preis_dojo : preis_einzel;
    const gueltig_ab = new Date();
    const gueltig_bis = new Date();
    gueltig_bis.setMonth(gueltig_bis.getMonth() + laufzeit);

    // Land für Mitgliedsnummer ermitteln
    const memberLand = typ === 'dojo' ? (dojo_land || 'Deutschland') : (land || 'Deutschland');
    const laenderCode = getLaenderCode(memberLand);
    const typCode = typ === 'dojo' ? 'D' : 'E';
    const prefix = `TDA-${laenderCode}-${typCode}-`;
    const key = typ === 'dojo' ? 'naechste_dojo_nummer' : 'naechste_einzel_nummer';
    const nummerValue = await getEinstellung(key, 1);
    const mitgliedsnummer = prefix + String(nummerValue).padStart(4, '0');

    db.query('UPDATE verband_einstellungen SET einstellung_value = ? WHERE einstellung_key = ?', [nummerValue + 1, key]);

    const insertQuery = `
      INSERT INTO verbandsmitgliedschaften (
        typ, mitgliedsnummer, status, person_vorname, person_nachname, person_email, person_telefon,
        person_strasse, person_plz, person_ort, person_land, person_geburtsdatum,
        dojo_name, dojo_inhaber, dojo_strasse, dojo_plz, dojo_ort, dojo_land,
        dojo_email, dojo_telefon, dojo_website, dojo_mitglieder_anzahl,
        jahresbeitrag, zahlungsart, iban, bic, kontoinhaber, bank_name,
        gueltig_ab, gueltig_bis, agb_akzeptiert, dsgvo_akzeptiert, widerruf_akzeptiert,
        unterschrift_digital, unterschrift_datum, notizen, created_at
      ) VALUES (?, ?, 'ausstehend', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
      typ === 'dojo' ? 'dojo' : 'einzelperson', mitgliedsnummer,
      typ === 'einzel' ? vorname : dojo_inhaber?.split(' ')[0] || '',
      typ === 'einzel' ? nachname : dojo_inhaber?.split(' ').slice(1).join(' ') || '',
      typ === 'einzel' ? email : dojo_email, typ === 'einzel' ? telefon : dojo_telefon,
      typ === 'einzel' ? strasse : dojo_strasse, typ === 'einzel' ? plz : dojo_plz,
      typ === 'einzel' ? ort : dojo_ort, typ === 'einzel' ? (land || 'Deutschland') : (dojo_land || 'Deutschland'),
      typ === 'einzel' ? geburtsdatum || null : null,
      typ === 'dojo' ? dojo_name : null, typ === 'dojo' ? dojo_inhaber : null,
      typ === 'dojo' ? dojo_strasse : null, typ === 'dojo' ? dojo_plz : null,
      typ === 'dojo' ? dojo_ort : null, typ === 'dojo' ? (dojo_land || 'Deutschland') : null,
      typ === 'dojo' ? dojo_email : null, typ === 'dojo' ? dojo_telefon : null,
      typ === 'dojo' ? dojo_website : null, typ === 'dojo' ? parseInt(dojo_mitglieder_anzahl) || null : null,
      jahresbeitrag, zahlungsart || 'rechnung', iban || null, bic || null, kontoinhaber || null, bank_name || null,
      gueltig_ab, gueltig_bis, agb_accepted ? 1 : 0, dsgvo_accepted ? 1 : 0, widerrufsrecht_acknowledged ? 1 : 0,
      unterschrift_digital || null, unterschrift_datum ? new Date(unterschrift_datum).toISOString().slice(0, 19).replace("T", " ") : null, notizen || null
    ];

    db.query(insertQuery, params, (err, result) => {
      if (err) {
        logger.error('Fehler beim Anlegen der Verbandsmitgliedschaft:', err);
        return res.status(500).json({ success: false, error: 'Datenbankfehler bei der Anmeldung' });
      }
      res.json({ success: true, mitgliedsnummer, message: 'Anmeldung erfolgreich!' });
    });
  } catch (err) {
    logger.error('Fehler bei der Anmeldung:', err);
    res.status(500).json({ success: false, error: 'Interner Serverfehler' });
  }
});

module.exports = router;
