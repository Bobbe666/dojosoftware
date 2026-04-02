// =====================================================================================
// ARTIKEL BESTELLUNGEN API-ROUTES
// =====================================================================================
// Bestellsystem für Artikel beim Lieferanten (z.B. Pakistan)
// Mit PDF-Generierung in Englisch
// =====================================================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireFeature } = require('../middleware/featureAccess');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const logger = require('../utils/logger');

// Feature Protection
router.use(authenticateToken);
router.use(requireFeature('verkauf'));

// =====================================================================================
// HILFSFUNKTIONEN
// =====================================================================================

const getDojoId = (req) => {
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
  const isSuperAdmin = userId == 1 || req.user?.username === 'admin';
  return req.tenant?.dojo_id || (isSuperAdmin ? 2 : null);
};

const formatBestellung = (bestellung) => ({
  ...bestellung,
  gesamtbetrag_euro: (bestellung.gesamtbetrag_cent || 0) / 100,
  positionen: bestellung.positionen ? bestellung.positionen.map(p => ({
    ...p,
    stueckpreis_euro: (p.stueckpreis_cent || 0) / 100,
    positions_preis_euro: (p.positions_preis_cent || 0) / 100,
    groessen_mengen: typeof p.groessen_mengen === 'string' ? JSON.parse(p.groessen_mengen) : p.groessen_mengen
  })) : []
});

// Artikel mit niedrigem Bestand abrufen (< 2 Stück)
const getLowStockArticles = async (dojoId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        a.artikel_id,
        a.name AS artikel_name,
        a.artikel_nummer,
        a.lagerbestand,
        a.mindestbestand,
        a.varianten_bestand,
        a.varianten_groessen,
        a.groessen_kids,
        a.groessen_erwachsene,
        a.hat_varianten,
        a.hat_preiskategorien,
        a.einkaufspreis_cent,
        ag.name AS artikelgruppe_name
      FROM artikel a
      LEFT JOIN artikelgruppen ag ON a.artikelgruppe_id = ag.id
      WHERE a.aktiv = TRUE
        AND a.lager_tracking = TRUE
        AND a.dojo_id = ?
        AND (a.lagerbestand < 2 OR a.hat_varianten = TRUE)
      ORDER BY a.lagerbestand ASC, a.name ASC
    `;

    db.query(query, [dojoId], (error, results) => {
      if (error) return reject(error);

      // Bei Varianten: prüfen ob einzelne Größen < 2 sind
      const lowStockItems = results.filter(item => {
        if (!item.hat_varianten) {
          return item.lagerbestand < 2;
        }

        // Varianten-Bestand prüfen
        const bestand = item.varianten_bestand ?
          (typeof item.varianten_bestand === 'string' ? JSON.parse(item.varianten_bestand) : item.varianten_bestand) : {};

        // Prüfen ob mindestens eine Größe < 2 ist
        const sizes = Object.values(bestand);
        return sizes.some(qty => qty < 2);
      }).map(item => ({
        ...item,
        einkaufspreis_euro: (item.einkaufspreis_cent || 0) / 100,
        varianten_bestand: item.varianten_bestand ?
          (typeof item.varianten_bestand === 'string' ? JSON.parse(item.varianten_bestand) : item.varianten_bestand) : {},
        varianten_groessen: item.varianten_groessen ?
          (typeof item.varianten_groessen === 'string' ? JSON.parse(item.varianten_groessen) : item.varianten_groessen) : [],
        groessen_kids: item.groessen_kids ?
          (typeof item.groessen_kids === 'string' ? JSON.parse(item.groessen_kids) : item.groessen_kids) : [],
        groessen_erwachsene: item.groessen_erwachsene ?
          (typeof item.groessen_erwachsene === 'string' ? JSON.parse(item.groessen_erwachsene) : item.groessen_erwachsene) : [],
        low_sizes: (() => {
          if (!item.hat_varianten) return null;
          const bestand = item.varianten_bestand ?
            (typeof item.varianten_bestand === 'string' ? JSON.parse(item.varianten_bestand) : item.varianten_bestand) : {};
          return Object.entries(bestand)
            .filter(([_, qty]) => qty < 2)
            .map(([size, qty]) => ({ size, qty }));
        })()
      }));

      resolve(lowStockItems);
    });
  });
};

// =====================================================================================
// ROUTES
// =====================================================================================

// GET /api/artikel-bestellungen/low-stock - Artikel mit niedrigem Bestand
router.get('/low-stock', async (req, res) => {
  try {
    const dojoId = getDojoId(req);
    if (!dojoId) return res.status(403).json({ error: 'No tenant' });

    const lowStockItems = await getLowStockArticles(dojoId);

    res.json({
      success: true,
      data: lowStockItems,
      count: lowStockItems.length
    });
  } catch (error) {
    logger.error('Fehler beim Abrufen der Artikel mit niedrigem Bestand:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Artikel' });
  }
});

// GET /api/artikel-bestellungen - Alle Bestellungen
router.get('/', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const { status, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT
      b.*,
      (SELECT COUNT(*) FROM artikel_bestellung_positionen WHERE bestellung_id = b.bestellung_id) AS anzahl_positionen
    FROM artikel_bestellungen b
    WHERE b.dojo_id = ?
  `;
  const params = [dojoId];

  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }

  query += ' ORDER BY b.erstellt_am DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(query, params, (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Bestellungen:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen' });
    }

    const formatted = results.map(b => ({
      ...b,
      gesamtbetrag_euro: (b.gesamtbetrag_cent || 0) / 100
    }));

    res.json({ success: true, data: formatted });
  });
});

// GET /api/artikel-bestellungen/:id - Einzelne Bestellung mit Positionen
router.get('/:id', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;

  // Bestellung abrufen
  db.query(
    'SELECT * FROM artikel_bestellungen WHERE bestellung_id = ? AND dojo_id = ?',
    [bestellungId, dojoId],
    (error, bestellungen) => {
      if (error) {
        logger.error('Fehler beim Abrufen der Bestellung:', error);
        return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellung' });
      }

      if (bestellungen.length === 0) {
        return res.status(404).json({ error: 'Bestellung nicht gefunden' });
      }

      const bestellung = bestellungen[0];

      // Positionen abrufen
      db.query(`
        SELECT
          p.*,
          a.name AS artikel_name,
          a.artikel_nummer,
          a.varianten_groessen,
          a.groessen_kids,
          a.groessen_erwachsene
        FROM artikel_bestellung_positionen p
        JOIN artikel a ON p.artikel_id = a.artikel_id
        WHERE p.bestellung_id = ?
        ORDER BY p.sortierung ASC
      `, [bestellungId], (error, positionen) => {
        if (error) {
          logger.error('Fehler beim Abrufen der Positionen:', error);
          return res.status(500).json({ error: 'Fehler beim Abrufen der Positionen' });
        }

        bestellung.positionen = positionen;
        res.json({ success: true, data: formatBestellung(bestellung) });
      });
    }
  );
});

// POST /api/artikel-bestellungen - Neue Bestellung erstellen
router.post('/', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const {
    lieferant_name,
    lieferant_land,
    lieferant_email,
    lieferant_telefon,
    bemerkungen,
    interne_notizen,
    positionen = []
  } = req.body;

  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;

  // Bestellung erstellen
  db.query(`
    INSERT INTO artikel_bestellungen
    (dojo_id, lieferant_name, lieferant_land, lieferant_email, lieferant_telefon, bemerkungen, interne_notizen, erstellt_von, bestellnummer)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')
  `, [dojoId, lieferant_name || 'Pakistan Supplier', lieferant_land || 'Pakistan', lieferant_email, lieferant_telefon, bemerkungen, interne_notizen, userId],
  (error, result) => {
    if (error) {
      logger.error('Fehler beim Erstellen der Bestellung:', error);
      return res.status(500).json({ error: 'Fehler beim Erstellen der Bestellung' });
    }

    const bestellungId = result.insertId;

    // Positionen einfügen
    if (positionen.length > 0) {
      const positionValues = positionen.map((p, idx) => [
        bestellungId,
        p.artikel_id,
        JSON.stringify(p.groessen_mengen || {}),
        0, // gesamt_menge wird per Trigger berechnet
        Math.round((p.stueckpreis_euro || 0) * 100),
        0, // positions_preis_cent wird per Trigger berechnet
        p.bemerkung || null,
        idx
      ]);

      db.query(`
        INSERT INTO artikel_bestellung_positionen
        (bestellung_id, artikel_id, groessen_mengen, gesamt_menge, stueckpreis_cent, positions_preis_cent, bemerkung, sortierung)
        VALUES ?
      `, [positionValues], (error) => {
        if (error) {
          logger.error('Fehler beim Einfügen der Positionen:', error);
          // Bestellung trotzdem zurückgeben
        }

        // Historie eintragen
        db.query(`
          INSERT INTO artikel_bestellung_historie (bestellung_id, aktion, benutzer_id)
          VALUES (?, 'erstellt', ?)
        `, [bestellungId, userId]);

        // Bestellnummer abrufen
        db.query('SELECT bestellnummer FROM artikel_bestellungen WHERE bestellung_id = ?', [bestellungId], (error, rows) => {
          res.json({
            success: true,
            bestellung_id: bestellungId,
            bestellnummer: rows?.[0]?.bestellnummer,
            message: 'Bestellung erfolgreich erstellt'
          });
        });
      });
    } else {
      // Keine Positionen
      db.query('SELECT bestellnummer FROM artikel_bestellungen WHERE bestellung_id = ?', [bestellungId], (error, rows) => {
        res.json({
          success: true,
          bestellung_id: bestellungId,
          bestellnummer: rows?.[0]?.bestellnummer,
          message: 'Bestellung erfolgreich erstellt'
        });
      });
    }
  });
});

// PUT /api/artikel-bestellungen/:id - Bestellung aktualisieren
router.put('/:id', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;
  const {
    lieferant_name,
    lieferant_land,
    lieferant_email,
    lieferant_telefon,
    bemerkungen,
    interne_notizen,
    status,
    positionen
  } = req.body;

  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;

  // Update-Felder sammeln
  const updateFields = [];
  const updateValues = [];

  if (lieferant_name !== undefined) { updateFields.push('lieferant_name = ?'); updateValues.push(lieferant_name); }
  if (lieferant_land !== undefined) { updateFields.push('lieferant_land = ?'); updateValues.push(lieferant_land); }
  if (lieferant_email !== undefined) { updateFields.push('lieferant_email = ?'); updateValues.push(lieferant_email); }
  if (lieferant_telefon !== undefined) { updateFields.push('lieferant_telefon = ?'); updateValues.push(lieferant_telefon); }
  if (bemerkungen !== undefined) { updateFields.push('bemerkungen = ?'); updateValues.push(bemerkungen); }
  if (interne_notizen !== undefined) { updateFields.push('interne_notizen = ?'); updateValues.push(interne_notizen); }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
    if (status === 'gesendet') updateFields.push('gesendet_am = CURRENT_TIMESTAMP');
    if (status === 'geliefert') updateFields.push('geliefert_am = CURRENT_TIMESTAMP');
  }

  if (updateFields.length > 0) {
    updateValues.push(bestellungId, dojoId);

    db.query(`
      UPDATE artikel_bestellungen
      SET ${updateFields.join(', ')}
      WHERE bestellung_id = ? AND dojo_id = ?
    `, updateValues, (error) => {
      if (error) {
        logger.error('Fehler beim Aktualisieren der Bestellung:', error);
        return res.status(500).json({ error: 'Fehler beim Aktualisieren' });
      }

      // Historie
      db.query(`
        INSERT INTO artikel_bestellung_historie (bestellung_id, aktion, details, benutzer_id)
        VALUES (?, 'bearbeitet', ?, ?)
      `, [bestellungId, JSON.stringify({ fields: updateFields }), userId]);
    });
  }

  // Positionen aktualisieren (falls gesendet)
  if (positionen && Array.isArray(positionen)) {
    // Alte Positionen löschen
    db.query('DELETE FROM artikel_bestellung_positionen WHERE bestellung_id = ?', [bestellungId], (error) => {
      if (error) logger.error('Fehler beim Löschen alter Positionen:', error);

      if (positionen.length > 0) {
        const positionValues = positionen.map((p, idx) => [
          bestellungId,
          p.artikel_id,
          JSON.stringify(p.groessen_mengen || {}),
          0,
          Math.round((p.stueckpreis_euro || 0) * 100),
          0,
          p.bemerkung || null,
          idx
        ]);

        db.query(`
          INSERT INTO artikel_bestellung_positionen
          (bestellung_id, artikel_id, groessen_mengen, gesamt_menge, stueckpreis_cent, positions_preis_cent, bemerkung, sortierung)
          VALUES ?
        `, [positionValues]);
      }
    });
  }

  res.json({ success: true, message: 'Bestellung aktualisiert' });
});

// DELETE /api/artikel-bestellungen/:id - Bestellung löschen
router.delete('/:id', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;

  // Nur Entwürfe können gelöscht werden
  db.query(
    'SELECT status FROM artikel_bestellungen WHERE bestellung_id = ? AND dojo_id = ?',
    [bestellungId, dojoId],
    (error, results) => {
      if (error || results.length === 0) {
        return res.status(404).json({ error: 'Bestellung nicht gefunden' });
      }

      if (results[0].status !== 'entwurf') {
        return res.status(400).json({ error: 'Nur Entwürfe können gelöscht werden' });
      }

      db.query('DELETE FROM artikel_bestellungen WHERE bestellung_id = ?', [bestellungId], (error) => {
        if (error) {
          logger.error('Fehler beim Löschen der Bestellung:', error);
          return res.status(500).json({ error: 'Fehler beim Löschen' });
        }

        res.json({ success: true, message: 'Bestellung gelöscht' });
      });
    }
  );
});

// POST /api/artikel-bestellungen/:id/pdf - PDF generieren
router.post('/:id/pdf', async (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;

  try {
    // Bestellung mit Positionen abrufen
    const [bestellungen] = await new Promise((resolve, reject) => {
      db.query(
        'SELECT * FROM artikel_bestellungen WHERE bestellung_id = ? AND dojo_id = ?',
        [bestellungId, dojoId],
        (error, results) => error ? reject(error) : resolve([results])
      );
    });

    if (bestellungen.length === 0) {
      return res.status(404).json({ error: 'Bestellung nicht gefunden' });
    }

    const bestellung = bestellungen[0];

    const [positionen] = await new Promise((resolve, reject) => {
      db.query(`
        SELECT
          p.*,
          a.name AS artikel_name,
          a.artikel_nummer
        FROM artikel_bestellung_positionen p
        JOIN artikel a ON p.artikel_id = a.artikel_id
        WHERE p.bestellung_id = ?
        ORDER BY p.sortierung ASC
      `, [bestellungId], (error, results) => error ? reject(error) : resolve([results]));
    });

    // Dojo-Info abrufen
    const [dojos] = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM dojo WHERE id = ?', [dojoId], (error, results) => error ? reject(error) : resolve([results]));
    });
    const dojo = dojos[0] || {};

    // PDF generieren
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // PDF in Memory speichern
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);

      // PDF-Pfad speichern
      const pdfFilename = `order_${bestellung.bestellnummer}.pdf`;
      const pdfDir = path.join(__dirname, '..', 'uploads', 'orders');

      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const pdfPath = path.join(pdfDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Datenbank aktualisieren
      db.query(`
        UPDATE artikel_bestellungen
        SET pdf_generiert_am = CURRENT_TIMESTAMP, pdf_pfad = ?
        WHERE bestellung_id = ?
      `, [pdfPath, bestellungId]);

      // Historie
      const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;
      db.query(`
        INSERT INTO artikel_bestellung_historie (bestellung_id, aktion, benutzer_id)
        VALUES (?, 'pdf_generiert', ?)
      `, [bestellungId, userId]);

      // PDF als Response senden
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
      res.send(pdfBuffer);
    });

    // =====================================================================================
    // PDF INHALT (in Englisch)
    // =====================================================================================

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('PURCHASE ORDER', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(`Order No: ${bestellung.bestellnummer}`, { align: 'center' });
    doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });

    doc.moveDown(1);

    // Trennlinie
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // FROM (Dojo Info)
    doc.fontSize(12).font('Helvetica-Bold').text('FROM:');
    doc.fontSize(10).font('Helvetica');
    doc.text(dojo.dojoname || 'Martial Arts Academy');
    if (dojo.strasse) doc.text(dojo.strasse);
    if (dojo.plz || dojo.ort) doc.text(`${dojo.plz || ''} ${dojo.ort || ''}`);
    if (dojo.land) doc.text(dojo.land);
    if (dojo.email) doc.text(`Email: ${dojo.email}`);
    if (dojo.telefon) doc.text(`Phone: ${dojo.telefon}`);

    doc.moveDown(1);

    // TO (Supplier)
    doc.fontSize(12).font('Helvetica-Bold').text('TO (SUPPLIER):');
    doc.fontSize(10).font('Helvetica');
    doc.text(bestellung.lieferant_name || 'Supplier');
    doc.text(bestellung.lieferant_land || 'Pakistan');
    if (bestellung.lieferant_email) doc.text(`Email: ${bestellung.lieferant_email}`);
    if (bestellung.lieferant_telefon) doc.text(`Phone: ${bestellung.lieferant_telefon}`);

    doc.moveDown(1.5);

    // Trennlinie
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // ORDER ITEMS HEADER
    doc.fontSize(12).font('Helvetica-Bold').text('ORDER ITEMS:', { underline: true });
    doc.moveDown(0.5);

    // Für jeden Artikel
    let itemNumber = 1;
    let totalAmount = 0;

    for (const position of positionen) {
      const groessenMengen = typeof position.groessen_mengen === 'string' ?
        JSON.parse(position.groessen_mengen) : (position.groessen_mengen || {});

      const stueckpreisEuro = (position.stueckpreis_cent || 0) / 100;
      const positionTotal = (position.positions_preis_cent || 0) / 100;
      totalAmount += positionTotal;

      // Artikel Header
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`${itemNumber}. ${position.artikel_name}`, { continued: false });

      if (position.artikel_nummer) {
        doc.fontSize(9).font('Helvetica').text(`   Article No: ${position.artikel_nummer}`);
      }

      doc.moveDown(0.3);

      // Größen-Tabelle Header
      doc.fontSize(9).font('Helvetica-Bold');
      const tableTop = doc.y;
      const col1 = 70; // Size
      const col2 = 170; // Quantity
      const colWidth = 100;

      doc.text('Size', col1, tableTop);
      doc.text('Quantity', col2, tableTop);

      // Linie unter Header
      doc.moveTo(col1, tableTop + 12).lineTo(col2 + 80, tableTop + 12).stroke();

      // Größen-Zeilen
      doc.font('Helvetica').fontSize(9);
      let rowY = tableTop + 18;

      const sortedSizes = Object.entries(groessenMengen)
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => {
          // Numerische Größen zuerst, dann alphabetisch
          const aNum = parseInt(a[0]);
          const bNum = parseInt(b[0]);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          if (!isNaN(aNum)) return -1;
          if (!isNaN(bNum)) return 1;
          return a[0].localeCompare(b[0]);
        });

      for (const [size, qty] of sortedSizes) {
        if (qty > 0) {
          doc.text(size, col1, rowY);
          doc.text(String(qty), col2, rowY);
          rowY += 14;
        }
      }

      // Gesamt für diesen Artikel
      doc.moveDown(0.3);
      doc.y = rowY + 5;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(`Total Pieces: ${position.gesamt_menge}`, col1);

      if (stueckpreisEuro > 0) {
        doc.text(`Unit Price: ${stueckpreisEuro.toFixed(2)} EUR`, col1);
        doc.text(`Subtotal: ${positionTotal.toFixed(2)} EUR`, col1);
      }

      // Bemerkung zur Position
      if (position.bemerkung) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Oblique').fontSize(9);
        doc.text(`Note: ${position.bemerkung}`, col1);
      }

      doc.moveDown(0.5);

      // Trennlinie zwischen Artikeln
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.strokeColor('#000000');

      itemNumber++;
    }

    // TOTAL
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica-Bold');
    doc.text(`TOTAL ORDER VALUE: ${totalAmount.toFixed(2)} EUR`, { align: 'right' });

    // Bemerkungen
    if (bestellung.bemerkungen) {
      doc.moveDown(1.5);
      doc.fontSize(12).font('Helvetica-Bold').text('REMARKS:');
      doc.fontSize(10).font('Helvetica').text(bestellung.bemerkungen);
    }

    // Footer
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text('This is an official purchase order. Please confirm receipt and expected shipping date.', { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-GB')}`, { align: 'center' });

    // Signatur-Bereich
    doc.moveDown(2);
    doc.fillColor('#000000');
    doc.fontSize(10).font('Helvetica');

    const signatureY = doc.y;
    doc.text('Authorized Signature:', 50, signatureY);
    doc.moveTo(170, signatureY + 30).lineTo(300, signatureY + 30).stroke();

    doc.text('Date:', 350, signatureY);
    doc.moveTo(400, signatureY + 30).lineTo(530, signatureY + 30).stroke();

    // PDF abschließen
    doc.end();

  } catch (error) {
    logger.error('Fehler beim Generieren des PDFs:', error);
    res.status(500).json({ error: 'Fehler beim Generieren des PDFs' });
  }
});

// GET /api/artikel-bestellungen/:id/pdf - PDF herunterladen
router.get('/:id/pdf', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;

  db.query(
    'SELECT pdf_pfad, bestellnummer FROM artikel_bestellungen WHERE bestellung_id = ? AND dojo_id = ?',
    [bestellungId, dojoId],
    (error, results) => {
      if (error || results.length === 0) {
        return res.status(404).json({ error: 'Bestellung nicht gefunden' });
      }

      const { pdf_pfad, bestellnummer } = results[0];

      if (!pdf_pfad || !fs.existsSync(pdf_pfad)) {
        return res.status(404).json({ error: 'PDF nicht gefunden. Bitte erst generieren.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="order_${bestellnummer}.pdf"`);
      res.sendFile(pdf_pfad);
    }
  );
});

// GET /api/artikel-bestellungen/:id/historie - Bestellhistorie
router.get('/:id/historie', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;

  db.query(`
    SELECT h.*, u.name AS benutzer_name_full
    FROM artikel_bestellung_historie h
    LEFT JOIN users u ON h.benutzer_id = u.id
    WHERE h.bestellung_id = ?
    ORDER BY h.zeitstempel DESC
  `, [bestellungId], (error, results) => {
    if (error) {
      logger.error('Fehler beim Abrufen der Historie:', error);
      return res.status(500).json({ error: 'Fehler beim Abrufen der Historie' });
    }

    res.json({ success: true, data: results });
  });
});

// POST /api/artikel-bestellungen/:id/status - Status ändern
router.post('/:id/status', (req, res) => {
  const dojoId = getDojoId(req);
  if (!dojoId) return res.status(403).json({ error: 'No tenant' });

  const bestellungId = req.params.id;
  const { status } = req.body;
  const userId = req.user?.id || req.user?.user_id || req.user?.admin_id;

  const validStatuses = ['entwurf', 'gesendet', 'bestaetigt', 'versendet', 'geliefert', 'storniert'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  let extraFields = '';
  if (status === 'gesendet') extraFields = ', gesendet_am = CURRENT_TIMESTAMP';
  if (status === 'geliefert') extraFields = ', geliefert_am = CURRENT_TIMESTAMP';

  db.query(`
    UPDATE artikel_bestellungen
    SET status = ?${extraFields}
    WHERE bestellung_id = ? AND dojo_id = ?
  `, [status, bestellungId, dojoId], (error) => {
    if (error) {
      logger.error('Fehler beim Ändern des Status:', error);
      return res.status(500).json({ error: 'Fehler beim Ändern des Status' });
    }

    // Historie
    db.query(`
      INSERT INTO artikel_bestellung_historie (bestellung_id, aktion, details, benutzer_id)
      VALUES (?, ?, ?, ?)
    `, [bestellungId, status, JSON.stringify({ new_status: status }), userId]);

    res.json({ success: true, message: `Status auf "${status}" geändert` });
  });
});

module.exports = router;
