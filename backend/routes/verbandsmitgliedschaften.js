/**
 * VERBANDSMITGLIEDSCHAFTEN ROUTES
 * ================================
 * TDA International - Dojo & Einzelmitgliedschaften
 * Preise werden aus Einstellungen geladen
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require("../middleware/auth");

// Default-Werte (falls Einstellungen nicht geladen werden können)
const DEFAULT_BEITRAG_DOJO = 99.00;
const DEFAULT_BEITRAG_EINZEL = 49.00;

/**
 * Holt eine Einstellung aus der Datenbank
 */
const getEinstellung = (key, defaultValue = null) => {
  return new Promise((resolve) => {
    db.query(
      'SELECT einstellung_value, einstellung_typ FROM verband_einstellungen WHERE einstellung_key = ?',
      [key],
      (err, results) => {
        if (err || results.length === 0) {
          return resolve(defaultValue);
        }
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

// Debug-Logging
router.use((req, res, next) => {
  console.log('🏛️ Verbandsmitgliedschaften Route:', req.method, req.path);
  next();
});


// Auth-Middleware für alle nicht-öffentlichen Routes
router.use((req, res, next) => {
  // Public routes brauchen keine Authentifizierung
  if (req.path.startsWith("/public")) {
    return next();
  }
  // Alle anderen routes erfordern Auth
  authenticateToken(req, res, next);
});
// ============================================================================
// PUBLIC ROUTES (KEINE AUTHENTIFIZIERUNG!)
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/public/config
 * Öffentliche Konfiguration für Anmeldeseite
 */
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
    console.error('Fehler beim Laden der öffentlichen Config:', err);
    res.json({
      preis_dojo: DEFAULT_BEITRAG_DOJO,
      preis_einzel: DEFAULT_BEITRAG_EINZEL,
      verband_name: 'Tiger & Dragon Association International'
    });
  }
});

/**
 * GET /api/verbandsmitgliedschaften/public/vorteile
 * Öffentliche Vorteile-Liste
 */
router.get('/public/vorteile', (req, res) => {
  db.query(
    'SELECT id, titel, beschreibung, rabatt_prozent, kategorie FROM verbandsmitgliedschaft_vorteile WHERE ist_aktiv = 1 ORDER BY sortierung',
    (err, results) => {
      if (err) {
        console.error('Fehler beim Laden der Vorteile:', err);
        return res.json([]);
      }
      res.json(results);
    }
  );
});

/**
 * POST /api/verbandsmitgliedschaften/public/anmeldung
 * Öffentliche Anmeldung als Verbandsmitglied
 */
router.post('/public/anmeldung', async (req, res) => {
  const {
    typ,
    // Dojo-Daten
    dojo_name, dojo_inhaber, dojo_strasse, dojo_plz, dojo_ort, dojo_land,
    dojo_email, dojo_telefon, dojo_website, dojo_mitglieder_anzahl,
    // Einzelperson-Daten
    vorname, nachname, geburtsdatum, strasse, plz, ort, land, email, telefon,
    // SEPA
    zahlungsart, iban, bic, kontoinhaber, bank_name,
    // Akzeptanz
    agb_accepted, dsgvo_accepted, widerrufsrecht_acknowledged,
    unterschrift_digital, unterschrift_datum,
    notizen
  } = req.body;

  console.log('📝 Neue Verbandsmitgliedschaft-Anmeldung:', typ);

  // Validierung
  if (!typ || !['dojo', 'einzel'].includes(typ)) {
    return res.status(400).json({ success: false, error: 'Ungültiger Mitgliedschaftstyp' });
  }

  if (typ === 'dojo' && (!dojo_name || !dojo_email)) {
    return res.status(400).json({ success: false, error: 'Dojo-Name und E-Mail sind erforderlich' });
  }

  if (typ === 'einzel' && (!vorname || !nachname || !email)) {
    return res.status(400).json({ success: false, error: 'Vorname, Nachname und E-Mail sind erforderlich' });
  }

  if (!agb_accepted || !dsgvo_accepted) {
    return res.status(400).json({ success: false, error: 'AGB und Datenschutz müssen akzeptiert werden' });
  }

  try {
    // Preise laden
    const preis_dojo = await getEinstellung('preis_dojo_mitgliedschaft', DEFAULT_BEITRAG_DOJO);
    const preis_einzel = await getEinstellung('preis_einzel_mitgliedschaft', DEFAULT_BEITRAG_EINZEL);
    const mwst_satz = await getEinstellung('mwst_satz', 19);
    const laufzeit = await getEinstellung('laufzeit_monate', 12);

    const jahresbeitrag = typ === 'dojo' ? preis_dojo : preis_einzel;
    const gueltig_ab = new Date();
    const gueltig_bis = new Date();
    gueltig_bis.setMonth(gueltig_bis.getMonth() + laufzeit);

    // Mitgliedsnummer generieren
    const prefix = typ === 'dojo' ? 'TDA-D-' : 'TDA-E-';
    const key = typ === 'dojo' ? 'naechste_dojo_nummer' : 'naechste_einzel_nummer';
    const nummerValue = await getEinstellung(key, 1);
    const mitgliedsnummer = prefix + String(nummerValue).padStart(5, '0');

    // Nummer erhöhen
    db.query(
      'UPDATE verband_einstellungen SET einstellung_value = ? WHERE einstellung_key = ?',
      [nummerValue + 1, key]
    );

    // Mitgliedschaft anlegen
    const insertQuery = `
      INSERT INTO verbandsmitgliedschaften (
        typ, mitgliedsnummer, status,
        person_vorname, person_nachname, person_email, person_telefon,
        person_strasse, person_plz, person_ort, person_land, person_geburtsdatum,
        dojo_name, dojo_inhaber, dojo_strasse, dojo_plz, dojo_ort, dojo_land,
        dojo_email, dojo_telefon, dojo_website, dojo_mitglieder_anzahl,
        jahresbeitrag, zahlungsart,
        iban, bic, kontoinhaber, bank_name,
        gueltig_ab, gueltig_bis,
        agb_akzeptiert, dsgvo_akzeptiert, widerruf_akzeptiert,
        unterschrift_digital, unterschrift_datum,
        notizen, created_at
      ) VALUES (?, ?, 'ausstehend',
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, NOW())
    `;

    const params = [
      typ === 'dojo' ? 'dojo' : 'einzelperson', mitgliedsnummer,
      typ === 'einzel' ? vorname : dojo_inhaber?.split(' ')[0] || '',
      typ === 'einzel' ? nachname : dojo_inhaber?.split(' ').slice(1).join(' ') || '',
      typ === 'einzel' ? email : dojo_email,
      typ === 'einzel' ? telefon : dojo_telefon,
      typ === 'einzel' ? strasse : dojo_strasse,
      typ === 'einzel' ? plz : dojo_plz,
      typ === 'einzel' ? ort : dojo_ort,
      typ === 'einzel' ? (land || 'Deutschland') : (dojo_land || 'Deutschland'),
      typ === 'einzel' ? geburtsdatum || null : null,
      typ === 'dojo' ? dojo_name : null,
      typ === 'dojo' ? dojo_inhaber : null,
      typ === 'dojo' ? dojo_strasse : null,
      typ === 'dojo' ? dojo_plz : null,
      typ === 'dojo' ? dojo_ort : null,
      typ === 'dojo' ? (dojo_land || 'Deutschland') : null,
      typ === 'dojo' ? dojo_email : null,
      typ === 'dojo' ? dojo_telefon : null,
      typ === 'dojo' ? dojo_website : null,
      typ === 'dojo' ? parseInt(dojo_mitglieder_anzahl) || null : null,
      jahresbeitrag, zahlungsart || 'rechnung',
      iban || null, bic || null, kontoinhaber || null, bank_name || null,
      gueltig_ab, gueltig_bis,
      agb_accepted ? 1 : 0, dsgvo_accepted ? 1 : 0, widerrufsrecht_acknowledged ? 1 : 0,
      unterschrift_digital || null, unterschrift_datum ? new Date(unterschrift_datum).toISOString().slice(0, 19).replace("T", " ") : null,
      notizen || null
    ];

    db.query(insertQuery, params, (err, result) => {
      if (err) {
        console.error('❌ Fehler beim Anlegen der Verbandsmitgliedschaft:', err);
        return res.status(500).json({ success: false, error: 'Datenbankfehler bei der Anmeldung' });
      }

      console.log('✅ Verbandsmitgliedschaft angelegt:', mitgliedsnummer);

      // TODO: E-Mail-Benachrichtigung senden

      res.json({
        success: true,
        mitgliedsnummer,
        message: 'Anmeldung erfolgreich! Sie erhalten in Kürze eine Bestätigungs-E-Mail.'
      });
    });

  } catch (err) {
    console.error('❌ Fehler bei der Anmeldung:', err);
    res.status(500).json({ success: false, error: 'Interner Serverfehler' });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generiert die nächste Mitgliedsnummer
 */
const getNextMitgliedsnummer = (typ) => {
  return new Promise((resolve, reject) => {
    const prefix = typ === 'dojo' ? 'TDA-D-' : 'TDA-E-';

    // Aktuelle Nummer holen und erhöhen
    db.query(
      'UPDATE verband_nummern_sequenz SET aktuelle_nummer = aktuelle_nummer + 1 WHERE typ = ?',
      [typ],
      (err) => {
        if (err) return reject(err);

        db.query(
          'SELECT aktuelle_nummer FROM verband_nummern_sequenz WHERE typ = ?',
          [typ],
          (err, results) => {
            if (err) return reject(err);
            const nummer = results[0]?.aktuelle_nummer || 1;
            resolve(`${prefix}${nummer.toString().padStart(4, '0')}`);
          }
        );
      }
    );
  });
};

/**
 * Berechnet MwSt und Bruttobeträge
 */
const calculateBrutto = (netto, mwstSatz = 19) => {
  const mwst = netto * (mwstSatz / 100);
  return {
    netto: netto,
    mwst_satz: mwstSatz,
    mwst_betrag: Math.round(mwst * 100) / 100,
    brutto: Math.round((netto + mwst) * 100) / 100
  };
};

// ============================================================================
// MITGLIEDSCHAFTEN - CRUD
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften
 * Alle Verbandsmitgliedschaften abrufen
 */
router.get('/', (req, res) => {
  const { typ, status } = req.query;

  let query = `
    SELECT
      vm.*,
      d.dojoname as dojo_name,
      d.ort as dojo_ort,
      CONCAT(m.vorname, ' ', m.nachname) as verknuepftes_mitglied_name
    FROM verbandsmitgliedschaften vm
    LEFT JOIN dojo d ON vm.dojo_id = d.id
    LEFT JOIN mitglieder m ON vm.mitglied_id = m.mitglied_id
    WHERE 1=1
  `;
  const params = [];

  if (typ) {
    query += ' AND vm.typ = ?';
    params.push(typ);
  }

  if (status) {
    query += ' AND vm.status = ?';
    params.push(status);
  }

  query += ' ORDER BY vm.created_at DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Verbandsmitgliedschaften:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

/**
 * GET /api/verbandsmitgliedschaften/stats
 * Statistiken abrufen
 */
router.get('/stats', (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM verbandsmitgliedschaften',
    aktiv: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE status = 'aktiv'",
    dojos: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'dojo' AND status = 'aktiv'",
    einzelpersonen: "SELECT COUNT(*) as count FROM verbandsmitgliedschaften WHERE typ = 'einzelperson' AND status = 'aktiv'",
    auslaufend: `SELECT COUNT(*) as count FROM verbandsmitgliedschaften
                 WHERE status = 'aktiv' AND gueltig_bis <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
    offeneZahlungen: "SELECT COUNT(*) as count FROM verbandsmitgliedschaft_zahlungen WHERE status = 'offen'",
    jahresumsatz: `SELECT COALESCE(SUM(betrag_brutto), 0) as summe
                   FROM verbandsmitgliedschaft_zahlungen
                   WHERE status = 'bezahlt' AND YEAR(bezahlt_am) = YEAR(CURDATE())`
  };

  const stats = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.query(query, (err, results) => {
      if (err) {
        console.error(`Fehler bei ${key}:`, err);
        stats[key] = 0;
      } else {
        stats[key] = results[0]?.count || results[0]?.summe || 0;
      }

      completed++;
      if (completed === total) {
        res.json(stats);
      }
    });
  });
});

// ============================================================================
// EINSTELLUNGEN (MUSS VOR /:id STEHEN!)
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/einstellungen/alle
 * Alle Einstellungen abrufen
 */
router.get('/einstellungen/alle', (req, res) => {
  const { kategorie } = req.query;

  let query = 'SELECT * FROM verband_einstellungen';
  const params = [];

  if (kategorie) {
    query += ' WHERE kategorie = ?';
    params.push(kategorie);
  }

  query += ' ORDER BY kategorie, sortierung';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Einstellungen:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // Werte nach Typ konvertieren
    const einstellungen = results.map(e => {
      let value = e.einstellung_value;
      if (e.einstellung_typ === 'number') {
        value = parseFloat(value) || 0;
      } else if (e.einstellung_typ === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (e.einstellung_typ === 'json') {
        try {
          value = JSON.parse(value);
        } catch (err) {
          value = [];
        }
      }
      return { ...e, einstellung_value: value };
    });

    res.json(einstellungen);
  });
});

/**
 * GET /api/verbandsmitgliedschaften/einstellungen-config
 * Komplette Konfiguration als Key-Value Object
 */
router.get('/einstellungen-config', (req, res) => {
  db.query('SELECT * FROM verband_einstellungen', (err, results) => {
    if (err) return res.status(500).json({ error: 'Datenbankfehler' });

    const config = {};
    results.forEach(e => {
      let value = e.einstellung_value;
      if (e.einstellung_typ === 'number') {
        value = parseFloat(value) || 0;
      } else if (e.einstellung_typ === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (e.einstellung_typ === 'json') {
        try { value = JSON.parse(value); } catch (err) { value = []; }
      }
      config[e.einstellung_key] = value;
    });

    res.json(config);
  });
});

/**
 * GET /api/verbandsmitgliedschaften/einstellungen/kategorien
 * Alle Kategorien abrufen
 */
router.get('/einstellungen/kategorien', (req, res) => {
  db.query(
    'SELECT DISTINCT kategorie FROM verband_einstellungen ORDER BY kategorie',
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      res.json(results.map(r => r.kategorie));
    }
  );
});

/**
 * PUT /api/verbandsmitgliedschaften/einstellungen
 * Mehrere Einstellungen auf einmal aktualisieren
 */
router.put('/einstellungen', async (req, res) => {
  const { einstellungen } = req.body;

  if (!einstellungen || !Array.isArray(einstellungen)) {
    return res.status(400).json({ error: 'Einstellungen-Array erforderlich' });
  }

  try {
    for (const { key, value } of einstellungen) {
      let valueStr = value;
      if (typeof value === 'object') {
        valueStr = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        valueStr = value ? 'true' : 'false';
      } else {
        valueStr = String(value);
      }

      await new Promise((resolve, reject) => {
        db.query(
          'UPDATE verband_einstellungen SET einstellung_value = ? WHERE einstellung_key = ?',
          [valueStr, key],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    res.json({ success: true, message: `${einstellungen.length} Einstellungen gespeichert` });
  } catch (err) {
    console.error('Fehler beim Speichern:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/verbandsmitgliedschaften/einstellungen/:key
 * Einzelne Einstellung abrufen
 */
router.get('/einstellungen/:key', (req, res) => {
  db.query(
    'SELECT * FROM verband_einstellungen WHERE einstellung_key = ?',
    [req.params.key],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      if (results.length === 0) return res.status(404).json({ error: 'Einstellung nicht gefunden' });

      const e = results[0];
      let value = e.einstellung_value;
      if (e.einstellung_typ === 'number') {
        value = parseFloat(value) || 0;
      } else if (e.einstellung_typ === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (e.einstellung_typ === 'json') {
        try { value = JSON.parse(value); } catch (err) { value = []; }
      }

      res.json({ ...e, einstellung_value: value });
    }
  );
});

/**
 * PUT /api/verbandsmitgliedschaften/einstellungen/:key
 * Einstellung aktualisieren
 */
router.put('/einstellungen/:key', (req, res) => {
  const { value } = req.body;
  const key = req.params.key;

  // Wert als String speichern
  let valueStr = value;
  if (typeof value === 'object') {
    valueStr = JSON.stringify(value);
  } else if (typeof value === 'boolean') {
    valueStr = value ? 'true' : 'false';
  } else {
    valueStr = String(value);
  }

  db.query(
    'UPDATE verband_einstellungen SET einstellung_value = ? WHERE einstellung_key = ?',
    [valueStr, key],
    (err, result) => {
      if (err) {
        console.error('Fehler beim Speichern:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Einstellung nicht gefunden' });
      }
      res.json({ success: true, message: 'Einstellung gespeichert' });
    }
  );
});

// ============================================================================
// MITGLIEDSCHAFTEN - EINZELN
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/:id
 * Einzelne Mitgliedschaft abrufen
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT
      vm.*,
      d.dojoname as dojo_name,
      d.ort as dojo_ort,
      d.email as dojo_email,
      CONCAT(m.vorname, ' ', m.nachname) as verknuepftes_mitglied_name
    FROM verbandsmitgliedschaften vm
    LEFT JOIN dojo d ON vm.dojo_id = d.id
    LEFT JOIN mitglieder m ON vm.mitglied_id = m.mitglied_id
    WHERE vm.id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Mitgliedschaft:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    }

    res.json(results[0]);
  });
});

/**
 * POST /api/verbandsmitgliedschaften
 * Neue Mitgliedschaft anlegen
 */
router.post('/', async (req, res) => {
  try {
    const {
      typ,
      dojo_id,
      person_vorname,
      person_nachname,
      person_email,
      person_telefon,
      person_strasse,
      person_plz,
      person_ort,
      person_land,
      person_geburtsdatum,
      mitglied_id,
      gueltig_von,
      zahlungsart,
      sepa_iban,
      sepa_bic,
      sepa_kontoinhaber,
      notizen
    } = req.body;

    // Validierung
    if (!typ || !['dojo', 'einzelperson'].includes(typ)) {
      return res.status(400).json({ error: 'Ungültiger Mitgliedschaftstyp' });
    }

    if (typ === 'dojo' && !dojo_id) {
      return res.status(400).json({ error: 'Dojo muss ausgewählt werden' });
    }

    if (typ === 'einzelperson' && (!person_vorname || !person_nachname || !person_email)) {
      return res.status(400).json({ error: 'Name und E-Mail sind erforderlich' });
    }

    // Prüfen ob Dojo bereits Mitglied ist
    if (typ === 'dojo') {
      const [existing] = await new Promise((resolve, reject) => {
        db.query(
          "SELECT id FROM verbandsmitgliedschaften WHERE dojo_id = ? AND status IN ('aktiv', 'ausstehend')",
          [dojo_id],
          (err, results) => err ? reject(err) : resolve(results)
        );
      });

      if (existing) {
        return res.status(400).json({ error: 'Dieses Dojo hat bereits eine aktive Mitgliedschaft' });
      }
    }

    // Mitgliedsnummer generieren
    const mitgliedsnummer = await getNextMitgliedsnummer(typ);

    // Beitrag aus Einstellungen laden
    const beitragDojo = await getEinstellung('preis_dojo_mitgliedschaft', DEFAULT_BEITRAG_DOJO);
    const beitragEinzel = await getEinstellung('preis_einzel_mitgliedschaft', DEFAULT_BEITRAG_EINZEL);
    const jahresbeitrag = typ === 'dojo' ? beitragDojo : beitragEinzel;

    // Laufzeit aus Einstellungen
    const laufzeitMonate = await getEinstellung('laufzeit_monate', 12);

    // Gültigkeit berechnen (basierend auf laufzeit_monate)
    const startDatum = gueltig_von || new Date().toISOString().split('T')[0];
    const endDatum = new Date(startDatum);
    endDatum.setMonth(endDatum.getMonth() + laufzeitMonate);
    const gueltigBis = endDatum.toISOString().split('T')[0];

    // Mitgliedschaft anlegen
    const insertQuery = `
      INSERT INTO verbandsmitgliedschaften (
        typ, dojo_id, person_vorname, person_nachname, person_email,
        person_telefon, person_strasse, person_plz, person_ort, person_land,
        person_geburtsdatum, mitglied_id, mitgliedsnummer, jahresbeitrag,
        gueltig_von, gueltig_bis, status, zahlungsart,
        sepa_iban, sepa_bic, sepa_kontoinhaber, notizen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ausstehend', ?, ?, ?, ?, ?)
    `;

    const result = await new Promise((resolve, reject) => {
      db.query(insertQuery, [
        typ, dojo_id || null, person_vorname || null, person_nachname || null,
        person_email || null, person_telefon || null, person_strasse || null,
        person_plz || null, person_ort || null, person_land || 'Deutschland',
        person_geburtsdatum || null, mitglied_id || null, mitgliedsnummer,
        jahresbeitrag, startDatum, gueltigBis, zahlungsart || 'rechnung',
        sepa_iban || null, sepa_bic || null, sepa_kontoinhaber || null, notizen || null
      ], (err, result) => err ? reject(err) : resolve(result));
    });

    // Erste Rechnung erstellen
    const betraege = calculateBrutto(jahresbeitrag);
    const rechnungsnummer = `TDA-${new Date().getFullYear()}-${result.insertId.toString().padStart(5, '0')}`;

    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO verbandsmitgliedschaft_zahlungen (
          verbandsmitgliedschaft_id, rechnungsnummer, rechnungsdatum, faellig_am,
          betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
          zeitraum_von, zeitraum_bis, status
        ) VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, ?, ?, ?, ?, 'offen')
      `, [
        result.insertId, rechnungsnummer, betraege.netto, betraege.mwst_satz,
        betraege.mwst_betrag, betraege.brutto, startDatum, gueltigBis
      ], (err) => err ? reject(err) : resolve());
    });

    res.status(201).json({
      success: true,
      id: result.insertId,
      mitgliedsnummer,
      rechnungsnummer,
      message: `${typ === 'dojo' ? 'Dojo' : 'Einzel'}-Mitgliedschaft erfolgreich angelegt`
    });

  } catch (err) {
    console.error('Fehler beim Anlegen der Mitgliedschaft:', err);
    res.status(500).json({ error: 'Datenbankfehler: ' + err.message });
  }
});

/**
 * PUT /api/verbandsmitgliedschaften/:id
 * Mitgliedschaft aktualisieren
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    person_vorname,
    person_nachname,
    person_email,
    person_telefon,
    person_strasse,
    person_plz,
    person_ort,
    person_land,
    person_geburtsdatum,
    zahlungsart,
    sepa_iban,
    sepa_bic,
    sepa_kontoinhaber,
    notizen,
    status
  } = req.body;

  const query = `
    UPDATE verbandsmitgliedschaften SET
      person_vorname = COALESCE(?, person_vorname),
      person_nachname = COALESCE(?, person_nachname),
      person_email = COALESCE(?, person_email),
      person_telefon = COALESCE(?, person_telefon),
      person_strasse = COALESCE(?, person_strasse),
      person_plz = COALESCE(?, person_plz),
      person_ort = COALESCE(?, person_ort),
      person_land = COALESCE(?, person_land),
      person_geburtsdatum = COALESCE(?, person_geburtsdatum),
      zahlungsart = COALESCE(?, zahlungsart),
      sepa_iban = COALESCE(?, sepa_iban),
      sepa_bic = COALESCE(?, sepa_bic),
      sepa_kontoinhaber = COALESCE(?, sepa_kontoinhaber),
      notizen = COALESCE(?, notizen),
      status = COALESCE(?, status),
      updated_at = NOW()
    WHERE id = ?
  `;

  db.query(query, [
    person_vorname, person_nachname, person_email, person_telefon,
    person_strasse, person_plz, person_ort, person_land,
    person_geburtsdatum, zahlungsart, sepa_iban, sepa_bic,
    sepa_kontoinhaber, notizen, status, id
  ], (err, result) => {
    if (err) {
      console.error('Fehler beim Aktualisieren:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    }

    res.json({ success: true, message: 'Mitgliedschaft aktualisiert' });
  });
});

/**
 * POST /api/verbandsmitgliedschaften/:id/verlaengern
 * Mitgliedschaft um ein Jahr verlängern
 */
router.post('/:id/verlaengern', async (req, res) => {
  const { id } = req.params;

  try {
    // Aktuelle Mitgliedschaft laden
    const [mitgliedschaft] = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM verbandsmitgliedschaften WHERE id = ?', [id],
        (err, results) => err ? reject(err) : resolve(results));
    });

    if (!mitgliedschaft) {
      return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
    }

    // Neues Enddatum berechnen (ab aktuellem Enddatum oder heute)
    const startDatum = new Date(mitgliedschaft.gueltig_bis) > new Date()
      ? mitgliedschaft.gueltig_bis
      : new Date().toISOString().split('T')[0];
    const endDatum = new Date(startDatum);
    endDatum.setFullYear(endDatum.getFullYear() + 1);

    // Gültigkeit verlängern
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE verbandsmitgliedschaften SET gueltig_bis = ?, status = 'aktiv' WHERE id = ?",
        [endDatum.toISOString().split('T')[0], id],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Neue Rechnung erstellen
    const betraege = calculateBrutto(mitgliedschaft.jahresbeitrag);
    const rechnungsnummer = `TDA-${new Date().getFullYear()}-${id.toString().padStart(5, '0')}-V`;

    await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO verbandsmitgliedschaft_zahlungen (
          verbandsmitgliedschaft_id, rechnungsnummer, rechnungsdatum, faellig_am,
          betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
          zeitraum_von, zeitraum_bis, status
        ) VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, ?, ?, ?, ?, 'offen')
      `, [
        id, rechnungsnummer, betraege.netto, betraege.mwst_satz,
        betraege.mwst_betrag, betraege.brutto, startDatum, endDatum.toISOString().split('T')[0]
      ], (err) => err ? reject(err) : resolve());
    });

    res.json({
      success: true,
      message: 'Mitgliedschaft verlängert',
      neues_ende: endDatum.toISOString().split('T')[0],
      rechnungsnummer
    });

  } catch (err) {
    console.error('Fehler bei Verlängerung:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * DELETE /api/verbandsmitgliedschaften/:id
 * Mitgliedschaft kündigen (nicht löschen)
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query(
    "UPDATE verbandsmitgliedschaften SET status = 'gekuendigt' WHERE id = ?",
    [id],
    (err, result) => {
      if (err) {
        console.error('Fehler beim Kündigen:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Mitgliedschaft nicht gefunden' });
      }

      res.json({ success: true, message: 'Mitgliedschaft gekündigt' });
    }
  );
});

// ============================================================================
// ZAHLUNGEN
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/:id/zahlungen
 * Zahlungen einer Mitgliedschaft
 */
router.get('/:id/zahlungen', (req, res) => {
  const { id } = req.params;

  db.query(
    'SELECT * FROM verbandsmitgliedschaft_zahlungen WHERE verbandsmitgliedschaft_id = ? ORDER BY rechnungsdatum DESC',
    [id],
    (err, results) => {
      if (err) {
        console.error('Fehler beim Laden der Zahlungen:', err);
        return res.status(500).json({ error: 'Datenbankfehler' });
      }
      res.json(results);
    }
  );
});

/**
 * POST /api/verbandsmitgliedschaften/zahlungen/:zahlungs_id/bezahlt
 * Zahlung als bezahlt markieren
 */
router.post('/zahlungen/:zahlungs_id/bezahlt', (req, res) => {
  const { zahlungs_id } = req.params;
  const { zahlungsart, transaktions_id } = req.body;

  db.query(`
    UPDATE verbandsmitgliedschaft_zahlungen
    SET status = 'bezahlt', bezahlt_am = CURDATE(), zahlungsart = ?, transaktions_id = ?
    WHERE id = ?
  `, [zahlungsart || 'ueberweisung', transaktions_id || null, zahlungs_id], (err, result) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    // Mitgliedschaft auf aktiv setzen wenn erste Zahlung
    db.query(`
      UPDATE verbandsmitgliedschaften vm
      SET status = 'aktiv'
      WHERE id = (SELECT verbandsmitgliedschaft_id FROM verbandsmitgliedschaft_zahlungen WHERE id = ?)
      AND status = 'ausstehend'
    `, [zahlungs_id]);

    res.json({ success: true, message: 'Zahlung als bezahlt markiert' });
  });
});

// ============================================================================
// VORTEILE
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/vorteile
 * Alle Vorteile abrufen
 */
router.get('/vorteile/liste', (req, res) => {
  db.query('SELECT * FROM verband_vorteile WHERE aktiv = TRUE ORDER BY kategorie, gilt_fuer', (err, results) => {
    if (err) {
      console.error('Fehler beim Laden der Vorteile:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

/**
 * GET /api/verbandsmitgliedschaften/check-rabatt
 * Prüft ob ein Dojo/Person Rabatt bekommt
 */
router.get('/check-rabatt', (req, res) => {
  const { dojo_id, mitglied_id, kategorie } = req.query;

  let query = `
    SELECT vv.*
    FROM verband_vorteile vv
    INNER JOIN verbandsmitgliedschaften vm ON (
      (vm.dojo_id = ? AND vv.gilt_fuer IN ('dojo', 'beide'))
      OR (vm.mitglied_id = ? AND vv.gilt_fuer IN ('einzelperson', 'beide'))
    )
    WHERE vm.status = 'aktiv'
    AND vm.gueltig_bis >= CURDATE()
    AND vv.aktiv = TRUE
    AND vv.kategorie = ?
  `;

  db.query(query, [dojo_id || 0, mitglied_id || 0, kategorie], (err, results) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    if (results.length === 0) {
      return res.json({ hatRabatt: false, rabatt: null });
    }

    // Besten Rabatt zurückgeben
    const besterRabatt = results.reduce((best, current) => {
      if (!best) return current;
      return current.rabatt_wert > best.rabatt_wert ? current : best;
    }, null);

    res.json({ hatRabatt: true, rabatt: besterRabatt });
  });
});

// ============================================================================
// DOJOS OHNE MITGLIEDSCHAFT
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/dojos-ohne-mitgliedschaft
 * Dojos die noch keine Verbandsmitgliedschaft haben
 */
router.get('/dojos-ohne-mitgliedschaft', (req, res) => {
  const query = `
    SELECT d.id, d.name, d.ort, d.email
    FROM dojo d
    WHERE d.id NOT IN (
      SELECT dojo_id FROM verbandsmitgliedschaften
      WHERE dojo_id IS NOT NULL AND status IN ('aktiv', 'ausstehend')
    )
    ORDER BY d.name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Fehler:', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
    res.json(results);
  });
});

// ============================================================================
// PDF GENERIERUNG
// ============================================================================

const { generateVerbandVertragPdf } = require('../utils/verbandVertragPdfGenerator');
const crypto = require('crypto');

/**
 * GET /api/verbandsmitgliedschaften/:id/pdf
 * Vertrags-PDF generieren und herunterladen
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    await generateVerbandVertragPdf(req.params.id, res);
  } catch (err) {
    console.error('PDF-Generierung fehlgeschlagen:', err);
    res.status(500).json({ error: 'PDF konnte nicht erstellt werden' });
  }
});

// ============================================================================
// SEPA-MANDATE
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/:id/sepa
 * SEPA-Mandat einer Mitgliedschaft abrufen
 */
router.get('/:id/sepa', (req, res) => {
  db.query(
    'SELECT * FROM verband_sepa_mandate WHERE verbandsmitgliedschaft_id = ? ORDER BY created_at DESC',
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      res.json(results);
    }
  );
});

/**
 * POST /api/verbandsmitgliedschaften/:id/sepa
 * Neues SEPA-Mandat anlegen
 */
router.post('/:id/sepa', async (req, res) => {
  const { id } = req.params;
  const {
    iban,
    bic,
    kontoinhaber,
    unterschrift_digital
  } = req.body;

  if (!iban || !kontoinhaber) {
    return res.status(400).json({ error: 'IBAN und Kontoinhaber sind erforderlich' });
  }

  try {
    // Mandatsreferenz generieren
    const mandatsreferenz = `TDA-${id}-${Date.now().toString(36).toUpperCase()}`;

    // IP und Hash
    const ip = req.ip || req.connection.remoteAddress;
    const hash = unterschrift_digital
      ? crypto.createHash('sha256').update(unterschrift_digital).digest('hex')
      : null;

    // Altes Mandat deaktivieren
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE verband_sepa_mandate SET status = 'inaktiv' WHERE verbandsmitgliedschaft_id = ? AND status = 'aktiv'",
        [id],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Neues Mandat anlegen
    const result = await new Promise((resolve, reject) => {
      db.query(`
        INSERT INTO verband_sepa_mandate (
          verbandsmitgliedschaft_id, mandatsreferenz, iban, bic, kontoinhaber,
          unterschriftsdatum, gueltig_ab, unterschrift_digital, unterschrift_ip, unterschrift_hash
        ) VALUES (?, ?, ?, ?, ?, CURDATE(), CURDATE(), ?, ?, ?)
      `, [id, mandatsreferenz, iban, bic || null, kontoinhaber, unterschrift_digital || null, ip, hash],
      (err, result) => err ? reject(err) : resolve(result));
    });

    // Mitgliedschaft auf Lastschrift umstellen
    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE verbandsmitgliedschaften SET zahlungsart = 'lastschrift', sepa_iban = ?, sepa_bic = ?, sepa_kontoinhaber = ? WHERE id = ?",
        [iban, bic, kontoinhaber, id],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Historie
    db.query(`
      INSERT INTO verband_vertragshistorie (verbandsmitgliedschaft_id, aktion, beschreibung, ip_adresse)
      VALUES (?, 'sepa_angelegt', ?, ?)
    `, [id, `SEPA-Mandat ${mandatsreferenz} angelegt`, ip]);

    res.status(201).json({
      success: true,
      id: result.insertId,
      mandatsreferenz,
      message: 'SEPA-Mandat erfolgreich angelegt'
    });

  } catch (err) {
    console.error('Fehler beim Anlegen des SEPA-Mandats:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * DELETE /api/verbandsmitgliedschaften/sepa/:sepa_id
 * SEPA-Mandat widerrufen
 */
router.delete('/sepa/:sepa_id', (req, res) => {
  db.query(
    "UPDATE verband_sepa_mandate SET status = 'widerrufen' WHERE id = ?",
    [req.params.sepa_id],
    (err, result) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Mandat nicht gefunden' });
      res.json({ success: true, message: 'SEPA-Mandat widerrufen' });
    }
  );
});

// ============================================================================
// DOKUMENTE (AGB, DSGVO, etc.)
// ============================================================================

/**
 * GET /api/verbandsmitgliedschaften/dokumente
 * Alle aktiven Dokumente abrufen
 */
router.get('/dokumente/liste', (req, res) => {
  db.query(
    'SELECT id, typ, version, titel, gueltig_ab, aktiv FROM verband_dokumente WHERE aktiv = 1 ORDER BY typ, version DESC',
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      res.json(results);
    }
  );
});

/**
 * GET /api/verbandsmitgliedschaften/dokumente/:typ
 * Aktuelles Dokument eines Typs abrufen (mit Inhalt)
 */
router.get('/dokumente/:typ', (req, res) => {
  db.query(
    'SELECT * FROM verband_dokumente WHERE typ = ? AND aktiv = 1 ORDER BY version DESC LIMIT 1',
    [req.params.typ],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      if (results.length === 0) return res.status(404).json({ error: 'Dokument nicht gefunden' });
      res.json(results[0]);
    }
  );
});

// ============================================================================
// DIGITALE UNTERSCHRIFT & VERTRAGSABSCHLUSS
// ============================================================================

/**
 * POST /api/verbandsmitgliedschaften/:id/unterschreiben
 * Vertrag digital unterschreiben
 */
router.post('/:id/unterschreiben', async (req, res) => {
  const { id } = req.params;
  const {
    unterschrift_digital,
    agb_akzeptiert,
    dsgvo_akzeptiert,
    widerrufsrecht_akzeptiert
  } = req.body;

  if (!unterschrift_digital) {
    return res.status(400).json({ error: 'Digitale Unterschrift erforderlich' });
  }

  if (!agb_akzeptiert || !dsgvo_akzeptiert || !widerrufsrecht_akzeptiert) {
    return res.status(400).json({ error: 'Alle Einwilligungen müssen akzeptiert werden' });
  }

  try {
    const ip = req.ip || req.connection.remoteAddress;
    const hash = crypto.createHash('sha256').update(unterschrift_digital + Date.now()).digest('hex');

    // Aktuelle Dokument-Versionen holen
    const [agbDoc] = await new Promise((resolve, reject) => {
      db.query("SELECT version FROM verband_dokumente WHERE typ = 'agb' AND aktiv = 1 ORDER BY version DESC LIMIT 1",
        (err, results) => err ? reject(err) : resolve(results));
    });

    const [dsgvoDoc] = await new Promise((resolve, reject) => {
      db.query("SELECT version FROM verband_dokumente WHERE typ = 'dsgvo' AND aktiv = 1 ORDER BY version DESC LIMIT 1",
        (err, results) => err ? reject(err) : resolve(results));
    });

    // Mitgliedschaft aktualisieren
    await new Promise((resolve, reject) => {
      db.query(`
        UPDATE verbandsmitgliedschaften SET
          unterschrift_digital = ?,
          unterschrift_ip = ?,
          unterschrift_hash = ?,
          vertrag_unterschrieben_am = NOW(),
          agb_akzeptiert = 1,
          agb_akzeptiert_am = NOW(),
          agb_version = ?,
          dsgvo_akzeptiert = 1,
          dsgvo_akzeptiert_am = NOW(),
          dsgvo_version = ?,
          widerrufsrecht_akzeptiert = 1,
          widerrufsrecht_akzeptiert_am = NOW(),
          status = 'aktiv'
        WHERE id = ?
      `, [unterschrift_digital, ip, hash, agbDoc?.version || '1.0', dsgvoDoc?.version || '1.0', id],
      (err) => err ? reject(err) : resolve());
    });

    // Historie
    db.query(`
      INSERT INTO verband_vertragshistorie (verbandsmitgliedschaft_id, aktion, beschreibung, ip_adresse)
      VALUES (?, 'erstellt', 'Vertrag digital unterschrieben', ?)
    `, [id, ip]);

    res.json({ success: true, message: 'Vertrag erfolgreich unterschrieben' });

  } catch (err) {
    console.error('Fehler beim Unterschreiben:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

/**
 * GET /api/verbandsmitgliedschaften/:id/historie
 * Vertragshistorie abrufen
 */
router.get('/:id/historie', (req, res) => {
  db.query(
    'SELECT * FROM verband_vertragshistorie WHERE verbandsmitgliedschaft_id = ? ORDER BY created_at DESC',
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler' });
      res.json(results);
    }
  );
});

module.exports = router;
