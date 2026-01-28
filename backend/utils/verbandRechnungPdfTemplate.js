/**
 * Verbandsmitgliedschaft Rechnung PDF Template
 * TDA International - Design identisch mit Dojo-Rechnungen
 */

module.exports = function generateVerbandRechnungHTML(zahlung, mitgliedschaft, config, qrCodeDataURI) {
  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    return Number(amount || 0).toFixed(2).replace('.', ',');
  };

  // Verband-Daten aus Config
  const verbandName = config.verband_name || 'Tiger & Dragon Association International';
  const verbandKurzname = config.verband_kurzname || 'TDA Int\'l';
  const verbandStrasse = config.verband_strasse || '';
  const verbandPlz = config.verband_plz || '';
  const verbandOrt = config.verband_ort || '';
  const verbandEmail = config.verband_email || '';
  const verbandTelefon = config.verband_telefon || '';
  const verbandWebsite = config.verband_website || '';
  const verbandSteuernummer = config.verband_steuernummer || '';
  const verbandUstId = config.verband_ustid || '';

  // Bank-Daten
  const bankName = config.sepa_bankname || '';
  const iban = config.sepa_iban || '';
  const bic = config.sepa_bic || '';
  const kontoinhaber = config.sepa_kontoinhaber || verbandName;

  // Absenderzeile
  const absenderzeile = [verbandName, verbandStrasse, `${verbandPlz} ${verbandOrt}`].filter(Boolean).join(' | ');

  // Empfänger-Adresse
  let empfaengerAnrede = 'Herrn/Frau';
  let empfaengerName = '';
  let empfaengerStrasse = '';
  let empfaengerOrt = '';

  if (mitgliedschaft.typ === 'dojo') {
    empfaengerAnrede = '';
    empfaengerName = mitgliedschaft.dojo_name || '';
    empfaengerStrasse = mitgliedschaft.dojo_strasse || '';
    empfaengerOrt = `${mitgliedschaft.dojo_plz || ''} ${mitgliedschaft.dojo_ort || ''}`.trim();
  } else {
    empfaengerName = `${mitgliedschaft.person_vorname || ''} ${mitgliedschaft.person_nachname || ''}`.trim();
    empfaengerStrasse = mitgliedschaft.person_strasse || '';
    empfaengerOrt = `${mitgliedschaft.person_plz || ''} ${mitgliedschaft.person_ort || ''}`.trim();
  }

  // Leistungsbeschreibung
  const leistung = mitgliedschaft.typ === 'dojo'
    ? 'TDA Verbandsmitgliedschaft - Dojo'
    : 'TDA Verbandsmitgliedschaft - Einzelperson';

  const zeitraum = `${formatDate(zahlung.zeitraum_von)} - ${formatDate(zahlung.zeitraum_bis)}`;

  // Mitgliedsnummer formatieren
  const mitgliedsnummer = mitgliedschaft.typ === 'dojo'
    ? `TDA-D-${String(mitgliedschaft.id).padStart(4, '0')}`
    : `TDA-E-${String(mitgliedschaft.id).padStart(4, '0')}`;

  // Zahlungsfrist Datum
  const zahlungsfristDatum = formatDate(zahlung.faellig_am);

  // Betrag berechnen
  const nettoPreis = Number(zahlung.betrag_netto || 0);
  const mwstSatz = Number(zahlung.mwst_satz || 19);
  const mwstBetrag = Number(zahlung.mwst_betrag || (nettoPreis * mwstSatz / 100));
  const bruttoBetrag = Number(zahlung.betrag_brutto || (nettoPreis + mwstBetrag));

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${zahlung.rechnungsnummer}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      padding: 12mm 15mm;
      position: relative;
    }

    /* Header */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.8rem;
    }
    .company-small {
      font-size: 7pt;
      color: #666;
      margin-bottom: 0.5rem;
      padding-bottom: 0.3rem;
      border-bottom: 1px solid #000;
      max-width: 350px;
    }
    .recipient-address {
      margin-top: 0.3rem;
      line-height: 1.4;
      font-size: 9pt;
    }
    .invoice-meta {
      text-align: right;
    }
    .logo-placeholder {
      width: 60px;
      height: 60px;
      border: 2px solid #000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 10pt;
      margin: 0 0 0.5rem auto;
    }
    .invoice-numbers {
      font-size: 8pt;
      line-height: 1.5;
    }

    /* Title */
    .invoice-title {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 0.8rem 0 0.5rem 0;
      border-bottom: 2px solid #000;
      padding-bottom: 0.3rem;
    }
    .invoice-title h1 {
      font-size: 14pt;
      font-weight: bold;
    }
    .page-number {
      font-size: 8pt;
      color: #666;
    }

    /* Table */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.5rem 0;
      font-size: 8pt;
    }
    table.invoice-table thead {
      background: #f3f4f6;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    table.invoice-table th {
      padding: 0.3rem 0.15rem;
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
      padding: 0.3rem 0.15rem;
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
      width: 55%;
      font-size: 8pt;
      margin-top: 0.5rem;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 0.2rem 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .totals-row.total-final {
      font-weight: bold;
      font-size: 9pt;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      margin-top: 0.2rem;
      padding-top: 0.3rem;
    }

    /* Payment section */
    .payment-section {
      display: flex;
      gap: 1.5rem;
      margin-top: 1rem;
      align-items: flex-start;
    }
    .payment-terms {
      flex: 1;
      font-size: 7.5pt;
      line-height: 1.4;
    }
    .payment-terms p {
      margin-bottom: 0.2rem;
    }
    .qr-codes-section {
      flex: 0 0 auto;
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }
    .qr-code-container {
      text-align: center;
      max-width: 120px;
    }
    .qr-code-title {
      font-size: 6pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 0.2rem;
    }
    .qr-code-image {
      width: 80px;
      height: 80px;
      margin: 0 auto;
      background: #fff;
      padding: 0.1rem;
      border-radius: 3px;
    }
    .qr-code-info {
      font-size: 6pt;
      font-weight: 600;
      margin-top: 0.15rem;
      line-height: 1.2;
    }

    /* Footer */
    .rechnung-footer {
      position: absolute;
      bottom: 10mm;
      left: 15mm;
      right: 15mm;
      padding-top: 0.3rem;
      border-top: 1px solid rgba(0, 0, 0, 0.2);
      font-size: 6.5pt;
      text-align: center;
      line-height: 1.4;
    }
    .rechnung-footer > div {
      margin-bottom: 0.1rem;
    }

    @page {
      margin: 0;
      size: A4;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="invoice-header">
    <div class="company-info">
      <div class="company-small">
        ${absenderzeile}
      </div>
      <div class="recipient-address">
        ${empfaengerAnrede ? `<div>${empfaengerAnrede}</div>` : ''}
        <div>${empfaengerName}</div>
        <div>${empfaengerStrasse}</div>
        <div>${empfaengerOrt}</div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="logo-placeholder">LOGO</div>
      <div class="invoice-numbers">
        <div>Rechnungs-Nr.: ${zahlung.rechnungsnummer || ''}</div>
        <div>Mitgliedsnummer: ${mitgliedsnummer}</div>
        <div>Belegdatum: ${formatDate(zahlung.rechnungsdatum)}</div>
        <div>Leistungszeitraum: ${zeitraum}</div>
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
      <tr>
        <td>1</td>
        <td>${leistung}<br/><span style="font-size: 6.5pt; color: #666;">Zeitraum: ${zeitraum}</span></td>
        <td>TDA-VM-${mitgliedschaft.typ === 'dojo' ? 'DOJO' : 'EINZEL'}</td>
        <td>1</td>
        <td>Jahr</td>
        <td>${formatCurrency(nettoPreis)}</td>
        <td>-</td>
        <td>${mwstSatz.toFixed(2).replace('.', ',')} %</td>
        <td>${formatCurrency(nettoPreis)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="invoice-totals">
    <div class="totals-row">
      <span>Zwischensumme:</span>
      <span>${formatCurrency(nettoPreis)}</span>
    </div>
    <div class="totals-row">
      <span>Summe:</span>
      <span>${formatCurrency(nettoPreis)}</span>
    </div>
    <div class="totals-row">
      <span>${mwstSatz.toFixed(2).replace('.', ',')} % USt. auf EUR ${formatCurrency(nettoPreis)}:</span>
      <span>${formatCurrency(mwstBetrag)}</span>
    </div>
    <div class="totals-row total-final">
      <span>Endbetrag:</span>
      <span>${formatCurrency(bruttoBetrag)}</span>
    </div>
  </div>

  <!-- Payment Terms and QR Codes -->
  <div class="payment-section">
    <div class="payment-terms">
      <p><strong>Bitte beachten Sie unsere Zahlungsbedingung:</strong></p>
      <p>Ohne Abzug bis zum ${zahlungsfristDatum}.</p>
      ${iban ? `
      <p style="margin-top: 0.5rem;"><strong>Bankverbindung:</strong></p>
      <p>Empfänger: ${kontoinhaber}</p>
      ${bankName ? `<p>Bank: ${bankName}</p>` : ''}
      <p>IBAN: ${iban}</p>
      ${bic ? `<p>BIC: ${bic}</p>` : ''}
      <p>Verwendungszweck: ${zahlung.rechnungsnummer}</p>
      ` : ''}
    </div>

    ${qrCodeDataURI ? `
      <div class="qr-codes-section">
        <div class="qr-code-container">
          <div class="qr-code-title">QR-Code für Überweisung</div>
          <img src="${qrCodeDataURI}" class="qr-code-image" alt="QR-Code" />
          <div class="qr-code-info">
            <div>Betrag: ${formatCurrency(bruttoBetrag)} EUR</div>
            <div>bis zum ${zahlungsfristDatum} zu zahlen</div>
          </div>
        </div>
      </div>
    ` : ''}
  </div>

  <!-- Footer -->
  <div class="rechnung-footer">
    <div>
      ${[
        verbandName,
        verbandStrasse,
        `${verbandPlz} ${verbandOrt}`,
        verbandEmail,
        verbandTelefon
      ].filter(Boolean).join(' | ')}
    </div>
    ${iban && kontoinhaber ? `
      <div>
        ${[
          bankName,
          kontoinhaber,
          iban,
          bic
        ].filter(Boolean).join(' | ')}
      </div>
    ` : ''}
    ${verbandWebsite ? `<div>Web: ${verbandWebsite}</div>` : ''}
    ${verbandSteuernummer || verbandUstId ? `
      <div>
        ${[verbandSteuernummer ? `Steuernummer: ${verbandSteuernummer}` : '', verbandUstId ? `USt-IdNr.: ${verbandUstId}` : ''].filter(Boolean).join(' | ')}
      </div>
    ` : ''}
  </div>
</body>
</html>
  `;
};
