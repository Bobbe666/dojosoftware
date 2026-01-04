const express = require("express");
const db = require("../db"); // Verbindung zur DB importieren
const SepaPdfGenerator = require("../utils/sepaPdfGenerator");
const MitgliedsausweisGenerator = require("../utils/mitgliedsausweisGenerator");
const bcrypt = require("bcryptjs"); // Für Passwort-Hashing
const router = express.Router();

// Mock-Daten wurden entfernt - verwende immer echte Datenbank

// ✅ NEU: API für Anwesenheit – aktive Mitglieder nach Stil filtern + DOJO-FILTER
router.get("/", (req, res) => {
    const { stil, dojo_id } = req.query;

    // 🔒 DOJO-FILTER: Baue WHERE-Bedingungen
    let whereConditions = ['m.aktiv = 1'];
    let queryParams = [];

    // Stil-Filter
    if (stil) {
        whereConditions.push('ms.stil = ?');
        queryParams.push(stil);
    }

    // 🔒 Dojo-Filter
    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    if (stil) {
        const query = `
            SELECT DISTINCT m.mitglied_id, m.vorname, m.nachname, m.strasse as adresse, m.hausnummer, m.plz, m.ort, m.email, m.telefon_mobil, m.foto_pfad
            FROM mitglieder m
            JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
            ${whereClause}
            ORDER BY m.nachname, m.vorname
        `;

        db.query(query, queryParams, (err, results) => {
            if (err) {
                console.error("❌ Fehler beim Filtern der Mitglieder:", err);
                return res.status(500).json({ error: "Fehler beim Filtern der Mitglieder" });
            }

            res.json(results);
        });
    } else {
        // Standard: Alle aktiven Mitglieder
        const query = `
            SELECT mitglied_id, vorname, nachname, strasse as adresse, hausnummer, plz, ort, email, telefon_mobil, foto_pfad
            FROM mitglieder m
            ${whereClause}
            ORDER BY nachname, vorname
        `;

        db.query(query, queryParams, (err, results) => {
            if (err) {
                console.error("❌ Fehler beim Laden der Mitglieder:", err);
                return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
            }

            res.json(results);
        });
    }
});

// ✅ API: Alle Mitglieder abrufen (inkl. Stile) - ERWEITERT + DOJO-FILTER
router.get("/all", (req, res) => {
    const { dojo_id } = req.query;

    // 🔒 DOJO-FILTER: Baue WHERE-Clause
    let whereClause = '';
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
        whereClause = 'WHERE m.dojo_id = ?';
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.geburtsdatum,
            m.gurtfarbe,
            m.graduierung_id,
            COALESCE(
                GROUP_CONCAT(DISTINCT g_stil.name ORDER BY g_stil.name SEPARATOR ', '),
                g.name
            ) AS aktuelle_graduierung,
            m.email,
            m.telefon_mobil,
            m.aktiv,
            m.eintrittsdatum,
            m.dojo_id,
            -- 🆕 Medizinische Informationen
            m.allergien,
            m.notfallkontakt_name,
            m.notfallkontakt_telefon,
            -- 🆕 Prüfungsmanagement
            m.naechste_pruefung_datum,
            m.pruefungsgebuehr_bezahlt,
            -- 🆕 Compliance
            m.hausordnung_akzeptiert,
            m.datenschutz_akzeptiert,
            m.foto_einverstaendnis,
            -- 🆕 Familie
            m.familien_id,
            m.rabatt_prozent,
            m.trainingsstunden,
            COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile,
            -- Foto
            m.foto_pfad
        FROM mitglieder m
        LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
        LEFT JOIN graduierungen g ON m.graduierung_id = g.graduierung_id
        LEFT JOIN mitglied_stil_data msd ON m.mitglied_id = msd.mitglied_id
        LEFT JOIN graduierungen g_stil ON msd.current_graduierung_id = g_stil.graduierung_id
        ${whereClause}
        GROUP BY m.mitglied_id
        ORDER BY m.nachname, m.vorname
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen der Mitglieder:", err);
            return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
        }

        if (!results || results.length === 0) {
            // ✅ Bei 0 Mitgliedern: 200 OK mit leerem Array (kein 404!)
            return res.status(200).json([]);
        }

        res.json(results);
    });
});

// ✅ API: Mitglied über Email abrufen (für MemberDashboard)
router.get("/by-email/:email", (req, res) => {
    const { email } = req.params;

    const query = `
        SELECT
            -- Stammdaten
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.geburtsdatum,
            m.geschlecht,
            m.gewicht,
            m.gurtfarbe,
            m.dojo_id,
            m.trainingsstunden,

            -- Kontaktdaten
            m.email,
            m.telefon,
            m.telefon_mobil,
            m.strasse,
            m.hausnummer,
            m.plz,
            m.ort,

            -- Zahlungsdaten
            m.iban,
            m.bic,
            m.bankname,
            m.zahlungsmethode,
            m.zahllaufgruppe,

            -- Status
            m.eintrittsdatum,
            m.gekuendigt_am,
            m.aktiv,

            -- Medizinische Informationen
            m.allergien,
            m.medizinische_hinweise,
            m.notfallkontakt_name,
            m.notfallkontakt_telefon,
            m.notfallkontakt_verhaeltnis,

            -- Prüfungsmanagement
            m.naechste_pruefung_datum,
            m.pruefungsgebuehr_bezahlt,
            m.trainer_empfehlung,

            -- Dokumente/Compliance
            m.hausordnung_akzeptiert,
            m.datenschutz_akzeptiert,
            m.foto_einverstaendnis,
            m.vereinsordnung_datum,

            -- Familienmanagement
            m.familien_id,
            m.rabatt_prozent,
            m.rabatt_grund,

            -- Stile
            COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile,
            -- Foto
            m.foto_pfad
        FROM mitglieder m
        LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
        WHERE m.email = ?
        GROUP BY m.mitglied_id
    `;

    db.query(query, [email], (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen des Mitglieds über Email:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Mitgliedsdaten" });
        }

        if (!result || result.length === 0) {

            return res.status(404).json({ error: `Mitglied mit Email ${email} nicht gefunden.` });
        }

        res.json(result[0]);
    });
});

// ✅ API: Alle verfügbaren Stile abrufen (MUSS VOR /:id Route stehen!)
router.get("/filter-options/stile", (req, res) => {
  const query = `
    SELECT name
    FROM stile
    WHERE aktiv = 1
    ORDER BY name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Laden der Stile:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Stile" });
    }

    const stile = results.map(r => r.name);
    res.json({ success: true, stile });
  });
});

// ✅ API: Alle verfügbaren Gurte/Graduierungen abrufen (MUSS VOR /:id Route stehen!)
router.get("/filter-options/gurte", (req, res) => {
  const query = `
    SELECT DISTINCT g.name, g.reihenfolge
    FROM graduierungen g
    INNER JOIN mitglied_stil_data msd ON g.graduierung_id = msd.current_graduierung_id
    INNER JOIN mitglieder m ON msd.mitglied_id = m.mitglied_id
    WHERE m.aktiv = 1
    ORDER BY g.reihenfolge
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Laden der Gurte:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Gurte" });
    }

    const gurte = results.map(r => r.name);
    res.json({ success: true, gurte });
  });
});

// ✅ API: Mitglieder ohne SEPA-Mandat (MUSS VOR /:id Route stehen!)
router.get("/filter/ohne-sepa", (req, res) => {
  const { dojo_id } = req.query;

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
  let whereConditions = [
    "m.zahlungsmethode IN ('SEPA-Lastschrift', 'Lastschrift')",
    "(sm.mandatsreferenz IS NULL OR sm.status != 'aktiv')",
    "(m.vertragsfrei = 0 OR m.vertragsfrei IS NULL)"
  ];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT DISTINCT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      v.monatsbeitrag
    FROM mitglieder m
    LEFT JOIN sepa_mandate sm ON m.mitglied_id = sm.mitglied_id AND sm.status = 'aktiv'
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Laden der Mitglieder ohne SEPA:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

// ✅ API: Mitglieder ohne Vertrag (MUSS VOR /:id Route stehen!)
router.get("/filter/ohne-vertrag", (req, res) => {
  const { dojo_id } = req.query;

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
  let whereConditions = [
    "m.aktiv = 1",
    "v.vertrag_id IS NULL"
  ];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT DISTINCT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      NULL as monatsbeitrag
    FROM mitglieder m
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Laden der Mitglieder ohne Vertrag:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

// ✅ API: Mitglieder mit Tarif-Abweichungen (MUSS VOR /:id Route stehen!)
router.get("/filter/tarif-abweichung", (req, res) => {
  const { dojo_id } = req.query;

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
  let whereConditions = [
    "v.status = 'aktiv'",
    // Zeige Verträge die:
    // 1. Keinen Tarif haben (tarif_id IS NULL) ODER
    // 2. Einen Tarif ohne Altersgruppe haben (alte Tarife, nicht kategorisiert) ODER
    // 3. Vom erwarteten Monatspreis abweichen
    `(
      v.tarif_id IS NULL
      OR t.altersgruppe IS NULL
      OR (
        t.id IS NOT NULL
        AND v.monatsbeitrag != ROUND(
          CASE
            WHEN t.billing_cycle = 'MONTHLY' THEN t.price_cents / 100
            WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
            WHEN t.billing_cycle = 'YEARLY' THEN (t.price_cents / 100) / 12
            ELSE t.price_cents / 100
          END,
          2
        )
      )
    )`
  ];
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT DISTINCT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      m.geburtsdatum,
      v.monatsbeitrag,
      v.tarif_id,
      v.billing_cycle as vertrag_billing_cycle,
      t.name as tarif_name,
      t.price_cents,
      t.billing_cycle as tarif_billing_cycle,
      t.altersgruppe,
      ROUND(
        CASE
          WHEN t.billing_cycle = 'MONTHLY' THEN t.price_cents / 100
          WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
          WHEN t.billing_cycle = 'YEARLY' THEN (t.price_cents / 100) / 12
          ELSE t.price_cents / 100
        END,
        2
      ) as erwarteter_monatsbeitrag,
      CASE
        WHEN v.tarif_id IS NULL THEN
          CONCAT('Alter Vertrag ohne Tarif-Zuordnung (€', COALESCE(v.monatsbeitrag, 0), '/Monat)')
        WHEN t.altersgruppe IS NULL THEN
          CONCAT('Tarif ohne Altersgruppen-Zuordnung (€', COALESCE(v.monatsbeitrag, 0), '/Monat - ', t.name, ')')
        ELSE
          CONCAT(
            'Zahlt €', COALESCE(v.monatsbeitrag, 0),
            ' statt €',
            ROUND(
              CASE
                WHEN t.billing_cycle = 'MONTHLY' THEN t.price_cents / 100
                WHEN t.billing_cycle = 'QUARTERLY' THEN (t.price_cents / 100) / 3
                WHEN t.billing_cycle = 'YEARLY' THEN (t.price_cents / 100) / 12
                ELSE t.price_cents / 100
              END,
              2
            ),
            '/Monat (',
            t.name,
            CASE WHEN t.billing_cycle = 'MONTHLY' THEN ' - Monatlich'
                 WHEN t.billing_cycle = 'QUARTERLY' THEN ' - Vierteljährlich'
                 WHEN t.billing_cycle = 'YEARLY' THEN ' - Jährlich'
                 ELSE ''
            END,
            ', ', t.altersgruppe,
            ')'
          )
      END as abweichung_grund
    FROM mitglieder m
    JOIN vertraege v ON m.mitglied_id = v.mitglied_id
    LEFT JOIN tarife t ON v.tarif_id = t.id
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Laden der Mitglieder mit Tarif-Abweichung:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

// ✅ API: Mitglieder nach Zahlungsweise filtern (MUSS VOR /:id Route stehen!)
router.get("/filter/zahlungsweisen", (req, res) => {
  const { payment_method, dojo_id } = req.query;

  // 🔒 DOJO-FILTER: Baue WHERE-Clause
  let whereConditions = [];
  let queryParams = [];

  if (payment_method && payment_method !== 'all') {
    // Lastschrift umfasst sowohl "SEPA-Lastschrift" als auch "Lastschrift"
    if (payment_method === 'Lastschrift') {
      whereConditions.push("(m.zahlungsmethode = 'SEPA-Lastschrift' OR m.zahlungsmethode = 'Lastschrift')");
    } else {
      whereConditions.push('m.zahlungsmethode = ?');
      queryParams.push(payment_method);
    }
  }

  if (dojo_id && dojo_id !== 'all') {
    whereConditions.push('m.dojo_id = ?');
    queryParams.push(parseInt(dojo_id));
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT DISTINCT
      m.mitglied_id,
      m.vorname,
      m.nachname,
      m.email,
      m.zahlungsmethode,
      m.aktiv,
      v.monatsbeitrag
    FROM mitglieder m
    LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
    ${whereClause}
    ORDER BY m.nachname, m.vorname
  `;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Laden der Mitglieder nach Zahlungsweise:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
    }

    res.json({ success: true, data: results });
  });
});

/**
 * GET /mitglieder/print
 * Generiert eine PDF-Liste aller Mitglieder mit Name, Geburtsdatum, Stil und Vertrag
 */
router.get("/print", async (req, res) => {
  const PDFDocument = require('pdfkit');
  const { dojo_id } = req.query;

  try {
    // Mitglieder mit Stil und Vertrag abrufen
    let query = `
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.dojo_id,
        GROUP_CONCAT(DISTINCT ms.stil SEPARATOR ', ') as stile,
        v.status as vertrag_status,
        t.name as tarif_name
      FROM mitglieder m
      LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
      LEFT JOIN vertraege v ON m.mitglied_id = v.mitglied_id AND v.status = 'aktiv'
      LEFT JOIN tarife t ON v.tarif_id = t.id
      WHERE m.aktiv = 1
    `;

    const params = [];
    if (dojo_id && dojo_id !== 'all') {
      query += ` AND m.dojo_id = ?`;
      params.push(dojo_id);
    }

    query += ` GROUP BY m.mitglied_id ORDER BY m.nachname, m.vorname`;

    db.query(query, params, (err, mitglieder) => {
      if (err) {
        console.error("❌ Fehler beim Abrufen der Mitglieder:", err);
        return res.status(500).json({ error: "Fehler beim Abrufen der Mitglieder" });
      }

      // PDF erstellen
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      // PDF direkt zum Client streamen
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="mitgliederliste.pdf"');
      doc.pipe(res);

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .text('Mitgliederliste', { align: 'center' })
         .moveDown();

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' })
         .text(`Anzahl Mitglieder: ${mitglieder.length}`, { align: 'center' })
         .moveDown(2);

      // Tabellen-Header
      const startY = doc.y;
      const col1X = 50;
      const col2X = 200;
      const col3X = 300;
      const col4X = 380;
      const rowHeight = 20;

      doc.fontSize(10)
         .font('Helvetica-Bold');

      doc.text('Name', col1X, startY, { width: 140, continued: false })
         .text('Geburtsdatum', col2X, startY, { width: 90, continued: false })
         .text('Stil', col3X, startY, { width: 70, continued: false })
         .text('Vertrag', col4X, startY, { width: 150, continued: false });

      // Linie unter Header
      doc.moveTo(col1X, startY + 15)
         .lineTo(530, startY + 15)
         .stroke();

      let currentY = startY + rowHeight;

      // Mitglieder-Daten
      doc.font('Helvetica')
         .fontSize(9);

      // Seitenzähler für Footer
      let currentPageNum = 1;
      const pageNumbers = []; // Speichert Y-Positionen und Page-Objekte

      // Erste Seite registrieren
      pageNumbers.push({ pageNum: currentPageNum, pageRef: doc.page });

      mitglieder.forEach((mitglied, index) => {
        // Neue Seite wenn nötig
        if (currentY > 750) {
          currentPageNum++;
          doc.addPage();
          currentY = 50;

          // Header wiederholen
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Name', col1X, currentY, { width: 140, continued: false })
             .text('Geburtsdatum', col2X, currentY, { width: 90, continued: false })
             .text('Stil', col3X, currentY, { width: 70, continued: false })
             .text('Vertrag', col4X, currentY, { width: 150, continued: false });

          doc.moveTo(col1X, currentY + 15)
             .lineTo(530, currentY + 15)
             .stroke();

          currentY += rowHeight;
          doc.font('Helvetica')
             .fontSize(9);
        }

        // Zebra-Streifen
        if (index % 2 === 0) {
          doc.rect(col1X - 5, currentY - 5, 490, rowHeight - 2)
             .fill('#f5f5f5');
          doc.fillColor('#000000');
        }

        // Name
        const name = `${mitglied.nachname}, ${mitglied.vorname}`;
        doc.text(name, col1X, currentY, { width: 140, continued: false });

        // Geburtsdatum
        const geburtsdatum = mitglied.geburtsdatum
          ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE')
          : '-';
        doc.text(geburtsdatum, col2X, currentY, { width: 90, continued: false });

        // Stil
        const stil = mitglied.stile || 'Kein Stil';
        doc.text(stil, col3X, currentY, { width: 70, continued: false });

        // Vertrag
        const vertrag = mitglied.tarif_name || 'Kein Vertrag';
        doc.text(vertrag, col4X, currentY, { width: 150, continued: false });

        currentY += rowHeight;
      });

      // Footer auf letzter Seite hinzufügen
      const totalPages = currentPageNum;
      doc.fontSize(8)
         .fillColor('#666666')
         .text(`Seite ${currentPageNum} von ${totalPages}`, 50, doc.page.height - 50, {
           align: 'center',
           width: doc.page.width - 100,
           lineBreak: false
         });

      // PDF abschließen
      doc.end();
    });
  } catch (error) {
    console.error("❌ Fehler beim Erstellen der PDF:", error);
    res.status(500).json({ error: "Fehler beim Erstellen der PDF" });
  }
});

// ✅ API: Einzelnes Mitglied VOLLPROFIL abrufen - KORRIGIERT + DOJO-FILTER
router.get("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {

        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = ['m.mitglied_id = ?'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            -- Stammdaten
            m.mitglied_id,
            m.vorname,
            m.nachname,
            m.geburtsdatum,
            m.geschlecht,
            m.gewicht,
            m.gurtfarbe,
            m.dojo_id,

            -- Kontaktdaten
            m.email,
            m.telefon,
            m.telefon_mobil,
            m.strasse,
            m.hausnummer,
            m.plz,
            m.ort,

            -- Zahlungsdaten
            m.iban,
            m.bic,
            m.bankname,
            m.zahlungsmethode,
            m.zahllaufgruppe,

            -- Status
            m.eintrittsdatum,
            m.gekuendigt_am,
            m.aktiv,

            -- 🆕 Medizinische Informationen
            m.allergien,
            m.medizinische_hinweise,
            m.notfallkontakt_name,
            m.notfallkontakt_telefon,
            m.notfallkontakt_verhaeltnis,

            -- 🆕 Prüfungsmanagement
            m.naechste_pruefung_datum,
            m.pruefungsgebuehr_bezahlt,
            m.trainer_empfehlung,

            -- 🆕 Dokumente/Compliance
            m.hausordnung_akzeptiert,
            m.datenschutz_akzeptiert,
            m.foto_einverstaendnis,
            m.vereinsordnung_datum,

            -- 🆕 Familienmanagement
            m.familien_id,
            m.rabatt_prozent,
            m.rabatt_grund,

            -- Stile
            COALESCE(GROUP_CONCAT(DISTINCT ms.stil ORDER BY ms.stil SEPARATOR ', '), '') AS stile
        FROM mitglieder m
        LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
        ${whereClause}
        GROUP BY m.mitglied_id
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen des Vollprofils:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Mitgliedsdaten" });
        }

        if (!result || result.length === 0) {

            return res.status(404).json({ error: `Mitglied mit ID ${id} nicht gefunden oder keine Berechtigung.` });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Medizinische Informationen abrufen + DOJO-FILTER
router.get("/:id/medizinisch", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            allergien,
            medizinische_hinweise,
            notfallkontakt_name,
            notfallkontakt_telefon,
            notfallkontakt_verhaeltnis
        FROM mitglieder
        ${whereClause}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen medizinischer Daten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen medizinischer Daten" });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Prüfungsstatus abrufen + DOJO-FILTER
router.get("/:id/pruefung", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            gurtfarbe,
            naechste_pruefung_datum,
            pruefungsgebuehr_bezahlt,
            trainer_empfehlung,
            eintrittsdatum
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen der Prüfungsdaten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Prüfungsdaten" });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Compliance-Status abrufen + DOJO-FILTER
router.get("/:id/compliance", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // 🔒 DOJO-FILTER
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            hausordnung_akzeptiert,
            datenschutz_akzeptiert,
            foto_einverstaendnis,
            vereinsordnung_datum
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen der Compliance-Daten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Compliance-Daten" });
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json(result[0]);
    });
});

// 🆕 API: Medizinische Daten aktualisieren + DOJO-FILTER (KRITISCH!)
router.put("/:id/medizinisch", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const {
        allergien,
        medizinische_hinweise,
        notfallkontakt_name,
        notfallkontakt_telefon,
        notfallkontakt_verhaeltnis
    } = req.body;

    // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [
        allergien || null,
        medizinische_hinweise || null,
        notfallkontakt_name || null,
        notfallkontakt_telefon || null,
        notfallkontakt_verhaeltnis || null,
        id
    ];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        UPDATE mitglieder
        SET
            allergien = ?,
            medizinische_hinweise = ?,
            notfallkontakt_name = ?,
            notfallkontakt_telefon = ?,
            notfallkontakt_verhaeltnis = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Update medizinischer Daten:", err);
            return res.status(500).json({ error: "Fehler beim Aktualisieren medizinischer Daten" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json({
            success: true,
            message: "Medizinische Daten erfolgreich aktualisiert",
            updated_fields: { allergien, medizinische_hinweise, notfallkontakt_name, notfallkontakt_telefon, notfallkontakt_verhaeltnis }
        });
    });
});

// 🆕 API: Prüfungsdaten aktualisieren + DOJO-FILTER (KRITISCH!)
router.put("/:id/pruefung", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const {
        naechste_pruefung_datum,
        pruefungsgebuehr_bezahlt,
        trainer_empfehlung
    } = req.body;

    // 🔒 KRITISCHER DOJO-FILTER
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [
        naechste_pruefung_datum || null,
        pruefungsgebuehr_bezahlt || false,
        trainer_empfehlung || null,
        id
    ];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        UPDATE mitglieder
        SET
            naechste_pruefung_datum = ?,
            pruefungsgebuehr_bezahlt = ?,
            trainer_empfehlung = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Update der Prüfungsdaten:", err);
            return res.status(500).json({ error: "Fehler beim Aktualisieren der Prüfungsdaten" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json({
            success: true,
            message: "Prüfungsdaten erfolgreich aktualisiert",
            updated_fields: { naechste_pruefung_datum, pruefungsgebuehr_bezahlt, trainer_empfehlung }
        });
    });
});

// 🆕 API: Compliance-Status aktualisieren + DOJO-FILTER (KRITISCH!)
router.put("/:id/compliance", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const {
        hausordnung_akzeptiert,
        datenschutz_akzeptiert,
        foto_einverstaendnis,
        vereinsordnung_datum
    } = req.body;

    // 🔒 KRITISCHER DOJO-FILTER
    let whereConditions = ['mitglied_id = ?'];
    let queryParams = [
        hausordnung_akzeptiert || false,
        datenschutz_akzeptiert || false,
        foto_einverstaendnis || false,
        vereinsordnung_datum || null,
        id
    ];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        UPDATE mitglieder
        SET
            hausordnung_akzeptiert = ?,
            datenschutz_akzeptiert = ?,
            foto_einverstaendnis = ?,
            vereinsordnung_datum = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Update des Compliance-Status:", err);
            return res.status(500).json({ error: "Fehler beim Aktualisieren des Compliance-Status" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Mitglied nicht gefunden oder keine Berechtigung" });
        }

        res.json({
            success: true,
            message: "Compliance-Status erfolgreich aktualisiert",
            updated_fields: { hausordnung_akzeptiert, datenschutz_akzeptiert, foto_einverstaendnis, vereinsordnung_datum }
        });
    });
});

// 🆕 API: Alle Mitglieder mit ausstehenden Dokumenten + DOJO-FILTER
router.get("/compliance/missing", (req, res) => {
    const { dojo_id } = req.query;

    // 🔒 DOJO-FILTER
    let whereConditions = [
        'aktiv = 1',
        '(hausordnung_akzeptiert = FALSE OR datenschutz_akzeptiert = FALSE OR foto_einverstaendnis = FALSE OR vereinsordnung_datum IS NULL)'
    ];
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            email,
            dojo_id,
            hausordnung_akzeptiert,
            datenschutz_akzeptiert,
            foto_einverstaendnis,
            vereinsordnung_datum,
            eintrittsdatum
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY eintrittsdatum DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen fehlender Compliance-Daten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen fehlender Compliance-Daten" });
        }

        res.json({
            success: true,
            count: results.length,
            missing_compliance: results
        });
    });
});

// 🆕 API: Prüfungskandidaten (nächste 30 Tage) + DOJO-FILTER
router.get("/pruefung/kandidaten", (req, res) => {
    const { dojo_id } = req.query;

    // 🔒 DOJO-FILTER
    let whereConditions = [
        'aktiv = 1',
        'naechste_pruefung_datum IS NOT NULL',
        'naechste_pruefung_datum <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)'
    ];
    let queryParams = [];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT
            mitglied_id,
            vorname,
            nachname,
            dojo_id,
            gurtfarbe,
            naechste_pruefung_datum,
            pruefungsgebuehr_bezahlt,
            trainer_empfehlung,
            eintrittsdatum,
            DATEDIFF(naechste_pruefung_datum, CURDATE()) as tage_bis_pruefung
        FROM mitglieder
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY naechste_pruefung_datum ASC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen der Prüfungskandidaten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Prüfungskandidaten" });
        }

        res.json({
            success: true,
            count: results.length,
            pruefungskandidaten: results
        });
    });
});

// ✅ NEU: PUT Allgemeine Mitgliederdaten Update (für Stil & Gurt) + DOJO-FILTER (KRITISCH!)
router.put("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { dojo_id } = req.query;

    if (isNaN(id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    const updateFields = req.body;

    // Dynamisch SQL Query bauen basierend auf den gesendeten Feldern
    const allowedFields = ['stil_id', 'gurtfarbe', 'letzte_pruefung', 'vorname', 'nachname', 'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer', 'plz', 'ort', 'gewicht', 'vertreter1_typ', 'vertreter1_name', 'vertreter1_telefon', 'vertreter1_email', 'vertreter2_typ', 'vertreter2_name', 'vertreter2_telefon', 'vertreter2_email'];
    const setClause = [];
    const values = [];

    Object.keys(updateFields).forEach(field => {
        if (allowedFields.includes(field)) {
            setClause.push(`${field} = ?`);
            values.push(updateFields[field]);
        }
    });

    if (setClause.length === 0) {
        return res.status(400).json({ error: "Keine gültigen Felder zum Update gefunden" });
    }

    // 🔒 KRITISCHER DOJO-FILTER: Baue WHERE-Clause
    let whereConditions = ['mitglied_id = ?'];
    values.push(id);

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('dojo_id = ?');
        values.push(parseInt(dojo_id));
    }

    const query = `
        UPDATE mitglieder
        SET ${setClause.join(', ')}
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, values, (error, results) => {
        if (error) {
            console.error('❌ Datenbankfehler beim Update:', error);
            return res.status(500).json({
                error: 'Datenbankfehler beim Aktualisieren',
                details: error.message
            });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Mitglied nicht gefunden oder keine Berechtigung' });
        }

        res.json({
            success: true,
            message: 'Mitglied erfolgreich aktualisiert',
            updated_fields: updateFields
        });
    });
});

// 🆕 API: Mitglied-Stile verwalten (Multiple Stile pro Person)
router.post("/:id/stile", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const { stile } = req.body; // Array von Stil-IDs
    
    if (isNaN(mitglied_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    if (!Array.isArray(stile)) {
        return res.status(400).json({ error: "Stile müssen als Array übergeben werden" });
    }

    // Vereinfache ohne Transaction für jetzt

    // Zuerst alle bestehenden Stile für dieses Mitglied löschen (beide Tabellen)
    const deleteMitgliedStileQuery = "DELETE FROM mitglied_stile WHERE mitglied_id = ?";
    const deleteMitgliedStilDataQuery = "DELETE FROM mitglied_stil_data WHERE mitglied_id = ?";

    // Lösche aus mitglied_stile
    db.query(deleteMitgliedStileQuery, [mitglied_id], (deleteErr) => {
        if (deleteErr) {
            console.error("❌ Fehler beim Löschen bestehender Stile:", deleteErr);
            return res.status(500).json({ error: "Fehler beim Löschen bestehender Stile" });
        }

        // Lösche auch aus mitglied_stil_data
        db.query(deleteMitgliedStilDataQuery, [mitglied_id], (deleteDataErr) => {
            if (deleteDataErr) {
                console.error("❌ Fehler beim Löschen von mitglied_stil_data:", deleteDataErr);
                // Nicht abbrechen, da mitglied_stile bereits gelöscht wurde
            }

            // Wenn keine neuen Stile hinzugefügt werden sollen
            if (stile.length === 0) {
                return res.json({ success: true, message: "Stile erfolgreich aktualisiert", stile: [] });
            }

            // Zuordnung von Stil-IDs zu ENUM-Werten (basiert auf tatsächlichen DB-Daten)
            const stilMapping = {
                2: 'ShieldX',      // ShieldX
                3: 'BJJ',          // BJJ
                4: 'Kickboxen',    // Kickboxen
                5: 'Karate',       // Enso Karate → wird als 'Karate' in ENUM gespeichert
                7: 'Taekwon-Do',   // Taekwon-Do
                8: 'BJJ'           // Brazilian Jiu-Jitsu → auch als BJJ
            };

            // Filter ungültige Stil-IDs und konvertiere zu ENUM-Werten
            const validValues = stile
                .filter(stil_id => stilMapping[stil_id]) // Nur bekannte IDs
                .map(stil_id => [mitglied_id, stilMapping[stil_id]]);

            if (validValues.length === 0) {
                return res.json({ success: true, message: "Keine gültigen Stile zum Hinzufügen", stile: [] });
            }

            const insertQuery = "INSERT INTO mitglied_stile (mitglied_id, stil) VALUES ?";
            const insertValues = validValues;

            db.query(insertQuery, [insertValues], (insertErr) => {
                if (insertErr) {
                    console.error("❌ Fehler beim Hinzufügen neuer Stile:", insertErr);
                    return res.status(500).json({ error: "Fehler beim Hinzufügen neuer Stile" });
                }

                // WICHTIG: Auch Einträge in mitglied_stil_data erstellen für Statistiken
                // Erstelle für jeden Stil einen Eintrag (falls noch nicht vorhanden)
                const stilDataPromises = stile.map(stil_id => {
                    return new Promise((resolve, reject) => {
                        // Prüfe ob bereits vorhanden
                        const checkQuery = 'SELECT id FROM mitglied_stil_data WHERE mitglied_id = ? AND stil_id = ?';
                        db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResults) => {
                            if (checkErr) {
                                console.error('Fehler beim Prüfen mitglied_stil_data:', checkErr);
                                return reject(checkErr);
                            }

                            if (checkResults.length > 0) {
                                // Bereits vorhanden
                                return resolve();
                            }

                            // Hole die erste Graduierung für diesen Stil (niedrigste reihenfolge)
                            const getFirstGraduierungQuery = `
                                SELECT graduierung_id
                                FROM graduierungen
                                WHERE stil_id = ? AND aktiv = 1
                                ORDER BY reihenfolge ASC
                                LIMIT 1
                            `;
                            db.query(getFirstGraduierungQuery, [stil_id], (gradErr, gradResults) => {
                                if (gradErr) {
                                    console.error('Fehler beim Abrufen der ersten Graduierung:', gradErr);
                                    return reject(gradErr);
                                }

                                const firstGraduierungId = gradResults.length > 0 ? gradResults[0].graduierung_id : null;

                                // Neu erstellen mit erster Graduierung
                                const insertDataQuery = `
                                    INSERT INTO mitglied_stil_data
                                    (mitglied_id, stil_id, current_graduierung_id, erstellt_am)
                                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                                `;
                                db.query(insertDataQuery, [mitglied_id, stil_id, firstGraduierungId], (insertDataErr) => {
                                    if (insertDataErr) {
                                        console.error('Fehler beim Erstellen mitglied_stil_data:', insertDataErr);
                                        return reject(insertDataErr);
                                    }
                                    console.log(`✅ mitglied_stil_data erstellt für Mitglied ${mitglied_id}, Stil ${stil_id}, Graduierung ${firstGraduierungId}`);
                                    resolve();
                                });
                            });
                        });
                    });
                });

                // Warte auf alle Inserts
                Promise.all(stilDataPromises)
                    .then(() => {
                        res.json({
                            success: true,
                            message: "Stile erfolgreich aktualisiert",
                            mitglied_id: mitglied_id,
                            stile: stile
                        });
                    })
                    .catch(err => {
                        console.error('Fehler beim Aktualisieren mitglied_stil_data:', err);
                        // Trotzdem Success zurückgeben, da mitglied_stile erfolgreich war
                        res.json({
                            success: true,
                            message: "Stile aktualisiert, aber Warnung bei Stil-Daten",
                            mitglied_id: mitglied_id,
                            stile: stile
                        });
                    });
            });
        });
    });
});

// 🆕 API: Mitglied-Stile abrufen
router.get("/:id/stile", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    
    if (isNaN(mitglied_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
    }

    // Zuordnung von ENUM-Werten zu Stil-IDs und Namen (basiert auf tatsächlichen DB-Daten)
    const stilMapping = {
        'ShieldX': { stil_id: 2, stil_name: 'ShieldX', beschreibung: 'Moderne Selbstverteidigung mit realistischen Szenarien' },
        'BJJ': { stil_id: 3, stil_name: 'BJJ', beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken' },
        'Brazilian Jiu Jitsu': { stil_id: 3, stil_name: 'Brazilian Jiu Jitsu', beschreibung: 'Brazilian Jiu-Jitsu - Bodenkampf und Grappling-Techniken' },
        'Kickboxen': { stil_id: 4, stil_name: 'Kickboxen', beschreibung: 'Moderne Kampfsportart kombiniert Boxing mit Fußtechniken' },
        'Karate': { stil_id: 5, stil_name: 'Enso Karate', beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken' },
        'Enso Karate': { stil_id: 5, stil_name: 'Enso Karate', beschreibung: 'Traditionelle japanische Kampfkunst mit Fokus auf Schlag- und Tritttechniken' },
        'Taekwon-Do': { stil_id: 7, stil_name: 'Taekwon-Do', beschreibung: 'Koreanische Kampfkunst mit Betonung auf Fußtechniken und hohe Tritte' }
    };

    const query = `
        SELECT ms.stil
        FROM mitglied_stile ms
        WHERE ms.mitglied_id = ?
        ORDER BY ms.stil
    `;

    db.query(query, [mitglied_id], (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen der Mitglied-Stile:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Stile" });
        }

        // Transformiere die ENUM-Werte zurück zu den erwarteten Objekten
        const transformedResults = results.map(row => {
            const stilInfo = stilMapping[row.stil];
            if (!stilInfo) {
                console.warn(`⚠️ Stil '${row.stil}' nicht im Mapping gefunden`);
                return null;
            }
            return {
                stil_id: stilInfo.stil_id,
                stil_name: stilInfo.stil_name,
                beschreibung: stilInfo.beschreibung
            };
        }).filter(Boolean);

        res.json({
            success: true,
            mitglied_id: mitglied_id,
            stile: transformedResults
        });
    });
});

// 🆕 API: Stilspezifische Daten für ein Mitglied verwalten (Graduierung, letzte Prüfung, etc.)
router.post("/:id/stil/:stil_id/data", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    const { current_graduierung_id, letzte_pruefung, naechste_pruefung, anmerkungen } = req.body;
    
    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds- oder Stil-ID" });
    }

    // Erst prüfen, ob bereits ein Eintrag existiert
    const checkQuery = `
        SELECT id FROM mitglied_stil_data 
        WHERE mitglied_id = ? AND stil_id = ?
    `;
    
    db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResult) => {
        if (checkErr) {
            console.error("❌ Fehler beim Prüfen vorhandener Daten:", checkErr);
            return res.status(500).json({ error: "Datenbankfehler beim Prüfen" });
        }

        let query, params;
        if (checkResult.length > 0) {
            // UPDATE existierende Daten
            query = `
                UPDATE mitglied_stil_data 
                SET current_graduierung_id = ?, letzte_pruefung = ?, naechste_pruefung = ?, anmerkungen = ?, 
                    aktualisiert_am = CURRENT_TIMESTAMP
                WHERE mitglied_id = ? AND stil_id = ?
            `;
            params = [current_graduierung_id || null, letzte_pruefung || null, naechste_pruefung || null, anmerkungen || null, mitglied_id, stil_id];
        } else {
            // INSERT neue Daten
            query = `
                INSERT INTO mitglied_stil_data 
                (mitglied_id, stil_id, current_graduierung_id, letzte_pruefung, naechste_pruefung, anmerkungen, erstellt_am)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            params = [mitglied_id, stil_id, current_graduierung_id || null, letzte_pruefung || null, naechste_pruefung || null, anmerkungen || null];
        }

        db.query(query, params, (err) => {
            if (err) {
                console.error("❌ Fehler beim Speichern stilspezifischer Daten:", err);
                return res.status(500).json({ error: "Fehler beim Speichern" });
            }

            res.json({ 
                success: true, 
                message: "Stilspezifische Daten erfolgreich gespeichert",
                mitglied_id,
                stil_id
            });
        });
    });
});

// 🆕 API: Stilspezifische Daten für ein Mitglied abrufen
router.get("/:id/stil/:stil_id/data", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    
    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds- oder Stil-ID" });
    }

    const query = `
        SELECT 
            msd.*,
            g.name as graduierung_name,
            g.farbe_hex,
            g.farbe_sekundaer,
            g.trainingsstunden_min,
            g.mindestzeit_monate,
            g.reihenfolge
        FROM mitglied_stil_data msd
        LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
        WHERE msd.mitglied_id = ? AND msd.stil_id = ?
    `;

    db.query(query, [mitglied_id, stil_id], (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen stilspezifischer Daten:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
        }

        // Prüfe automatisch ob es einen kommenden Prüfungstermin für diesen Stil gibt
        const pruefungsterminQuery = `
            SELECT pruefungsdatum
            FROM pruefungstermin_vorlagen
            WHERE stil_id = ?
            AND pruefungsdatum >= CURDATE()
            ORDER BY pruefungsdatum ASC
            LIMIT 1
        `;

        db.query(pruefungsterminQuery, [stil_id], (pruefErr, pruefResults) => {
            if (pruefErr) {
                console.error("⚠️ Fehler beim Abrufen des Prüfungstermins:", pruefErr);
                // Fahre trotzdem fort, gebe nur stilData zurück
            }

            let stilData = results.length > 0 ? results[0] : {
                mitglied_id,
                stil_id,
                current_graduierung_id: null,
                letzte_pruefung: null,
                naechste_pruefung: null,
                anmerkungen: null
            };

            // Wenn Prüfungstermin gefunden und neuer/aktueller als gespeicherte naechste_pruefung
            if (pruefResults && pruefResults.length > 0) {
                const kommenderTermin = pruefResults[0].pruefungsdatum;

                if (!stilData.naechste_pruefung || new Date(kommenderTermin) > new Date(stilData.naechste_pruefung)) {
                    stilData.naechste_pruefung = kommenderTermin;
                    stilData.auto_gefuellt = true; // Markierung dass automatisch gefüllt

                    console.log(`✅ Auto-Befüllung: Nächster Prüfungstermin für Stil ${stil_id}: ${kommenderTermin}`);
                }
            }

            res.json({
                success: true,
                data: stilData
            });
        });
    });
});

// 🆕 API: Trainingsstunden-Analyse für ein Mitglied und Stil
router.get("/:id/stil/:stil_id/training-analysis", (req, res) => {
    const mitglied_id = parseInt(req.params.id, 10);
    const stil_id = parseInt(req.params.stil_id, 10);
    
    if (isNaN(mitglied_id) || isNaN(stil_id)) {
        return res.status(400).json({ error: "Ungültige Mitglieds- oder Stil-ID" });
    }

    // Multi-Query für komplexe Analyse
    const queries = {
        // 1. Aktuelle Graduierung und letzte Prüfung
        currentData: `
            SELECT 
                msd.current_graduierung_id,
                msd.letzte_pruefung,
                g.name as graduierung_name,
                g.trainingsstunden_min,
                g.mindestzeit_monate,
                g.reihenfolge
            FROM mitglied_stil_data msd
            LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
            WHERE msd.mitglied_id = ? AND msd.stil_id = ?
        `,
        
        // 2. Nächste Graduierung
        nextGraduation: `
            SELECT 
                g.graduierung_id,
                g.name,
                g.trainingsstunden_min,
                g.mindestzeit_monate,
                g.reihenfolge
            FROM graduierungen g
            WHERE g.stil_id = ? AND g.reihenfolge = (
                SELECT MIN(g2.reihenfolge) 
                FROM graduierungen g2 
                JOIN mitglied_stil_data msd ON msd.current_graduierung_id IS NOT NULL
                WHERE g2.stil_id = ? AND g2.reihenfolge > (
                    SELECT g3.reihenfolge 
                    FROM graduierungen g3 
                    WHERE g3.graduierung_id = msd.current_graduierung_id 
                    AND msd.mitglied_id = ?
                )
            )
        `,
        
        // 3. Anwesenheiten seit letzter Prüfung
        attendanceCount: `
            SELECT COUNT(*) as training_sessions
            FROM anwesenheit a
            WHERE a.mitglied_id = ? 
            AND a.anwesend = 1
            AND a.datum >= COALESCE(
                (SELECT msd.letzte_pruefung FROM mitglied_stil_data msd 
                 WHERE msd.mitglied_id = ? AND msd.stil_id = ?), 
                '2020-01-01'
            )
        `
    };

    // Führe alle Queries aus
    Promise.all([
        new Promise((resolve, reject) => {
            db.query(queries.currentData, [mitglied_id, stil_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0] || null);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(queries.nextGraduation, [stil_id, stil_id, mitglied_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0] || null);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(queries.attendanceCount, [mitglied_id, mitglied_id, stil_id], (err, results) => {
                if (err) reject(err);
                else resolve(results[0].training_sessions || 0);
            });
        })
    ])
    .then(([currentData, nextGraduation, trainingSessions]) => {
        const analysis = {
            current_graduation: currentData,
            next_graduation: nextGraduation,
            training_sessions_completed: trainingSessions,
            training_sessions_required: nextGraduation?.trainingsstunden_min || 0,
            training_sessions_remaining: Math.max(0, (nextGraduation?.trainingsstunden_min || 0) - trainingSessions),
            is_ready_for_exam: nextGraduation ? trainingSessions >= nextGraduation.trainingsstunden_min : false,
            last_exam_date: currentData?.letzte_pruefung || null
        };

        res.json({
            success: true,
            analysis
        });
    })
    .catch(err => {
        console.error("❌ Fehler bei der Trainingsstunden-Analyse:", err);
        res.status(500).json({ error: "Fehler bei der Analyse" });
    });
});

// ✅ SEPA-Mandat abrufen + DOJO-FILTER (KRITISCH - Bankdaten!)
router.get("/:id/sepa-mandate", (req, res) => {
    const { id } = req.params;
    const { dojo_id } = req.query;

    // 🔒 KRITISCHER DOJO-FILTER: SEPA-Mandate nur für berechtigte Dojos!
    let whereConditions = ['sm.mitglied_id = ?', 'sm.status = \'aktiv\''];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT sm.*
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sm.erstellungsdatum DESC
        LIMIT 1
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen des SEPA-Mandats:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen des SEPA-Mandats" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "Kein aktives SEPA-Mandat gefunden oder keine Berechtigung" });
        }

        res.json(results[0]);
    });
});

// ✅ SEPA-Mandat erstellen + DOJO-FILTER (KRITISCH - Bankdaten!)
router.post("/:id/sepa-mandate", (req, res) => {
    const { id } = req.params;
    const { dojo_id } = req.query;
    const { iban, bic, kontoinhaber, bankname } = req.body;

    // Validierung
    if (!iban || !bic || !kontoinhaber) {
        return res.status(400).json({ error: "IBAN, BIC und Kontoinhaber sind erforderlich" });
    }

    // 🔒 KRITISCH: Zuerst prüfen ob Mitglied zum richtigen Dojo gehört!
    let checkConditions = ['mitglied_id = ?'];
    let checkParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        checkConditions.push('dojo_id = ?');
        checkParams.push(parseInt(dojo_id));
    }

    const checkQuery = `SELECT mitglied_id, dojo_id FROM mitglieder WHERE ${checkConditions.join(' AND ')}`;

    db.query(checkQuery, checkParams, (checkErr, checkResults) => {
        if (checkErr) {
            console.error("❌ Fehler bei Berechtigungsprüfung:", checkErr);
            return res.status(500).json({ error: "Fehler bei Berechtigungsprüfung" });
        }

        if (checkResults.length === 0) {
            console.error(`❌ SICHERHEITSVERLETZUNG: Versuch SEPA-Mandat für fremdes Mitglied ${id} zu erstellen!`);
            return res.status(403).json({ error: "Keine Berechtigung - Mitglied gehört nicht zum ausgewählten Dojo" });
        }

        const memberDojoId = checkResults[0].dojo_id;

        // Erst Gläubiger-ID aus dem RICHTIGEN Dojo-Einstellungen abrufen
        const dojoQuery = `SELECT id, sepa_glaeubiger_id FROM dojo WHERE id = ? LIMIT 1`;

        db.query(dojoQuery, [memberDojoId], (dojoErr, dojoResults) => {
            if (dojoErr) {
                console.error("❌ Fehler beim Abrufen der Dojo-Einstellungen:", dojoErr);
                return res.status(500).json({ error: "Fehler beim Abrufen der Dojo-Einstellungen" });
            }

            // Gläubiger-ID aus DB oder Fallback
            const glaeubiger_id = (dojoResults.length > 0 && dojoResults[0].sepa_glaeubiger_id)
                ? dojoResults[0].sepa_glaeubiger_id
                : "DE98ZZZ09999999999"; // Fallback

            // Generiere eindeutige Mandatsreferenz
            const timestamp = Date.now();
            const mandatsreferenz = `DOJO${memberDojoId}-${id}-${timestamp}`;

            const query = `
                INSERT INTO sepa_mandate (
                    mitglied_id, mandatsreferenz, glaeubiger_id,
                    iban, bic, kontoinhaber, bankname
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(query, [id, mandatsreferenz, glaeubiger_id, iban, bic, kontoinhaber, bankname], (err, result) => {
                if (err) {
                    console.error("❌ Fehler beim Erstellen des SEPA-Mandats:", err);
                    return res.status(500).json({ error: "Fehler beim Erstellen des SEPA-Mandats" });
                }

                // Mandate-Details für Response
                const newMandate = {
                    mandat_id: result.insertId,
                    mitglied_id: id,
                    dojo_id: memberDojoId,
                    mandatsreferenz,
                    glaeubiger_id,
                    erstellungsdatum: new Date(),
                    status: 'aktiv',
                    iban,
                    bic,
                    kontoinhaber,
                    bankname
                };

                // Aktualisiere auch die Bankdaten im Mitglieder-Datensatz (nur für dieses Dojo!)
                const updateMemberQuery = `
                    UPDATE mitglieder
                    SET iban = ?, bic = ?, kontoinhaber = ?, bankname = ?, zahlungsmethode = 'SEPA-Lastschrift'
                    WHERE mitglied_id = ? AND dojo_id = ?
                `;

                db.query(updateMemberQuery, [iban, bic, kontoinhaber, bankname, id, memberDojoId], (updateErr) => {
                    if (updateErr) {

                    }
                });

                res.status(201).json(newMandate);
            });
        });
    });
});

// ✅ SEPA-Mandat widerrufen + DOJO-FILTER (KRITISCH!)
router.delete("/:id/sepa-mandate", (req, res) => {
    const { id } = req.params;
    const { dojo_id } = req.query;
    const { grund } = req.body; // Optional: Grund für Archivierung

    // 🔒 KRITISCHER DOJO-FILTER: Nur Mandate des eigenen Dojos widerrufen!
    let whereConditions = ['sm.mitglied_id = ?', 'sm.status = \'aktiv\''];
    let queryParams = [grund || 'Widerrufen durch Benutzer', id];

    let joinClause = '';
    if (dojo_id && dojo_id !== 'all') {
        joinClause = 'JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id';
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        UPDATE sepa_mandate sm
        ${joinClause}
        SET sm.status = 'widerrufen',
            sm.widerruf_datum = NOW(),
            sm.archiviert = 1,
            sm.archiviert_am = NOW(),
            sm.archiviert_grund = ?
        WHERE ${whereConditions.join(' AND ')}
    `;

    db.query(query, queryParams, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Archivieren des SEPA-Mandats:", err);
            return res.status(500).json({ error: "Fehler beim Archivieren des SEPA-Mandats" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Kein aktives SEPA-Mandat gefunden oder keine Berechtigung" });
        }

        res.json({ success: true, message: "SEPA-Mandat wurde archiviert" });
    });
});

// ✅ Archivierte SEPA-Mandate abrufen + DOJO-FILTER (KRITISCH!)
router.get("/:id/sepa-mandate/archiv", (req, res) => {
    const { id } = req.params;
    const { dojo_id } = req.query;

    // 🔒 KRITISCHER DOJO-FILTER: Nur archivierte Mandate des eigenen Dojos!
    let whereConditions = ['sm.mitglied_id = ?', '(sm.archiviert = 1 OR sm.status = \'widerrufen\')'];
    let queryParams = [id];

    if (dojo_id && dojo_id !== 'all') {
        whereConditions.push('m.dojo_id = ?');
        queryParams.push(parseInt(dojo_id));
    }

    const query = `
        SELECT sm.*, m.vorname, m.nachname, m.email, m.dojo_id
        FROM sepa_mandate sm
        JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY COALESCE(sm.archiviert_am, sm.widerruf_datum) DESC
    `;

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error("❌ Fehler beim Abrufen archivierter SEPA-Mandate:", err);
            return res.status(500).json({ error: "Fehler beim Abrufen archivierter Mandate" });
        }

        res.json(results);
    });
});

// ✅ SEPA-Mandat als PDF herunterladen + DOJO-FILTER (KRITISCH!)
router.get("/:id/sepa-mandate/download", async (req, res) => {
    const { id } = req.params;
    const { mandate_id, dojo_id } = req.query;

    try {
        let query;
        let queryParams;

        // 🔒 KRITISCHER DOJO-FILTER: Richtiges Dojo-JOIN statt CROSS JOIN!
        let whereConditions = [];

        if (mandate_id) {
            // Download eines spezifischen archivierten Mandats
            whereConditions = ['sm.mandat_id = ?', 'sm.mitglied_id = ?'];
            queryParams = [mandate_id, id];

            if (dojo_id && dojo_id !== 'all') {
                whereConditions.push('m.dojo_id = ?');
                queryParams.push(parseInt(dojo_id));
            }

            query = `
                SELECT sm.*, m.vorname, m.nachname, m.strasse, m.hausnummer, m.plz, m.ort, m.dojo_id,
                       d.dojoname, d.inhaber, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
                       d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                JOIN dojo d ON m.dojo_id = d.id
                WHERE ${whereConditions.join(' AND ')}
            `;
        } else {
            // Download des aktuellen aktiven Mandats
            whereConditions = ['sm.mitglied_id = ?', 'sm.status = \'aktiv\''];
            queryParams = [id];

            if (dojo_id && dojo_id !== 'all') {
                whereConditions.push('m.dojo_id = ?');
                queryParams.push(parseInt(dojo_id));
            }

            query = `
                SELECT sm.*, m.vorname, m.nachname, m.strasse, m.hausnummer, m.plz, m.ort, m.dojo_id,
                       d.dojoname, d.inhaber, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
                       d.plz as dojo_plz, d.ort as dojo_ort, d.sepa_glaeubiger_id
                FROM sepa_mandate sm
                JOIN mitglieder m ON sm.mitglied_id = m.mitglied_id
                JOIN dojo d ON m.dojo_id = d.id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY sm.erstellungsdatum DESC
                LIMIT 1
            `;
        }

        db.query(query, queryParams, async (err, results) => {
            if (err) {
                console.error("❌ Fehler beim Abrufen der Mandate-Daten:", err);
                return res.status(500).json({ error: "Fehler beim Generieren des PDFs" });
            }

            if (results.length === 0) {
                return res.status(404).json({ error: "Kein aktives SEPA-Mandat gefunden" });
            }

            const mandate = results[0];
            
            try {
                // PDF generieren
                const pdfGenerator = new SepaPdfGenerator();
                const pdfBuffer = await pdfGenerator.generateSepaMandatePDF(mandate);
                
                // HTTP-Headers für PDF-Download setzen
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="SEPA-Mandat_${mandate.nachname}_${mandate.vorname}.pdf"`);
                res.setHeader('Content-Length', pdfBuffer.length);
                
                // PDF-Buffer senden
                res.send(pdfBuffer);

            } catch (pdfError) {
                console.error("❌ Fehler bei der PDF-Generierung:", pdfError);
                res.status(500).json({ error: "Fehler bei der PDF-Generierung" });
            }
        });
        
    } catch (error) {
        console.error("❌ Allgemeiner Fehler beim PDF-Download:", error);
        res.status(500).json({ error: "Fehler beim PDF-Download" });
    }
});

// 🆕 API: Duplikatsprüfung für neue Mitglieder
router.post("/check-duplicate", (req, res) => {
    const { vorname, nachname, geburtsdatum, geschlecht } = req.body;

    if (!vorname || !nachname || !geburtsdatum) {
        return res.status(400).json({ error: "Vorname, Nachname und Geburtsdatum sind erforderlich" });
    }

    const query = `
        SELECT 
            mitglied_id,
            vorname,
            nachname,
            geburtsdatum,
            geschlecht,
            email,
            aktiv,
            eintrittsdatum
        FROM mitglieder 
        WHERE LOWER(vorname) = LOWER(?) 
        AND LOWER(nachname) = LOWER(?) 
        AND geburtsdatum = ?
        ${geschlecht ? 'AND geschlecht = ?' : ''}
        ORDER BY eintrittsdatum DESC
    `;

    const params = geschlecht ? [vorname, nachname, geburtsdatum, geschlecht] : [vorname, nachname, geburtsdatum];

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("❌ Fehler bei der Duplikatsprüfung:", err);
            return res.status(500).json({ error: "Fehler bei der Duplikatsprüfung" });
        }

        const isDuplicate = results.length > 0;

        res.json({
            isDuplicate,
            matches: results,
            count: results.length,
            message: isDuplicate ? 
                `Gefunden: ${results[0].vorname} ${results[0].nachname} (${results[0].geburtsdatum})` : 
                "Kein Duplikat gefunden"
        });
    });
});

// 🆕 API: Neues Mitglied erstellen (erweitert) + DOJO-ID PFLICHTFELD! (KRITISCH!)
router.post("/", (req, res) => {

    const memberData = req.body;

    // 🔄 DOKUMENTAKZEPTANZEN: Kopiere Daten vom Vertrag auch in mitglieder-Tabelle (für Auswertungen!)
    // Frontend sendet: vertrag_agb_akzeptiert, Backend braucht: agb_akzeptiert + agb_akzeptiert_am
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19); // MySQL-Format

    if (memberData.vertrag_agb_akzeptiert) {
        memberData.agb_akzeptiert = true;
        memberData.agb_akzeptiert_am = now;
    }
    if (memberData.vertrag_datenschutz_akzeptiert) {
        memberData.datenschutz_akzeptiert = true;
        memberData.datenschutz_akzeptiert_am = now;
    }
    if (memberData.vertrag_hausordnung_akzeptiert) {
        memberData.hausordnung_akzeptiert = true;
        memberData.hausordnung_akzeptiert_am = now;
    }
    if (memberData.vertrag_haftungsausschluss_akzeptiert) {
        memberData.haftungsausschluss_akzeptiert = true;
        memberData.haftungsausschluss_datum = now;
    }
    if (memberData.vertrag_gesundheitserklaerung) {
        memberData.gesundheitserklaerung = true;
        memberData.gesundheitserklaerung_datum = now;
    }
    if (memberData.vertrag_foto_einverstaendnis) {
        memberData.foto_einverstaendnis = true;
        memberData.foto_einverstaendnis_datum = now;
    }

    // 🔒 KRITISCH: dojo_id ist PFLICHTFELD für Tax Compliance!
    if (!memberData.dojo_id) {
        console.error("❌ KRITISCHER FEHLER: Neues Mitglied ohne dojo_id!");
        return res.status(400).json({
            error: "dojo_id ist erforderlich - jedes Mitglied MUSS einem Dojo zugeordnet sein (Tax Compliance!)",
            required: ['vorname', 'nachname', 'geburtsdatum', 'dojo_id']
        });
    }

    // Erforderliche Felder prüfen
    const requiredFields = ['vorname', 'nachname', 'geburtsdatum', 'dojo_id'];
    const missingFields = requiredFields.filter(field => !memberData[field]);

    if (missingFields.length > 0) {
        return res.status(400).json({
            error: "Fehlende erforderliche Felder",
            missingFields
        });
    }

    // SQL Query für INSERT mit allen möglichen Feldern (inkl. dojo_id!)
    const fields = [
        'dojo_id',  // 🔒 KRITISCH: dojo_id MUSS als erstes kommen!
        'vorname', 'nachname', 'geburtsdatum', 'geschlecht', 'schueler_student', 'gewicht',
        'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer',
        'plz', 'ort', 'iban', 'bic', 'bankname', 'kontoinhaber',
        'allergien', 'medizinische_hinweise', 'notfallkontakt_name',
        'notfallkontakt_telefon', 'notfallkontakt_verhaeltnis',
        'hausordnung_akzeptiert', 'hausordnung_akzeptiert_am',
        'datenschutz_akzeptiert', 'datenschutz_akzeptiert_am',
        'foto_einverstaendnis', 'foto_einverstaendnis_datum',
        'agb_akzeptiert', 'agb_akzeptiert_am',
        'haftungsausschluss_akzeptiert', 'haftungsausschluss_datum',
        'gesundheitserklaerung', 'gesundheitserklaerung_datum',
        'eintrittsdatum'
    ];

    const insertFields = fields.filter(field => memberData[field] !== undefined);
    const placeholders = insertFields.map(() => '?').join(', ');
    const values = insertFields.map(field => memberData[field]);

    const query = `
        INSERT INTO mitglieder (${insertFields.join(', ')})
        VALUES (${placeholders})
    `;

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("❌ Fehler beim Erstellen des Mitglieds:", err);
            return res.status(500).json({
                error: "Fehler beim Erstellen des Mitglieds",
                details: err.message
            });
        }

        const newMemberId = result.insertId;

        // 🆕 VERTRAG AUTOMATISCH ERSTELLEN (wenn Vertragsdaten vorhanden)
        if (memberData.vertrag_tarif_id) {

            const vertragData = {
                mitglied_id: newMemberId,
                dojo_id: memberData.dojo_id,  // 🔒 KRITISCH: Tax Compliance!
                tarif_id: memberData.vertrag_tarif_id,
                kuendigungsfrist_monate: memberData.vertrag_kuendigungsfrist_monate || 3,
                mindestlaufzeit_monate: memberData.vertrag_mindestlaufzeit_monate || 12,
                automatische_verlaengerung: memberData.vertrag_automatische_verlaengerung !== undefined ? memberData.vertrag_automatische_verlaengerung : true,
                verlaengerung_monate: memberData.vertrag_verlaengerung_monate || 12,
                faelligkeit_tag: memberData.vertrag_faelligkeit_tag || 1,
                agb_akzeptiert_am: memberData.vertrag_agb_akzeptiert ? new Date() : null,
                agb_version: memberData.vertrag_agb_version || '1.0',
                datenschutz_akzeptiert_am: memberData.vertrag_datenschutz_akzeptiert ? new Date() : null,
                datenschutz_version: memberData.vertrag_datenschutz_version || '1.0',
                hausordnung_akzeptiert_am: memberData.vertrag_hausordnung_akzeptiert ? new Date() : null,
                haftungsausschluss_akzeptiert: memberData.vertrag_haftungsausschluss_akzeptiert ? 1 : 0,
                haftungsausschluss_datum: memberData.vertrag_haftungsausschluss_akzeptiert ? new Date() : null,
                gesundheitserklaerung: memberData.vertrag_gesundheitserklaerung ? 1 : 0,
                gesundheitserklaerung_datum: memberData.vertrag_gesundheitserklaerung ? new Date() : null,
                foto_einverstaendnis: memberData.vertrag_foto_einverstaendnis ? 1 : 0,
                foto_einverstaendnis_datum: memberData.vertrag_foto_einverstaendnis ? new Date() : null,
                status: 'aktiv',
                unterschrift_datum: new Date()
            };

            const vertragFields = Object.keys(vertragData);
            const vertragPlaceholders = vertragFields.map(() => '?').join(', ');
            const vertragValues = vertragFields.map(field => vertragData[field]);

            const vertragQuery = `
                INSERT INTO vertraege (${vertragFields.join(', ')})
                VALUES (${vertragPlaceholders})
            `;

            db.query(vertragQuery, vertragValues, (vertragErr, vertragResult) => {
                if (vertragErr) {
                    console.error("❌ Fehler beim Erstellen des Vertrags:", vertragErr);
                    // Mitglied wurde erstellt, aber Vertrag fehlgeschlagen
                    return res.status(201).json({
                        success: true,
                        mitglied_id: newMemberId,
                        dojo_id: memberData.dojo_id,
                        warning: "Mitglied erstellt, aber Vertrag konnte nicht angelegt werden",
                        vertrag_error: vertragErr.message,
                        data: {
                            ...memberData,
                            mitglied_id: newMemberId
                        }
                    });
                }

                // 🔐 User-Account erstellen (nur bei öffentlicher Registrierung mit Benutzername/Passwort)
                createUserAccountIfNeeded(memberData, newMemberId, () => {
                    res.status(201).json({
                        success: true,
                        mitglied_id: newMemberId,
                        vertrag_id: vertragResult.insertId,
                        dojo_id: memberData.dojo_id,
                        message: "Mitglied und Vertrag erfolgreich erstellt",
                        data: {
                            ...memberData,
                            mitglied_id: newMemberId,
                            vertrag_id: vertragResult.insertId
                        }
                    });
                });
            });
        } else {
            // Kein Vertrag, nur Mitglied erstellt
            // 🔐 User-Account erstellen (nur bei öffentlicher Registrierung mit Benutzername/Passwort)
            createUserAccountIfNeeded(memberData, newMemberId, () => {
                res.status(201).json({
                    success: true,
                    mitglied_id: newMemberId,
                    dojo_id: memberData.dojo_id,
                    message: "Mitglied erfolgreich erstellt",
                    data: {
                        ...memberData,
                        mitglied_id: newMemberId
                    }
                });
            });
        }
    });
});

// 🔐 HILFSFUNKTION: User-Account erstellen (nur bei öffentlicher Registrierung)
async function createUserAccountIfNeeded(memberData, mitgliedId, callback) {
    // Nur wenn Benutzername und Passwort vorhanden sind (öffentliche Registrierung)
    if (memberData.benutzername && memberData.passwort) {
        console.log('🔐 Erstelle User-Account für öffentliche Registrierung...');

        try {
            // ✅ SCHUTZ: "admin" Benutzername ist reserviert
            if (memberData.benutzername.trim().toLowerCase() === 'admin') {
                console.error('❌ Versuch, reservierten Benutzernamen "admin" zu verwenden');
                // Callback mit Fehler - Mitglied wurde erstellt, aber kein User-Account
                return callback();
            }

            // Passwort hashen
            const hashedPassword = await bcrypt.hash(memberData.passwort, 10);

            // User in users-Tabelle erstellen
            const userQuery = `
                INSERT INTO users (username, email, password, role, mitglied_id, created_at)
                VALUES (?, ?, ?, 'member', ?, NOW())
            `;

            const userValues = [
                memberData.benutzername.trim(), // Leerzeichen entfernen
                memberData.email || null,
                hashedPassword,
                mitgliedId
            ];

            db.query(userQuery, userValues, (userErr, userResult) => {
                if (userErr) {
                    console.error("❌ Fehler beim Erstellen des User-Accounts:", userErr);
                    // Trotzdem fortfahren - Mitglied wurde erstellt
                } else {
                    console.log(`✅ User-Account erstellt für Mitglied ${mitgliedId} (User-ID: ${userResult.insertId})`);
                }

                // Callback ausführen (Response senden)
                callback();
            });
        } catch (hashError) {
            console.error("❌ Fehler beim Hashen des Passworts:", hashError);
            callback();
        }
    } else {
        // Keine User-Account-Daten vorhanden (interne Admin-Erstellung)
        callback();
    }
}

// ===================================================================
// 📧 NOTIFICATION RECIPIENTS (TEMP)
// ===================================================================

router.get('/notification-recipients', async (req, res) => {
  try {

    const db = require('../db');
    let memberEmails = [];
    let trainerEmails = [];
    let personalEmails = [];

    // Hole Mitglieder mit Email
    try {
      memberEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'mitglied' as type
          FROM mitglieder 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      memberEmails = [];
    }

    // Hole Trainer mit Email
    try {
      trainerEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'trainer' as type
          FROM trainer 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      trainerEmails = [];
    }

    // Hole Personal mit Email
    try {
      personalEmails = await new Promise((resolve, reject) => {
        db.query(`
          SELECT DISTINCT 
            COALESCE(email, '') as email, 
            CONCAT(COALESCE(vorname, ''), ' ', COALESCE(nachname, '')) as name, 
            'personal' as type
          FROM personal 
          WHERE email IS NOT NULL 
            AND email != '' 
            AND email != 'NULL'
            AND email LIKE '%@%'
          ORDER BY name
        `, (err, results) => {
          if (err) {

            resolve([]);
          } else {

            resolve(results);
          }
        });
      });
    } catch (error) {

      personalEmails = [];
    }

    res.json({
      success: true,
      recipients: {
        mitglieder: memberEmails,
        trainer: trainerEmails,
        personal: personalEmails,
        alle: [...memberEmails, ...trainerEmails, ...personalEmails]
      }
    });
  } catch (error) {
    console.error('❌ Notification recipients error:', error);
    res.status(500).json({ success: false, message: 'Fehler beim Laden der Empfänger' });
  }
});

// ============================================================================
// PUT /:id/graduierung - Graduierung eines Mitglieds aktualisieren
// ============================================================================
router.put("/:id/graduierung", (req, res) => {
  const mitglied_id = parseInt(req.params.id);
  let { stil_id, graduierung_id, pruefungsdatum } = req.body;

  if (!mitglied_id || !stil_id || !graduierung_id) {
    return res.status(400).json({
      error: "Fehlende Parameter: mitglied_id, stil_id und graduierung_id sind erforderlich"
    });
  }

  // Konvertiere ISO-Timestamp zu MySQL DATE Format (YYYY-MM-DD)
  if (pruefungsdatum) {
    const date = new Date(pruefungsdatum);
    pruefungsdatum = date.toISOString().split('T')[0];
  }

  console.log('🎖️ Aktualisiere Graduierung:', { mitglied_id, stil_id, graduierung_id, pruefungsdatum });

  // Prüfe, ob Eintrag in mitglied_stil_data existiert
  const checkQuery = `
    SELECT * FROM mitglied_stil_data
    WHERE mitglied_id = ? AND stil_id = ?
  `;

  db.query(checkQuery, [mitglied_id, stil_id], (checkErr, checkResults) => {
    if (checkErr) {
      console.error('❌ Fehler beim Prüfen der Stildaten:', checkErr);
      return res.status(500).json({ error: 'Fehler beim Prüfen der Stildaten' });
    }

    let query, params;

    if (checkResults.length > 0) {
      // UPDATE: Eintrag existiert bereits
      query = `
        UPDATE mitglied_stil_data
        SET current_graduierung_id = ?,
            letzte_pruefung = ?
        WHERE mitglied_id = ? AND stil_id = ?
      `;
      params = [graduierung_id, pruefungsdatum || null, mitglied_id, stil_id];
    } else {
      // INSERT: Neuer Eintrag
      query = `
        INSERT INTO mitglied_stil_data
        (mitglied_id, stil_id, current_graduierung_id, letzte_pruefung)
        VALUES (?, ?, ?, ?)
      `;
      params = [mitglied_id, stil_id, graduierung_id, pruefungsdatum || null];
    }

    db.query(query, params, (err, result) => {
      if (err) {
        console.error('❌ Fehler beim Aktualisieren der Graduierung:', err);
        return res.status(500).json({
          error: 'Fehler beim Aktualisieren der Graduierung',
          details: err.message
        });
      }

      console.log('✅ Graduierung erfolgreich aktualisiert:', result);

      res.json({
        success: true,
        message: 'Graduierung erfolgreich aktualisiert',
        mitglied_id,
        stil_id,
        graduierung_id
      });
    });
  });
});

// ============================================
// GET /api/mitglieder/:id/birthday-check
// Prüft ob das Mitglied heute Geburtstag hat
// ============================================
router.get('/:id/birthday-check', (req, res) => {
  const mitgliedId = req.params.id;

  const query = `
    SELECT
      mitglied_id,
      vorname,
      nachname,
      geburtsdatum,
      DAYOFMONTH(geburtsdatum) as geburtstag_tag,
      MONTH(geburtsdatum) as geburtstag_monat,
      DAYOFMONTH(CURDATE()) as heute_tag,
      MONTH(CURDATE()) as heute_monat,
      YEAR(CURDATE()) - YEAR(geburtsdatum) as alter,
      CASE
        WHEN DAYOFMONTH(geburtsdatum) = DAYOFMONTH(CURDATE())
         AND MONTH(geburtsdatum) = MONTH(CURDATE())
        THEN 1
        ELSE 0
      END as hat_heute_geburtstag
    FROM mitglieder
    WHERE mitglied_id = ?
  `;

  db.query(query, [mitgliedId], (err, results) => {
    if (err) {
      console.error('Fehler beim Geburtstags-Check:', err);
      return res.status(500).json({
        error: 'Datenbankfehler',
        hasBirthday: false
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        error: 'Mitglied nicht gefunden',
        hasBirthday: false
      });
    }

    const mitglied = results[0];
    const hasBirthday = mitglied.hat_heute_geburtstag === 1;

    res.json({
      success: true,
      hasBirthday: hasBirthday,
      mitglied: {
        id: mitglied.mitglied_id,
        vorname: mitglied.vorname,
        nachname: mitglied.nachname,
        geburtsdatum: mitglied.geburtsdatum,
        alter: hasBirthday ? mitglied.alter : null
      }
    });
  });
});

// ==============================
// ARCHIVIERUNG
// ==============================

/**
 * POST /mitglieder/:id/archivieren
 * Archiviert ein Mitglied (verschiebt in archiv_mitglieder Tabelle)
 */
router.post("/:id/archivieren", async (req, res) => {
  const mitgliedId = parseInt(req.params.id);
  const { grund, archiviert_von } = req.body;

  console.log(`📦 Archivierung von Mitglied ${mitgliedId} gestartet...`);

  try {
    // Starte Transaction
    await db.promise().query('START TRANSACTION');

    // 1. Hole alle Mitgliedsdaten
    const [mitgliedRows] = await db.promise().query(
      'SELECT * FROM mitglieder WHERE mitglied_id = ?',
      [mitgliedId]
    );

    if (mitgliedRows.length === 0) {
      await db.promise().query('ROLLBACK');
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const mitglied = mitgliedRows[0];

    // 2. Hole Stil-Daten
    const [stilData] = await db.promise().query(
      `SELECT msd.*, s.name as stil_name, g.name as graduierung_name
       FROM mitglied_stil_data msd
       LEFT JOIN stile s ON msd.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
       WHERE msd.mitglied_id = ?`,
      [mitgliedId]
    );

    // 3. Hole SEPA-Mandate
    const [sepaMandate] = await db.promise().query(
      'SELECT * FROM sepa_mandate WHERE mitglied_id = ? ORDER BY created_at DESC',
      [mitgliedId]
    );

    // 4. Hole Prüfungshistorie
    const [pruefungen] = await db.promise().query(
      `SELECT p.*, g.name as graduierung_name
       FROM pruefungen p
       LEFT JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
       WHERE p.mitglied_id = ?
       ORDER BY p.pruefungsdatum DESC`,
      [mitgliedId]
    );

    // 5. Hole User/Login-Daten falls vorhanden
    const [userData] = await db.promise().query(
      'SELECT * FROM users WHERE mitglied_id = ?',
      [mitgliedId]
    );

    // 6. Bereite User-Daten für Archiv vor (ohne Passwort!)
    let userDataForArchive = null;
    if (userData.length > 0) {
      const user = { ...userData[0] };
      delete user.password; // WICHTIG: Passwort nicht archivieren
      userDataForArchive = user;
    }

    // 7. Erstelle Archiv-Eintrag
    const insertArchivQuery = `
      INSERT INTO archiv_mitglieder (
        mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
        strasse, plz, ort, land, telefon, email, eintrittsdatum,
        status, notizen, foto_pfad,
        tarif_id, zahlungszyklus_id, gekuendigt, gekuendigt_am, kuendigungsgrund,
        vereinsordnung_akzeptiert, vereinsordnung_datum,
        security_question, security_answer,
        stil_daten, sepa_mandate, pruefungen, user_daten,
        archiviert_am, archiviert_von, archivierungsgrund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
    `;

    const archivValues = [
      mitglied.mitglied_id,
      mitglied.dojo_id,
      mitglied.vorname,
      mitglied.nachname,
      mitglied.geburtsdatum,
      mitglied.strasse,
      mitglied.plz,
      mitglied.ort,
      mitglied.land || 'Deutschland',
      mitglied.telefon,
      mitglied.email,
      mitglied.eintrittsdatum,
      mitglied.status,
      mitglied.notizen,
      mitglied.foto_pfad,
      mitglied.tarif_id,
      mitglied.zahlungszyklus_id,
      mitglied.gekuendigt || false,
      mitglied.gekuendigt_am,
      mitglied.kuendigungsgrund,
      mitglied.vereinsordnung_akzeptiert || false,
      mitglied.vereinsordnung_datum,
      mitglied.security_question,
      mitglied.security_answer,
      JSON.stringify(stilData),
      JSON.stringify(sepaMandate),
      JSON.stringify(pruefungen),
      userDataForArchive ? JSON.stringify(userDataForArchive) : null,
      archiviert_von || null,
      grund || 'Mitglied archiviert'
    ];

    const [archivResult] = await db.promise().query(insertArchivQuery, archivValues);
    const archivId = archivResult.insertId;

    console.log(`✅ Archiv-Eintrag erstellt mit ID: ${archivId}`);

    // 8. Kopiere Stil-Daten ins Archiv
    for (const stil of stilData) {
      await db.promise().query(
        `INSERT INTO archiv_mitglied_stil_data
         (archiv_id, mitglied_id, stil_id, current_graduierung_id, aktiv_seit)
         VALUES (?, ?, ?, ?, ?)`,
        [archivId, mitgliedId, stil.stil_id, stil.current_graduierung_id, stil.aktiv_seit]
      );
    }

    // 9. Lösche User/Login-Zugang (Login wird gesperrt!)
    if (userData.length > 0) {
      await db.promise().query('DELETE FROM users WHERE mitglied_id = ?', [mitgliedId]);
      console.log(`🔒 Login-Zugang für Mitglied ${mitgliedId} gelöscht`);
    }

    // 10. Lösche alle abhängigen Daten (Foreign Key Constraints)
    console.log(`🗑️ Lösche abhängige Daten für Mitglied ${mitgliedId}...`);

    // Reihenfolge wichtig: Von abhängigsten zu unabhängigen Tabellen
    await db.promise().query('DELETE FROM fortschritt_updates WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_meilensteine WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM trainings_notizen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM pruefung_teilnehmer WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM event_anmeldungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM gruppen_mitglieder WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM verkaeufe WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM gesetzlicher_vertreter WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM beitraege WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM anwesenheit WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM anwesenheit_protokoll WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM checkins WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM pruefungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_fortschritt WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM stripe_payment_intents WHERE mitglied_id = ?', [mitgliedId]);
    // WICHTIG: Rechnungen werden NICHT gelöscht (gesetzliche Aufbewahrungspflicht 10 Jahre § 147 AO)
    // await db.promise().query('DELETE FROM rechnungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglied_stil_data WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglied_stile WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_ziele WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM kurs_bewertungen WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM payment_provider_logs WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglieder_dokumente WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM mitglied_dokumente WHERE mitglied_id = ?', [mitgliedId]);
    await db.promise().query('DELETE FROM sepa_mandate WHERE mitglied_id = ?', [mitgliedId]);

    console.log(`✅ Abhängige Daten gelöscht`);

    // 11. Markiere Mitglied als inaktiv (NICHT löschen wegen Rechnungen!)
    // Mitglied bleibt in DB erhalten, da Rechnungen die mitglied_id referenzieren müssen
    await db.promise().query(
      'UPDATE mitglieder SET aktiv = 0, gekuendigt_am = NOW() WHERE mitglied_id = ?',
      [mitgliedId]
    );

    // 12. Commit Transaction
    await db.promise().query('COMMIT');

    console.log(`✅ Mitglied ${mitgliedId} erfolgreich archiviert (aktiv=0) und Login gesperrt`);

    res.json({
      success: true,
      message: 'Mitglied erfolgreich archiviert',
      archivId: archivId,
      mitglied: {
        id: mitglied.mitglied_id,
        name: `${mitglied.vorname} ${mitglied.nachname}`
      }
    });

  } catch (error) {
    // Rollback bei Fehler
    await db.promise().query('ROLLBACK');
    console.error('❌ Fehler beim Archivieren:', error);
    res.status(500).json({
      error: 'Fehler beim Archivieren des Mitglieds',
      details: error.message
    });
  }
});

/**
 * POST /mitglieder/bulk-archivieren
 * Archiviert mehrere Mitglieder gleichzeitig
 */
router.post("/bulk-archivieren", async (req, res) => {
  const { mitglied_ids, grund, archiviert_von } = req.body;

  // Validierung
  if (!mitglied_ids || !Array.isArray(mitglied_ids) || mitglied_ids.length === 0) {
    return res.status(400).json({
      error: 'Keine Mitglieds-IDs angegeben',
      details: 'mitglied_ids muss ein Array mit mindestens einem Element sein'
    });
  }

  console.log(`📦 Bulk-Archivierung von ${mitglied_ids.length} Mitgliedern gestartet...`);

  const results = {
    success: [],
    failed: []
  };

  // Archiviere jedes Mitglied einzeln
  for (const mitgliedId of mitglied_ids) {
    try {
      // Starte Transaction für dieses Mitglied
      await db.promise().query('START TRANSACTION');

      // 1. Hole alle Mitgliedsdaten
      const [mitgliedRows] = await db.promise().query(
        'SELECT * FROM mitglieder WHERE mitglied_id = ?',
        [mitgliedId]
      );

      if (mitgliedRows.length === 0) {
        await db.promise().query('ROLLBACK');
        results.failed.push({
          mitglied_id: mitgliedId,
          error: 'Mitglied nicht gefunden'
        });
        continue;
      }

      const mitglied = mitgliedRows[0];

      // 2. Hole Stil-Daten
      const [stilData] = await db.promise().query(
        `SELECT msd.*, s.name as stil_name, g.name as graduierung_name
         FROM mitglied_stil_data msd
         LEFT JOIN stile s ON msd.stil_id = s.stil_id
         LEFT JOIN graduierungen g ON msd.current_graduierung_id = g.graduierung_id
         WHERE msd.mitglied_id = ?`,
        [mitgliedId]
      );

      // 3. Hole SEPA-Mandate
      const [sepaMandate] = await db.promise().query(
        'SELECT * FROM sepa_mandate WHERE mitglied_id = ? ORDER BY created_at DESC',
        [mitgliedId]
      );

      // 4. Hole Prüfungshistorie
      const [pruefungen] = await db.promise().query(
        `SELECT p.*, g.name as graduierung_name
         FROM pruefungen p
         LEFT JOIN graduierungen g ON p.graduierung_nachher_id = g.graduierung_id
         WHERE p.mitglied_id = ?
         ORDER BY p.pruefungsdatum DESC`,
        [mitgliedId]
      );

      // 5. Hole User/Login-Daten falls vorhanden
      const [userData] = await db.promise().query(
        'SELECT * FROM users WHERE mitglied_id = ?',
        [mitgliedId]
      );

      // 6. Bereite User-Daten für Archiv vor (ohne Passwort!)
      let userDataForArchive = null;
      if (userData.length > 0) {
        const user = { ...userData[0] };
        delete user.password; // WICHTIG: Passwort nicht archivieren
        userDataForArchive = user;
      }

      // 7. Erstelle Archiv-Eintrag
      const insertArchivQuery = `
        INSERT INTO archiv_mitglieder (
          mitglied_id, dojo_id, vorname, nachname, geburtsdatum,
          strasse, plz, ort, land, telefon, email, eintrittsdatum,
          status, notizen, foto_pfad,
          tarif_id, zahlungszyklus_id, gekuendigt, gekuendigt_am, kuendigungsgrund,
          vereinsordnung_akzeptiert, vereinsordnung_datum,
          security_question, security_answer,
          stil_daten, sepa_mandate, pruefungen, user_daten,
          archiviert_am, archiviert_von, archivierungsgrund
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
      `;

      const archivValues = [
        mitglied.mitglied_id,
        mitglied.dojo_id,
        mitglied.vorname,
        mitglied.nachname,
        mitglied.geburtsdatum,
        mitglied.strasse,
        mitglied.plz,
        mitglied.ort,
        mitglied.land || 'Deutschland',
        mitglied.telefon,
        mitglied.email,
        mitglied.eintrittsdatum,
        mitglied.status,
        mitglied.notizen,
        mitglied.foto_pfad,
        mitglied.tarif_id,
        mitglied.zahlungszyklus_id,
        mitglied.gekuendigt || false,
        mitglied.gekuendigt_am,
        mitglied.kuendigungsgrund,
        mitglied.vereinsordnung_akzeptiert || false,
        mitglied.vereinsordnung_datum,
        mitglied.security_question,
        mitglied.security_answer,
        JSON.stringify(stilData),
        JSON.stringify(sepaMandate),
        JSON.stringify(pruefungen),
        userDataForArchive ? JSON.stringify(userDataForArchive) : null,
        archiviert_von || null,
        grund || 'Mitglieder bulk-archiviert'
      ];

      const [archivResult] = await db.promise().query(insertArchivQuery, archivValues);
      const archivId = archivResult.insertId;

      // 8. Kopiere Stil-Daten ins Archiv
      for (const stil of stilData) {
        await db.promise().query(
          `INSERT INTO archiv_mitglied_stil_data
           (archiv_id, mitglied_id, stil_id, current_graduierung_id, aktiv_seit)
           VALUES (?, ?, ?, ?, ?)`,
          [archivId, mitgliedId, stil.stil_id, stil.current_graduierung_id, stil.aktiv_seit]
        );
      }

      // 9. Lösche User/Login-Zugang (Login wird gesperrt!)
      if (userData.length > 0) {
        await db.promise().query('DELETE FROM users WHERE mitglied_id = ?', [mitgliedId]);
      }

      // 10. Lösche alle abhängigen Daten (Foreign Key Constraints)
      await db.promise().query('DELETE FROM fortschritt_updates WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_meilensteine WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM trainings_notizen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM pruefung_teilnehmer WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM event_anmeldungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM gruppen_mitglieder WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM verkaeufe WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM gesetzlicher_vertreter WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM beitraege WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM anwesenheit WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM anwesenheit_protokoll WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM checkins WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM pruefungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_fortschritt WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM stripe_payment_intents WHERE mitglied_id = ?', [mitgliedId]);
      // WICHTIG: Rechnungen werden NICHT gelöscht (gesetzliche Aufbewahrungspflicht 10 Jahre § 147 AO)
      // await db.promise().query('DELETE FROM rechnungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglied_stil_data WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglied_stile WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_ziele WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM kurs_bewertungen WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM payment_provider_logs WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglieder_dokumente WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM mitglied_dokumente WHERE mitglied_id = ?', [mitgliedId]);
      await db.promise().query('DELETE FROM sepa_mandate WHERE mitglied_id = ?', [mitgliedId]);

      // 11. Markiere Mitglied als inaktiv (NICHT löschen wegen Rechnungen!)
      // Mitglied bleibt in DB erhalten, da Rechnungen die mitglied_id referenzieren müssen
      await db.promise().query(
        'UPDATE mitglieder SET aktiv = 0, gekuendigt_am = NOW() WHERE mitglied_id = ?',
        [mitgliedId]
      );

      // 12. Commit Transaction
      await db.promise().query('COMMIT');

      results.success.push({
        mitglied_id: mitgliedId,
        name: `${mitglied.vorname} ${mitglied.nachname}`,
        archiv_id: archivId
      });

      console.log(`✅ Mitglied ${mitgliedId} erfolgreich archiviert`);

    } catch (error) {
      // Rollback bei Fehler für dieses Mitglied
      await db.promise().query('ROLLBACK');
      console.error(`❌ Fehler beim Archivieren von Mitglied ${mitgliedId}:`, error);
      results.failed.push({
        mitglied_id: mitgliedId,
        error: error.message
      });
    }
  }

  console.log(`📊 Bulk-Archivierung abgeschlossen: ${results.success.length} erfolgreich, ${results.failed.length} fehlgeschlagen`);

  res.json({
    success: true,
    message: `${results.success.length} von ${mitglied_ids.length} Mitgliedern erfolgreich archiviert`,
    results: results
  });
});

/**
 * GET /archiv
 * Ruft alle archivierten Mitglieder ab
 */
router.get("/archiv", (req, res) => {
  const { dojo_id, limit = 100, offset = 0 } = req.query;

  let whereClause = '';
  let queryParams = [];

  if (dojo_id && dojo_id !== 'all') {
    whereClause = 'WHERE dojo_id = ?';
    queryParams.push(parseInt(dojo_id));
  }

  const query = `
    SELECT * FROM v_archiv_mitglieder_uebersicht
    ${whereClause}
    LIMIT ? OFFSET ?
  `;

  queryParams.push(parseInt(limit), parseInt(offset));

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Abrufen archivierter Mitglieder:", err);
      return res.status(500).json({ error: "Fehler beim Abrufen des Archivs" });
    }

    res.json({
      success: true,
      count: results.length,
      archivierte_mitglieder: results
    });
  });
});

/**
 * GET /archiv/:archivId
 * Ruft Details eines archivierten Mitglieds ab
 */
router.get("/archiv/:archivId", (req, res) => {
  const archivId = parseInt(req.params.archivId);

  const query = 'SELECT * FROM archiv_mitglieder WHERE archiv_id = ?';

  db.query(query, [archivId], (err, results) => {
    if (err) {
      console.error("❌ Fehler beim Abrufen des Archiv-Eintrags:", err);
      return res.status(500).json({ error: "Fehler beim Abrufen des Archiv-Eintrags" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Archiv-Eintrag nicht gefunden' });
    }

    const archiv = results[0];

    // Parse JSON-Felder
    if (archiv.stil_daten && typeof archiv.stil_daten === 'string') {
      archiv.stil_daten = JSON.parse(archiv.stil_daten);
    }
    if (archiv.sepa_mandate && typeof archiv.sepa_mandate === 'string') {
      archiv.sepa_mandate = JSON.parse(archiv.sepa_mandate);
    }
    if (archiv.pruefungen && typeof archiv.pruefungen === 'string') {
      archiv.pruefungen = JSON.parse(archiv.pruefungen);
    }

    res.json({
      success: true,
      archiv: archiv
    });
  });
});

/**
 * POST /mitglieder/:id/mitgliedsausweis
 * Generiert einen Mitgliedsausweis als PDF
 */
router.post("/:id/mitgliedsausweis", async (req, res) => {
  const mitglied_id = parseInt(req.params.id, 10);

  if (isNaN(mitglied_id)) {
    console.error("[Mitgliedsausweis] Ungültige Mitglieds-ID:", req.params.id);
    return res.status(400).json({ error: "Ungültige Mitglieds-ID" });
  }

  console.log(`[Mitgliedsausweis] Generiere PDF für Mitglied ${mitglied_id}`);

  try {
    // 1. Mitgliedsdaten abrufen
    const mitgliedQuery = `
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.geburtsdatum,
        m.dojo_id,
        GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stil,
        g.name AS graduierung
      FROM mitglieder m
      LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
      LEFT JOIN stile s ON ms.stil = s.name
      LEFT JOIN graduierungen g ON m.graduierung_id = g.id
      WHERE m.mitglied_id = ?
      GROUP BY m.mitglied_id
    `;

    db.query(mitgliedQuery, [mitglied_id], async (err, results) => {
      if (err) {
        console.error("[Mitgliedsausweis] Datenbankfehler beim Laden des Mitglieds:", err);
        return res.status(500).json({ error: "Fehler beim Laden der Mitgliedsdaten" });
      }

      if (results.length === 0) {
        console.error("[Mitgliedsausweis] Mitglied nicht gefunden:", mitglied_id);
        return res.status(404).json({ error: "Mitglied nicht gefunden" });
      }

      const mitglied = results[0];
      console.log("[Mitgliedsausweis] Mitglied gefunden:", mitglied);

      // 2. Dojo-Daten abrufen
      const dojoQuery = `SELECT name, strasse, hausnummer, plz, ort FROM dojos WHERE dojo_id = ?`;

      db.query(dojoQuery, [mitglied.dojo_id], async (dojoErr, dojoResults) => {
        if (dojoErr) {
          console.error("[Mitgliedsausweis] Fehler beim Laden der Dojo-Daten:", dojoErr);
          return res.status(500).json({ error: "Fehler beim Laden der Dojo-Daten" });
        }

        const dojo = dojoResults.length > 0 ? dojoResults[0] : { name: "Dojo" };
        if (dojo.strasse && dojo.hausnummer && dojo.plz && dojo.ort) {
          dojo.adresse = `${dojo.strasse} ${dojo.hausnummer}, ${dojo.plz} ${dojo.ort}`;
        }
        console.log("[Mitgliedsausweis] Dojo gefunden:", dojo);

        // 3. PDF generieren
        try {
          const generator = new MitgliedsausweisGenerator();
          const pdfDoc = await generator.generateMitgliedsausweis(mitglied, dojo);

          console.log("[Mitgliedsausweis] PDF erfolgreich generiert");

          // 4. PDF an Client senden
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=mitgliedsausweis_${mitglied_id}.pdf`);

          pdfDoc.pipe(res);
        } catch (pdfError) {
          console.error("[Mitgliedsausweis] Fehler bei der PDF-Generierung:", pdfError);
          return res.status(500).json({ error: "Fehler bei der PDF-Generierung", details: pdfError.message });
        }
      });
    });
  } catch (error) {
    console.error("[Mitgliedsausweis] Unerwarteter Fehler:", error);
    return res.status(500).json({ error: "Interner Serverfehler", details: error.message });
  }
});

/**
 * GET /mitglieder/print
 * Generiert eine PDF-Liste aller Mitglieder mit Name, Geburtsdatum, Stil und Vertrag
 */
module.exports = router;