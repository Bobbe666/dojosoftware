// ============================================================================
// Lizenzvertrag HTML-Template (serverseitig)
// ============================================================================

const PLAN_PRICES = {
  starter:      { label: 'Starter',      monatlich: 49,  jaehrlich: 529  },
  professional: { label: 'Professional', monatlich: 89,  jaehrlich: 961  },
  premium:      { label: 'Premium',      monatlich: 149, jaehrlich: 1609 },
  enterprise:   { label: 'Enterprise',   monatlich: 249, jaehrlich: 2689 },
};

function formatDate(d = new Date()) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildContractHTML(settings = {}, dojo = {}, plan = 'starter', interval = 'monthly', sigOptions = {}) {
  const s = settings;
  const today    = formatDate();
  const planInfo = PLAN_PRICES[plan] || PLAN_PRICES.starter;
  const preis    = interval === 'yearly'
    ? `${planInfo.jaehrlich} € / Jahr (entspricht ${(planInfo.jaehrlich / 12).toFixed(2)} € / Monat)`
    : `${planInfo.monatlich} € / Monat`;
  const abrechnung = interval === 'yearly' ? 'jährlich' : 'monatlich';

  const anbieterAdresse = [s.lv_anbieter_strasse, s.lv_anbieter_plz_ort].filter(Boolean).join(', ');
  const kundeAdresse    = [dojo.strasse, [dojo.plz, dojo.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const { sigDataUrl, sigTimestamp, sigIp, sigName } = sigOptions;
  const sigDateStr = sigTimestamp
    ? new Date(sigTimestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '________________________________';
  const sigTimeStr = sigTimestamp
    ? new Date(sigTimestamp).toLocaleString('de-DE')
    : '';

  const planRows = Object.entries(PLAN_PRICES).map(([k, v]) => {
    const features = k === 'starter'      ? 'Mitglieder, Check-in, SEPA, Prüfungen, Stundenplan'
                   : k === 'professional' ? 'Starter + Kommunikation, Events, Familien, Verkauf, Chat'
                   : k === 'premium'      ? 'Professional + Lernplattform, Eltern-Portal, Buchhaltung, API'
                   :                        'Premium + Multi-Dojo, White-Label, Homepage-Builder';
    return `<tr${k === plan ? ' class="selected"' : ''}>
      <td>${v.label}</td>
      <td>${v.monatlich} €</td>
      <td>${v.jaehrlich} €</td>
      <td>${features}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 10pt;
    color: #1a1a1a;
    line-height: 1.65;
    background: #f8f5ef;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 20mm; background: #ffffff; }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 9mm; padding-bottom: 5mm; border-bottom: 2px solid #1a1a1a;
  }
  .header-logo { font-size: 13pt; font-weight: bold; color: #1a1a1a; }
  .header-logo span { display: block; font-size: 8.5pt; font-weight: normal; color: #b8922a; margin-top: 2px; font-family: Arial, sans-serif; }
  .header-date { text-align: right; font-size: 8.5pt; color: #555; font-family: Arial, sans-serif; line-height: 1.6; }
  .header-date strong { display: block; color: #1a1a1a; font-size: 8pt; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 1mm; }
  .title { text-align: center; margin-bottom: 8mm; padding: 5mm 0; border-bottom: 1px solid #e0d5c0; }
  .title h1 { font-size: 17pt; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: #1a1a1a; }
  .title-gold-line { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 2mm 0 0; }
  .tgl-bar { height: 1px; width: 30mm; background: #b8922a; }
  .title p { font-size: 8.5pt; color: #b8922a; margin-top: 1.5mm; font-family: Arial, sans-serif; letter-spacing: 1px; text-transform: uppercase; }
  .parties { display: flex; gap: 6mm; margin-bottom: 8mm; }
  .party { flex: 1; border: 1px solid #e0d5c0; border-top: 3px solid #b8922a; border-radius: 3px; padding: 4mm; background: #faf7f2; }
  .party h4 { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: #b8922a; margin-bottom: 2mm; border-bottom: 1px solid #e0d5c0; padding-bottom: 1.5mm; font-family: Arial, sans-serif; }
  .party p { font-size: 9pt; line-height: 1.75; color: #1a1a1a; font-family: Arial, sans-serif; }
  .party .role { display: inline-block; margin-top: 2.5mm; font-size: 7.5pt; background: #1a1a1a; color: #f0e0a0; padding: 1px 7px; border-radius: 2px; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
  .section { margin-bottom: 5.5mm; }
  .section h2 { font-size: 10.5pt; font-weight: bold; margin-bottom: 2mm; color: #1a1a1a; border-left: 3px solid #b8922a; padding-left: 3mm; }
  .section p, .section li { font-size: 9pt; margin-bottom: 1.5mm; color: #222; font-family: Arial, sans-serif; }
  .section ol, .section ul { padding-left: 6mm; }
  .section ol li { margin-bottom: 1mm; }
  .price-table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-family: Arial, sans-serif; }
  .price-table th { background: #1a1a1a; font-size: 8.5pt; padding: 2mm 3mm; text-align: left; border: 1px solid #1a1a1a; color: #f0e0a0; font-weight: 600; }
  .price-table td { font-size: 8.5pt; padding: 2mm 3mm; border: 1px solid #e0d5c0; color: #222; }
  .price-table tr.selected td { background: #faf0d0; font-weight: bold; color: #1a1a1a; }
  .highlight-box { background: #faf7f2; border: 1px solid #e0d5c0; border-left: 3px solid #b8922a; border-radius: 3px; padding: 3mm 4mm; margin: 2mm 0 4mm; font-size: 9pt; font-family: Arial, sans-serif; }
  .highlight-box strong { color: #8a6a10; }
  .signatures { display: flex; gap: 10mm; margin-top: 10mm; padding-top: 6mm; border-top: 1px solid #e0d5c0; }
  .sig-block { flex: 1; }
  .sig-block p { font-size: 8.5pt; color: #777; margin-bottom: 8mm; font-family: Arial, sans-serif; }
  .sig-line { border-top: 1px solid #1a1a1a; padding-top: 2mm; font-size: 9pt; font-family: Arial, sans-serif; color: #1a1a1a; }
  .sig-meta { font-size: 7pt; color: #999; font-style: italic; }
  .footer { text-align: center; font-size: 7.5pt; color: #b8922a; margin-top: 8mm; padding-top: 4mm; border-top: 1px solid #e0d5c0; font-family: Arial, sans-serif; }
  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f5ef; }
    .page { padding: 20mm; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-logo">
      ${s.lv_anbieter_name || 'Anbieter'}
      <span>${anbieterAdresse || s.lv_anbieter_website || ''}</span>
    </div>
    <div class="header-date">
      <strong>LIZENZVERTRAG (SaaS)</strong>
      Datum: ${today}
    </div>
  </div>

  <div class="title">
    <h1>SOFTWARE-LIZENZVERTRAG</h1>
    <div class="title-gold-line">
      <div class="tgl-bar"></div>
      <p>Software-as-a-Service · DojoSoftware · ${today}</p>
      <div class="tgl-bar"></div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h4>Anbieter</h4>
      <p>
        <strong>${s.lv_anbieter_name || ''}</strong><br>
        ${s.lv_anbieter_strasse ? s.lv_anbieter_strasse + '<br>' : ''}
        ${s.lv_anbieter_plz_ort ? s.lv_anbieter_plz_ort + '<br>' : ''}
        ${s.lv_anbieter_email ? 'E-Mail: ' + s.lv_anbieter_email + '<br>' : ''}
        ${s.lv_anbieter_telefon ? 'Tel: ' + s.lv_anbieter_telefon + '<br>' : ''}
        ${s.lv_anbieter_website || ''}
        ${s.lv_anbieter_steuernr ? '<br>St-Nr: ' + s.lv_anbieter_steuernr : ''}
        ${s.lv_anbieter_ust_id ? '<br>USt-ID: ' + s.lv_anbieter_ust_id : ''}
      </p>
      <span class="role">Anbieter</span>
    </div>
    <div class="party">
      <h4>Kunde</h4>
      <p>
        <strong>${dojo.dojoname || '[Dojo-Name]'}</strong><br>
        ${kundeAdresse ? kundeAdresse + '<br>' : ''}
        ${dojo.email ? 'E-Mail: ' + dojo.email + '<br>' : ''}
        ${dojo.subdomain ? 'Subdomain: ' + dojo.subdomain + '.dojo.tda-intl.org' : ''}
      </p>
      <span class="role">Kunde</span>
    </div>
  </div>

  <div class="section">
    <h2>§ 1 &nbsp;Vertragsgegenstand</h2>
    <ol>
      <li>Der Anbieter stellt dem Kunden die Software <strong>DojoSoftware</strong> als Software-as-a-Service (SaaS) über das Internet zur Nutzung bereit.</li>
      <li>Die Software dient der Verwaltung von Kampfkunstschulen, insbesondere: Mitgliederverwaltung, Kurse &amp; Stundenplan, Prüfungen, Verträge, Zahlungsabwicklung (SEPA), Check-in-System und weitere Funktionen gemäß dem gewählten Lizenzplan.</li>
      <li>Zugang: <strong>${dojo.subdomain ? dojo.subdomain + '.dojo.tda-intl.org' : '[subdomain].dojo.tda-intl.org'}</strong></li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 2 &nbsp;Testphase (14 Tage)</h2>
    <ol>
      <li>Der Kunde erhält eine kostenfreie Testphase von <strong>14 Tagen</strong> ab erstmaliger Registrierung.</li>
      <li>Während der Testphase stehen dem Kunden alle Funktionen des <strong>Professional-Plans</strong> vollständig zur Verfügung.</li>
      <li>Nach Ablauf der Testphase wird der Zugang automatisch gesperrt, sofern keine kostenpflichtige Lizenz abgeschlossen wird.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 3 &nbsp;Gewählter Lizenzplan</h2>
    <div class="highlight-box">
      Gewählter Plan: <strong>${planInfo.label}</strong> &nbsp;&middot;&nbsp;
      Preis: <strong>${preis}</strong> &nbsp;&middot;&nbsp;
      Abrechnung: <strong>${abrechnung}</strong>
    </div>
    <table class="price-table">
      <tr><th>Plan</th><th>Monatlich</th><th>Jährlich</th><th>Enthaltene Kernfunktionen</th></tr>
      ${planRows}
    </table>
  </div>

  <div class="section">
    <h2>§ 4 &nbsp;Lizenz und Nutzungsrecht</h2>
    <ol>
      <li>Nach Abschluss einer kostenpflichtigen Lizenz erhält der Kunde ein nicht-exklusives, nicht übertragbares Nutzungsrecht im Umfang des gewählten Plans.</li>
      <li>Eine Weitergabe von Zugangsdaten an Dritte ist unzulässig.</li>
      <li>Der Kunde verpflichtet sich, die Software nicht zu dekompilieren, zu reverse-engineeren oder anderweitig technisch zu verändern.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 5 &nbsp;Preise und Zahlung</h2>
    <ol>
      <li>Die Nutzung nach der Testphase ist kostenpflichtig gemäß § 3.</li>
      <li>Die Abrechnung erfolgt <strong>${abrechnung}</strong> im Voraus per SEPA-Lastschrift oder Überweisung.</li>
      <li>Preisanpassungen werden dem Kunden mindestens 30 Tage vorab angekündigt.</li>
      <li>Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang nach Mahnung zu sperren.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 6 &nbsp;Verfügbarkeit und Wartung</h2>
    <ol>
      <li>Der Anbieter stellt eine Verfügbarkeit von <strong>${s.lv_verfuegbarkeit_prozent || '99'} % im Jahresmittel</strong> sicher.</li>
      <li>Wartungsarbeiten können zu temporären Einschränkungen führen.</li>
      <li>Es besteht kein Anspruch auf eine unterbrechungsfreie Nutzung.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 7 &nbsp;Support</h2>
    <ol>
      <li>E-Mail-Support: <strong>${s.lv_support_email || ''}</strong></li>
      <li>Supportzeiten: <strong>${s.lv_support_zeiten || 'Mo–Fr, 09:00–17:00 Uhr'}</strong></li>
      <li>Für Enterprise-Kunden steht ein priorisierter Support zur Verfügung.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 8 &nbsp;Pflichten des Kunden</h2>
    <ul>
      <li>korrekte und vollständige Daten anzugeben;</li>
      <li>Zugangsdaten sicher aufzubewahren und nicht an Dritte weiterzugeben;</li>
      <li>keine rechtswidrigen Inhalte zu speichern oder zu verarbeiten;</li>
      <li>die Software ausschließlich im Rahmen der vereinbarten Lizenz zu nutzen.</li>
    </ul>
  </div>

  <div class="section">
    <h2>§ 9 &nbsp;Datenschutz (DSGVO)</h2>
    <ol>
      <li>Der Anbieter verarbeitet personenbezogene Daten ausschließlich im Rahmen der DSGVO und des BDSG.</li>
      <li>Zwischen Anbieter und Kunde wird eine separate <strong>Auftragsverarbeitungsvereinbarung (AVV)</strong> geschlossen.</li>
      <li>Der Kunde bleibt Verantwortlicher im Sinne der DSGVO für die von ihm eingegebenen Daten.</li>
      <li>Der Anbieter hostet alle Daten auf Servern innerhalb der EU.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 10 &nbsp;Haftung</h2>
    <ol>
      <li>Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit.</li>
      <li>Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den vertragstypischen, vorhersehbaren Schaden.</li>
      <li>Eine Haftung für Datenverluste durch fehlerhafte Bedienung durch den Kunden ist ausgeschlossen.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 11 &nbsp;Laufzeit und Kündigung</h2>
    <ol>
      <li>Der Vertrag wird auf unbestimmte Zeit geschlossen.</li>
      <li>Kündigungsfrist: <strong>${s.lv_kuendigungsfrist || '30 Tage zum Monatsende'}</strong></li>
      <li>Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</li>
      <li>Nach Vertragsende wird der Zugang gesperrt. Gespeicherte Daten können nach <strong>${s.lv_datenspeicherung_tage || '30'} Tagen</strong> gelöscht werden.</li>
    </ol>
  </div>

  <div class="section">
    <h2>§ 12 &nbsp;Weiterentwicklung</h2>
    <p>Der Anbieter ist berechtigt, die Software laufend weiterzuentwickeln. Über wesentliche Änderungen wird der Kunde rechtzeitig informiert.</p>
  </div>

  <div class="section">
    <h2>§ 13 &nbsp;Schlussbestimmungen</h2>
    <ol>
      <li>Es gilt das Recht der Bundesrepublik Deutschland.</li>
      <li>Gerichtsstand ist – soweit rechtlich zulässig – <strong>${s.lv_gerichtsstand || 'Sitz des Anbieters'}</strong>.</li>
      <li>Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam.</li>
      <li>Änderungen und Ergänzungen bedürfen der Schriftform.</li>
    </ol>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <p>Ort, Datum: ________________________________</p>
      <div style="height:18mm;"></div>
      <div class="sig-line">
        <strong>${s.lv_anbieter_name || 'Anbieter'}</strong><br>
        (Anbieter)
      </div>
    </div>
    <div class="sig-block">
      <p>Ort, Datum: ${sigDateStr}</p>
      ${sigDataUrl
        ? `<img src="${sigDataUrl}" style="height:18mm; max-width:80mm; display:block; margin-bottom:1mm; object-fit:contain;">`
        : '<div style="height:18mm;"></div>'
      }
      <div class="sig-line">
        <strong>${sigName || dojo.dojoname || '________________________________'}</strong><br>
        (Kunde)
        ${sigTimeStr ? `<br><span class="sig-meta">Elektronisch signiert &middot; ${sigTimeStr} &middot; IP: ${sigIp || '–'}</span>` : ''}
      </div>
    </div>
  </div>

  <div class="footer">
    ${s.lv_anbieter_name || ''} &middot; ${anbieterAdresse || s.lv_anbieter_website || ''} &middot; ${s.lv_anbieter_email || ''}
    ${s.lv_anbieter_steuernr ? '&middot; St-Nr: ' + s.lv_anbieter_steuernr : ''}
    ${s.lv_anbieter_ust_id ? '&middot; USt-ID: ' + s.lv_anbieter_ust_id : ''}
  </div>

</div>
</body>
</html>`;
}

module.exports = { buildContractHTML, PLAN_PRICES };
