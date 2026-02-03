/**
 * Verbandsmitgliedschaften CRUD Routes
 * Hauptoperationen für Mitgliedschaften
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const router = express.Router();
const crypto = require('crypto');
const { DEFAULT_BEITRAG_DOJO, DEFAULT_BEITRAG_EINZEL, queryAsync, getEinstellung, generateFortlaufendeRechnungsnummer } = require('./shared');

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

// Helper functions
const getNextMitgliedsnummer = (typ, land = 'Deutschland') => {
  return new Promise((resolve, reject) => {
    const laenderCode = getLaenderCode(land);
    const typCode = typ === 'dojo' ? 'D' : 'E';
    const prefix = `TDA-${laenderCode}-${typCode}-`;

    db.query('UPDATE verband_nummern_sequenz SET aktuelle_nummer = aktuelle_nummer + 1 WHERE typ = ?', [typ], (err) => {
      if (err) return reject(err);
      db.query('SELECT aktuelle_nummer FROM verband_nummern_sequenz WHERE typ = ?', [typ], (err, results) => {
        if (err) return reject(err);
        const nummer = results[0]?.aktuelle_nummer || 1;
        resolve(`${prefix}${nummer.toString().padStart(4, '0')}`);
      });
    });
  });
};

const calculateBrutto = (netto, mwstSatz = 19) => {
  const mwst = netto * (mwstSatz / 100);
  return { netto, mwst_satz: mwstSatz, mwst_betrag: Math.round(mwst * 100) / 100, brutto: Math.round((netto + mwst) * 100) / 100 };
};

/**
 * Protokolliert eine Aktion in der Vertragshistorie (rechtssicher)
 * @param {number} mitgliedschaftId - ID der Verbandsmitgliedschaft
 * @param {string} aktion - Art der Aktion (erstellt, verlaengert, geaendert, gekuendigt, reaktiviert, sepa_angelegt, sepa_geaendert, zahlung)
 * @param {string} beschreibung - Beschreibung der Aktion
 * @param {object} alteWerte - Alte Werte (JSON)
 * @param {object} neueWerte - Neue Werte (JSON)
 * @param {string} durchgefuehrtVon - Wer die Aktion durchgeführt hat
 * @param {string} ipAdresse - IP-Adresse des Ausführenden
 */
const protokolliereHistorie = async (mitgliedschaftId, aktion, beschreibung, alteWerte = null, neueWerte = null, durchgefuehrtVon = null, ipAdresse = null) => {
  try {
    await queryAsync(
      `INSERT INTO verband_vertragshistorie
       (verbandsmitgliedschaft_id, aktion, beschreibung, alte_werte, neue_werte, durchgefuehrt_von, ip_adresse)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        mitgliedschaftId,
        aktion,
        beschreibung,
        alteWerte ? JSON.stringify(alteWerte) : null,
        neueWerte ? JSON.stringify(neueWerte) : null,
        durchgefuehrtVon,
        ipAdresse
      ]
    );
    logger.debug('Historie protokolliert:', { mitgliedschaftId, aktion, beschreibung });
  } catch (err) {
    logger.error('Fehler beim Protokollieren der Historie:', { error: err, mitgliedschaftId, aktion });
  }
};

// GET / - Alle Mitgliedschaften
router.get('/', (req, res) => {
  const { typ, status, limit } = req.query;
  // COALESCE: Bei Dojo-Mitgliedschaften entweder aus verknüpftem Dojo ODER direkt aus verbandsmitgliedschaften.dojo_name
  let query = `SELECT vm.*,
    COALESCE(d.dojoname, vm.dojo_name) as dojo_name,
    COALESCE(d.ort, vm.dojo_ort) as dojo_ort,
    COALESCE(d.email, vm.dojo_email) as dojo_email,
    CONCAT(m.vorname, ' ', m.nachname) as verknuepftes_mitglied_name
    FROM verbandsmitgliedschaften vm
    LEFT JOIN dojo d ON vm.dojo_id = d.id
    LEFT JOIN mitglieder m ON vm.mitglied_id = m.mitglied_id WHERE 1=1`;
  const params = [];
  if (typ) { query += ' AND vm.typ = ?'; params.push(typ); }
  if (status) { query += ' AND vm.status = ?'; params.push(status); }
  query += ' ORDER BY vm.created_at DESC';
  if (limit && !isNaN(parseInt(limit))) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, error: 'Datenbankfehler' });
    res.json({ success: true, mitgliedschaften: results });
  });
});

// GET /stats - Statistiken
router.get('/stats', (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM verbandsmitgliedschaften',
    aktiv: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE status = 'aktiv'",
    dojos: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'dojo' AND status IN ('aktiv', 'vertragsfrei')",
    dojosGesamt: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'dojo'",
    dojosMitBeitrag: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'dojo' AND status = 'aktiv' AND beitragsfrei = 0",
    dojosVertragsfrei: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'dojo' AND (status = 'vertragsfrei' OR beitragsfrei = 1)",
    einzelpersonen: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'einzelperson' AND status = 'aktiv'",
    auslaufend: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE status = 'aktiv' AND gueltig_bis <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)",
    offeneZahlungen: "SELECT COUNT(*) as count FROM verbandsmitgliedschaft_zahlungen WHERE status = 'offen'",
    jahresumsatz: "SELECT COALESCE(SUM(betrag_brutto), 0) as summe FROM verbandsmitgliedschaft_zahlungen WHERE status = 'bezahlt' AND YEAR(bezahlt_am) = YEAR(CURDATE())"
  };
  const stats = {};
  let completed = 0;
  Object.entries(queries).forEach(([key, query]) => {
    db.query(query, (err, results) => {
      stats[key] = err ? 0 : (results[0]?.count || results[0]?.summe || 0);
      if (++completed === Object.keys(queries).length) res.json({ success: true, stats });
    });
  });
});

// GET /vorteile/liste
router.get('/vorteile/liste', (req, res) => {
  db.query('SELECT * FROM verband_vorteile WHERE aktiv = TRUE ORDER BY kategorie, gilt_fuer', (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json(results);
  });
});

// GET /check-rabatt
router.get('/check-rabatt', (req, res) => {
  const { dojo_id, mitglied_id, kategorie } = req.query;
  const query = `SELECT vv.* FROM verband_vorteile vv
    INNER JOIN verbandsmitgliedschaften vm ON ((vm.dojo_id = ? AND vv.gilt_fuer IN ('dojo', 'beide')) OR (vm.mitglied_id = ? AND vv.gilt_fuer IN ('einzelperson', 'beide')))
    WHERE vm.status = 'aktiv' AND vm.gueltig_bis >= CURDATE() AND vv.aktiv = TRUE AND vv.kategorie = ?`;
  db.query(query, [dojo_id || 0, mitglied_id || 0, kategorie], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (results.length === 0) return res.json({ hatRabatt: false, rabatt: null });
    const besterRabatt = results.reduce((best, curr) => (!best || curr.rabatt_wert > best.rabatt_wert) ? curr : best, null);
    res.json({ hatRabatt: true, rabatt: besterRabatt });
  });
});

// GET /dojos-ohne-mitgliedschaft
router.get('/dojos-ohne-mitgliedschaft', (req, res) => {
  db.query(`SELECT d.id, d.dojoname as name, d.ort, d.email FROM dojo d WHERE d.id NOT IN (SELECT dojo_id FROM verbandsmitgliedschaften WHERE dojo_id IS NOT NULL AND status IN ('aktiv', 'ausstehend')) ORDER BY d.dojoname`, (err, results) => {
    if (err) {
      console.error('Fehler bei dojos-ohne-mitgliedschaft:', err);
      return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
    res.json(results);
  });
});

// GET /dokumente/liste
router.get('/dokumente/liste', (req, res) => {
  db.query('SELECT * FROM verband_dokumente WHERE aktiv = TRUE ORDER BY typ, titel', (err, results) => {
    if (err) {
      console.error('Fehler bei dokumente/liste:', err);
      return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
    }
    res.json(results);
  });
});

// GET /dokumente/:typ
router.get('/dokumente/:typ', (req, res) => {
  db.query('SELECT * FROM verband_dokumente WHERE typ = ? AND aktiv = TRUE', [req.params.typ], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (results.length === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });
    res.json(results[0]);
  });
});

// GET /:id - Einzelne Mitgliedschaft
router.get('/:id(\\d+)', async (req, res) => {
  try {
    logger.info('Loading verbandsmitgliedschaft detail for id:', req.params.id);

    const query = `SELECT vm.*,
      COALESCE(d.dojoname, vm.dojo_name) as dojo_name,
      COALESCE(d.ort, vm.dojo_ort) as dojo_ort,
      COALESCE(d.email, vm.dojo_email) as dojo_email,
      COALESCE(d.strasse, vm.dojo_strasse) as dojo_strasse,
      COALESCE(d.plz, vm.dojo_plz) as dojo_plz,
      COALESCE(d.telefon, vm.dojo_telefon) as dojo_telefon,
      COALESCE(d.internet, vm.dojo_website) as dojo_website,
      COALESCE(d.inhaber, vm.dojo_inhaber) as dojo_inhaber,
      d.id as linked_dojo_id,
      d.ist_aktiv as dojo_ist_aktiv,
      d.created_at as dojo_created_at,
      d.subscription_status,
      d.subscription_plan,
      CONCAT(m.vorname, ' ', m.nachname) as verknuepftes_mitglied_name
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      LEFT JOIN mitglieder m ON vm.mitglied_id = m.mitglied_id
      WHERE vm.id = ?`;

    const results = await queryAsync(query, [req.params.id]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    }

    const mitgliedschaft = results[0];
    logger.info('Mitgliedschaft loaded - typ:', mitgliedschaft.typ, 'linked_dojo_id:', mitgliedschaft.linked_dojo_id);

    // Historie laden
    const historie = await queryAsync(
      `SELECT * FROM verband_vertragshistorie WHERE verbandsmitgliedschaft_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    mitgliedschaft.historie = historie;

    // Wenn es eine Dojo-Mitgliedschaft mit verknüpftem Dojo ist, hole zusätzliche Statistiken
    if (mitgliedschaft.typ === 'dojo' && mitgliedschaft.linked_dojo_id) {
      const dojoId = mitgliedschaft.linked_dojo_id;
      logger.info('Loading dojo stats for dojoId:', dojoId);

      try {
        // Speicherplatz aus Dateisystem berechnen
        const { execSync } = require('child_process');
        let storageBytes = 0;
        try {
          // Mitglieder-IDs holen
          const mitgliederIds = await queryAsync('SELECT mitglied_id FROM mitglieder WHERE dojo_id = ?', [dojoId]);
          for (const m of mitgliederIds) {
            const path = `/var/www/dojosoftware/backend/uploads/mitglieder/${m.mitglied_id}`;
            try {
              const size = execSync(`du -sb "${path}" 2>/dev/null | cut -f1`, { encoding: 'utf8' }).trim();
              if (size) storageBytes += parseInt(size, 10) || 0;
            } catch (e) { /* Ordner existiert nicht */ }
          }
        } catch (e) {
          logger.error('Error calculating storage:', e);
        }

        const [mitgliederStats, kurseStats, trainerStats, adminStats, standortStats, eventStats, letztesLogin, stileStats, stundenplanStats] = await Promise.all([
          queryAsync('SELECT COUNT(*) as gesamt, SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as aktiv, SUM(CASE WHEN aktiv = 0 THEN 1 ELSE 0 END) as inaktiv FROM mitglieder WHERE dojo_id = ?', [dojoId]),
          queryAsync('SELECT COUNT(*) as gesamt FROM kurse WHERE dojo_id = ?', [dojoId]),
          queryAsync('SELECT COUNT(DISTINCT JSON_UNQUOTE(jt.trainer_id)) as anzahl FROM kurse k, JSON_TABLE(COALESCE(k.trainer_ids, \"[]\"), \"$[*]\" COLUMNS (trainer_id VARCHAR(10) PATH \"$\")) jt WHERE k.dojo_id = ? AND jt.trainer_id IS NOT NULL', [dojoId]),
          queryAsync('SELECT COUNT(*) as gesamt, SUM(CASE WHEN aktiv = 1 THEN 1 ELSE 0 END) as aktiv FROM admin_users WHERE dojo_id = ?', [dojoId]),
          queryAsync('SELECT COUNT(*) as anzahl FROM standorte WHERE dojo_id = ?', [dojoId]),
          queryAsync('SELECT COUNT(*) as gesamt, SUM(CASE WHEN datum >= CURDATE() THEN 1 ELSE 0 END) as kommende FROM events WHERE dojo_id = ?', [dojoId]),
          queryAsync('SELECT MAX(letzter_login) as letztes_login FROM admin_users WHERE dojo_id = ? AND aktiv = 1', [dojoId]),
          queryAsync('SELECT COUNT(DISTINCT stil) as anzahl FROM kurse WHERE dojo_id = ? AND stil IS NOT NULL AND stil \!= \"\"', [dojoId]),
          queryAsync('SELECT COUNT(*) as anzahl FROM stundenplan sp JOIN kurse k ON sp.kurs_id = k.kurs_id WHERE k.dojo_id = ?', [dojoId])
        ]);

        logger.info('Dojo stats loaded successfully');

        mitgliedschaft.dojo_stats = {
          mitglieder: { gesamt: mitgliederStats[0]?.gesamt || 0, aktiv: mitgliederStats[0]?.aktiv || 0, inaktiv: mitgliederStats[0]?.inaktiv || 0 },
          kurse: { gesamt: kurseStats[0]?.gesamt || 0 },
          trainer: { anzahl: trainerStats[0]?.anzahl || 0 },
          speicherplatz: { bytes: storageBytes, mb: Math.round(storageBytes / 1024 / 1024 * 100) / 100 },
          admins: { gesamt: adminStats[0]?.gesamt || 0, aktiv: adminStats[0]?.aktiv || 0 },
          stile: stileStats[0]?.anzahl || 0,
          standorte: standortStats[0]?.anzahl || 0,
          events: { gesamt: eventStats[0]?.gesamt || 0, kommende: eventStats[0]?.kommende || 0 },
          letztes_login: letztesLogin[0]?.letztes_login || null,
          stundenplan: stundenplanStats[0]?.anzahl || 0
        };
      } catch (statsErr) {
        logger.error('Error loading dojo stats:', statsErr);
      }
    }

    res.json(mitgliedschaft);
  } catch (err) {
    logger.error('Fehler beim Laden der Mitgliedschaft:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});


// POST /:id/beitragsfrei - Beitragsfrei-Status umschalten (nur Admin)
router.post('/:id(\\d+)/beitragsfrei', async (req, res) => {
  try {
    const { beitragsfrei } = req.body;
    const id = req.params.id;

    // Mitgliedschaft laden
    const mitgliedschaft = await queryAsync('SELECT * FROM verbandsmitgliedschaften WHERE id = ?', [id]);
    if (mitgliedschaft.length === 0) {
      return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    }

    if (beitragsfrei) {
      // Auf beitragsfrei setzen
      await queryAsync(
        'UPDATE verbandsmitgliedschaften SET beitragsfrei = 1, jahresbeitrag = 0, status = ?, updated_at = NOW() WHERE id = ?',
        [mitgliedschaft[0].status === 'ausstehend' ? 'aktiv' : mitgliedschaft[0].status, id]
      );

      // Offene Zahlungen stornieren
      await queryAsync(
        "UPDATE verbandsmitgliedschaft_zahlungen SET status = 'storniert' WHERE verbandsmitgliedschaft_id = ? AND status = 'offen'",
        [id]
      );

      res.json({ success: true, message: 'Mitgliedschaft auf beitragsfrei umgestellt. Offene Zahlungen wurden storniert.' });
    } else {
      // Beitragsfrei aufheben - normalen Beitrag wiederherstellen
      const beitragDojo = await getEinstellung('preis_dojo_mitgliedschaft', DEFAULT_BEITRAG_DOJO);
      const beitragEinzel = await getEinstellung('preis_einzel_mitgliedschaft', DEFAULT_BEITRAG_EINZEL);
      const neuerBeitrag = mitgliedschaft[0].typ === 'dojo' ? beitragDojo : beitragEinzel;

      await queryAsync(
        'UPDATE verbandsmitgliedschaften SET beitragsfrei = 0, jahresbeitrag = ?, updated_at = NOW() WHERE id = ?',
        [neuerBeitrag, id]
      );

      res.json({ success: true, message: 'Beitragsfrei aufgehoben. Neuer Jahresbeitrag: ' + neuerBeitrag + '€' });
    }
  } catch (err) {
    console.error('Fehler bei beitragsfrei-Toggle:', err);
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// PUT /:id - Mitgliedschaft aktualisieren
router.put('/:id(\\d+)', (req, res) => {
  const { person_vorname, person_nachname, person_email, person_telefon, person_strasse, person_plz, person_ort, person_land, person_geburtsdatum, zahlungsart, sepa_iban, sepa_bic, sepa_kontoinhaber, notizen, status } = req.body;
  const query = `UPDATE verbandsmitgliedschaften SET person_vorname = COALESCE(?, person_vorname), person_nachname = COALESCE(?, person_nachname), person_email = COALESCE(?, person_email), person_telefon = COALESCE(?, person_telefon), person_strasse = COALESCE(?, person_strasse), person_plz = COALESCE(?, person_plz), person_ort = COALESCE(?, person_ort), person_land = COALESCE(?, person_land), person_geburtsdatum = COALESCE(?, person_geburtsdatum), zahlungsart = COALESCE(?, zahlungsart), sepa_iban = COALESCE(?, sepa_iban), sepa_bic = COALESCE(?, sepa_bic), sepa_kontoinhaber = COALESCE(?, sepa_kontoinhaber), notizen = COALESCE(?, notizen), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?`;
  db.query(query, [person_vorname, person_nachname, person_email, person_telefon, person_strasse, person_plz, person_ort, person_land, person_geburtsdatum, zahlungsart, sepa_iban, sepa_bic, sepa_kontoinhaber, notizen, status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    res.json({ success: true, message: 'Mitgliedschaft aktualisiert' });
  });
});

// POST /:id/verlaengern - Verlängern
router.post('/:id(\\d+)/verlaengern', async (req, res) => {
  try {
    const mitgliedschaft = await queryAsync('SELECT * FROM verbandsmitgliedschaften WHERE id = ?', [req.params.id]);
    if (mitgliedschaft.length === 0) return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });

    const startDatum = new Date(mitgliedschaft[0].gueltig_bis) > new Date() ? mitgliedschaft[0].gueltig_bis : new Date().toISOString().split('T')[0];
    const endDatum = new Date(startDatum);
    endDatum.setFullYear(endDatum.getFullYear() + 1);

    await queryAsync("UPDATE verbandsmitgliedschaften SET gueltig_bis = ?, status = 'aktiv' WHERE id = ?", [endDatum.toISOString().split('T')[0], req.params.id]);

    let rechnungsnummer = null;

    // Nur Zahlung anlegen wenn nicht beitragsfrei
    if (!mitgliedschaft[0].beitragsfrei) {
      const betraege = calculateBrutto(mitgliedschaft[0].jahresbeitrag);
      rechnungsnummer = await generateFortlaufendeRechnungsnummer();

      await queryAsync(`INSERT INTO verbandsmitgliedschaft_zahlungen (verbandsmitgliedschaft_id, rechnungsnummer, rechnungsdatum, faellig_am, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto, zeitraum_von, zeitraum_bis, status) VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, ?, ?, ?, ?, 'offen')`,
        [req.params.id, rechnungsnummer, betraege.netto, betraege.mwst_satz, betraege.mwst_betrag, betraege.brutto, startDatum, endDatum.toISOString().split('T')[0]]);
    }

    const message = mitgliedschaft[0].beitragsfrei
      ? 'Beitragsfreie Mitgliedschaft verlängert'
      : 'Mitgliedschaft verlängert';

    res.json({ success: true, message, neues_ende: endDatum.toISOString().split('T')[0], rechnungsnummer, beitragsfrei: !!mitgliedschaft[0].beitragsfrei });
  } catch (err) {
    logger.error('Fehler bei Verlängerung:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /:id - Kündigen (nur numerische IDs)
router.delete('/:id(\\d+)', (req, res) => {
  db.query("UPDATE verbandsmitgliedschaften SET status = 'gekuendigt' WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    res.json({ success: true, message: 'Mitgliedschaft gekündigt' });
  });
});

// GET /:id/zahlungen
router.get('/:id(\\d+)/zahlungen', (req, res) => {
  db.query('SELECT * FROM verbandsmitgliedschaft_zahlungen WHERE verbandsmitgliedschaft_id = ? ORDER BY rechnungsdatum DESC', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json(results);
  });
});

// POST /zahlungen/:zahlungs_id/bezahlt
router.post('/zahlungen/:zahlungs_id/bezahlt', async (req, res) => {
  const { zahlungsart, transaktions_id } = req.body;
  try {
    // Zahlungsdetails laden
    const zahlung = await queryAsync('SELECT z.*, vm.mitgliedsnummer FROM verbandsmitgliedschaft_zahlungen z JOIN verbandsmitgliedschaften vm ON z.verbandsmitgliedschaft_id = vm.id WHERE z.id = ?', [req.params.zahlungs_id]);
    if (zahlung.length === 0) return res.status(404).json({ error: 'Zahlung nicht gefunden' });

    await queryAsync(`UPDATE verbandsmitgliedschaft_zahlungen SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = ?, transaktions_id = ? WHERE id = ?`, [zahlungsart || 'ueberweisung', transaktions_id || null, req.params.zahlungs_id]);
    await queryAsync(`UPDATE verbandsmitgliedschaften vm SET status = 'aktiv' WHERE id = ? AND status = 'ausstehend'`, [zahlung[0].verbandsmitgliedschaft_id]);

    // Historie protokollieren
    await protokolliereHistorie(
      zahlung[0].verbandsmitgliedschaft_id,
      'zahlung',
      `Zahlung eingegangen: ${zahlung[0].betrag_brutto}€ (${zahlung[0].rechnungsnummer}), Zahlungsart: ${zahlungsart || 'ueberweisung'}${transaktions_id ? ', Transaktions-ID: ' + transaktions_id : ''}`,
      { status: 'offen' },
      { status: 'bezahlt', zahlungsart: zahlungsart || 'ueberweisung', transaktions_id, bezahlt_am: new Date().toISOString().split('T')[0] },
      req.user?.email || req.user?.username || 'Admin',
      req.ip || req.headers['x-forwarded-for']
    );

    res.json({ success: true, message: 'Zahlung als bezahlt markiert' });
  } catch (err) {
    console.error('Fehler beim Markieren der Zahlung:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /:id/sepa
router.get('/:id(\\d+)/sepa', (req, res) => {
  db.query('SELECT * FROM verband_sepa_mandate WHERE verbandsmitgliedschaft_id = ? ORDER BY created_at DESC', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json(results);
  });
});

// POST /:id/sepa
router.post('/:id(\\d+)/sepa', async (req, res) => {
  const { iban, bic, kontoinhaber, bank_name, unterschrift_digital, unterschrift_datum, ip_adresse } = req.body;
  if (!iban || !kontoinhaber) return res.status(400).json({ error: 'IBAN und Kontoinhaber sind erforderlich' });

  try {
    const mandatsreferenz = `VM-${req.params.id}-${Date.now()}`;
    const ip = ip_adresse || req.ip || req.headers['x-forwarded-for'];
    const timestamp = unterschrift_datum || new Date();

    const result = await queryAsync(`INSERT INTO verband_sepa_mandate (verbandsmitgliedschaft_id, mandatsreferenz, iban, bic, kontoinhaber, bank_name, status, unterschrift_digital, unterschrift_datum, unterschrift_ip) VALUES (?, ?, ?, ?, ?, ?, 'aktiv', ?, ?, ?)`,
      [req.params.id, mandatsreferenz, iban, bic || null, kontoinhaber, bank_name || null, unterschrift_digital || null, timestamp, ip]);

    await queryAsync("UPDATE verbandsmitgliedschaften SET zahlungsart = 'sepa', sepa_iban = ?, sepa_bic = ?, sepa_kontoinhaber = ? WHERE id = ?", [iban, bic, kontoinhaber, req.params.id]);

    // Mitgliedsnummer laden
    const mitgliedschaft = await queryAsync('SELECT mitgliedsnummer FROM verbandsmitgliedschaften WHERE id = ?', [req.params.id]);

    // Historie protokollieren - RECHTSSICHER
    await protokolliereHistorie(
      req.params.id,
      'sepa_angelegt',
      `SEPA-Lastschriftmandat erteilt (${mitgliedschaft[0]?.mitgliedsnummer}). Mandatsreferenz: ${mandatsreferenz}, Kontoinhaber: ${kontoinhaber}, IBAN: ${iban.substring(0, 4)}****${iban.substring(iban.length - 4)}`,
      null,
      {
        mandatsreferenz,
        kontoinhaber,
        iban_masked: iban.substring(0, 4) + '****' + iban.substring(iban.length - 4),
        bic,
        bank_name,
        unterschrift_datum: timestamp,
        unterschrift_ip: ip
      },
      'Mitglied (Selbstunterschrift)',
      ip
    );

    res.json({ success: true, id: result.insertId, mandatsreferenz });
  } catch (err) {
    logger.error('Fehler beim Anlegen des SEPA-Mandats:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /sepa/:sepa_id
router.delete('/sepa/:sepa_id', (req, res) => {
  db.query("UPDATE verband_sepa_mandate SET status = 'widerrufen' WHERE id = ?", [req.params.sepa_id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json({ success: true, message: 'SEPA-Mandat widerrufen' });
  });
});

// POST /:id/unterschreiben
router.post('/:id(\\d+)/unterschreiben', async (req, res) => {
  const { unterschrift_digital, unterschrift_datum, ip_adresse, agb_akzeptiert, dsgvo_akzeptiert, widerruf_akzeptiert } = req.body;

  try {
    const timestamp = unterschrift_datum || new Date();
    const ip = ip_adresse || req.ip || req.headers['x-forwarded-for'];

    await queryAsync(`UPDATE verbandsmitgliedschaften SET unterschrift_digital = ?, unterschrift_datum = ?, unterschrift_ip = ?, agb_akzeptiert = COALESCE(?, agb_akzeptiert), dsgvo_akzeptiert = COALESCE(?, dsgvo_akzeptiert), widerruf_akzeptiert = COALESCE(?, widerruf_akzeptiert), status = CASE WHEN status = 'ausstehend_unterschrift' THEN 'ausstehend' ELSE status END WHERE id = ?`,
      [unterschrift_digital, timestamp, ip, agb_akzeptiert, dsgvo_akzeptiert, widerruf_akzeptiert, req.params.id]);

    // Mitgliedsnummer für Historie laden
    const mitgliedschaft = await queryAsync('SELECT mitgliedsnummer FROM verbandsmitgliedschaften WHERE id = ?', [req.params.id]);
    const mitgliedsnummer = mitgliedschaft[0]?.mitgliedsnummer || req.params.id;

    // Historie protokollieren - RECHTSSICHER
    await protokolliereHistorie(
      req.params.id,
      'erstellt',
      `Vertrag digital unterschrieben (${mitgliedsnummer}). AGB akzeptiert: ${agb_akzeptiert ? 'Ja' : 'Nein'}, DSGVO akzeptiert: ${dsgvo_akzeptiert ? 'Ja' : 'Nein'}, Widerrufsrecht akzeptiert: ${widerruf_akzeptiert ? 'Ja' : 'Nein'}`,
      null,
      {
        unterschrift_datum: timestamp,
        unterschrift_ip: ip,
        agb_akzeptiert,
        dsgvo_akzeptiert,
        widerruf_akzeptiert,
        unterschrift_hash: unterschrift_digital ? require('crypto').createHash('sha256').update(unterschrift_digital).digest('hex').substring(0, 16) : null
      },
      'Mitglied (Selbstunterschrift)',
      ip
    );

    res.json({ success: true, message: 'Unterschrift gespeichert' });
  } catch (err) {
    logger.error('Fehler beim Speichern der Unterschrift:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /:id/historie
router.get('/:id(\\d+)/historie', (req, res) => {
  db.query(`SELECT * FROM verband_vertragshistorie WHERE verbandsmitgliedschaft_id = ? ORDER BY created_at DESC`, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });
    res.json(results);
  });
});

// GET /:id/pdf
router.get('/:id(\\d+)/pdf', async (req, res) => {
  try {
    const { generateVerbandVertragPdf } = require('../../utils/verbandVertragPdfGenerator');
    await generateVerbandVertragPdf(req.params.id, res);
  } catch (err) {
    logger.error('PDF-Generierung fehlgeschlagen:', { error: err });
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden' });
  }
});

// GET /zahlungen/:zahlungs_id/pdf
router.get('/zahlungen/:zahlungs_id/pdf', async (req, res) => {
  try {
    const { generateVerbandRechnungPdf } = require('../../utils/verbandVertragPdfGenerator');
    await generateVerbandRechnungPdf(req.params.zahlungs_id, res);
  } catch (err) {
    logger.error('Rechnungs-PDF-Generierung fehlgeschlagen:', { error: err });
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden' });
  }
});

module.exports = router;
