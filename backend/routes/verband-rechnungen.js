/**
 * Verband-Rechnungen Routes
 * Rechnungserstellung für TDA International
 * - Empfänger: Verbandsmitglieder, DojoSoftware-Nutzer
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');

// Promise-basierte Query-Funktion
const queryAsync = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// ============================================================================
// EMPFÄNGER LADEN (Verbandsmitglieder + DojoSoftware-Nutzer)
// ============================================================================

// GET /empfaenger - Alle möglichen Rechnungsempfänger
router.get('/empfaenger', async (req, res) => {
  try {
    // 1. Verbandsmitglieder (Dojos & Einzelpersonen)
    const verbandsmitglieder = await queryAsync(`
      SELECT
        vm.id,
        vm.typ,
        vm.mitgliedsnummer,
        vm.status,
        vm.jahresbeitrag,
        CASE
          WHEN vm.typ = 'dojo' THEN COALESCE(d.dojoname, vm.dojo_name)
          ELSE CONCAT(vm.person_vorname, ' ', vm.person_nachname)
        END as name,
        CASE
          WHEN vm.typ = 'dojo' THEN COALESCE(d.email, vm.dojo_email)
          ELSE vm.person_email
        END as email,
        CASE
          WHEN vm.typ = 'dojo' THEN CONCAT(COALESCE(d.strasse, vm.dojo_strasse), ', ', COALESCE(d.plz, vm.dojo_plz), ' ', COALESCE(d.ort, vm.dojo_ort))
          ELSE CONCAT(vm.person_strasse, ', ', vm.person_plz, ' ', vm.person_ort)
        END as adresse,
        'verbandsmitglied' as kategorie
      FROM verbandsmitgliedschaften vm
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      WHERE vm.status IN ('aktiv', 'ausstehend')
      ORDER BY name
    `);

    // 2. DojoSoftware-Nutzer (alle Dojos die Software nutzen)
    const softwareNutzer = await queryAsync(`
      SELECT
        d.id,
        d.dojoname as name,
        d.email,
        CONCAT(d.strasse, ' ', COALESCE(d.hausnummer, ''), ', ', d.plz, ' ', d.ort) as adresse,
        d.subscription_status as status,
        d.subscription_plan as plan,
        'software_nutzer' as kategorie
      FROM dojo d
      WHERE d.id != 2  -- TDA International ausschließen
      AND d.ist_aktiv = 1
      ORDER BY d.dojoname
    `);

    res.json({
      success: true,
      empfaenger: {
        verbandsmitglieder: verbandsmitglieder,
        softwareNutzer: softwareNutzer
      }
    });

  } catch (err) {
    logger.error('Fehler beim Laden der Empfänger:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// ============================================================================
// RECHNUNGEN CRUD
// ============================================================================

// GET / - Alle Verbandsrechnungen
router.get('/', async (req, res) => {
  try {
    const rechnungen = await queryAsync(`
      SELECT
        vr.*,
        CASE
          WHEN vr.empfaenger_typ = 'verbandsmitglied' THEN
            CASE
              WHEN vm.typ = 'dojo' THEN COALESCE(d.dojoname, vm.dojo_name)
              ELSE CONCAT(vm.person_vorname, ' ', vm.person_nachname)
            END
          WHEN vr.empfaenger_typ = 'software_nutzer' THEN dojo.dojoname
          ELSE vr.empfaenger_name
        END as empfaenger_display_name
      FROM verband_rechnungen vr
      LEFT JOIN verbandsmitgliedschaften vm ON vr.empfaenger_typ = 'verbandsmitglied' AND vr.empfaenger_id = vm.id
      LEFT JOIN dojo d ON vm.dojo_id = d.id
      LEFT JOIN dojo dojo ON vr.empfaenger_typ = 'software_nutzer' AND vr.empfaenger_id = dojo.id
      ORDER BY vr.erstellt_am DESC
    `);

    res.json({ success: true, rechnungen });
  } catch (err) {
    logger.error('Fehler beim Laden der Verbandsrechnungen:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /nummernkreis - Nächste Rechnungsnummer generieren
// Format: TDA-RE-{Jahr}-{fortlaufende Nummer} für TDA International (Verband, Software, Dojo T&D)
router.get('/nummernkreis', async (req, res) => {
  try {
    const jahr = new Date().getFullYear();

    // Höchste Rechnungsnummer für dieses Jahr finden
    const result = await queryAsync(`
      SELECT rechnungsnummer
      FROM verband_rechnungen
      WHERE rechnungsnummer LIKE ?
      ORDER BY rechnungsnummer DESC
      LIMIT 1
    `, [`TDA-RE-${jahr}-%`]);

    let nextNum = 1;
    if (result.length > 0) {
      const lastNum = result[0].rechnungsnummer;
      const match = lastNum.match(/TDA-RE-\d+-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    const rechnungsnummer = `TDA-RE-${jahr}-${String(nextNum).padStart(4, '0')}`;
    res.json({ success: true, rechnungsnummer });
  } catch (err) {
    logger.error('Fehler beim Generieren der Rechnungsnummer:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST / - Neue Verbandsrechnung erstellen
router.post('/', async (req, res) => {
  try {
    const {
      empfaenger_typ,      // 'verbandsmitglied' | 'software_nutzer' | 'manuell'
      empfaenger_id,       // ID des Empfängers (oder null bei manuell)
      empfaenger_name,     // Name (bei manuell)
      empfaenger_adresse,  // Adresse
      empfaenger_email,    // E-Mail
      rechnungsnummer,
      rechnungsdatum,
      leistungsdatum,
      faellig_am,
      positionen,          // Array: [{bezeichnung, menge, einzelpreis, mwst_satz}]
      notizen,
      zahlungsbedingungen
    } = req.body;

    // Validierung
    if (!empfaenger_typ || !rechnungsnummer || !positionen || positionen.length === 0) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen' });
    }

    // Berechne Summen
    let summe_netto = 0;
    let summe_mwst = 0;

    positionen.forEach(pos => {
      const netto = pos.menge * pos.einzelpreis;
      const mwst = netto * (pos.mwst_satz / 100);
      summe_netto += netto;
      summe_mwst += mwst;
    });

    const summe_brutto = summe_netto + summe_mwst;

    // Rechnung erstellen
    const result = await queryAsync(`
      INSERT INTO verband_rechnungen (
        empfaenger_typ, empfaenger_id, empfaenger_name, empfaenger_adresse, empfaenger_email,
        rechnungsnummer, rechnungsdatum, leistungsdatum, faellig_am,
        summe_netto, summe_mwst, summe_brutto,
        status, notizen, zahlungsbedingungen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?)
    `, [
      empfaenger_typ, empfaenger_id || null, empfaenger_name || null,
      empfaenger_adresse || null, empfaenger_email || null,
      rechnungsnummer, rechnungsdatum, leistungsdatum, faellig_am,
      summe_netto, summe_mwst, summe_brutto,
      notizen || null, zahlungsbedingungen || 'Zahlbar innerhalb von 14 Tagen ohne Abzug.'
    ]);

    const rechnungId = result.insertId;

    // Positionen speichern
    for (let i = 0; i < positionen.length; i++) {
      const pos = positionen[i];
      const netto = pos.menge * pos.einzelpreis;
      const mwst = netto * (pos.mwst_satz / 100);

      await queryAsync(`
        INSERT INTO verband_rechnungspositionen (
          rechnung_id, position_nr, bezeichnung, menge, einheit, einzelpreis, mwst_satz, netto, mwst, brutto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [rechnungId, i + 1, pos.bezeichnung, pos.menge, pos.einheit || 'Stück', pos.einzelpreis, pos.mwst_satz, netto, mwst, netto + mwst]);
    }

    logger.info('Verbandsrechnung erstellt:', { id: rechnungId, rechnungsnummer });

    res.json({
      success: true,
      rechnung_id: rechnungId,
      rechnungsnummer,
      message: 'Rechnung erfolgreich erstellt'
    });

  } catch (err) {
    logger.error('Fehler beim Erstellen der Rechnung:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler', details: err.message });
  }
});

// GET /:id - Einzelne Rechnung laden
router.get('/:id', async (req, res) => {
  try {
    const [rechnung] = await queryAsync(`
      SELECT * FROM verband_rechnungen WHERE id = ?
    `, [req.params.id]);

    if (!rechnung) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    }

    const positionen = await queryAsync(`
      SELECT * FROM verband_rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr
    `, [req.params.id]);

    res.json({ success: true, rechnung: { ...rechnung, positionen } });
  } catch (err) {
    logger.error('Fehler beim Laden der Rechnung:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /:id/status - Rechnungsstatus ändern (bezahlt, storniert, etc.)
router.put('/:id/status', async (req, res) => {
  try {
    const { status, bezahlt_am } = req.body;

    if (!['offen', 'bezahlt', 'storniert', 'mahnung'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status' });
    }

    await queryAsync(`
      UPDATE verband_rechnungen
      SET status = ?, bezahlt_am = ?
      WHERE id = ?
    `, [status, status === 'bezahlt' ? (bezahlt_am || new Date()) : null, req.params.id]);

    res.json({ success: true, message: 'Status aktualisiert' });
  } catch (err) {
    logger.error('Fehler beim Status-Update:', { error: err });
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /:id/pdf - PDF generieren
router.get('/:id/pdf', async (req, res) => {
  try {
    const [rechnung] = await queryAsync(`
      SELECT * FROM verband_rechnungen WHERE id = ?
    `, [req.params.id]);

    if (!rechnung) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    }

    const positionen = await queryAsync(`
      SELECT * FROM verband_rechnungspositionen WHERE rechnung_id = ? ORDER BY position_nr
    `, [req.params.id]);

    // TDA Bankdaten laden
    const [tdaDojo] = await queryAsync(`SELECT * FROM dojo WHERE id = 2`);
    const [tdaBank] = await queryAsync(`
      SELECT * FROM dojo_banken WHERE dojo_id = 2 AND ist_standard = 1 AND ist_aktiv = 1 LIMIT 1
    `);

    // HTML für PDF erstellen
    const html = generateInvoiceHTML(rechnung, positionen, tdaDojo, tdaBank);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (err) {
    logger.error('Fehler beim PDF-Generieren:', { error: err });
    res.status(500).json({ error: 'Fehler beim Generieren' });
  }
});

// HTML-Generator für Rechnung
function generateInvoiceHTML(rechnung, positionen, tda, bank) {
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
  const formatCurrency = (n) => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatIBAN = (iban) => iban ? iban.replace(/(.{4})/g, '$1 ').trim() : '-';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${rechnung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      padding: 15mm 20mm;
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #c9a227;
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 60px;
      height: 60px;
    }
    .company-name {
      font-size: 18pt;
      font-weight: bold;
      color: #1a1a2e;
    }
    .company-tagline {
      font-size: 9pt;
      color: #666;
    }
    .invoice-title {
      font-size: 24pt;
      font-weight: bold;
      color: #c9a227;
      text-align: right;
    }
    .company-small {
      font-size: 8pt;
      color: #666;
      margin-bottom: 0.5rem;
      padding-bottom: 0.3rem;
      border-bottom: 1px solid #ccc;
    }
    .recipient {
      margin-top: 0.5rem;
      line-height: 1.5;
      min-height: 80px;
    }
    .meta-section {
      display: flex;
      justify-content: space-between;
      margin: 2rem 0;
    }
    .meta-left, .meta-right {
      width: 48%;
    }
    .meta-table {
      width: 100%;
      font-size: 9pt;
    }
    .meta-table td {
      padding: 3px 0;
    }
    .meta-table td:first-child {
      font-weight: bold;
      width: 40%;
    }
    h1 {
      font-size: 14pt;
      margin: 1.5rem 0 1rem;
      color: #1a1a2e;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    table.items th {
      background: #1a1a2e;
      color: #fff;
      padding: 10px 8px;
      text-align: left;
      font-size: 9pt;
    }
    table.items th:nth-child(3),
    table.items th:nth-child(4),
    table.items th:nth-child(5),
    table.items th:nth-child(6) {
      text-align: right;
    }
    table.items td {
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
      font-size: 9pt;
    }
    table.items td:nth-child(3),
    table.items td:nth-child(4),
    table.items td:nth-child(5),
    table.items td:nth-child(6) {
      text-align: right;
    }
    .totals {
      margin-left: auto;
      width: 300px;
      margin-top: 1rem;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 10pt;
    }
    .totals-row.total {
      font-weight: bold;
      font-size: 12pt;
      border-top: 2px solid #1a1a2e;
      margin-top: 5px;
      padding-top: 10px;
      color: #c9a227;
    }
    .bank-section {
      margin-top: 2rem;
      padding: 15px;
      background: #f8f8f8;
      border-radius: 5px;
    }
    .bank-section h3 {
      font-size: 10pt;
      margin-bottom: 10px;
      color: #1a1a2e;
    }
    .bank-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 5px;
      font-size: 9pt;
    }
    .bank-item span:first-child {
      font-weight: bold;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #ccc;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
    .notes {
      margin-top: 1.5rem;
      padding: 10px;
      background: #fffbeb;
      border-left: 3px solid #c9a227;
      font-size: 9pt;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      <div>
        <div class="company-name">Tiger & Dragon Association</div>
        <div class="company-tagline">International Martial Arts Federation</div>
      </div>
    </div>
    <div class="invoice-title">RECHNUNG</div>
  </div>

  <div class="meta-section">
    <div class="meta-left">
      <div class="company-small">
        Tiger & Dragon Association Int. • ${tda?.strasse || ''} ${tda?.hausnummer || ''} • ${tda?.plz || ''} ${tda?.ort || ''}
      </div>
      <div class="recipient">
        <strong>${rechnung.empfaenger_name || '-'}</strong><br>
        ${(rechnung.empfaenger_adresse || '').replace(/, /g, '<br>')}
      </div>
    </div>
    <div class="meta-right">
      <table class="meta-table">
        <tr><td>Rechnungsnummer:</td><td>${rechnung.rechnungsnummer}</td></tr>
        <tr><td>Rechnungsdatum:</td><td>${formatDate(rechnung.rechnungsdatum)}</td></tr>
        <tr><td>Leistungsdatum:</td><td>${formatDate(rechnung.leistungsdatum)}</td></tr>
        <tr><td>Fällig bis:</td><td>${formatDate(rechnung.faellig_am)}</td></tr>
      </table>
    </div>
  </div>

  <h1>Leistungsübersicht</h1>

  <table class="items">
    <thead>
      <tr>
        <th>Pos.</th>
        <th>Bezeichnung</th>
        <th>Menge</th>
        <th>Einzelpreis</th>
        <th>MwSt.</th>
        <th>Gesamt</th>
      </tr>
    </thead>
    <tbody>
      ${positionen.map(pos => `
        <tr>
          <td>${pos.position_nr}</td>
          <td>${pos.bezeichnung}</td>
          <td>${pos.menge} ${pos.einheit || ''}</td>
          <td>${formatCurrency(pos.einzelpreis)} €</td>
          <td>${pos.mwst_satz}%</td>
          <td>${formatCurrency(pos.brutto)} €</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Nettobetrag:</span>
      <span>${formatCurrency(rechnung.summe_netto)} €</span>
    </div>
    <div class="totals-row">
      <span>MwSt. (19%):</span>
      <span>${formatCurrency(rechnung.summe_mwst)} €</span>
    </div>
    <div class="totals-row total">
      <span>Gesamtbetrag:</span>
      <span>${formatCurrency(rechnung.summe_brutto)} €</span>
    </div>
  </div>

  ${rechnung.notizen ? `
    <div class="notes">
      <strong>Hinweis:</strong> ${rechnung.notizen}
    </div>
  ` : ''}

  <div class="bank-section">
    <h3>Bankverbindung</h3>
    <div class="bank-grid">
      <div class="bank-item"><span>Kontoinhaber:</span> ${bank?.kontoinhaber || tda?.inhaber || 'Tiger & Dragon Association'}</div>
      <div class="bank-item"><span>Bank:</span> ${bank?.bank_name || '-'}</div>
      <div class="bank-item"><span>IBAN:</span> ${formatIBAN(bank?.iban)}</div>
      <div class="bank-item"><span>BIC:</span> ${bank?.bic || '-'}</div>
    </div>
    <p style="margin-top: 10px; font-size: 9pt;">
      ${rechnung.zahlungsbedingungen || 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen unter Angabe der Rechnungsnummer.'}
    </p>
  </div>

  <div class="footer">
    Tiger & Dragon Association International • ${tda?.email || 'info@tda-intl.org'} • ${tda?.telefon || ''}<br>
    ${tda?.strasse || ''} ${tda?.hausnummer || ''}, ${tda?.plz || ''} ${tda?.ort || ''}, ${tda?.land || 'Deutschland'}
  </div>

  <script>
    // Auto-print wenn gewünscht
    if (window.location.search.includes('print=1')) {
      window.print();
    }
  </script>
</body>
</html>
  `;
}

module.exports = router;
