/**
 * Verbandsmitgliedschaft Rechnung PDF Template
 * TDA International
 */

module.exports = function generateVerbandRechnungHTML(zahlung, mitgliedschaft, config) {
  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    return Number(amount || 0).toFixed(2).replace('.', ',') + ' €';
  };

  // Empfänger-Adresse
  let empfaenger = '';
  if (mitgliedschaft.typ === 'dojo') {
    empfaenger = `
      <div>${mitgliedschaft.dojo_name || ''}</div>
      <div>${mitgliedschaft.dojo_inhaber || ''}</div>
      <div>${mitgliedschaft.dojo_strasse || ''}</div>
      <div>${mitgliedschaft.dojo_plz || ''} ${mitgliedschaft.dojo_ort || ''}</div>
    `;
  } else {
    empfaenger = `
      <div>${mitgliedschaft.person_vorname || ''} ${mitgliedschaft.person_nachname || ''}</div>
      <div>${mitgliedschaft.person_strasse || ''}</div>
      <div>${mitgliedschaft.person_plz || ''} ${mitgliedschaft.person_ort || ''}</div>
    `;
  }

  // Leistungsbeschreibung
  const leistung = mitgliedschaft.typ === 'dojo'
    ? 'TDA Verbandsmitgliedschaft - Dojo'
    : 'TDA Verbandsmitgliedschaft - Einzelperson';

  const zeitraum = `${formatDate(zahlung.zeitraum_von)} - ${formatDate(zahlung.zeitraum_bis)}`;

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${zahlung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 15mm 20mm;
      min-height: 297mm;
      position: relative;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15mm;
      padding-bottom: 5mm;
      border-bottom: 3px solid #ffd700;
    }

    .logo-section {
      text-align: right;
    }

    .logo {
      font-size: 28pt;
      font-weight: bold;
      color: #1a1a1a;
      letter-spacing: 2px;
    }

    .logo-subtitle {
      font-size: 10pt;
      color: #666;
      margin-top: 2mm;
    }

    .sender-line {
      font-size: 8pt;
      color: #666;
      border-bottom: 1px solid #ccc;
      padding-bottom: 2mm;
      margin-bottom: 3mm;
    }

    .recipient {
      font-size: 11pt;
      line-height: 1.6;
      min-height: 25mm;
    }

    .invoice-meta {
      margin-top: 10mm;
      margin-bottom: 10mm;
    }

    .invoice-title {
      font-size: 22pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 5mm;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 120px auto;
      gap: 2mm 5mm;
      font-size: 10pt;
    }

    .meta-label {
      color: #666;
    }

    .meta-value {
      font-weight: 500;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10mm 0;
    }

    .invoice-table th {
      background: #f5f5f5;
      border-top: 2px solid #1a1a1a;
      border-bottom: 1px solid #1a1a1a;
      padding: 3mm 2mm;
      text-align: left;
      font-size: 9pt;
      font-weight: 600;
    }

    .invoice-table th:last-child {
      text-align: right;
    }

    .invoice-table td {
      padding: 4mm 2mm;
      border-bottom: 1px solid #e0e0e0;
      font-size: 10pt;
    }

    .invoice-table td:last-child {
      text-align: right;
    }

    .totals {
      margin-left: auto;
      width: 250px;
      margin-top: 5mm;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 10pt;
    }

    .totals-row.total {
      border-top: 2px solid #1a1a1a;
      font-size: 12pt;
      font-weight: bold;
      padding-top: 3mm;
      margin-top: 2mm;
    }

    .payment-info {
      margin-top: 15mm;
      padding: 5mm;
      background: #f9f9f9;
      border-left: 4px solid #ffd700;
    }

    .payment-info h3 {
      font-size: 11pt;
      margin-bottom: 3mm;
    }

    .payment-info p {
      font-size: 10pt;
      margin-bottom: 2mm;
    }

    .bank-details {
      margin-top: 10mm;
      font-size: 10pt;
    }

    .bank-details table {
      border-collapse: collapse;
    }

    .bank-details td {
      padding: 1mm 3mm 1mm 0;
    }

    .bank-details td:first-child {
      color: #666;
      width: 100px;
    }

    .footer {
      position: absolute;
      bottom: 10mm;
      left: 20mm;
      right: 20mm;
      text-align: center;
      font-size: 8pt;
      color: #666;
      border-top: 1px solid #e0e0e0;
      padding-top: 3mm;
    }

    .footer-line {
      margin-bottom: 1mm;
    }

    .status-badge {
      display: inline-block;
      padding: 2mm 4mm;
      border-radius: 3px;
      font-size: 9pt;
      font-weight: bold;
    }

    .status-offen {
      background: #fff3cd;
      color: #856404;
    }

    .status-bezahlt {
      background: #d4edda;
      color: #155724;
    }

    @page {
      margin: 0;
      size: A4;
    }

    @media print {
      body { padding: 15mm 20mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="address-section">
      <div class="sender-line">
        Tiger Dragon Association International | Musterstraße 1 | 12345 Musterstadt
      </div>
      <div class="recipient">
        ${empfaenger}
      </div>
    </div>
    <div class="logo-section">
      <div class="logo">TDA</div>
      <div class="logo-subtitle">Tiger Dragon Association<br/>International</div>
    </div>
  </div>

  <div class="invoice-meta">
    <div class="invoice-title">RECHNUNG</div>
    <div class="meta-grid">
      <span class="meta-label">Rechnungsnummer:</span>
      <span class="meta-value">${zahlung.rechnungsnummer}</span>

      <span class="meta-label">Rechnungsdatum:</span>
      <span class="meta-value">${formatDate(zahlung.rechnungsdatum)}</span>

      <span class="meta-label">Leistungszeitraum:</span>
      <span class="meta-value">${zeitraum}</span>

      <span class="meta-label">Mitgliedsnummer:</span>
      <span class="meta-value">TDA-${String(mitgliedschaft.id).padStart(5, '0')}</span>

      <span class="meta-label">Status:</span>
      <span class="meta-value">
        <span class="status-badge status-${zahlung.status}">${zahlung.status === 'bezahlt' ? 'BEZAHLT' : 'OFFEN'}</span>
      </span>
    </div>
  </div>

  <table class="invoice-table">
    <thead>
      <tr>
        <th style="width: 40px;">Pos.</th>
        <th>Beschreibung</th>
        <th style="width: 100px;">Betrag</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <strong>${leistung}</strong><br/>
          <span style="font-size: 9pt; color: #666;">Zeitraum: ${zeitraum}</span>
        </td>
        <td>${formatCurrency(zahlung.betrag_netto)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Nettobetrag:</span>
      <span>${formatCurrency(zahlung.betrag_netto)}</span>
    </div>
    <div class="totals-row">
      <span>USt. ${zahlung.mwst_satz}%:</span>
      <span>${formatCurrency(zahlung.mwst_betrag)}</span>
    </div>
    <div class="totals-row total">
      <span>Gesamtbetrag:</span>
      <span>${formatCurrency(zahlung.betrag_brutto)}</span>
    </div>
  </div>

  <div class="payment-info">
    <h3>Zahlungsinformationen</h3>
    <p><strong>Fällig bis:</strong> ${formatDate(zahlung.faellig_am)}</p>
    <p>Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer auf folgendes Konto:</p>

    <div class="bank-details">
      <table>
        <tr>
          <td>Empfänger:</td>
          <td><strong>Tiger Dragon Association International</strong></td>
        </tr>
        <tr>
          <td>IBAN:</td>
          <td><strong>DE89 3704 0044 0532 0130 00</strong></td>
        </tr>
        <tr>
          <td>BIC:</td>
          <td>COBADEFFXXX</td>
        </tr>
        <tr>
          <td>Verwendungszweck:</td>
          <td><strong>${zahlung.rechnungsnummer}</strong></td>
        </tr>
      </table>
    </div>
  </div>

  <div class="footer">
    <div class="footer-line">Tiger Dragon Association International | Musterstraße 1 | 12345 Musterstadt</div>
    <div class="footer-line">E-Mail: info@tda-intl.org | Web: www.tda-intl.org</div>
    <div class="footer-line">Steuernummer: 123/456/78901 | USt-IdNr.: DE123456789</div>
  </div>
</body>
</html>
  `;
};
