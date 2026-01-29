/**
 * EÜR PDF Template
 * ================
 * Professionelle Einnahmen-Überschuss-Rechnung für das Finanzamt
 */

module.exports = function generateEuerPdfHTML(data, dojoInfo, logoBase64 = null) {
  const { jahr, monate, jahresSumme, isTDA } = data;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const heute = formatDate(new Date());

  // Firmen-/Dojo-Daten
  const firmenname = dojoInfo?.dojoname || dojoInfo?.name || 'Unternehmen';
  const inhaber = dojoInfo?.inhaber || '';
  const strasse = dojoInfo?.strasse || '';
  const plz = dojoInfo?.plz || '';
  const ort = dojoInfo?.ort || '';
  const steuernummer = dojoInfo?.steuernummer || '';
  const ustId = dojoInfo?.ust_id || '';
  const finanzamt = dojoInfo?.finanzamt || '';

  // Monatsnamen
  const monatsnamen = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // Einnahmen-Kategorien für Dojo
  const einnahmenKategorienDojo = [
    { key: 'beitraege', label: 'Mitgliedsbeiträge' },
    { key: 'rechnungen', label: 'Rechnungen' },
    { key: 'verkaeufe', label: 'Barverkäufe/Kasse' }
  ];

  // Einnahmen-Kategorien für TDA
  const einnahmenKategorienTDA = [
    { key: 'mitglieder', label: 'Mitgliedsbeiträge' },
    { key: 'verbandsmitgliedschaften', label: 'Verbandsmitgliedschaften' },
    { key: 'software_lizenzen', label: 'Software-Lizenzen' },
    { key: 'rechnungen', label: 'Rechnungen' },
    { key: 'verkaeufe', label: 'Barverkäufe/Kasse' }
  ];

  const einnahmenKategorien = isTDA ? einnahmenKategorienTDA : einnahmenKategorienDojo;

  // Berechne Kategorie-Summen
  const kategorieSummen = {};
  einnahmenKategorien.forEach(kat => {
    kategorieSummen[kat.key] = monate.reduce((sum, m) => {
      return sum + (m.einnahmen[kat.key] || 0);
    }, 0);
  });

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Einnahmen-Überschuss-Rechnung ${jahr}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 20mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #1a1a1a;
      background: #fff;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #2563eb;
    }

    .company-info {
      flex: 1;
    }

    .company-name {
      font-size: 16pt;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 4px;
    }

    .company-details {
      font-size: 8pt;
      color: #4b5563;
      line-height: 1.5;
    }

    .logo-container {
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-container img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    /* Titel */
    .document-title {
      text-align: center;
      margin: 25px 0;
    }

    .document-title h1 {
      font-size: 18pt;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 5px;
      letter-spacing: 0.5px;
    }

    .document-title .subtitle {
      font-size: 11pt;
      color: #4b5563;
    }

    .document-title .legal-reference {
      font-size: 8pt;
      color: #6b7280;
      margin-top: 5px;
    }

    /* Steuer-Info Box */
    .tax-info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 15px;
    }

    .tax-info-item {
      font-size: 8pt;
    }

    .tax-info-item .label {
      color: #6b7280;
      margin-bottom: 2px;
    }

    .tax-info-item .value {
      font-weight: 600;
      color: #1e3a5f;
    }

    /* Zusammenfassung */
    .summary-section {
      margin-bottom: 25px;
    }

    .summary-title {
      font-size: 11pt;
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }

    .summary-card.income {
      border-left: 3px solid #10b981;
    }

    .summary-card.expense {
      border-left: 3px solid #ef4444;
    }

    .summary-card.result {
      border-left: 3px solid #2563eb;
    }

    .summary-card .card-label {
      font-size: 8pt;
      color: #6b7280;
      margin-bottom: 5px;
    }

    .summary-card .card-value {
      font-size: 14pt;
      font-weight: 700;
    }

    .summary-card.income .card-value {
      color: #10b981;
    }

    .summary-card.expense .card-value {
      color: #ef4444;
    }

    .summary-card.result .card-value {
      color: ${(jahresSumme?.ueberschuss || 0) >= 0 ? '#10b981' : '#ef4444'};
    }

    /* Tabellen */
    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 10pt;
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 10px;
    }

    thead {
      background: #1e3a5f;
      color: #fff;
    }

    th {
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    th.amount {
      text-align: right;
    }

    td {
      padding: 6px;
      border-bottom: 1px solid #e5e7eb;
    }

    td.amount {
      text-align: right;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    td.amount.positive {
      color: #10b981;
    }

    td.amount.negative {
      color: #ef4444;
    }

    tr.subtotal {
      background: #f1f5f9;
      font-weight: 600;
    }

    tr.total {
      background: #1e3a5f;
      color: #fff;
      font-weight: 700;
    }

    tr.total td {
      padding: 10px 6px;
      border-bottom: none;
    }

    /* Einnahmen-Aufschlüsselung */
    .income-breakdown {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 20px;
    }

    .income-breakdown h3 {
      font-size: 9pt;
      color: #166534;
      margin-bottom: 8px;
    }

    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }

    .breakdown-item {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      padding: 4px 0;
      border-bottom: 1px dashed #bbf7d0;
    }

    .breakdown-item .label {
      color: #166534;
    }

    .breakdown-item .value {
      font-weight: 600;
      color: #166534;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
    }

    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
    }

    .signature-box {
      width: 200px;
      text-align: center;
    }

    .signature-line {
      border-top: 1px solid #1a1a1a;
      padding-top: 5px;
      font-size: 8pt;
      color: #4b5563;
    }

    .legal-notice {
      font-size: 7pt;
      color: #6b7280;
      text-align: center;
      margin-top: 20px;
      line-height: 1.5;
    }

    .page-footer {
      position: fixed;
      bottom: 10mm;
      left: 20mm;
      right: 20mm;
      font-size: 7pt;
      color: #9ca3af;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      padding-top: 5px;
    }

    /* Druckoptimierung */
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="company-info">
      <div class="company-name">${firmenname}</div>
      <div class="company-details">
        ${inhaber ? `${inhaber}<br>` : ''}
        ${strasse ? `${strasse}<br>` : ''}
        ${plz || ort ? `${plz} ${ort}` : ''}
      </div>
    </div>
    ${logoBase64 ? `
      <div class="logo-container">
        <img src="${logoBase64}" alt="Logo" />
      </div>
    ` : ''}
  </div>

  <!-- Dokumenttitel -->
  <div class="document-title">
    <h1>EINNAHMEN-ÜBERSCHUSS-RECHNUNG</h1>
    <div class="subtitle">Geschäftsjahr ${jahr}</div>
    <div class="legal-reference">gemäß § 4 Abs. 3 EStG</div>
  </div>

  <!-- Steuer-Info Box -->
  <div class="tax-info-box">
    <div class="tax-info-item">
      <div class="label">Steuerpflichtiger</div>
      <div class="value">${inhaber || firmenname}</div>
    </div>
    ${steuernummer ? `
      <div class="tax-info-item">
        <div class="label">Steuernummer</div>
        <div class="value">${steuernummer}</div>
      </div>
    ` : ''}
    ${ustId ? `
      <div class="tax-info-item">
        <div class="label">USt-IdNr.</div>
        <div class="value">${ustId}</div>
      </div>
    ` : ''}
    ${finanzamt ? `
      <div class="tax-info-item">
        <div class="label">Finanzamt</div>
        <div class="value">${finanzamt}</div>
      </div>
    ` : ''}
    <div class="tax-info-item">
      <div class="label">Ermittlungszeitraum</div>
      <div class="value">01.01.${jahr} - 31.12.${jahr}</div>
    </div>
  </div>

  <!-- Zusammenfassung -->
  <div class="summary-section">
    <div class="summary-title">Jahresübersicht ${jahr}</div>
    <div class="summary-grid">
      <div class="summary-card income">
        <div class="card-label">Betriebseinnahmen</div>
        <div class="card-value">${formatCurrency(jahresSumme?.einnahmen_gesamt || 0)} €</div>
      </div>
      <div class="summary-card expense">
        <div class="card-label">Betriebsausgaben</div>
        <div class="card-value">${formatCurrency(jahresSumme?.ausgaben_gesamt || 0)} €</div>
      </div>
      <div class="summary-card result">
        <div class="card-label">Gewinn/Verlust</div>
        <div class="card-value">${formatCurrency(jahresSumme?.ueberschuss || 0)} €</div>
      </div>
    </div>
  </div>

  <!-- Einnahmen-Aufschlüsselung -->
  <div class="income-breakdown">
    <h3>Aufschlüsselung der Betriebseinnahmen</h3>
    <div class="breakdown-grid">
      ${einnahmenKategorien.map(kat => `
        <div class="breakdown-item">
          <span class="label">${kat.label}</span>
          <span class="value">${formatCurrency(kategorieSummen[kat.key] || 0)} €</span>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Monatliche Übersicht -->
  <div class="section">
    <div class="section-title">Monatliche Übersicht</div>
    <table>
      <thead>
        <tr>
          <th>Monat</th>
          <th class="amount">Einnahmen</th>
          <th class="amount">Ausgaben</th>
          <th class="amount">Überschuss</th>
        </tr>
      </thead>
      <tbody>
        ${monate.map((m, idx) => `
          <tr>
            <td>${monatsnamen[idx]}</td>
            <td class="amount positive">${formatCurrency(m.einnahmen?.gesamt || 0)} €</td>
            <td class="amount negative">${formatCurrency(m.ausgaben?.gesamt || 0)} €</td>
            <td class="amount ${(m.ueberschuss || 0) >= 0 ? 'positive' : 'negative'}">${formatCurrency(m.ueberschuss || 0)} €</td>
          </tr>
        `).join('')}
        <tr class="total">
          <td><strong>GESAMT</strong></td>
          <td class="amount">${formatCurrency(jahresSumme?.einnahmen_gesamt || 0)} €</td>
          <td class="amount">${formatCurrency(jahresSumme?.ausgaben_gesamt || 0)} €</td>
          <td class="amount">${formatCurrency(jahresSumme?.ueberschuss || 0)} €</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Detaillierte Einnahmen -->
  <div class="section">
    <div class="section-title">Betriebseinnahmen nach Kategorien und Monaten</div>
    <table>
      <thead>
        <tr>
          <th>Monat</th>
          ${einnahmenKategorien.map(kat => `<th class="amount">${kat.label}</th>`).join('')}
          <th class="amount">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${monate.map((m, idx) => `
          <tr>
            <td>${monatsnamen[idx]}</td>
            ${einnahmenKategorien.map(kat => `
              <td class="amount">${formatCurrency(m.einnahmen?.[kat.key] || 0)} €</td>
            `).join('')}
            <td class="amount positive"><strong>${formatCurrency(m.einnahmen?.gesamt || 0)} €</strong></td>
          </tr>
        `).join('')}
        <tr class="total">
          <td><strong>SUMME</strong></td>
          ${einnahmenKategorien.map(kat => `
            <td class="amount">${formatCurrency(kategorieSummen[kat.key] || 0)} €</td>
          `).join('')}
          <td class="amount"><strong>${formatCurrency(jahresSumme?.einnahmen_gesamt || 0)} €</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Footer mit Unterschrift -->
  <div class="footer">
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">${ort}, den ${heute}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Unterschrift</div>
      </div>
    </div>

    <div class="legal-notice">
      Diese Einnahmen-Überschuss-Rechnung wurde nach den Grundsätzen des § 4 Abs. 3 EStG erstellt.<br>
      Die Aufzeichnungen entsprechen den Anforderungen der §§ 140-148 AO.<br>
      Erstellt am ${heute} | ${firmenname}
    </div>
  </div>

  <div class="page-footer">
    Einnahmen-Überschuss-Rechnung ${jahr} | ${firmenname} | Seite 1 von 1
  </div>
</body>
</html>
  `;
};
