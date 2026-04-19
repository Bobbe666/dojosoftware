// ============================================================================
// KAMPAGNEN ROUTES — Super-Admin
// E-Mail-Kampagnen an Akquise-Kontakte oder Lizenzinhaber (Dojo-Admins)
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../../db');
const logger = require('../../utils/logger');
const { requireSuperAdmin } = require('./shared');
const { sendEmailForDojo } = require('../../services/emailService');

const pool = db.promise();
const TDA_DOJO_ID = 2;

router.use(requireSuperAdmin);

// ── Platzhalter-Ersatz ────────────────────────────────────────────────────────
function ersetze(text, data) {
  if (!text) return text;
  return Object.entries(data).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v || ''), text);
}

function datumDe() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── GET /empfaenger-vorschau ─────────────────────────────────────────────────
// Query-Params: typ=akquise|lizenzinhaber, status, typen, plan_typen
router.get('/empfaenger-vorschau', async (req, res) => {
  const { typ, status, typen, plan_typen } = req.query;

  try {
    if (typ === 'akquise') {
      const where = ['email IS NOT NULL', "email != ''", "status NOT IN ('gewonnen','abgelehnt')"];
      const params = [];
      if (status) {
        const list = status.split(',').filter(Boolean);
        if (list.length) { where.push(`status IN (${list.map(() => '?').join(',')})`); params.push(...list); }
      }
      if (typen) {
        const list = typen.split(',').filter(Boolean);
        if (list.length) { where.push(`typ IN (${list.map(() => '?').join(',')})`); params.push(...list); }
      }
      const [rows] = await pool.query(
        `SELECT id, organisation, ansprechpartner, email, status, typ, ort, sportart
         FROM akquise_kontakte WHERE ${where.join(' AND ')} ORDER BY organisation LIMIT 500`,
        params
      );
      return res.json({ success: true, empfaenger: rows, anzahl: rows.length });
    }

    if (typ === 'lizenzinhaber') {
      const where = ['d.email IS NOT NULL', "d.email != ''"];
      const params = [];
      if (plan_typen) {
        const list = plan_typen.split(',').filter(Boolean);
        if (list.length) { where.push(`COALESCE(ds.plan_type,'trial') IN (${list.map(() => '?').join(',')})`); params.push(...list); }
      }
      const [rows] = await pool.query(
        `SELECT d.id, d.dojoname, d.inhaber, d.email, d.ort,
                COALESCE(ds.plan_type,'trial') AS plan_type
         FROM dojo d
         LEFT JOIN dojo_subscriptions ds ON d.id = ds.dojo_id
         WHERE ${where.join(' AND ')}
         ORDER BY d.dojoname LIMIT 500`,
        params
      );
      return res.json({ success: true, empfaenger: rows, anzahl: rows.length });
    }

    res.status(400).json({ success: false, message: 'Ungültiger Typ (akquise|lizenzinhaber)' });
  } catch (err) {
    logger.error('Kampagne Vorschau Fehler', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /vorlagen ─────────────────────────────────────────────────────────────
router.get('/vorlagen', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, betreff, html FROM akquise_vorlagen WHERE typ='email' AND aktiv=1 ORDER BY name"
    );
    res.json({ success: true, vorlagen: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /verlauf ──────────────────────────────────────────────────────────────
router.get('/verlauf', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT k.*, COUNT(ke.id) AS empfaenger_gesamt,
              SUM(ke.status='gesendet') AS ok,
              SUM(ke.status='fehler') AS fehler
       FROM kampagnen_versand k
       LEFT JOIN kampagnen_empfaenger ke ON k.id = ke.kampagne_id
       GROUP BY k.id ORDER BY k.erstellt_am DESC LIMIT 50`
    );
    res.json({ success: true, verlauf: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /senden ──────────────────────────────────────────────────────────────
router.post('/senden', async (req, res) => {
  const { typ, filter = {}, betreff, html } = req.body;
  const userId = req.user?.id || null;

  if (!typ || !betreff || !html) {
    return res.status(400).json({ success: false, message: 'typ, betreff und html sind Pflichtfelder' });
  }

  try {
    // Absender-Info laden
    const [[dojo]] = await pool.query(
      'SELECT dojoname, inhaber, email, strasse, hausnummer, plz, ort, internet FROM dojo WHERE id=? LIMIT 1',
      [TDA_DOJO_ID]
    );
    const absName    = dojo?.dojoname || 'Tiger & Dragon Association – International';
    const absInhaber = dojo?.inhaber  || 'Sascha Schreiner';
    const absEmail   = dojo?.email    || 'info@tda-intl.com';
    const absInternet= dojo?.internet || 'www.tda-intl.com';

    // Empfänger laden (gleiche Logik wie Vorschau)
    let empfaenger = [];
    if (typ === 'akquise') {
      const where = ['email IS NOT NULL', "email != ''", "status NOT IN ('gewonnen','abgelehnt')"];
      const params = [];
      if (filter.status?.length) { where.push(`status IN (${filter.status.map(() => '?').join(',')})`); params.push(...filter.status); }
      if (filter.typen?.length)  { where.push(`typ IN (${filter.typen.map(() => '?').join(',')})`);   params.push(...filter.typen);  }
      const [rows] = await pool.query(
        `SELECT id, organisation, ansprechpartner, email, status, ort, sportart FROM akquise_kontakte WHERE ${where.join(' AND ')} LIMIT 500`,
        params
      );
      empfaenger = rows.map(r => ({
        email: r.email,
        name: r.organisation,
        platzhalter: {
          organisation: r.organisation,
          ansprechpartner: r.ansprechpartner || '',
          anrede_persoenlich: r.ansprechpartner ? `Sehr geehrte/r ${r.ansprechpartner}` : 'Sehr geehrte Damen und Herren',
          anrede: 'Sehr geehrte Damen und Herren',
          ort: r.ort || '',
          sportart: r.sportart || 'Kampfkunst',
          absender_name: absName,
          absender_inhaber: absInhaber,
          absender_email: absEmail,
          absender_internet: absInternet,
          datum: datumDe(),
        },
      }));
    } else if (typ === 'lizenzinhaber') {
      const where = ['d.email IS NOT NULL', "d.email != ''"];
      const params = [];
      if (filter.plan_typen?.length) { where.push(`COALESCE(ds.plan_type,'trial') IN (${filter.plan_typen.map(() => '?').join(',')})`); params.push(...filter.plan_typen); }
      const [rows] = await pool.query(
        `SELECT d.id, d.dojoname, d.inhaber, d.email, d.ort, COALESCE(ds.plan_type,'trial') AS plan_type
         FROM dojo d LEFT JOIN dojo_subscriptions ds ON d.id = ds.dojo_id
         WHERE ${where.join(' AND ')} LIMIT 500`,
        params
      );
      empfaenger = rows.map(r => ({
        email: r.email,
        name: r.dojoname,
        platzhalter: {
          dojoname: r.dojoname,
          inhaber: r.inhaber || '',
          anrede_persoenlich: r.inhaber ? `Sehr geehrte/r ${r.inhaber}` : 'Sehr geehrte Damen und Herren',
          anrede: 'Sehr geehrte Damen und Herren',
          ort: r.ort || '',
          plan: r.plan_type,
          absender_name: absName,
          absender_inhaber: absInhaber,
          absender_email: absEmail,
          absender_internet: absInternet,
          datum: datumDe(),
        },
      }));
    }

    if (empfaenger.length === 0) {
      return res.status(400).json({ success: false, message: 'Keine Empfänger mit dieser Filterauswahl' });
    }

    // Kampagne anlegen
    const [kResult] = await pool.query(
      `INSERT INTO kampagnen_versand (typ, betreff, empfaenger_anzahl, status, filter_info, erstellt_von_user_id)
       VALUES (?, ?, ?, 'gesendet', ?, ?)`,
      [typ, betreff, empfaenger.length, JSON.stringify(filter), userId]
    );
    const kampagneId = kResult.insertId;

    // E-Mails versenden
    let gesendet = 0, fehler = 0;
    const empfaengerLog = [];

    for (const e of empfaenger) {
      const personalHtml = ersetze(html, e.platzhalter);
      const personalBetreff = ersetze(betreff, e.platzhalter);
      try {
        await sendEmailForDojo({ to: e.email, subject: personalBetreff, html: personalHtml }, TDA_DOJO_ID);
        empfaengerLog.push([kampagneId, e.email, e.name, 'gesendet', null]);
        gesendet++;
      } catch (mailErr) {
        logger.warn(`Kampagne Mail-Fehler an ${e.email}: ${mailErr.message}`);
        empfaengerLog.push([kampagneId, e.email, e.name, 'fehler', mailErr.message]);
        fehler++;
      }
      // Kurze Pause zwischen E-Mails (Anti-Spam / Rate-Limiting)
      await new Promise(r => setTimeout(r, 150));
    }

    // Empfänger-Log speichern
    if (empfaengerLog.length > 0) {
      await pool.query(
        'INSERT INTO kampagnen_empfaenger (kampagne_id, email, name, status, fehler_info) VALUES ?',
        [empfaengerLog]
      );
    }

    // Status updaten
    const status = fehler === empfaenger.length ? 'fehler' : fehler > 0 ? 'teilweise' : 'gesendet';
    await pool.query(
      'UPDATE kampagnen_versand SET gesendet_anzahl=?, fehler_anzahl=?, status=? WHERE id=?',
      [gesendet, fehler, status, kampagneId]
    );

    logger.info(`Kampagne ${kampagneId} gesendet: ${gesendet}/${empfaenger.length} erfolgreich`);
    res.json({ success: true, kampagne_id: kampagneId, gesendet, fehler, gesamt: empfaenger.length });

  } catch (err) {
    logger.error('Kampagne Senden Fehler', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /outlook-import ──────────────────────────────────────────────────────
// Importiert Outlook-Kontakte (CSV) in akquise_kontakte
// Body: { csv: "...", preview: true|false }
router.post('/outlook-import', async (req, res) => {
  const { csv, preview = false } = req.body;
  if (!csv) return res.status(400).json({ success: false, message: 'Kein CSV-Inhalt' });

  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ success: false, message: 'Kopfzeile + mindestens eine Zeile erforderlich' });

  const sep = lines[0].includes(';') ? ';' : ',';

  // CSV-Zeile parsen (berücksichtigt Anführungszeichen)
  const parseLine = (line) => {
    const result = [];
    let inQuote = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === sep && !inQuote) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);

  // Outlook DE + EN Spalten-Mapping
  const mapHeader = (h) => {
    const l = h.toLowerCase().trim();
    // Name
    if (/^vorname$|^first.?name$/.test(l))              return 'vorname';
    if (/^nachname$|^last.?name$|^surname$/.test(l))   return 'nachname';
    if (/^anzeigename$|^display.?name$|^name$/.test(l)) return 'anzeigename';
    // Organisation
    if (/^firma$|^company$|^unternehmen$/.test(l))      return 'organisation';
    // E-Mail (Outlook hat mehrere: "E-Mail-Adresse", "E-Mail 2-Adresse" etc.)
    if (/^e.?mail.?adresse$|^e.?mail.?(address|1)?$/.test(l) && !l.includes('2') && !l.includes('3')) return 'email';
    if (/^e.?mail.?2/.test(l))                          return 'email2';
    if (/^e.?mail.?3/.test(l))                          return 'email3';
    // Telefon
    if (/telefon.*(gesch|büro|work|business)|^geschäft.*tel|^business.*phone|^work.*phone/.test(l)) return 'telefon';
    if (/^mobil$|^handy$|^mobile$|^cell/.test(l))       return 'mobil';
    if (/^telefon$|^phone$|^tel$/.test(l))              return 'telefon_allg';
    // Adresse (geschäftlich bevorzugt)
    if (/stra[ße]+.*(gesch|work|business)|^business.*street|^work.*street/.test(l)) return 'strasse';
    if (/^stra[ße]+$|^street$/.test(l))                 return 'strasse_allg';
    if (/plz.*(gesch|work)|postal.*(gesch|work|business)|^business.*postal/.test(l)) return 'plz';
    if (/^plz$|^postleitzahl$|^postal.?code$|^zip/.test(l)) return 'plz_allg';
    if (/ort.*(gesch|work)|city.*(gesch|work|business)|^business.*city/.test(l)) return 'ort';
    if (/^ort$|^stadt$|^city$/.test(l))                 return 'ort_allg';
    // Sonstiges
    if (/^notiz|^notes?$|^kommentar$/.test(l))          return 'notiz';
    if (/^webseite|^website|^web.*page/.test(l))        return 'webseite';
    return l.replace(/\s+/g, '_');
  };

  const headers = rawHeaders.map(mapHeader);

  const kontakte = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

    // E-Mail: erste vorhandene nehmen
    const email = row.email || row.email2 || row.email3 || '';
    if (!email || !email.includes('@')) continue; // ohne E-Mail überspringen

    // Name aufbauen
    const vorname  = row.vorname || '';
    const nachname = row.nachname || '';
    const vollname = [vorname, nachname].filter(Boolean).join(' ');
    const organisation = row.organisation || row.anzeigename || vollname || email.split('@')[0];
    const ansprechpartner = vollname || '';

    const strasse = row.strasse || row.strasse_allg || '';
    const plz     = row.plz    || row.plz_allg     || '';
    const ort     = row.ort    || row.ort_allg      || '';
    const telefon = row.telefon || row.mobil || row.telefon_allg || '';

    kontakte.push({ organisation, ansprechpartner, email, telefon, strasse, plz, ort, webseite: row.webseite||'', notiz: row.notiz||'' });
  }

  if (preview) {
    return res.json({ success: true, preview: kontakte.slice(0, 20), gesamt: kontakte.length });
  }

  // Import durchführen
  let importiert = 0, duplikate = 0, fehler = [];
  for (const k of kontakte) {
    try {
      await pool.query(`
        INSERT INTO akquise_kontakte
          (organisation, ansprechpartner, email, telefon, strasse, plz, ort, webseite, notiz,
           typ, status, prioritaet, quelle)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sonstige', 'neu', 'mittel', 'sonstige')
      `, [k.organisation, k.ansprechpartner||null, k.email,
          k.telefon||null, k.strasse||null, k.plz||null, k.ort||null,
          k.webseite||null, k.notiz||null]);
      importiert++;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') duplikate++;
      else fehler.push(`${k.email}: ${err.message}`);
    }
  }

  logger.info(`Outlook-Import: ${importiert} importiert, ${duplikate} Duplikate, ${fehler.length} Fehler`);
  res.json({ success: true, importiert, duplikate, fehler: fehler.slice(0, 10), gesamt: kontakte.length });
});

module.exports = router;
