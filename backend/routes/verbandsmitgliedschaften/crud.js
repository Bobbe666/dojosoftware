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

// Helper functions
const getNextMitgliedsnummer = (typ) => {
  return new Promise((resolve, reject) => {
    const prefix = typ === 'dojo' ? 'TDA-D-' : 'TDA-E-';
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
    // COALESCE: Bei Dojo-Mitgliedschaften entweder aus verknüpftem Dojo ODER direkt aus verbandsmitgliedschaften
    const query = `SELECT vm.*,
      COALESCE(d.dojoname, vm.dojo_name) as dojo_name,
      COALESCE(d.ort, vm.dojo_ort) as dojo_ort,
      COALESCE(d.email, vm.dojo_email) as dojo_email,
      COALESCE(d.strasse, vm.dojo_strasse) as dojo_strasse,
      COALESCE(d.plz, vm.dojo_plz) as dojo_plz,
      COALESCE(d.telefon, vm.dojo_telefon) as dojo_telefon,
      COALESCE(d.internet, vm.dojo_website) as dojo_website,
      COALESCE(d.inhaber, vm.dojo_inhaber) as dojo_inhaber,
      CONCAT(m.vorname, ' ', m.nachname) as verknuepftes_mitglied_name
      FROM verbandsmitgliedschaften vm LEFT JOIN dojo d ON vm.dojo_id = d.id LEFT JOIN mitglieder m ON vm.mitglied_id = m.mitglied_id WHERE vm.id = ?`;

    const results = await queryAsync(query, [req.params.id]);
    if (results.length === 0) return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });

    // Historie laden
    const historie = await queryAsync(
      `SELECT * FROM verband_vertragshistorie WHERE verbandsmitgliedschaft_id = ? ORDER BY erstellt_am DESC`,
      [req.params.id]
    );

    // Mitgliedschaft mit Historie zurückgeben
    const mitgliedschaft = results[0];
    mitgliedschaft.historie = historie;

    res.json(mitgliedschaft);
  } catch (err) {
    logger.error('Fehler beim Laden der Mitgliedschaft:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST / - Neue Mitgliedschaft anlegen
router.post('/', async (req, res) => {
  try {
    const { typ, dojo_id, person_vorname, person_nachname, person_email, person_telefon, person_strasse, person_plz, person_ort, person_land, person_geburtsdatum, mitglied_id, gueltig_von, zahlungsart, sepa_iban, sepa_bic, sepa_kontoinhaber, notizen, beitragsfrei } = req.body;

    if (!typ || !['dojo', 'einzelperson'].includes(typ)) return res.status(400).json({ error: 'Ungültiger Mitgliedschaftstyp' });
    // Bei neues_dojo wird kein dojo_id benötigt - das Dojo wird vom Frontend vorher angelegt
    if (typ === 'dojo' && !dojo_id && !req.body.neues_dojo) return res.status(400).json({ error: 'Dojo muss ausgewählt werden' });
    if (typ === 'einzelperson' && (!person_vorname || !person_nachname || !person_email)) return res.status(400).json({ error: 'Name und E-Mail sind erforderlich' });

    if (typ === 'dojo') {
      const existing = await queryAsync("SELECT id FROM verbandsmitgliedschaften WHERE dojo_id = ? AND status IN ('aktiv', 'ausstehend')", [dojo_id]);
      if (existing.length > 0) return res.status(400).json({ error: 'Dieses Dojo hat bereits eine aktive Mitgliedschaft' });
    }

    const mitgliedsnummer = await getNextMitgliedsnummer(typ);
    const beitragDojo = await getEinstellung('preis_dojo_mitgliedschaft', DEFAULT_BEITRAG_DOJO);
    const beitragEinzel = await getEinstellung('preis_einzel_mitgliedschaft', DEFAULT_BEITRAG_EINZEL);

    // Wenn beitragsfrei, dann 0€ - ansonsten normaler Beitrag
    const jahresbeitrag = beitragsfrei ? 0 : (typ === 'dojo' ? beitragDojo : beitragEinzel);
    const laufzeitMonate = await getEinstellung('laufzeit_monate', 12);

    const startDatum = gueltig_von || new Date().toISOString().split('T')[0];
    const endDatum = new Date(startDatum);
    endDatum.setMonth(endDatum.getMonth() + laufzeitMonate);
    const gueltigBis = endDatum.toISOString().split('T')[0];

    // Bei beitragsfrei sofort 'aktiv', ansonsten 'ausstehend'
    const initialStatus = beitragsfrei ? 'aktiv' : 'ausstehend';

    const result = await queryAsync(`INSERT INTO verbandsmitgliedschaften (typ, dojo_id, person_vorname, person_nachname, person_email, person_telefon, person_strasse, person_plz, person_ort, person_land, person_geburtsdatum, mitglied_id, mitgliedsnummer, jahresbeitrag, gueltig_von, gueltig_bis, status, zahlungsart, sepa_iban, sepa_bic, sepa_kontoinhaber, notizen, beitragsfrei) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [typ, dojo_id || null, person_vorname || null, person_nachname || null, person_email || null, person_telefon || null, person_strasse || null, person_plz || null, person_ort || null, person_land || 'Deutschland', person_geburtsdatum || null, mitglied_id || null, mitgliedsnummer, jahresbeitrag, startDatum, gueltigBis, initialStatus, zahlungsart || 'rechnung', sepa_iban || null, sepa_bic || null, sepa_kontoinhaber || null, notizen || null, beitragsfrei ? 1 : 0]);

    let rechnungsnummer = null;

    // Nur Zahlung anlegen wenn nicht beitragsfrei
    if (!beitragsfrei) {
      const betraege = calculateBrutto(jahresbeitrag);
      rechnungsnummer = await generateFortlaufendeRechnungsnummer();

      await queryAsync(`INSERT INTO verbandsmitgliedschaft_zahlungen (verbandsmitgliedschaft_id, rechnungsnummer, rechnungsdatum, faellig_am, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto, zeitraum_von, zeitraum_bis, status) VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, ?, ?, ?, ?, 'offen')`,
        [result.insertId, rechnungsnummer, betraege.netto, betraege.mwst_satz, betraege.mwst_betrag, betraege.brutto, startDatum, gueltigBis]);
    }

    const message = beitragsfrei
      ? `${typ === 'dojo' ? 'Dojo' : 'Einzel'}-Mitgliedschaft beitragsfrei angelegt`
      : `${typ === 'dojo' ? 'Dojo' : 'Einzel'}-Mitgliedschaft erfolgreich angelegt`;

    // Historie protokollieren
    await protokolliereHistorie(
      result.insertId,
      'erstellt',
      `Mitgliedschaft erstellt: ${mitgliedsnummer} (${typ}), Beitrag: ${jahresbeitrag}€/Jahr, Laufzeit: ${startDatum} bis ${gueltigBis}${beitragsfrei ? ' (beitragsfrei)' : ''}`,
      null,
      { typ, mitgliedsnummer, jahresbeitrag, gueltig_von: startDatum, gueltig_bis: gueltigBis, status: initialStatus, zahlungsart, beitragsfrei },
      req.user?.email || req.user?.username || 'System',
      req.ip || req.headers['x-forwarded-for']
    );

    res.status(201).json({ success: true, id: result.insertId, mitgliedsnummer, rechnungsnummer, beitragsfrei: !!beitragsfrei, message });
  } catch (err) {
    logger.error('Fehler beim Anlegen der Mitgliedschaft:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler: ' + err.message });
  }
});

// PUT /:id/status - Status ändern
router.put('/:id(\\d+)/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status fehlt' });

  try {
    // Alten Status laden
    const alteMitgliedschaft = await queryAsync('SELECT status, mitgliedsnummer FROM verbandsmitgliedschaften WHERE id = ?', [req.params.id]);
    if (alteMitgliedschaft.length === 0) return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });

    const alterStatus = alteMitgliedschaft[0].status;
    const mitgliedsnummer = alteMitgliedschaft[0].mitgliedsnummer;

    await queryAsync('UPDATE verbandsmitgliedschaften SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);

    // Historie protokollieren
    const aktion = status === 'gekuendigt' ? 'gekuendigt' : (status === 'aktiv' && alterStatus === 'gekuendigt' ? 'reaktiviert' : 'geaendert');
    await protokolliereHistorie(
      req.params.id,
      aktion,
      `Status geändert: ${alterStatus} → ${status} (${mitgliedsnummer})`,
      { status: alterStatus },
      { status },
      req.user?.email || req.user?.username || 'Admin',
      req.ip || req.headers['x-forwarded-for']
    );

    res.json({ success: true, message: 'Status aktualisiert' });
  } catch (err) {
    console.error('Fehler bei Status-Update:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /:id/permanent - Mitgliedschaft DAUERHAFT löschen (nur Admin)
router.delete('/:id(\\d+)/permanent', async (req, res) => {
  try {
    const id = req.params.id;

    // Prüfen ob Mitgliedschaft existiert
    const mitgliedschaft = await queryAsync('SELECT * FROM verbandsmitgliedschaften WHERE id = ?', [id]);
    if (mitgliedschaft.length === 0) {
      return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    }

    // Zugehörige Zahlungen löschen
    await queryAsync('DELETE FROM verbandsmitgliedschaft_zahlungen WHERE verbandsmitgliedschaft_id = ?', [id]);

    // SEPA-Mandate löschen (falls vorhanden)
    await queryAsync('DELETE FROM verbandsmitgliedschaft_sepa WHERE verbandsmitgliedschaft_id = ?', [id]);

    // Mitgliedschaft dauerhaft löschen
    await queryAsync('DELETE FROM verbandsmitgliedschaften WHERE id = ?', [id]);

    logger.info('Verbandsmitgliedschaft dauerhaft gelöscht', { id, typ: mitgliedschaft[0].typ });
    res.json({ success: true, message: 'Mitgliedschaft dauerhaft gelöscht' });
  } catch (err) {
    logger.error('Fehler beim dauerhaften Löschen:', { error: err, id: req.params.id });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
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
