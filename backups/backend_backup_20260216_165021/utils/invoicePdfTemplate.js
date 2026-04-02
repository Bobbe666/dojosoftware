/**
 * Invoice PDF HTML Template Generator
 * Generates HTML matching the frontend preview exactly
 */

module.exports = function generateInvoiceHTML(rechnung, positionen, qrCodeDataURIs, formatDateDDMMYYYY) {
  // Calculate totals
  const calculateZwischensumme = () => {
    return positionen.reduce((sum, pos) => {
      const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
      const rabattBetrag = pos.ist_rabattfaehig ? (bruttoPreis * Number(pos.rabatt_prozent) / 100) : 0;
      return sum + (bruttoPreis - rabattBetrag);
    }, 0);
  };

  const calculateRabatt = () => {
    if (Number(rechnung.rabatt_prozent) > 0) {
      const basis = rechnung.rabatt_auf_betrag || calculateZwischensumme();
      return (Number(basis) * Number(rechnung.rabatt_prozent)) / 100;
    }
    return 0;
  };

  const calculateSumme = () => {
    return calculateZwischensumme() - calculateRabatt();
  };

  const calculateUSt = () => {
    return (calculateSumme() * 19) / 100;
  };

  const calculateEndbetrag = () => {
    return calculateSumme() + calculateUSt();
  };

  const calculateSkonto = () => {
    if (Number(rechnung.skonto_prozent) > 0) {
      return (calculateEndbetrag() * Number(rechnung.skonto_prozent)) / 100;
    }
    return 0;
  };

  const hasSkonto = Number(rechnung.skonto_prozent) > 0 && Number(rechnung.skonto_tage) > 0;
  const skontoDatum = hasSkonto ? formatDateDDMMYYYY(rechnung.datum, Number(rechnung.skonto_tage)) : '';
  const zahlungsfristDatum = formatDateDDMMYYYY(rechnung.faelligkeitsdatum);
  const betragMitSkonto = calculateEndbetrag() - calculateSkonto();
  const betragOhneSkonto = calculateEndbetrag();

  return `
<!DOCTYPE html>
<html lang="de">
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
      padding: 20mm;
      position: relative;
      min-height: 297mm;
    }

    /* Header */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2rem;
    }
    .company-small {
      font-size: 8pt;
      color: #666;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #000;
      max-width: 400px;
    }
    .recipient-address {
      margin-top: 0.5rem;
      line-height: 1.6;
    }
    .invoice-meta {
      text-align: right;
    }
    .logo-placeholder {
      width: 80px;
      height: 80px;
      border: 2px solid #000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12pt;
      margin: 0 0 1rem auto;
    }
    .invoice-numbers {
      font-size: 9pt;
      line-height: 1.8;
    }

    /* Title */
    .invoice-title {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 2rem 0 1rem 0;
      border-bottom: 2px solid #000;
      padding-bottom: 0.5rem;
    }
    .invoice-title h1 {
      font-size: 18pt;
      font-weight: bold;
    }
    .page-number {
      font-size: 9pt;
      color: #666;
    }

    /* Table */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 8pt;
    }
    table.invoice-table thead {
      background: #f3f4f6;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    table.invoice-table th {
      padding: 0.4rem 0.2rem;
      text-align: left;
      font-weight: bold;
      font-size: 7pt;
    }
    table.invoice-table th:nth-child(3),
    table.invoice-table th:nth-child(4),
    table.invoice-table th:nth-child(5),
    table.invoice-table th:nth-child(6),
    table.invoice-table th:nth-child(7),
    table.invoice-table th:nth-child(8),
    table.invoice-table th:nth-child(9) {
      text-align: right;
    }
    table.invoice-table td {
      padding: 0.4rem 0.2rem;
      border-bottom: 1px solid #e5e7eb;
      font-size: 7.5pt;
    }
    table.invoice-table td:nth-child(3),
    table.invoice-table td:nth-child(4),
    table.invoice-table td:nth-child(5),
    table.invoice-table td:nth-child(6),
    table.invoice-table td:nth-child(7),
    table.invoice-table td:nth-child(8),
    table.invoice-table td:nth-child(9) {
      text-align: right;
    }

    /* Totals */
    .invoice-totals {
      margin-left: auto;
      width: 60%;
      font-size: 9pt;
      margin-top: 1rem;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total-final {
      font-weight: bold;
      font-size: 10pt;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin-top: 0.3rem;
      padding-top: 0.5rem;
    }

    /* Payment section */
    .payment-section {
      display: flex;
      gap: 2rem;
      margin-top: 1.5rem;
      align-items: flex-start;
    }
    .payment-terms {
      flex: 1;
      font-size: 8pt;
      line-height: 1.5;
    }
    .payment-terms p {
      margin-bottom: 0.3rem;
    }
    .qr-codes-section {
      flex: 1;
      display: flex;
      gap: 1rem;
      justify-content: center;
    }
    .qr-code-container {
      text-align: center;
      flex: 1;
      max-width: 150px;
    }
    .qr-code-title {
      font-size: 7pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 0.3rem;
    }
    .qr-code-image {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      background: #fff;
      padding: 0.2rem;
      border-radius: 4px;
    }
    .qr-code-info {
      font-size: 7pt;
      font-weight: 600;
      margin-top: 0.2rem;
      line-height: 1.2;
    }

    /* Footer */
    .rechnung-footer {
      position: absolute;
      bottom: 15mm;
      left: 20mm;
      right: 20mm;
      padding-top: 0.5rem;
      border-top: 1px solid rgba(0, 0, 0, 0.2);
      font-size: 7pt;
      text-align: center;
      line-height: 1.5;
    }
    .rechnung-footer > div {
      margin-bottom: 0.2rem;
    }

    @page {
      margin: 20mm;
      size: A4;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="invoice-header">
    <div class="company-info">
      <div class="company-small">
        ${rechnung.dojoname || ''} | ${rechnung.dojo_strasse || ''} ${rechnung.dojo_hausnummer || ''} | ${rechnung.dojo_plz || ''} ${rechnung.dojo_ort || ''}
      </div>
      <div class="recipient-address">
        <div>Herrn/Frau</div>
        <div>${rechnung.mitglied_name || ''}</div>
        <div>${rechnung.strasse || ''} ${rechnung.hausnummer || ''}</div>
        <div>${rechnung.plz || ''} ${rechnung.ort || ''}</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="logo-placeholder">LOGO</div>
      <div class="invoice-numbers">
        <div>Rechnungs-Nr.: ${rechnung.rechnungsnummer || ''}</div>
        <div>Kundennummer: ${rechnung.mitglied_id || ''}</div>
        <div>Belegdatum: ${formatDateDDMMYYYY(rechnung.datum)}</div>
        <div>Liefer-/Leistungsdatum: ${formatDateDDMMYYYY(rechnung.datum)}</div>
      </div>
    </div>
  </div>

  <!-- Title -->
  <div class="invoice-title">
    <h1>RECHNUNG</h1>
    <div class="page-number">Seite 1 von 1</div>
  </div>

  <!-- Positions Table -->
  <table class="invoice-table">
    <thead>
      <tr>
        <th>Pos.</th>
        <th>Bezeichnung</th>
        <th>Artikelnummer</th>
        <th>Menge</th>
        <th>Einheit</th>
        <th>Preis</th>
        <th>Rabatt %</th>
        <th>USt %</th>
        <th>Betrag EUR</th>
      </tr>
    </thead>
    <tbody>
      ${positionen.map(pos => {
        const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
        const rabattBetrag = pos.ist_rabattfaehig ? (bruttoPreis * Number(pos.rabatt_prozent) / 100) : 0;
        const nettoPreis = bruttoPreis - rabattBetrag;

        return `
          <tr>
            <td>${pos.position_nr}</td>
            <td>${pos.bezeichnung || ''}</td>
            <td>${pos.artikelnummer || ''}</td>
            <td>${pos.menge || 1}</td>
            <td>Stk.</td>
            <td>${Number(pos.einzelpreis || 0).toFixed(2)}</td>
            <td>${pos.ist_rabattfaehig ? Number(pos.rabatt_prozent || 0).toFixed(2) + ' %' : '-'}</td>
            <td>${Number(pos.ust_prozent || 19).toFixed(2)} %</td>
            <td>${nettoPreis.toFixed(2)}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="invoice-totals">
    <div class="totals-row">
      <span>Zwischensumme:</span>
      <span>${calculateZwischensumme().toFixed(2)}</span>
    </div>
    ${Number(rechnung.rabatt_prozent) > 0 ? `
      <div class="totals-row">
        <span>${Number(rechnung.rabatt_prozent).toFixed(2)} % Rabatt auf EUR ${(rechnung.rabatt_auf_betrag || calculateZwischensumme()).toFixed(2)}:</span>
        <span>-${calculateRabatt().toFixed(2)}</span>
      </div>
    ` : ''}
    <div class="totals-row">
      <span>Summe:</span>
      <span>${calculateSumme().toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>19,00 % USt. auf EUR ${calculateSumme().toFixed(2)}:</span>
      <span>${calculateUSt().toFixed(2)}</span>
    </div>
    <div class="totals-row total-final">
      <span>Endbetrag:</span>
      <span>${calculateEndbetrag().toFixed(2)}</span>
    </div>
  </div>

  <!-- Payment Terms and QR Codes -->
  <div class="payment-section">
    <div class="payment-terms">
      <p><strong>Bitte beachten Sie unsere Zahlungsbedingung:</strong></p>
      ${hasSkonto ? `
        <p>${Number(rechnung.skonto_prozent).toFixed(2)} % Skonto bei Zahlung innerhalb von ${rechnung.skonto_tage} Tagen (bis zum ${skontoDatum}).</p>
        <p>Ohne Abzug bis zum ${zahlungsfristDatum}.</p>
        <p>Skonto-Betrag: ${calculateSkonto().toFixed(2)} €</p>
        <p>Zu überweisender Betrag: ${betragMitSkonto.toFixed(2)} €</p>
      ` : `
        <p>Ohne Abzug bis zum ${zahlungsfristDatum}.</p>
      `}
    </div>

    ${qrCodeDataURIs && qrCodeDataURIs.length > 0 ? `
      <div class="qr-codes-section">
        ${hasSkonto && qrCodeDataURIs[0] ? `
          <div class="qr-code-container">
            <div class="qr-code-title">Zahlung mit Skonto</div>
            <img src="${qrCodeDataURIs[0]}" class="qr-code-image" alt="QR-Code mit Skonto" />
            <div class="qr-code-info">
              <div>Betrag: ${betragMitSkonto.toFixed(2)} €</div>
              <div>bis zum ${skontoDatum} zu zahlen</div>
            </div>
          </div>
        ` : ''}
        ${qrCodeDataURIs[hasSkonto ? 1 : 0] ? `
          <div class="qr-code-container">
            <div class="qr-code-title">${hasSkonto ? 'Zahlung ohne Skonto' : 'QR-Code für Überweisung'}</div>
            <img src="${qrCodeDataURIs[hasSkonto ? 1 : 0]}" class="qr-code-image" alt="QR-Code" />
            <div class="qr-code-info">
              <div>Betrag: ${betragOhneSkonto.toFixed(2)} €</div>
              <div>${hasSkonto ? 'ab' : 'bis zum'} ${zahlungsfristDatum} zu zahlen</div>
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}
  </div>

  <!-- Footer -->
  <div class="rechnung-footer">
    <div>
      ${[
        rechnung.dojoname,
        rechnung.dojo_strasse && rechnung.dojo_hausnummer ? `${rechnung.dojo_strasse} ${rechnung.dojo_hausnummer}` : null,
        rechnung.dojo_plz && rechnung.dojo_ort ? `${rechnung.dojo_plz} ${rechnung.dojo_ort}` : null,
        rechnung.dojo_email,
        rechnung.dojo_telefon
      ].filter(Boolean).join(' | ')}
    </div>
    ${rechnung.iban && rechnung.bic && rechnung.kontoinhaber ? `
      <div>
        ${[
          rechnung.bank_name,
          rechnung.kontoinhaber,
          rechnung.iban,
          rechnung.bic
        ].filter(Boolean).join(' | ')}
      </div>
    ` : ''}
  </div>
</body>
</html>
  `;
};
