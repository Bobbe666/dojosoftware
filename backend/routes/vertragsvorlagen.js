// Backend/routes/vertragsvorlagen.js - Verwaltung von Vertragsvorlagen (GrapesJS + TipTap)
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { generateVertragsvorlagePdf, replacePlaceholders } = require('../utils/vertragsvorlagenPdfGenerator');

// Promise-Wrapper für db.query
const queryAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

/**
 * Lädt das Haupt-Logo des Dojos als base64
 */
const loadDojoLogo = async (dojoId) => {
  try {
    const logos = await queryAsync(
      'SELECT file_path, mime_type FROM dojo_logos WHERE dojo_id = ? AND logo_type = ? LIMIT 1',
      [dojoId, 'haupt']
    );

    if (logos.length > 0 && fs.existsSync(logos[0].file_path)) {
      const imageBuffer = fs.readFileSync(logos[0].file_path);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = logos[0].mime_type || 'image/png';
      return `data:${mimeType};base64,${base64Image}`;
    }

    return null;
  } catch (error) {
    logger.error('Fehler beim Laden des Logos:', { error: error });
    return null;
  }
};

// GET /api/vertragsvorlagen - Alle Vorlagen für ein Dojo abrufen
router.get('/', async (req, res) => {
  try {
    const { dojo_id, template_type, aktiv } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (dojo_id) {
      whereConditions.push('dojo_id = ?');
      queryParams.push(parseInt(dojo_id));
    }

    if (template_type) {
      whereConditions.push('template_type = ?');
      queryParams.push(template_type);
    }

    if (aktiv !== undefined) {
      whereConditions.push('aktiv = ?');
      queryParams.push(aktiv === 'true' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const vorlagen = await queryAsync(`
      SELECT
        id,
        dojo_id,
        name,
        beschreibung,
        template_type,
        is_default,
        aktiv,
        version,
        editor_version,
        erstellt_am,
        aktualisiert_am
      FROM vertragsvorlagen
      ${whereClause}
      ORDER BY is_default DESC, erstellt_am DESC
    `, queryParams);
    res.json({ success: true, data: vorlagen });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Vorlagen:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// GET /api/vertragsvorlagen/:id - Einzelne Vorlage mit vollem Inhalt abrufen
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const vorlagen = await queryAsync(`
      SELECT *
      FROM vertragsvorlagen
      WHERE id = ?
    `, [id]);

    if (vorlagen.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }
    res.json({ success: true, data: vorlagen[0] });
  } catch (err) {
    logger.error('Fehler beim Abrufen der Vorlage:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// POST /api/vertragsvorlagen - Neue Vorlage erstellen
router.post('/', async (req, res) => {
  try {
    const {
      dojo_id,
      name,
      beschreibung,
      grapesjs_html,
      grapesjs_css,
      grapesjs_components,
      grapesjs_styles,
      tiptap_html,
      editor_version,
      template_type,
      is_default,
      available_placeholders
    } = req.body;

    if (!dojo_id || !name) {
      return res.status(400).json({
        error: 'Fehlende Pflichtfelder: dojo_id, name'
      });
    }
    if (editor_version !== 'tiptap' && !grapesjs_html) {
      return res.status(400).json({
        error: 'Fehlende Pflichtfelder: grapesjs_html (oder editor_version=tiptap)'
      });
    }

    // Wenn is_default = true, setze alle anderen Vorlagen desselben Typs auf false
    if (is_default) {
      await queryAsync(`
        UPDATE vertragsvorlagen
        SET is_default = FALSE
        WHERE dojo_id = ? AND template_type = ?
      `, [dojo_id, template_type || 'vertrag']);
    }

    const result = await queryAsync(`
      INSERT INTO vertragsvorlagen (
        dojo_id,
        name,
        beschreibung,
        grapesjs_html,
        grapesjs_css,
        grapesjs_components,
        grapesjs_styles,
        tiptap_html,
        editor_version,
        template_type,
        is_default,
        available_placeholders
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dojo_id,
      name,
      beschreibung || '',
      grapesjs_html || '',
      grapesjs_css || '',
      grapesjs_components || '',
      grapesjs_styles || '',
      tiptap_html || null,
      editor_version || 'grapesjs',
      template_type || 'vertrag',
      is_default || false,
      available_placeholders || null
    ]);
    res.json({
      success: true,
      message: 'Vorlage erstellt',
      data: { id: result.insertId }
    });
  } catch (err) {
    logger.error('Fehler beim Erstellen der Vorlage:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// PUT /api/vertragsvorlagen/:id - Vorlage aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      beschreibung,
      grapesjs_html,
      grapesjs_css,
      grapesjs_components,
      grapesjs_styles,
      tiptap_html,
      editor_version,
      template_type,
      is_default,
      aktiv
    } = req.body;

    // Prüfen ob Vorlage existiert
    const existing = await queryAsync('SELECT * FROM vertragsvorlagen WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    const dojo_id = existing[0].dojo_id;

    // Wenn is_default = true, setze alle anderen Vorlagen desselben Typs auf false
    if (is_default) {
      await queryAsync(`
        UPDATE vertragsvorlagen
        SET is_default = FALSE
        WHERE dojo_id = ? AND template_type = ? AND id != ?
      `, [dojo_id, template_type || existing[0].template_type, id]);
    }

    // Version erhöhen
    const newVersion = (existing[0].version || 1) + 1;

    await queryAsync(`
      UPDATE vertragsvorlagen
      SET
        name = ?,
        beschreibung = ?,
        grapesjs_html = ?,
        grapesjs_css = ?,
        grapesjs_components = ?,
        grapesjs_styles = ?,
        tiptap_html = ?,
        editor_version = ?,
        template_type = ?,
        is_default = ?,
        aktiv = ?,
        version = ?,
        aktualisiert_am = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name !== undefined ? name : existing[0].name,
      beschreibung !== undefined ? beschreibung : existing[0].beschreibung,
      grapesjs_html !== undefined ? grapesjs_html : existing[0].grapesjs_html,
      grapesjs_css !== undefined ? grapesjs_css : existing[0].grapesjs_css,
      grapesjs_components !== undefined ? grapesjs_components : existing[0].grapesjs_components,
      grapesjs_styles !== undefined ? grapesjs_styles : existing[0].grapesjs_styles,
      tiptap_html !== undefined ? tiptap_html : existing[0].tiptap_html,
      editor_version !== undefined ? editor_version : existing[0].editor_version,
      template_type !== undefined ? template_type : existing[0].template_type,
      is_default !== undefined ? is_default : existing[0].is_default,
      aktiv !== undefined ? aktiv : existing[0].aktiv,
      newVersion,
      id
    ]);
    res.json({
      success: true,
      message: 'Vorlage aktualisiert',
      data: { version: newVersion }
    });
  } catch (err) {
    logger.error('Fehler beim Aktualisieren der Vorlage:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// DELETE /api/vertragsvorlagen/:id - Vorlage löschen
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await queryAsync('DELETE FROM vertragsvorlagen WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }
    res.json({ success: true, message: 'Vorlage gelöscht' });
  } catch (err) {
    logger.error('Fehler beim Löschen der Vorlage:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// GET /api/vertragsvorlagen/:id/preview - Vorschau der Vorlage mit echten Daten
router.get('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;

    const vorlagen = await queryAsync('SELECT * FROM vertragsvorlagen WHERE id = ?', [id]);

    if (vorlagen.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    const template = vorlagen[0];

    // Versuche, echte Daten zu laden (erstes Mitglied mit Vertrag für dieses Dojo)
    let sampleData;

    try {
      const mitglieder = await queryAsync(`
        SELECT m.*, v.*, d.*,
               m.vorname as mitglied_vorname, m.nachname as mitglied_nachname,
               m.email as mitglied_email, m.telefon as mitglied_telefon,
               m.strasse as mitglied_strasse, m.hausnummer as mitglied_hausnummer,
               m.plz as mitglied_plz, m.ort as mitglied_ort,
               v.vertragsnummer, v.vertragsbeginn, v.vertragsende,
               v.monatsbeitrag, v.mindestlaufzeit_monate, v.kuendigungsfrist_monate,
               d.dojoname, d.strasse as dojo_strasse, d.hausnummer as dojo_hausnummer,
               d.plz as dojo_plz, d.ort as dojo_ort, d.telefon as dojo_telefon,
               d.email as dojo_email, d.internet as dojo_internet
        FROM mitglieder m
        LEFT JOIN vertraege v ON m.id = v.mitglied_id
        LEFT JOIN dojo d ON m.dojo_id = d.id
        WHERE m.dojo_id = ? AND v.id IS NOT NULL
        ORDER BY v.erstellt_am DESC
        LIMIT 1
      `, [template.dojo_id]);

      if (mitglieder.length > 0) {
        const data = mitglieder[0];
        sampleData = {
          mitglied: {
            vorname: data.mitglied_vorname || 'Max',
            nachname: data.mitglied_nachname || 'Mustermann',
            email: data.mitglied_email || 'max.mustermann@example.com',
            telefon: data.mitglied_telefon || '0123 456789',
            strasse: data.mitglied_strasse || 'Musterstraße',
            hausnummer: data.mitglied_hausnummer || '123',
            plz: data.mitglied_plz || '12345',
            ort: data.mitglied_ort || 'Musterstadt',
            geburtsdatum: data.geburtsdatum ? new Date(data.geburtsdatum).toLocaleDateString('de-DE') : '01.01.1990',
            mitgliedsnummer: data.mitgliedsnummer || 'M-001'
          },
          vertrag: {
            vertragsnummer: data.vertragsnummer || 'V-2025-001',
            vertragsbeginn: data.vertragsbeginn ? new Date(data.vertragsbeginn).toLocaleDateString('de-DE') : '01.01.2025',
            vertragsende: data.vertragsende ? new Date(data.vertragsende).toLocaleDateString('de-DE') : '31.12.2025',
            monatsbeitrag: data.monatsbeitrag || '49.99',
            mindestlaufzeit_monate: data.mindestlaufzeit_monate || '12',
            kuendigungsfrist_monate: data.kuendigungsfrist_monate || '3',
            tarifname: data.tarifname || 'Standard Tarif'
          },
          dojo: {
            dojoname: data.dojoname || 'Muster Dojo',
            strasse: data.dojo_strasse || 'Dojo-Straße',
            hausnummer: data.dojo_hausnummer || '1',
            plz: data.dojo_plz || '54321',
            ort: data.dojo_ort || 'Dojo-Stadt',
            telefon: data.dojo_telefon || '09876 543210',
            email: data.dojo_email || 'info@muster-dojo.de',
            internet: data.dojo_internet || 'www.muster-dojo.de'
          },
          system: {
            datum: new Date().toLocaleDateString('de-DE'),
            jahr: new Date().getFullYear(),
            monat: new Date().toLocaleDateString('de-DE', { month: 'long' })
          }
        };
      } else {
        throw new Error('Keine Mitglieder mit Vertrag gefunden');
      }
    } catch (dbErr) {
      // Fallback auf Beispieldaten, wenn keine echten Daten verfügbar sind
      logger.warn('⚠️ Verwende Beispieldaten für Vorschau:', dbErr.message);
      sampleData = {
        mitglied: {
          vorname: 'Max',
          nachname: 'Mustermann',
          email: 'max.mustermann@example.com',
          telefon: '0123 456789',
          strasse: 'Musterstraße',
          hausnummer: '123',
          plz: '12345',
          ort: 'Musterstadt',
          geburtsdatum: '01.01.1990',
          mitgliedsnummer: 'M-001'
        },
        vertrag: {
          vertragsnummer: 'V-2025-001',
          vertragsbeginn: '01.01.2025',
          vertragsende: '31.12.2025',
          monatsbeitrag: '49.99',
          mindestlaufzeit_monate: '12',
          kuendigungsfrist_monate: '3',
          tarifname: 'Standard Tarif'
        },
        dojo: {
          dojoname: 'Muster Dojo',
          strasse: 'Dojo-Straße',
          hausnummer: '1',
          plz: '54321',
          ort: 'Dojo-Stadt',
          telefon: '09876 543210',
          email: 'info@muster-dojo.de',
          internet: 'www.muster-dojo.de'
        },
        system: {
          datum: new Date().toLocaleDateString('de-DE'),
          jahr: new Date().getFullYear(),
          monat: new Date().toLocaleDateString('de-DE', { month: 'long' })
        }
      };
    }

    // ── TipTap-Vorlage: professionelle A4-Browser-Vorschau ───────────────────
    if (template.editor_version === 'tiptap') {
      const logoBase64 = await loadDojoLogo(template.dojo_id);

      const resolvedHtml = replacePlaceholders(template.tiptap_html || '', {
        mitglied: sampleData.mitglied,
        vertrag: sampleData.vertrag,
        dojo: sampleData.dojo,
        system: sampleData.system,
      });

      const dojoName  = sampleData.dojo.dojoname;
      const dojoAdr   = [sampleData.dojo.strasse, sampleData.dojo.hausnummer].filter(Boolean).join(' ');
      const dojoOrt   = [sampleData.dojo.plz, sampleData.dojo.ort].filter(Boolean).join(' ');
      const dojoKtkt  = [sampleData.dojo.telefon, sampleData.dojo.email].filter(Boolean).join(' | ');
      const datumH    = sampleData.system.datum;
      const logoHtml  = logoBase64
        ? `<img src="${logoBase64}" alt="Logo" style="max-width:40mm;max-height:20mm;object-fit:contain;" />`
        : '';

      const previewHtml = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Vorschau — ${template.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #3a3a3a; min-height: 100%; }
  body { padding: 24px 16px 40px; font-family: 'Helvetica Neue', Arial, sans-serif; }

  .preview-banner {
    max-width: 210mm; margin: 0 auto 0;
    background: #8B0000; color: #fff;
    font-size: 9pt; font-weight: 600;
    padding: 6px 14px;
    border-radius: 3px 3px 0 0;
    display: flex; justify-content: space-between; align-items: center;
    letter-spacing: 0.03em;
  }

  .a4 {
    background: #fff; color: #1a1a1a;
    max-width: 210mm; min-height: 297mm;
    margin: 0 auto;
    padding: 20mm 18mm 28mm 20mm;
    box-shadow: 0 8px 40px rgba(0,0,0,0.65);
    font-size: 10pt; line-height: 1.55;
    position: relative;
  }

  /* ── KOPFZEILE ── */
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2pt solid #1a1a1a;
    padding-bottom: 4mm; margin-bottom: 8mm;
  }
  .header-org { text-align: right; }
  .header-org-name { font-size: 13pt; font-weight: 700; }
  .header-org-detail { font-size: 8pt; color: #555; margin-top: 2pt; line-height: 1.4; }

  /* ── TITEL ── */
  .doc-title {
    font-size: 15pt; font-weight: 700;
    text-align: center; margin: 6mm 0 4mm; letter-spacing: 0.02em;
  }
  .doc-meta {
    display: flex; justify-content: space-between;
    font-size: 8.5pt; color: #555;
    margin-bottom: 6mm; padding-bottom: 3mm;
    border-bottom: 0.5pt solid #ccc;
  }

  /* ── INHALT ── */
  .doc-body { font-size: 10pt; line-height: 1.6; }
  .doc-body p { margin-bottom: 6pt; }
  .doc-body h1 { font-size: 13pt; font-weight: 700; margin: 8pt 0 4pt; color: #1a1a1a; }
  .doc-body h2 { font-size: 11pt; font-weight: 700; margin: 6pt 0 4pt; }
  .doc-body h3 { font-size: 10pt; font-weight: 700; margin: 5pt 0 3pt; }
  .doc-body ul, .doc-body ol { padding-left: 14pt; margin-bottom: 6pt; }
  .doc-body li { margin-bottom: 2pt; }
  .doc-body strong { font-weight: 700; }
  .doc-body em { font-style: italic; }
  .doc-body u { text-decoration: underline; }
  .doc-body table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; font-size: 9pt; }
  .doc-body td, .doc-body th { border: 0.5pt solid #aaa; padding: 3pt 5pt; }
  .doc-body th { background: #f0f0f0; font-weight: 700; }
  .doc-body [style*="text-align: center"] { text-align: center; }
  .doc-body [style*="text-align: right"]  { text-align: right; }

  /* ── SIGNATUR ── */
  .signature-block { margin-top: 14mm; display: flex; gap: 20mm; }
  .signature-col { flex: 1; }
  .signature-line { border-top: 0.75pt solid #1a1a1a; margin-bottom: 3pt; }
  .signature-label { font-size: 8pt; color: #555; }

  @media print {
    html, body { background: #fff; padding: 0; }
    .preview-banner { display: none; }
    .a4 { box-shadow: none; margin: 0; padding: 0; max-width: 100%; min-height: auto; }
  }
</style>
</head>
<body>

<div class="preview-banner">
  <span>VORSCHAU — Musterdaten</span>
  <span>${template.name}</span>
</div>

<div class="a4">
  <div class="doc-header">
    <div>${logoHtml}</div>
    <div class="header-org">
      <div class="header-org-name">${dojoName}</div>
      <div class="header-org-detail">
        ${dojoAdr}${dojoOrt ? ', ' + dojoOrt : ''}<br>
        ${dojoKtkt}
      </div>
    </div>
  </div>

  <div class="doc-title">${template.name || 'Vertragsvorlage'}</div>

  <div class="doc-meta">
    <span>Musterdaten: ${sampleData.mitglied.vorname} ${sampleData.mitglied.nachname}</span>
    <span>Datum: ${datumH}</span>
  </div>

  <div class="doc-body">${resolvedHtml}</div>

  <div class="signature-block">
    <div class="signature-col">
      <div class="signature-line"></div>
      <div class="signature-label">Ort, Datum</div>
    </div>
    <div class="signature-col">
      <div class="signature-line"></div>
      <div class="signature-label">Unterschrift Mitglied</div>
    </div>
    <div class="signature-col">
      <div class="signature-line"></div>
      <div class="signature-label">Unterschrift ${dojoName}</div>
    </div>
  </div>
</div>

</body>
</html>`;
      return res.send(previewHtml);
    }

    // ── GrapeJS-Vorlage (Fallback) ────────────────────────────────────────────
    let html = template.grapesjs_html;

    // Platzhalter ersetzen (unterstützt beide Formate: {{kategorie.feld}} und {{feld}})
    Object.entries(sampleData).forEach(([category, data]) => {
      Object.entries(data).forEach(([key, value]) => {
        // Format: {{mitglied.vorname}}
        const placeholderWithCategory = new RegExp(`{{${category}\\.${key}}}`, 'g');
        html = html.replace(placeholderWithCategory, value || '');

        // Format: {{vorname}} (ohne Kategorie - für Kompatibilität)
        const placeholderWithoutCategory = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(placeholderWithoutCategory, value || '');
      });
    });

    // Zusätzliche Template-spezifische Platzhalter
    const additionalMappings = {
      'mitglied_id': sampleData.mitglied.mitgliedsnummer,
      'anrede': 'Herr/Frau',
      'mobil': sampleData.mitglied.telefon,
      'dojo_name': sampleData.dojo.dojoname,
      'dojo_adresse': `${sampleData.dojo.strasse} ${sampleData.dojo.hausnummer}, ${sampleData.dojo.plz} ${sampleData.dojo.ort}`,
      'dojo_kontakt': `Tel: ${sampleData.dojo.telefon} | E-Mail: ${sampleData.dojo.email}`,
      'tarif_name': sampleData.vertrag.tarifname,
      'betrag': sampleData.vertrag.monatsbeitrag,
      'aufnahmegebuehr': '0.00',
      'mindestlaufzeit': `${sampleData.vertrag.mindestlaufzeit_monate} Monate`,
      'nutzungsbeginn': sampleData.vertrag.vertragsbeginn,
      'vertragsverlaengerung': '1 Monat',
      'kuendigungsfrist': `${sampleData.vertrag.kuendigungsfrist_monate} Monate`,
      'zahlweise': 'monatlich',
      'zahlungsdienstleister': sampleData.dojo.dojoname,
      'glaeubiger_id': 'DE00ZZZ00000000000',
      'kontoinhaber': `${sampleData.mitglied.vorname} ${sampleData.mitglied.nachname}`,
      'kreditinstitut': 'Musterbank',
      'bic': 'DEUTDEDBXXX',
      'iban': 'DE89 3704 0044 0532 0130 00',
      'sepa_referenz': sampleData.vertrag.vertragsnummer,
      'zahlungstermine': 'Siehe Tabelle unten'
    };

    Object.entries(additionalMappings).forEach(([placeholder, value]) => {
      const regex = new RegExp(`{{${placeholder}}}`, 'g');
      html = html.replace(regex, value || '');
    });

    // Logo laden und einfügen
    const logoBase64 = await loadDojoLogo(template.dojo_id);
    if (logoBase64) {
      const logoHtml = `<img src="${logoBase64}" alt="Dojo Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />`;
      html = html.replace(
        /<div[^>]*class="[^"]*logo-placeholder[^"]*"[^>]*>[\s\S]*?<\/div>/g,
        (match) => match.replace(/>[\s\S]*?<\/div>/, `>${logoHtml}</div>`)
      );
    }

    // HTML mit CSS kombinieren
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background: #f5f5f5;
          }

          /* A4-Seiten-Simulation */
          .page {
            background: white;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 0 auto 20mm auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
            page-break-after: always;
          }

          /* Seitenwechsel-Indikator (nur am Bildschirm sichtbar) */
          .page:not(:last-child)::after {
            content: '─────────── Seitenwechsel ───────────';
            display: block;
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 20mm;
            padding: 10px;
            background: #f0f0f0;
            border-top: 2px dashed #ccc;
            border-bottom: 2px dashed #ccc;
          }

          /* Für Druckansicht */
          @media print {
            body {
              background: white;
              margin: 0;
            }
            .page {
              margin: 0;
              box-shadow: none;
              width: 100%;
              min-height: auto;
            }
            .page::after {
              display: none !important;
            }
          }

          ${template.grapesjs_css || ''}
        </style>
      </head>
      <body>
        <div class="page">
          ${html}
        </div>
      </body>
      </html>
    `;

    res.send(fullHtml);
  } catch (err) {
    logger.error('Fehler beim Erstellen der Vorschau:', { error: err });
    res.status(500).json({ error: 'Fehler bei der Vorschau', details: err.message });
  }
});

// GET /api/vertragsvorlagen/:id/generate-pdf - PDF mit echten Mitgliedsdaten generieren
router.get('/:id/generate-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const { mitglied_id, vertrag_id } = req.query;

    if (!mitglied_id) {
      return res.status(400).json({ error: 'mitglied_id ist erforderlich' });
    }

    // Vorlage laden
    const vorlagen = await queryAsync('SELECT * FROM vertragsvorlagen WHERE id = ?', [id]);
    if (vorlagen.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }
    const template = vorlagen[0];

    // Mitgliedsdaten laden
    const mitglieder = await queryAsync('SELECT * FROM mitglieder WHERE id = ?', [mitglied_id]);
    if (mitglieder.length === 0) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }
    const mitglied = mitglieder[0];

    // Dojo-Daten laden
    const dojos = await queryAsync('SELECT * FROM dojo WHERE id = ?', [mitglied.dojo_id]);
    const dojo = dojos.length > 0 ? dojos[0] : {};

    // Vertragsdaten laden (optional)
    let vertrag = null;
    if (vertrag_id) {
      const vertraege = await queryAsync('SELECT * FROM vertraege WHERE id = ?', [vertrag_id]);
      if (vertraege.length > 0) {
        vertrag = vertraege[0];
      }
    } else {
      // Letzten aktiven Vertrag laden
      const vertraege = await queryAsync(
        'SELECT * FROM vertraege WHERE mitglied_id = ? AND status = "aktiv" ORDER BY vertragsbeginn DESC LIMIT 1',
        [mitglied_id]
      );
      if (vertraege.length > 0) {
        vertrag = vertraege[0];
      }
    }

    // Daten für Platzhalter vorbereiten
    const data = {
      mitglied: {
        vorname: mitglied.vorname || '',
        nachname: mitglied.nachname || '',
        email: mitglied.email || '',
        telefon: mitglied.telefon || '',
        strasse: mitglied.strasse || '',
        hausnummer: mitglied.hausnummer || '',
        plz: mitglied.plz || '',
        ort: mitglied.ort || '',
        geburtsdatum: mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE') : '',
        mitgliedsnummer: mitglied.mitgliedsnummer || mitglied.id
      },
      vertrag: vertrag ? {
        vertragsnummer: vertrag.vertragsnummer || `V-${vertrag.id}`,
        vertragsbeginn: vertrag.vertragsbeginn ? new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE') : '',
        vertragsende: vertrag.vertragsende ? new Date(vertrag.vertragsende).toLocaleDateString('de-DE') : '',
        monatsbeitrag: vertrag.monatsbeitrag || '0.00',
        mindestlaufzeit_monate: vertrag.mindestlaufzeit_monate || '0',
        kuendigungsfrist_monate: vertrag.kuendigungsfrist_monate || '0',
        tarifname: vertrag.tarifname || ''
      } : {
        vertragsnummer: '',
        vertragsbeginn: '',
        vertragsende: '',
        monatsbeitrag: '',
        mindestlaufzeit_monate: '',
        kuendigungsfrist_monate: '',
        tarifname: ''
      },
      dojo: {
        dojoname: dojo.dojoname || '',
        strasse: dojo.strasse || '',
        hausnummer: dojo.hausnummer || '',
        plz: dojo.plz || '',
        ort: dojo.ort || '',
        telefon: dojo.telefon || '',
        email: dojo.email || '',
        internet: dojo.internet || ''
      },
      system: {
        datum: new Date().toLocaleDateString('de-DE'),
        jahr: new Date().getFullYear().toString(),
        monat: (new Date().getMonth() + 1).toString().padStart(2, '0')
      }
    };

    // Template rendern
    let html = template.grapesjs_html;

    // Platzhalter ersetzen
    Object.entries(data).forEach(([category, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{${category}\\.${key}}}`, 'g');
        html = html.replace(placeholder, value || '');
      });
    });

    // HTML mit CSS kombinieren
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background: #f5f5f5;
          }

          /* A4-Seiten-Simulation */
          .page {
            background: white;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 0 auto 20mm auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
            page-break-after: always;
          }

          /* Seitenwechsel-Indikator (nur am Bildschirm sichtbar) */
          .page:not(:last-child)::after {
            content: '─────────── Seitenwechsel ───────────';
            display: block;
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 20mm;
            padding: 10px;
            background: #f0f0f0;
            border-top: 2px dashed #ccc;
            border-bottom: 2px dashed #ccc;
          }

          /* Für Druckansicht */
          @media print {
            body {
              background: white;
              margin: 0;
            }
            .page {
              margin: 0;
              box-shadow: none;
              width: 100%;
              min-height: auto;
            }
            .page::after {
              display: none !important;
            }
          }

          ${template.grapesjs_css || ''}
        </style>
      </head>
      <body>
        <div class="page">
          ${html}
        </div>
      </body>
      </html>
    `;

    // PDF generieren mit Puppeteer
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });

    await browser.close();

    // PDF als Download senden
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${template.name}_${mitglied.nachname}_${mitglied.vorname}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Fehler beim Generieren des PDFs:', { error: err });
    res.status(500).json({ error: 'Fehler beim Generieren des PDFs', details: err.message });
  }
});

// GET /api/vertragsvorlagen/:id/download - Vorlage als PDF herunterladen
router.get('/:id/download', async (req, res) => {
  try {
    const vorlageId = req.params.id;
    
    // Vorlage laden
    const vorlage = await queryAsync('SELECT * FROM vertragsvorlagen WHERE id = ?', [vorlageId]);
    
    if (vorlage.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }
    
    const template = vorlage[0];
    
    // HTML mit Platzhaltern erstellen (ohne Mitgliedsdaten)
    const htmlContent = template.grapesjs_html || '';
    const cssContent = template.grapesjs_css || '';
    
    // Build complete HTML
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            ${cssContent}
            body { font-family: Arial, sans-serif; padding: 20px; }
            @page { margin: 2cm; }
            .placeholder { background-color: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-style: italic; }
          </style>
        </head>
        <body>
          ${htmlContent.replace(/\{\{[^}]+\}\}/g, '<span class="placeholder">$&</span>')}
        </body>
      </html>
    `;
    
    // PDF mit Puppeteer generieren
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // PDF generieren
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });
    
    await browser.close();
    
    // PDF als Download senden
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${template.name.replace(/[^a-zA-Z0-9]/g, '_')}_Vorlage.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    logger.error('Fehler beim Download der Vorlage:', { error: error });
    res.status(500).json({ error: 'Fehler beim Download der Vorlage' });
  }
});

// POST /api/vertragsvorlagen/:id/copy - Vorlage in anderes Dojo kopieren
router.post('/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const { target_dojo_id } = req.body;

    if (!target_dojo_id) {
      return res.status(400).json({ error: 'target_dojo_id ist erforderlich' });
    }

    // Original-Vorlage abrufen
    const original = await queryAsync(`
      SELECT * FROM vertragsvorlagen WHERE id = ?
    `, [id]);

    if (original.length === 0) {
      return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    }

    const template = original[0];

    // Prüfen ob Ziel-Dojo existiert
    const targetDojo = await queryAsync('SELECT id FROM dojo WHERE id = ?', [target_dojo_id]);
    if (targetDojo.length === 0) {
      return res.status(404).json({ error: 'Ziel-Dojo nicht gefunden' });
    }

    // Neue Vorlage im Ziel-Dojo erstellen
    const result = await queryAsync(`
      INSERT INTO vertragsvorlagen (
        dojo_id,
        name,
        beschreibung,
        grapesjs_html,
        grapesjs_css,
        grapesjs_components,
        grapesjs_styles,
        template_type,
        is_default,
        aktiv,
        version,
        available_placeholders
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      target_dojo_id,
      template.name + ' (Kopie)',
      template.beschreibung,
      template.grapesjs_html,
      template.grapesjs_css,
      template.grapesjs_components,
      template.grapesjs_styles,
      template.template_type,
      false, // Kopie ist nie Standard
      template.aktiv,
      '1.0', // Neue Version für Kopie
      template.available_placeholders
    ]);

    res.json({
      success: true,
      message: 'Vorlage erfolgreich kopiert',
      data: { id: result.insertId }
    });
  } catch (err) {
    logger.error('Fehler beim Kopieren der Vorlage:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// GET /api/vertragsvorlagen/:id/generate-pdf-tiptap - PDF aus TipTap-HTML generieren
router.get('/:id/generate-pdf-tiptap', async (req, res) => {
  try {
    const { id } = req.params;
    const { mitglied_id, vertrag_id } = req.query;

    const vorlagen = await queryAsync('SELECT * FROM vertragsvorlagen WHERE id = ?', [id]);
    if (vorlagen.length === 0) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
    const template = vorlagen[0];

    if (!template.tiptap_html) {
      return res.status(400).json({ error: 'Diese Vorlage hat keinen TipTap-Inhalt' });
    }

    // Dojo-Daten
    const dojos = await queryAsync('SELECT * FROM dojo WHERE id = ?', [template.dojo_id]);
    const dojo = dojos.length > 0 ? dojos[0] : {};

    // Mitglied (optional)
    let mitglied = null;
    if (mitglied_id) {
      const mitglieder = await queryAsync('SELECT * FROM mitglieder WHERE id = ?', [mitglied_id]);
      if (mitglieder.length > 0) mitglied = mitglieder[0];
    }

    // Vertrag (optional)
    let vertrag = null;
    if (vertrag_id) {
      const vertraege = await queryAsync('SELECT * FROM vertraege WHERE id = ?', [vertrag_id]);
      if (vertraege.length > 0) vertrag = vertraege[0];
    } else if (mitglied_id) {
      const vertraege = await queryAsync(
        'SELECT * FROM vertraege WHERE mitglied_id = ? AND status = "aktiv" ORDER BY vertragsbeginn DESC LIMIT 1',
        [mitglied_id]
      );
      if (vertraege.length > 0) vertrag = vertraege[0];
    }

    // Logo laden
    const logoBase64 = await loadDojoLogo(template.dojo_id);

    // Format Datumsfelder
    if (mitglied?.geburtsdatum) {
      mitglied.geburtsdatum = new Date(mitglied.geburtsdatum).toLocaleDateString('de-DE');
    }
    if (vertrag?.vertragsbeginn) vertrag.vertragsbeginn = new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE');
    if (vertrag?.vertragsende) vertrag.vertragsende = new Date(vertrag.vertragsende).toLocaleDateString('de-DE');

    const pdfBuffer = await generateVertragsvorlagePdf({
      tiptapHtml: template.tiptap_html,
      templateName: template.name,
      dojo,
      mitglied,
      vertrag,
      logoBase64,
    });

    const filename = `${template.name}_${mitglied ? mitglied.nachname + '_' + mitglied.vorname : 'Vorlage'}.pdf`
      .replace(/[^a-zA-Z0-9_.-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('Fehler beim Generieren des TipTap-PDFs:', { error: err });
    res.status(500).json({ error: 'Fehler beim Generieren des PDFs', details: err.message });
  }
});

module.exports = router;
