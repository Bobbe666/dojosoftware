// routes/buchhaltung.js
// EÜR (Einnahmen-Überschuss-Rechnung) für Super Admin Dashboard
// GoBD-konform mit Audit-Trail

const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===================================================================
// 📂 FILE UPLOAD CONFIG
// ===================================================================
const uploadDir = path.join(__dirname, '..', 'uploads', 'belege');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF, JPG und PNG Dateien erlaubt'));
    }
  }
});

// ===================================================================
// 🔧 HELPER FUNCTIONS
// ===================================================================

// Generiere fortlaufende Belegnummer
const generateBelegNummer = async (dojoId, jahr) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT MAX(CAST(SUBSTRING_INDEX(beleg_nummer, '-', -1) AS UNSIGNED)) as max_nr
      FROM buchhaltung_belege
      WHERE dojo_id = ? AND YEAR(buchungsdatum) = ?
    `;
    db.query(sql, [dojoId, jahr], (err, results) => {
      if (err) return reject(err);
      const nextNr = (results[0]?.max_nr || 0) + 1;
      const belegNummer = `${jahr}-${String(nextNr).padStart(5, '0')}`;
      resolve(belegNummer);
    });
  });
};

// Prüfe Super Admin Berechtigung
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.is_super_admin || req.user?.rolle === 'super_admin') {
    return next();
  }
  return res.status(403).json({ message: 'Nur für Super-Admin zugänglich' });
};

// Log to Audit
const logAudit = async (belegId, aktion, alteWerte, neueWerte, benutzerId, benutzerName) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO buchhaltung_audit_log (beleg_id, aktion, alte_werte, neue_werte, benutzer_id, benutzer_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [
      belegId,
      aktion,
      alteWerte ? JSON.stringify(alteWerte) : null,
      neueWerte ? JSON.stringify(neueWerte) : null,
      benutzerId,
      benutzerName || ''
    ], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// ===================================================================
// 📊 GET /api/buchhaltung/dashboard - Dashboard Übersicht
// ===================================================================
router.get('/dashboard', requireSuperAdmin, (req, res) => {
  const { organisation, jahr } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  // EÜR Zusammenfassung für Dashboard
  const einnahmenSql = `
    SELECT
      COALESCE(SUM(betrag_brutto), 0) as summe,
      MONTH(datum) as monat
    FROM v_euer_einnahmen
    WHERE jahr = ?
    ${organisation && organisation !== 'alle' ? `AND organisation_name = ?` : ''}
    GROUP BY MONTH(datum)
    ORDER BY monat
  `;

  const ausgabenSql = `
    SELECT
      COALESCE(SUM(betrag_brutto), 0) as summe,
      MONTH(datum) as monat
    FROM v_euer_ausgaben
    WHERE jahr = ?
    ${organisation && organisation !== 'alle' ? `AND organisation_name = ?` : ''}
    GROUP BY MONTH(datum)
    ORDER BY monat
  `;

  const params = organisation && organisation !== 'alle' ? [currentYear, organisation] : [currentYear];

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenSql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenSql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmen, ausgaben]) => {
    // Berechne Totals
    const totalEinnahmen = einnahmen.reduce((sum, row) => sum + parseFloat(row.summe || 0), 0);
    const totalAusgaben = ausgaben.reduce((sum, row) => sum + parseFloat(row.summe || 0), 0);

    res.json({
      jahr: currentYear,
      organisation: organisation || 'alle',
      einnahmen: {
        gesamt: totalEinnahmen,
        proMonat: einnahmen
      },
      ausgaben: {
        gesamt: totalAusgaben,
        proMonat: ausgaben
      },
      gewinnVerlust: totalEinnahmen - totalAusgaben
    });
  })
  .catch(err => {
    console.error('Dashboard-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Dashboard-Daten', error: err.message });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/euer - EÜR Übersicht nach Kategorien
// ===================================================================
router.get('/euer', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, quartal } = req.query;
  const currentYear = jahr || new Date().getFullYear();

  let dateFilter = `jahr = ${db.escape(currentYear)}`;
  if (quartal) {
    const q = parseInt(quartal);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    dateFilter += ` AND monat BETWEEN ${startMonth} AND ${endMonth}`;
  }

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Einnahmen nach Kategorie
  const einnahmenSql = `
    SELECT
      kategorie,
      quelle,
      COALESCE(SUM(betrag_brutto), 0) as summe,
      COUNT(*) as anzahl
    FROM v_euer_einnahmen
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
    ORDER BY kategorie, quelle
  `;

  // Ausgaben nach Kategorie
  const ausgabenSql = `
    SELECT
      kategorie,
      quelle,
      COALESCE(SUM(betrag_brutto), 0) as summe,
      COUNT(*) as anzahl
    FROM v_euer_ausgaben
    WHERE ${dateFilter} ${orgFilter}
    GROUP BY kategorie, quelle
    ORDER BY kategorie, quelle
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenSql, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmen, ausgaben]) => {
    // Gruppiere nach Kategorie
    const einnahmenNachKategorie = {};
    let totalEinnahmen = 0;
    einnahmen.forEach(row => {
      if (!einnahmenNachKategorie[row.kategorie]) {
        einnahmenNachKategorie[row.kategorie] = { summe: 0, details: [] };
      }
      einnahmenNachKategorie[row.kategorie].summe += parseFloat(row.summe);
      einnahmenNachKategorie[row.kategorie].details.push({
        quelle: row.quelle,
        summe: parseFloat(row.summe),
        anzahl: row.anzahl
      });
      totalEinnahmen += parseFloat(row.summe);
    });

    const ausgabenNachKategorie = {};
    let totalAusgaben = 0;
    ausgaben.forEach(row => {
      if (!ausgabenNachKategorie[row.kategorie]) {
        ausgabenNachKategorie[row.kategorie] = { summe: 0, details: [] };
      }
      ausgabenNachKategorie[row.kategorie].summe += parseFloat(row.summe);
      ausgabenNachKategorie[row.kategorie].details.push({
        quelle: row.quelle,
        summe: parseFloat(row.summe),
        anzahl: row.anzahl
      });
      totalAusgaben += parseFloat(row.summe);
    });

    res.json({
      jahr: currentYear,
      quartal: quartal || null,
      organisation: organisation || 'alle',
      einnahmen: {
        gesamt: totalEinnahmen,
        nachKategorie: einnahmenNachKategorie
      },
      ausgaben: {
        gesamt: totalAusgaben,
        nachKategorie: ausgabenNachKategorie
      },
      gewinnVerlust: totalEinnahmen - totalAusgaben
    });
  })
  .catch(err => {
    console.error('EÜR-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Laden der EÜR', error: err.message });
  });
});

// ===================================================================
// 📋 GET /api/buchhaltung/belege - Alle Belege abrufen
// ===================================================================
router.get('/belege', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, kategorie, buchungsart, seite = 1, limit = 50 } = req.query;
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = '1=1';
  const params = [];

  if (organisation && organisation !== 'alle') {
    whereClause += ' AND organisation_name = ?';
    params.push(organisation);
  }

  if (jahr) {
    whereClause += ' AND YEAR(buchungsdatum) = ?';
    params.push(jahr);
  }

  if (kategorie) {
    whereClause += ' AND kategorie = ?';
    params.push(kategorie);
  }

  if (buchungsart) {
    whereClause += ' AND buchungsart = ?';
    params.push(buchungsart);
  }

  const countSql = `SELECT COUNT(*) as total FROM buchhaltung_belege WHERE ${whereClause} AND storniert = FALSE`;
  const dataSql = `
    SELECT
      beleg_id,
      beleg_nummer,
      organisation_name,
      buchungsart,
      beleg_datum,
      buchungsdatum,
      betrag_netto,
      mwst_satz,
      mwst_betrag,
      betrag_brutto,
      kategorie,
      beschreibung,
      lieferant_kunde,
      rechnungsnummer_extern,
      datei_name,
      festgeschrieben,
      storniert,
      erstellt_am,
      geaendert_am
    FROM buchhaltung_belege
    WHERE ${whereClause} AND storniert = FALSE
    ORDER BY buchungsdatum DESC, beleg_nummer DESC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, params, (err, countResult) => {
    if (err) {
      console.error('Belege-Count-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Zählen der Belege' });
    }

    const total = countResult[0]?.total || 0;
    const dataParams = [...params, parseInt(limit), offset];

    db.query(dataSql, dataParams, (err, belege) => {
      if (err) {
        console.error('Belege-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Laden der Belege' });
      }

      res.json({
        belege,
        pagination: {
          seite: parseInt(seite),
          limit: parseInt(limit),
          total,
          seiten: Math.ceil(total / parseInt(limit))
        }
      });
    });
  });
});

// ===================================================================
// ➕ POST /api/buchhaltung/belege - Neuen Beleg erstellen
// ===================================================================
router.post('/belege', requireSuperAdmin, async (req, res) => {
  try {
    const {
      organisation_name,
      buchungsart,
      beleg_datum,
      buchungsdatum,
      betrag_netto,
      mwst_satz = 19,
      kategorie,
      beschreibung,
      lieferant_kunde,
      rechnungsnummer_extern
    } = req.body;

    // Validierung
    if (!organisation_name || !buchungsart || !beleg_datum || !betrag_netto || !kategorie || !beschreibung) {
      return res.status(400).json({ message: 'Pflichtfelder fehlen' });
    }

    // Berechne MwSt und Brutto
    const netto = parseFloat(betrag_netto);
    const mwst = parseFloat(mwst_satz);
    const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

    // Dojo ID basierend auf Organisation
    const dojoId = organisation_name === 'TDA International' ? 2 : 1;
    const jahr = new Date(buchungsdatum || beleg_datum).getFullYear();

    // Generiere Belegnummer
    const belegNummer = await generateBelegNummer(dojoId, jahr);

    const sql = `
      INSERT INTO buchhaltung_belege (
        beleg_nummer, dojo_id, organisation_name, buchungsart,
        beleg_datum, buchungsdatum, betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
        kategorie, beschreibung, lieferant_kunde, rechnungsnummer_extern, erstellt_von
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      belegNummer,
      dojoId,
      organisation_name,
      buchungsart,
      beleg_datum,
      buchungsdatum || beleg_datum,
      netto,
      mwst,
      mwstBetrag,
      brutto,
      kategorie,
      beschreibung,
      lieferant_kunde || null,
      rechnungsnummer_extern || null,
      req.user?.id || 1
    ];

    db.query(sql, params, async (err, result) => {
      if (err) {
        console.error('Beleg-Erstellung-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Erstellen des Belegs', error: err.message });
      }

      const belegId = result.insertId;

      // Audit Log
      await logAudit(belegId, 'erstellt', null, {
        beleg_nummer: belegNummer,
        betrag_brutto: brutto,
        kategorie,
        beschreibung
      }, req.user?.id || 1, req.user?.username);

      res.status(201).json({
        message: 'Beleg erfolgreich erstellt',
        beleg_id: belegId,
        beleg_nummer: belegNummer
      });
    });
  } catch (err) {
    console.error('Beleg-Erstellung-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Erstellen des Belegs', error: err.message });
  }
});

// ===================================================================
// ✏️ PUT /api/buchhaltung/belege/:id - Beleg bearbeiten
// ===================================================================
router.put('/belege/:id', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;

  // Erst prüfen ob festgeschrieben
  db.query('SELECT * FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: 'Beleg nicht gefunden' });
    }

    const beleg = results[0];
    if (beleg.festgeschrieben) {
      return res.status(403).json({ message: 'Beleg ist festgeschrieben und kann nicht mehr geändert werden' });
    }

    const {
      beleg_datum,
      buchungsdatum,
      betrag_netto,
      mwst_satz,
      kategorie,
      beschreibung,
      lieferant_kunde,
      rechnungsnummer_extern
    } = req.body;

    // Berechne MwSt und Brutto
    const netto = parseFloat(betrag_netto || beleg.betrag_netto);
    const mwst = parseFloat(mwst_satz || beleg.mwst_satz);
    const mwstBetrag = Math.round(netto * (mwst / 100) * 100) / 100;
    const brutto = Math.round((netto + mwstBetrag) * 100) / 100;

    const sql = `
      UPDATE buchhaltung_belege SET
        beleg_datum = ?,
        buchungsdatum = ?,
        betrag_netto = ?,
        mwst_satz = ?,
        mwst_betrag = ?,
        betrag_brutto = ?,
        kategorie = ?,
        beschreibung = ?,
        lieferant_kunde = ?,
        rechnungsnummer_extern = ?,
        geaendert_von = ?
      WHERE beleg_id = ?
    `;

    const params = [
      beleg_datum || beleg.beleg_datum,
      buchungsdatum || beleg.buchungsdatum,
      netto,
      mwst,
      mwstBetrag,
      brutto,
      kategorie || beleg.kategorie,
      beschreibung || beleg.beschreibung,
      lieferant_kunde !== undefined ? lieferant_kunde : beleg.lieferant_kunde,
      rechnungsnummer_extern !== undefined ? rechnungsnummer_extern : beleg.rechnungsnummer_extern,
      req.user?.id || 1,
      belegId
    ];

    db.query(sql, params, async (err) => {
      if (err) {
        console.error('Beleg-Update-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Aktualisieren des Belegs' });
      }

      // Audit Log (Trigger macht das automatisch, aber zusätzlich für IP etc.)
      await logAudit(belegId, 'geaendert', {
        betrag_brutto: beleg.betrag_brutto,
        kategorie: beleg.kategorie,
        beschreibung: beleg.beschreibung
      }, {
        betrag_brutto: brutto,
        kategorie: kategorie || beleg.kategorie,
        beschreibung: beschreibung || beleg.beschreibung
      }, req.user?.id || 1, req.user?.username);

      res.json({ message: 'Beleg erfolgreich aktualisiert' });
    });
  });
});

// ===================================================================
// 📎 POST /api/buchhaltung/belege/:id/upload - Beleg-Datei hochladen
// ===================================================================
router.post('/belege/:id/upload', requireSuperAdmin, upload.single('datei'), (req, res) => {
  const belegId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ message: 'Keine Datei hochgeladen' });
  }

  // Erst prüfen ob festgeschrieben
  db.query('SELECT festgeschrieben FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0) {
      // Lösche hochgeladene Datei wieder
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Beleg nicht gefunden' });
    }

    if (results[0].festgeschrieben) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Beleg ist festgeschrieben' });
    }

    const sql = `
      UPDATE buchhaltung_belege SET
        datei_pfad = ?,
        datei_name = ?,
        datei_typ = ?,
        datei_groesse = ?,
        geaendert_von = ?
      WHERE beleg_id = ?
    `;

    db.query(sql, [
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.user?.id || 1,
      belegId
    ], (err) => {
      if (err) {
        console.error('Datei-Upload-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Speichern der Datei' });
      }

      res.json({
        message: 'Datei erfolgreich hochgeladen',
        datei_name: req.file.originalname
      });
    });
  });
});

// ===================================================================
// 📥 GET /api/buchhaltung/belege/:id/datei - Beleg-Datei herunterladen
// ===================================================================
router.get('/belege/:id/datei', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;

  db.query('SELECT datei_pfad, datei_name, datei_typ FROM buchhaltung_belege WHERE beleg_id = ?', [belegId], (err, results) => {
    if (err || results.length === 0 || !results[0].datei_pfad) {
      return res.status(404).json({ message: 'Datei nicht gefunden' });
    }

    const { datei_pfad, datei_name, datei_typ } = results[0];

    if (!fs.existsSync(datei_pfad)) {
      return res.status(404).json({ message: 'Datei nicht mehr vorhanden' });
    }

    res.setHeader('Content-Type', datei_typ);
    res.setHeader('Content-Disposition', `inline; filename="${datei_name}"`);
    res.sendFile(datei_pfad);
  });
});

// ===================================================================
// 🔒 POST /api/buchhaltung/belege/:id/festschreiben - Beleg festschreiben
// ===================================================================
router.post('/belege/:id/festschreiben', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;

  db.query(
    `UPDATE buchhaltung_belege SET
      festgeschrieben = TRUE,
      festgeschrieben_am = NOW(),
      festgeschrieben_von = ?
    WHERE beleg_id = ? AND festgeschrieben = FALSE`,
    [req.user?.id || 1, belegId],
    async (err, result) => {
      if (err) {
        console.error('Festschreiben-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Festschreiben' });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: 'Beleg bereits festgeschrieben oder nicht gefunden' });
      }

      await logAudit(belegId, 'festgeschrieben', null, { festgeschrieben: true }, req.user?.id || 1, req.user?.username);

      res.json({ message: 'Beleg erfolgreich festgeschrieben' });
    }
  );
});

// ===================================================================
// ❌ POST /api/buchhaltung/belege/:id/stornieren - Beleg stornieren
// ===================================================================
router.post('/belege/:id/stornieren', requireSuperAdmin, (req, res) => {
  const belegId = req.params.id;
  const { grund } = req.body;

  if (!grund) {
    return res.status(400).json({ message: 'Storno-Grund ist erforderlich' });
  }

  db.query(
    `UPDATE buchhaltung_belege SET
      storniert = TRUE,
      storno_grund = ?,
      storno_am = NOW(),
      storno_von = ?
    WHERE beleg_id = ? AND storniert = FALSE`,
    [grund, req.user?.id || 1, belegId],
    async (err, result) => {
      if (err) {
        console.error('Storno-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Stornieren' });
      }

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: 'Beleg bereits storniert oder nicht gefunden' });
      }

      await logAudit(belegId, 'storniert', null, { storniert: true, grund }, req.user?.id || 1, req.user?.username);

      res.json({ message: 'Beleg erfolgreich storniert' });
    }
  );
});

// ===================================================================
// 📈 GET /api/buchhaltung/einnahmen-auto - Automatische Einnahmen
// ===================================================================
router.get('/einnahmen-auto', requireSuperAdmin, (req, res) => {
  const { organisation, jahr, monat, seite = 1, limit = 50 } = req.query;
  const currentYear = jahr || new Date().getFullYear();
  const offset = (parseInt(seite) - 1) * parseInt(limit);

  let whereClause = `jahr = ${db.escape(currentYear)}`;
  if (organisation && organisation !== 'alle') {
    whereClause += ` AND organisation_name = ${db.escape(organisation)}`;
  }
  if (monat) {
    whereClause += ` AND monat = ${db.escape(monat)}`;
  }

  const sql = `
    SELECT
      quelle,
      referenz_id,
      organisation_name,
      datum,
      betrag_brutto,
      kategorie,
      beschreibung
    FROM v_euer_einnahmen
    WHERE ${whereClause}
    ORDER BY datum DESC
    LIMIT ? OFFSET ?
  `;

  db.query(sql, [parseInt(limit), offset], (err, results) => {
    if (err) {
      console.error('Auto-Einnahmen-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden der automatischen Einnahmen' });
    }

    res.json({
      einnahmen: results,
      pagination: {
        seite: parseInt(seite),
        limit: parseInt(limit)
      }
    });
  });
});

// ===================================================================
// 📊 GET /api/buchhaltung/abschluss/:jahr - Jahresabschluss
// ===================================================================
router.get('/abschluss/:jahr', requireSuperAdmin, (req, res) => {
  const { jahr } = req.params;
  const { organisation } = req.query;

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Prüfe ob Abschluss existiert
  const abschlussSql = `
    SELECT * FROM euer_abschluesse
    WHERE jahr = ? ${organisation && organisation !== 'alle' ? `AND organisation_name = ?` : ''}
  `;
  const abschlussParams = organisation && organisation !== 'alle' ? [jahr, organisation] : [jahr];

  db.query(abschlussSql, abschlussParams, (err, abschlussResults) => {
    if (err) {
      console.error('Abschluss-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Laden des Abschlusses' });
    }

    // Berechne aktuelle Werte
    const einnahmenSql = `
      SELECT kategorie, COALESCE(SUM(betrag_brutto), 0) as summe
      FROM v_euer_einnahmen
      WHERE jahr = ? ${orgFilter}
      GROUP BY kategorie
    `;

    const ausgabenSql = `
      SELECT kategorie, COALESCE(SUM(betrag_brutto), 0) as summe
      FROM v_euer_ausgaben
      WHERE jahr = ? ${orgFilter}
      GROUP BY kategorie
    `;

    Promise.all([
      new Promise((resolve, reject) => {
        db.query(einnahmenSql, [jahr], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      }),
      new Promise((resolve, reject) => {
        db.query(ausgabenSql, [jahr], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      })
    ])
    .then(([einnahmen, ausgaben]) => {
      const einnahmenDetails = {};
      let totalEinnahmen = 0;
      einnahmen.forEach(row => {
        einnahmenDetails[row.kategorie] = parseFloat(row.summe);
        totalEinnahmen += parseFloat(row.summe);
      });

      const ausgabenDetails = {};
      let totalAusgaben = 0;
      ausgaben.forEach(row => {
        ausgabenDetails[row.kategorie] = parseFloat(row.summe);
        totalAusgaben += parseFloat(row.summe);
      });

      const abschluss = abschlussResults[0] || null;

      res.json({
        jahr: parseInt(jahr),
        organisation: organisation || 'alle',
        abschluss: abschluss ? {
          status: abschluss.status,
          abgeschlossen_am: abschluss.abgeschlossen_am,
          letzter_export: abschluss.letzter_export_datum
        } : null,
        berechnet: {
          einnahmen: {
            gesamt: totalEinnahmen,
            details: einnahmenDetails
          },
          ausgaben: {
            gesamt: totalAusgaben,
            details: ausgabenDetails
          },
          gewinnVerlust: totalEinnahmen - totalAusgaben
        }
      });
    })
    .catch(err => {
      console.error('Abschluss-Berechnung-Fehler:', err);
      res.status(500).json({ message: 'Fehler bei der Berechnung' });
    });
  });
});

// ===================================================================
// 🔐 POST /api/buchhaltung/abschluss/:jahr/festschreiben - Jahr festschreiben
// ===================================================================
router.post('/abschluss/:jahr/festschreiben', requireSuperAdmin, (req, res) => {
  const { jahr } = req.params;
  const { organisation } = req.body;

  if (!organisation) {
    return res.status(400).json({ message: 'Organisation ist erforderlich' });
  }

  const dojoId = organisation === 'TDA International' ? 2 : 1;

  // Erst alle nicht-festgeschriebenen Belege des Jahres festschreiben
  const festschreibenBelegeSql = `
    UPDATE buchhaltung_belege SET
      festgeschrieben = TRUE,
      festgeschrieben_am = NOW(),
      festgeschrieben_von = ?
    WHERE YEAR(buchungsdatum) = ? AND organisation_name = ? AND festgeschrieben = FALSE
  `;

  db.query(festschreibenBelegeSql, [req.user?.id || 1, jahr, organisation], (err, belegeResult) => {
    if (err) {
      console.error('Belege-Festschreiben-Fehler:', err);
      return res.status(500).json({ message: 'Fehler beim Festschreiben der Belege' });
    }

    // Dann Abschluss erstellen/aktualisieren
    const upsertSql = `
      INSERT INTO euer_abschluesse (dojo_id, organisation_name, jahr, status, abgeschlossen_am, abgeschlossen_von)
      VALUES (?, ?, ?, 'abgeschlossen', NOW(), ?)
      ON DUPLICATE KEY UPDATE
        status = 'abgeschlossen',
        abgeschlossen_am = NOW(),
        abgeschlossen_von = ?
    `;

    db.query(upsertSql, [dojoId, organisation, jahr, req.user?.id || 1, req.user?.id || 1], (err) => {
      if (err) {
        console.error('Abschluss-Festschreiben-Fehler:', err);
        return res.status(500).json({ message: 'Fehler beim Erstellen des Abschlusses' });
      }

      res.json({
        message: `Jahresabschluss ${jahr} für ${organisation} erfolgreich festgeschrieben`,
        belege_festgeschrieben: belegeResult.affectedRows
      });
    });
  });
});

// ===================================================================
// 📤 GET /api/buchhaltung/abschluss/:jahr/export - CSV Export
// ===================================================================
router.get('/abschluss/:jahr/export', requireSuperAdmin, (req, res) => {
  const { jahr } = req.params;
  const { organisation, format = 'csv' } = req.query;

  const orgFilter = organisation && organisation !== 'alle'
    ? `AND organisation_name = ${db.escape(organisation)}`
    : '';

  // Hole alle Buchungen des Jahres
  const einnahmenSql = `
    SELECT
      datum, kategorie, beschreibung, betrag_brutto, quelle, organisation_name
    FROM v_euer_einnahmen
    WHERE jahr = ? ${orgFilter}
    ORDER BY datum
  `;

  const ausgabenSql = `
    SELECT
      datum, kategorie, beschreibung, betrag_brutto, quelle, organisation_name
    FROM v_euer_ausgaben
    WHERE jahr = ? ${orgFilter}
    ORDER BY datum
  `;

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(einnahmenSql, [jahr], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    }),
    new Promise((resolve, reject) => {
      db.query(ausgabenSql, [jahr], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    })
  ])
  .then(([einnahmen, ausgaben]) => {
    // CSV generieren
    let csv = 'Datum;Typ;Kategorie;Beschreibung;Betrag;Quelle;Organisation\n';

    einnahmen.forEach(row => {
      csv += `${row.datum};Einnahme;${row.kategorie};${row.beschreibung};${row.betrag_brutto};${row.quelle};${row.organisation_name}\n`;
    });

    ausgaben.forEach(row => {
      csv += `${row.datum};Ausgabe;${row.kategorie};${row.beschreibung};${row.betrag_brutto};${row.quelle};${row.organisation_name}\n`;
    });

    // Zusammenfassung
    const totalEinnahmen = einnahmen.reduce((sum, row) => sum + parseFloat(row.betrag_brutto || 0), 0);
    const totalAusgaben = ausgaben.reduce((sum, row) => sum + parseFloat(row.betrag_brutto || 0), 0);
    const gewinn = totalEinnahmen - totalAusgaben;

    csv += '\n;;;\n';
    csv += `;Summe Einnahmen;;;${totalEinnahmen.toFixed(2)};;\n`;
    csv += `;Summe Ausgaben;;;${totalAusgaben.toFixed(2)};;\n`;
    csv += `;Gewinn/Verlust;;;${gewinn.toFixed(2)};;\n`;

    // Update Export-Tracking
    if (organisation && organisation !== 'alle') {
      const dojoId = organisation === 'TDA International' ? 2 : 1;
      db.query(
        `UPDATE euer_abschluesse SET letzter_export_datum = NOW(), letzter_export_format = ? WHERE dojo_id = ? AND jahr = ?`,
        [format, dojoId, jahr]
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="EUeR_${jahr}_${organisation || 'alle'}.csv"`);
    res.send('\ufeff' + csv); // BOM für Excel UTF-8
  })
  .catch(err => {
    console.error('Export-Fehler:', err);
    res.status(500).json({ message: 'Fehler beim Export' });
  });
});

// ===================================================================
// 📋 GET /api/buchhaltung/kategorien - Alle EÜR-Kategorien
// ===================================================================
router.get('/kategorien', requireSuperAdmin, (req, res) => {
  const kategorien = [
    { id: 'betriebseinnahmen', name: 'Betriebseinnahmen', typ: 'einnahme', beschreibung: 'Umsatzerlöse, Mitgliedsbeiträge' },
    { id: 'wareneingang', name: 'Wareneingang', typ: 'ausgabe', beschreibung: 'Einkauf Artikel, Material' },
    { id: 'personalkosten', name: 'Personalkosten', typ: 'ausgabe', beschreibung: 'Löhne, Gehälter, Sozialabgaben' },
    { id: 'raumkosten', name: 'Raumkosten', typ: 'ausgabe', beschreibung: 'Miete, Nebenkosten, Reinigung' },
    { id: 'versicherungen', name: 'Versicherungen', typ: 'ausgabe', beschreibung: 'Haftpflicht, Unfallversicherung' },
    { id: 'kfz_kosten', name: 'KFZ-Kosten', typ: 'ausgabe', beschreibung: 'Fahrzeugkosten, Kraftstoff' },
    { id: 'werbekosten', name: 'Werbekosten', typ: 'ausgabe', beschreibung: 'Marketing, Flyer, Online-Werbung' },
    { id: 'reisekosten', name: 'Reisekosten', typ: 'ausgabe', beschreibung: 'Fahrten, Übernachtungen' },
    { id: 'telefon_internet', name: 'Telefon/Internet', typ: 'ausgabe', beschreibung: 'Kommunikationskosten' },
    { id: 'buerokosten', name: 'Bürokosten', typ: 'ausgabe', beschreibung: 'Büromaterial, Porto' },
    { id: 'fortbildung', name: 'Fortbildung', typ: 'ausgabe', beschreibung: 'Seminare, Weiterbildung' },
    { id: 'abschreibungen', name: 'Abschreibungen', typ: 'ausgabe', beschreibung: 'AfA auf Anlagegüter' },
    { id: 'sonstige_kosten', name: 'Sonstige Kosten', typ: 'ausgabe', beschreibung: 'Sonstige betriebliche Aufwendungen' }
  ];

  res.json(kategorien);
});

module.exports = router;
