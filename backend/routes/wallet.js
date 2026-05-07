const express = require('express');
const router = express.Router();
const db = require('../db');
const QRCode = require('qrcode');
const pool = db.promise();
const { getSecureDojoId } = require('../middleware/tenantSecurity');
const logger = require('../utils/logger');

function makeSolidPNG(width, height, r, g, b) {
  const PNG = require('pngjs').PNG;
  const png = new PNG({ width, height, colorType: 2, bitDepth: 8 });
  png.data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

// GET /wallet/qr/:mitglied_id — QR-Code als PNG oder SVG
router.get('/qr/:mitglied_id', async (req, res) => {
  const mitgliedId = parseInt(req.params.mitglied_id);
  const { format = 'png' } = req.query;
  const secureDojoId = getSecureDojoId(req);

  try {
    const dojoClause = secureDojoId ? ' AND m.dojo_id = ?' : '';
    const params = [mitgliedId, ...(secureDojoId ? [secureDojoId] : [])];
    const [rows] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.mitglieds_nr, m.dojo_id,
              d.dojoname,
              GROUP_CONCAT(DISTINCT CONCAT(s.name, ': ', COALESCE(g.name, '?')) ORDER BY s.name SEPARATOR ' | ') AS graduierungen
       FROM mitglieder m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
       LEFT JOIN stile s ON ms.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON ms.graduierung_id = g.graduierung_id
       WHERE m.mitglied_id = ?${dojoClause}
       GROUP BY m.mitglied_id`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const m = rows[0];
    const qrData = JSON.stringify({
      id: m.mitglied_id,
      nr: m.mitglieds_nr,
      name: `${m.vorname} ${m.nachname}`,
      dojo: m.dojoname,
      grad: m.graduierungen,
      ts: Date.now()
    });

    if (format === 'svg') {
      const svg = await QRCode.toString(qrData, { type: 'svg', margin: 1, width: 256 });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    // Default: PNG Buffer
    const png = await QRCode.toBuffer(qrData, { type: 'png', margin: 1, width: 256 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim QR-Code', detail: err.message });
  }
});

// GET /wallet/pass/:mitglied_id — Ausweis-Daten als JSON
router.get('/pass/:mitglied_id', async (req, res) => {
  const mitgliedId = parseInt(req.params.mitglied_id);
  const secureDojoId = getSecureDojoId(req);

  try {
    const dojoClause = secureDojoId ? ' AND m.dojo_id = ?' : '';
    const params = [mitgliedId, ...(secureDojoId ? [secureDojoId] : [])];
    const [rows] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.mitglieds_nr,
              m.geburtsdatum, m.eintrittsdatum,
              d.dojoname,
              GROUP_CONCAT(DISTINCT CONCAT(s.name, ': ', COALESCE(g.name, 'Anfänger')) ORDER BY s.name SEPARATOR '\n') AS graduierungen,
              GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stile
       FROM mitglieder m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
       LEFT JOIN stile s ON ms.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON ms.graduierung_id = g.graduierung_id
       WHERE m.mitglied_id = ?${dojoClause}
       GROUP BY m.mitglied_id`,
      params
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const m = rows[0];
    res.json({
      success: true,
      pass: {
        mitglied_id: m.mitglied_id,
        mitglieds_nr: m.mitglieds_nr,
        vorname: m.vorname,
        nachname: m.nachname,
        dojo: m.dojoname,
        stile: m.stile,
        graduierungen: m.graduierungen,
        eintrittsdatum: m.eintrittsdatum,
        generiert_am: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Datenbankfehler', detail: err.message });
  }
});

// GET /wallet/apple-pass — Apple Wallet Mitgliedskarte (.pkpass) für eingeloggtes Mitglied
router.get('/apple-pass', async (req, res) => {
  const mitgliedId = req.user?.mitglied_id;
  if (!mitgliedId) {
    return res.status(403).json({ error: 'Nur für Mitglieder zugänglich' });
  }

  const teamId = process.env.APPLE_TEAM_ID;
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const passCert = process.env.APPLE_PASS_CERT;
  const passKey = process.env.APPLE_PASS_KEY;

  if (!teamId || !passTypeId || !passCert || !passKey) {
    return res.status(503).json({
      error: 'Apple Wallet nicht konfiguriert',
      setup: ['APPLE_TEAM_ID', 'APPLE_PASS_TYPE_ID', 'APPLE_PASS_CERT', 'APPLE_PASS_KEY']
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT m.mitglied_id, m.vorname, m.nachname, m.mitglieds_nr,
              m.eintrittsdatum, m.dojo_id,
              d.dojoname,
              GROUP_CONCAT(DISTINCT CONCAT(s.name, ': ', COALESCE(g.name, 'Anfänger')) ORDER BY s.name SEPARATOR ' | ') AS graduierungen,
              GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS stile
       FROM mitglieder m
       LEFT JOIN dojo d ON m.dojo_id = d.id
       LEFT JOIN mitglied_stile ms ON m.mitglied_id = ms.mitglied_id
       LEFT JOIN stile s ON ms.stil_id = s.stil_id
       LEFT JOIN graduierungen g ON ms.graduierung_id = g.graduierung_id
       WHERE m.mitglied_id = ?
       GROUP BY m.mitglied_id`,
      [mitgliedId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    const m = rows[0];

    const { Template } = require('@walletpass/pass-js');

    const template = new Template('generic', {
      passTypeIdentifier: passTypeId,
      teamIdentifier: teamId,
      organizationName: m.dojoname || 'TDA Kampfkunstschule',
      backgroundColor: 'rgb(10, 10, 30)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: 'rgb(255, 215, 0)',
      logoText: m.dojoname || 'TDA',
      description: 'Mitgliedskarte'
    });

    template.setCertificate(passCert);
    template.setPrivateKey(passKey, process.env.APPLE_PASS_KEY_PASSPHRASE || '');

    const icon29 = makeSolidPNG(29, 29, 10, 10, 30);
    const icon58 = makeSolidPNG(58, 58, 10, 10, 30);
    const logo = makeSolidPNG(160, 50, 10, 10, 30);
    await template.images.add('icon', icon29);
    await template.images.add('icon', icon58, '2x');
    await template.images.add('logo', logo);

    const memberNr = String(m.mitglieds_nr || m.mitglied_id).padStart(5, '0');
    const pass = template.createPass({
      serialNumber: `dojo-mitglied-${mitgliedId}`,
      description: 'Mitgliedskarte'
    });

    pass.primaryFields.add({
      key: 'name',
      label: 'MITGLIED',
      value: `${m.vorname} ${m.nachname}`
    });

    pass.secondaryFields.add({
      key: 'dojo',
      label: 'DOJO',
      value: m.dojoname || 'TDA'
    });

    if (m.graduierungen) {
      pass.secondaryFields.add({
        key: 'grad',
        label: 'GÜRTEL',
        value: m.graduierungen
      });
    }

    pass.auxiliaryFields.add({
      key: 'nr',
      label: 'MITGLIEDS-NR.',
      value: memberNr
    });

    if (m.eintrittsdatum) {
      pass.auxiliaryFields.add({
        key: 'seit',
        label: 'MITGLIED SEIT',
        value: new Date(m.eintrittsdatum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
      });
    }

    pass.backFields.add({ key: 'stile', label: 'Kampfkünste', value: m.stile || '' });
    pass.backFields.add({ key: 'motto', label: 'Motto', value: '心技体 — Shin Gi Tai' });

    pass.barcodes = [{
      message: `DOJO-CHECKIN:${m.dojo_id}:${mitgliedId}`,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1'
    }];

    const buf = await pass.asBuffer();

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="mitgliedskarte-${memberNr}.pkpass"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buf);

    logger.info(`Apple Wallet Pass generiert — Mitglied ${mitgliedId}`);
  } catch (err) {
    logger.error('Apple Wallet Pass Fehler:', { error: err.message });
    res.status(500).json({ error: 'Fehler beim Generieren des Wallet Pass', detail: err.message });
  }
});

module.exports = router;
