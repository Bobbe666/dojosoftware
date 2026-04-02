/**
 * Interne API-Routen für Service-to-Service Kommunikation
 * Verwendung: TDA Events Software → Dojosoftware
 * Gesichert mit TDA_INTERNAL_KEY Header
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db');

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => err ? reject(err) : resolve(results))
  );

// ── Middleware: API-Key Prüfung ──────────────────────────────
function requireInternalKey(req, res, next) {
  const key = req.headers['x-tda-internal-key'];
  if (!key || key !== process.env.TDA_INTERNAL_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}
router.use(requireInternalKey);

// ── GET /api/internal/verband-info ───────────────────────────
// Gibt Absender-Daten (Verband-Name, Adresse, Bankdaten) zurück
router.get('/verband-info', async (req, res) => {
  try {
    const keys = [
      'verband_name', 'verband_strasse', 'verband_plz', 'verband_ort',
      'verband_email', 'verband_telefon', 'verband_website',
      'verband_steuernummer', 'verband_ustid',
      'sepa_bankname', 'sepa_iban', 'sepa_bic',
    ];
    const placeholders = keys.map(() => '?').join(',');
    const rows = await queryAsync(
      `SELECT einstellung_key, einstellung_value FROM verband_einstellungen WHERE einstellung_key IN (${placeholders})`,
      keys
    );
    const cfg = {};
    rows.forEach(r => { cfg[r.einstellung_key] = r.einstellung_value || ''; });

    res.json({
      success: true,
      data: {
        name:         cfg.verband_name       || 'TDA International',
        strasse:      cfg.verband_strasse    || '',
        plz:          cfg.verband_plz        || '',
        ort:          cfg.verband_ort        || '',
        email:        cfg.verband_email      || '',
        telefon:      cfg.verband_telefon    || '',
        website:      cfg.verband_website    || '',
        steuernummer: cfg.verband_steuernummer || '',
        ust_id:       cfg.verband_ustid      || '',
        bank_name:    cfg.sepa_bankname      || '',
        iban:         cfg.sepa_iban          || '',
        bic:          cfg.sepa_bic           || '',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/internal/reserve-rechnungsnummer ───────────────
// Reserviert die nächste Rechnungsnummer im gemeinsamen Nummernkreis
// Body: { verein_name, turnier_name, betrag }
router.post('/reserve-rechnungsnummer', async (req, res) => {
  try {
    const { verein_name, turnier_name, betrag = 0 } = req.body;
    const jahr = new Date().getFullYear();

    // Höchste Nummer dieses Jahres ermitteln
    const existing = await queryAsync(
      `SELECT rechnungsnummer FROM verband_rechnungen WHERE rechnungsnummer LIKE ? ORDER BY rechnungsnummer DESC LIMIT 1`,
      [`TDA-RE-${jahr}-%`]
    );

    let nextNum = 1;
    if (existing.length > 0) {
      const match = existing[0].rechnungsnummer.match(/TDA-RE-\d+-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }

    const rechnungsnummer = `TDA-RE-${jahr}-${String(nextNum).padStart(4, '0')}`;

    // Datum: fällig in 30 Tagen
    const faelligDatum = new Date();
    faelligDatum.setDate(faelligDatum.getDate() + 30);
    const faelligStr = faelligDatum.toISOString().slice(0, 10);
    const heute      = new Date().toISOString().slice(0, 10);

    const empfaengerName = verein_name
      ? `TDA Events: ${verein_name}`
      : 'TDA Events Software';
    const notizen = [
      'Automatisch reserviert durch TDA Events Software',
      turnier_name ? `Turnier: ${turnier_name}` : null,
    ].filter(Boolean).join(' — ');

    await queryAsync(
      `INSERT INTO verband_rechnungen
         (rechnungsnummer, empfaenger_typ, empfaenger_name, rechnungsdatum, faellig_am, summe_brutto, notizen)
       VALUES (?, 'manuell', ?, ?, ?, ?, ?)`,
      [rechnungsnummer, empfaengerName, heute, faelligStr, betrag, notizen]
    );

    res.json({ success: true, rechnungsnummer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
