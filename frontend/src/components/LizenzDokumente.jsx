import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, FileText, Download, Eye, Save, Building2, Mail, Phone, Globe, MapPin, Clock, Shield, PenLine, Trash2, CheckCircle, List } from 'lucide-react';
import SignaturePad from 'signature_pad';
import axios from 'axios';
import { getAuthToken } from '../utils/fetchWithAuth';
import '../styles/LizenzDokumente.css';

const PLAN_PRICES = {
  trial:        { label: 'Trial (14 Tage kostenlos)', monatlich: 0,   jaehrlich: 0 },
  basic:        { label: 'Basic',                     monatlich: 0,   jaehrlich: 0 },
  starter:      { label: 'Starter',                   monatlich: 49,  jaehrlich: 529  },
  professional: { label: 'Professional',              monatlich: 89,  jaehrlich: 961  },
  premium:      { label: 'Premium',                   monatlich: 149, jaehrlich: 1609 },
  enterprise:   { label: 'Enterprise',                monatlich: 249, jaehrlich: 2689 },
};

const DEFAULT_SETTINGS = {
  lv_anbieter_name:          'Tiger & Dragon Association – International',
  lv_anbieter_strasse:       '',
  lv_anbieter_plz_ort:       '',
  lv_anbieter_email:         'info@tda-intl.com',
  lv_anbieter_telefon:       '',
  lv_anbieter_website:       'www.tda-intl.com',
  lv_anbieter_steuernr:      '',
  lv_anbieter_ust_id:        '',
  lv_support_email:          'info@tda-intl.com',
  lv_support_zeiten:         'Mo–Fr, 09:00–17:00 Uhr',
  lv_kuendigungsfrist:       '30 Tage zum Monatsende',
  lv_datenspeicherung_tage:  '30',
  lv_verfuegbarkeit_prozent: '99',
  lv_gerichtsstand:          'Sitz des Anbieters',
};

function formatDate(d = new Date()) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Vertrag HTML generieren ────────────────────────────────────────────────
function buildContractHTML(settings, dojo, plan, interval, sigOptions = {}) {
  const s       = { ...DEFAULT_SETTINGS, ...settings };
  const today   = formatDate();
  const planInfo = PLAN_PRICES[plan] || PLAN_PRICES.starter;
  const preis   = interval === 'yearly'
    ? `${planInfo.jaehrlich} € / Jahr (entspricht ${(planInfo.jaehrlich / 12).toFixed(2)} € / Monat)`
    : `${planInfo.monatlich} € / Monat`;
  const abrechnung = interval === 'yearly' ? 'jährlich' : 'monatlich';

  const anbieterAdresse = [s.lv_anbieter_strasse, s.lv_anbieter_plz_ort].filter(Boolean).join(', ');
  const kundeAdresse    = [dojo?.strasse, [dojo?.plz, dojo?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const { sigDataUrl, sigTimestamp, sigIp, sigName } = sigOptions;

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
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 20mm;
    background: #ffffff;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 9mm;
    padding-bottom: 5mm;
    border-bottom: 2px solid #1a1a1a;
  }
  .header-logo {
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a1a;
    letter-spacing: 0.5px;
  }
  .header-logo span {
    display: block;
    font-size: 8.5pt;
    font-weight: normal;
    color: #b8922a;
    margin-top: 2px;
    font-family: Arial, sans-serif;
    letter-spacing: 0.3px;
  }
  .header-date {
    text-align: right;
    font-size: 8.5pt;
    color: #555;
    font-family: Arial, sans-serif;
    line-height: 1.6;
  }
  .header-date strong {
    display: block;
    color: #1a1a1a;
    font-size: 8pt;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 1mm;
  }

  /* ── Titel ── */
  .title {
    text-align: center;
    margin-bottom: 8mm;
    padding: 5mm 0;
    border-bottom: 1px solid #e0d5c0;
  }
  .title h1 {
    font-size: 17pt;
    font-weight: bold;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #1a1a1a;
  }
  .title .title-gold-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 2mm 0 0;
  }
  .title .tgl-bar {
    height: 1px;
    width: 30mm;
    background: #b8922a;
  }
  .title p {
    font-size: 8.5pt;
    color: #b8922a;
    margin-top: 1.5mm;
    font-family: Arial, sans-serif;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  /* ── Vertragsparteien ── */
  .parties {
    display: flex;
    gap: 6mm;
    margin-bottom: 8mm;
  }
  .party {
    flex: 1;
    border: 1px solid #e0d5c0;
    border-top: 3px solid #b8922a;
    border-radius: 3px;
    padding: 4mm;
    background: #faf7f2;
  }
  .party h4 {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #b8922a;
    margin-bottom: 2mm;
    border-bottom: 1px solid #e0d5c0;
    padding-bottom: 1.5mm;
    font-family: Arial, sans-serif;
  }
  .party p {
    font-size: 9pt;
    line-height: 1.75;
    color: #1a1a1a;
    font-family: Arial, sans-serif;
  }
  .party strong { color: #1a1a1a; }
  .party .role {
    display: inline-block;
    margin-top: 2.5mm;
    font-size: 7.5pt;
    background: #1a1a1a;
    color: #f0e0a0;
    padding: 1px 7px;
    border-radius: 2px;
    font-family: Arial, sans-serif;
    letter-spacing: 0.5px;
  }

  /* ── Abschnitte ── */
  .section { margin-bottom: 5.5mm; }
  .section h2 {
    font-size: 10.5pt;
    font-weight: bold;
    margin-bottom: 2mm;
    color: #1a1a1a;
    border-left: 3px solid #b8922a;
    padding-left: 3mm;
    letter-spacing: 0.3px;
  }
  .section p, .section li {
    font-size: 9pt;
    margin-bottom: 1.5mm;
    color: #222;
    font-family: Arial, sans-serif;
  }
  .section ol, .section ul { padding-left: 6mm; }
  .section ol li { margin-bottom: 1mm; }
  .section strong { color: #1a1a1a; }

  /* ── Preistabelle ── */
  .price-table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-family: Arial, sans-serif; }
  .price-table th {
    background: #1a1a1a;
    font-size: 8.5pt;
    padding: 2mm 3mm;
    text-align: left;
    border: 1px solid #1a1a1a;
    color: #f0e0a0;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .price-table td {
    font-size: 8.5pt;
    padding: 2mm 3mm;
    border: 1px solid #e0d5c0;
    color: #222;
  }
  .price-table tr.selected td {
    background: #faf0d0;
    font-weight: bold;
    color: #1a1a1a;
  }

  /* ── Highlight ── */
  .highlight-box {
    background: #faf7f2;
    border: 1px solid #e0d5c0;
    border-left: 3px solid #b8922a;
    border-radius: 3px;
    padding: 3mm 4mm;
    margin: 2mm 0 4mm;
    font-size: 9pt;
    font-family: Arial, sans-serif;
    color: #1a1a1a;
  }
  .highlight-box strong { color: #8a6a10; }

  /* ── Unterschriften ── */
  .signatures {
    display: flex;
    gap: 10mm;
    margin-top: 10mm;
    padding-top: 6mm;
    border-top: 1px solid #e0d5c0;
  }
  .sig-block { flex: 1; }
  .sig-block p {
    font-size: 8.5pt;
    color: #777;
    margin-bottom: 8mm;
    font-family: Arial, sans-serif;
  }
  .sig-line {
    border-top: 1px solid #1a1a1a;
    padding-top: 2mm;
    font-size: 9pt;
    font-family: Arial, sans-serif;
    color: #1a1a1a;
  }
  .sig-meta {
    font-size: 7pt;
    color: #999;
    font-style: italic;
  }

  /* ── Footer ── */
  .footer {
    text-align: center;
    font-size: 7.5pt;
    color: #b8922a;
    margin-top: 8mm;
    padding-top: 4mm;
    border-top: 1px solid #e0d5c0;
    font-family: Arial, sans-serif;
    letter-spacing: 0.3px;
  }

  @media print {
    @page { size: A4; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f8f5ef; }
    .page { padding: 20mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      ${s.lv_anbieter_name}
      <span>${anbieterAdresse || s.lv_anbieter_website}</span>
    </div>
    <div class="header-date">
      <strong>LIZENZVERTRAG (SaaS)</strong><br>
      Datum: ${today}
    </div>
  </div>

  <!-- Titel -->
  <div class="title">
    <h1>SOFTWARE-LIZENZVERTRAG</h1>
    <div class="title-gold-line">
      <div class="tgl-bar"></div>
      <p>Software-as-a-Service · DojoSoftware · ${today}</p>
      <div class="tgl-bar"></div>
    </div>
  </div>

  <!-- Vertragsparteien -->
  <div class="parties">
    <div class="party">
      <h4>Anbieter</h4>
      <p>
        <strong>${s.lv_anbieter_name}</strong><br>
        ${s.lv_anbieter_strasse ? s.lv_anbieter_strasse + '<br>' : ''}
        ${s.lv_anbieter_plz_ort ? s.lv_anbieter_plz_ort + '<br>' : ''}
        ${s.lv_anbieter_email ? 'E-Mail: ' + s.lv_anbieter_email + '<br>' : ''}
        ${s.lv_anbieter_telefon ? 'Tel: ' + s.lv_anbieter_telefon + '<br>' : ''}
        ${s.lv_anbieter_website ? s.lv_anbieter_website : ''}
        ${s.lv_anbieter_steuernr ? '<br>St-Nr: ' + s.lv_anbieter_steuernr : ''}
        ${s.lv_anbieter_ust_id ? '<br>USt-ID: ' + s.lv_anbieter_ust_id : ''}
      </p>
      <span class="role">Anbieter</span>
    </div>
    <div class="party">
      <h4>Kunde</h4>
      <p>
        <strong>${dojo?.dojoname || '[Dojo-Name]'}</strong><br>
        ${kundeAdresse ? kundeAdresse + '<br>' : ''}
        ${dojo?.email ? 'E-Mail: ' + dojo.email + '<br>' : ''}
        ${dojo?.subdomain ? 'Subdomain: ' + dojo.subdomain + '.dojo.tda-intl.org' : ''}
      </p>
      <span class="role">Kunde</span>
    </div>
  </div>

  <!-- §1 -->
  <div class="section">
    <h2>§ 1 &nbsp;Vertragsgegenstand</h2>
    <ol>
      <li>Der Anbieter stellt dem Kunden die Software <strong>DojoSoftware</strong> als Software-as-a-Service (SaaS) über das Internet zur Nutzung bereit.</li>
      <li>Die Software dient der Verwaltung von Kampfkunstschulen, insbesondere: Mitgliederverwaltung, Kurse &amp; Stundenplan, Prüfungen, Verträge, Zahlungsabwicklung (SEPA), Check-in-System und weitere Funktionen gemäß dem gewählten Lizenzplan.</li>
      <li>Der Zugriff erfolgt ausschließlich über einen Webbrowser. Eine lokale Installation ist nicht erforderlich. Zugang: <strong>${dojo?.subdomain ? dojo.subdomain + '.dojo.tda-intl.org' : '[subdomain].dojo.tda-intl.org'}</strong></li>
    </ol>
  </div>

  <!-- §2 -->
  <div class="section">
    <h2>§ 2 &nbsp;Testphase (14 Tage)</h2>
    <ol>
      <li>Der Kunde erhält eine kostenfreie Testphase von <strong>14 Tagen</strong> ab erstmaliger Registrierung.</li>
      <li>Während der Testphase stehen dem Kunden alle Funktionen des <strong>Professional-Plans</strong> vollständig zur Verfügung.</li>
      <li>Nach Ablauf der Testphase wird der Zugang automatisch gesperrt, sofern keine kostenpflichtige Lizenz abgeschlossen wird.</li>
      <li>Der Anbieter ist berechtigt, während der Testphase Daten zu speichern, jedoch ohne Verpflichtung zur dauerhaften Sicherung nach Ablauf ohne aktive Lizenz.</li>
    </ol>
  </div>

  <!-- §3 -->
  <div class="section">
    <h2>§ 3 &nbsp;Gewählter Lizenzplan</h2>
    <div class="highlight-box">
      Gewählter Plan: <strong>${planInfo.label}</strong> &nbsp;·&nbsp;
      Preis: <strong>${preis}</strong> &nbsp;·&nbsp;
      Abrechnung: <strong>${abrechnung}</strong>
    </div>
    <table class="price-table">
      <tr><th>Plan</th><th>Monatlich</th><th>Jährlich</th><th>Enthaltene Kernfunktionen</th></tr>
      ${Object.entries(PLAN_PRICES).filter(([k]) => !['trial','basic'].includes(k)).map(([k, v]) => `
      <tr${k === plan ? ' class="selected"' : ''}>
        <td>${v.label}</td>
        <td>${v.monatlich > 0 ? v.monatlich + ' €' : '–'}</td>
        <td>${v.jaehrlich > 0 ? v.jaehrlich + ' €' : '–'}</td>
        <td>${k === 'starter' ? 'Mitglieder, Check-in, SEPA, Prüfungen, Stundenplan' :
             k === 'professional' ? 'Starter + Kommunikation, Events, Familien, Verkauf, Chat' :
             k === 'premium' ? 'Professional + Lernplattform, Eltern-Portal, Buchhaltung, API' :
             'Premium + Multi-Dojo, White-Label, Homepage-Builder'}</td>
      </tr>`).join('')}
    </table>
  </div>

  <!-- §4 -->
  <div class="section">
    <h2>§ 4 &nbsp;Lizenz und Nutzungsrecht</h2>
    <ol>
      <li>Nach Abschluss einer kostenpflichtigen Lizenz erhält der Kunde ein nicht-exklusives, nicht übertragbares Nutzungsrecht an der Software im Umfang des gewählten Plans.</li>
      <li>Eine Weitergabe von Zugangsdaten an Dritte ist unzulässig.</li>
      <li>Der Kunde verpflichtet sich, die Software nicht zu dekompilieren, zu reverse-engineeren oder anderweitig technisch zu verändern.</li>
    </ol>
  </div>

  <!-- §5 -->
  <div class="section">
    <h2>§ 5 &nbsp;Preise und Zahlung</h2>
    <ol>
      <li>Die Nutzung nach der Testphase ist kostenpflichtig gemäß §&nbsp;3.</li>
      <li>Die Abrechnung erfolgt <strong>${abrechnung}</strong> im Voraus per SEPA-Lastschrift oder Überweisung.</li>
      <li>Preisanpassungen werden dem Kunden mindestens 30 Tage vorab schriftlich oder per E-Mail angekündigt.</li>
      <li>Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Software nach Mahnung zu sperren.</li>
    </ol>
  </div>

  <!-- §6 -->
  <div class="section">
    <h2>§ 6 &nbsp;Verfügbarkeit und Wartung</h2>
    <ol>
      <li>Der Anbieter stellt eine Verfügbarkeit von <strong>${s.lv_verfuegbarkeit_prozent} % im Jahresmittel</strong> sicher.</li>
      <li>Wartungsarbeiten können zu temporären Einschränkungen führen und werden nach Möglichkeit angekündigt.</li>
      <li>Es besteht kein Anspruch auf eine unterbrechungsfreie Nutzung.</li>
    </ol>
  </div>

  <!-- §7 -->
  <div class="section">
    <h2>§ 7 &nbsp;Support</h2>
    <ol>
      <li>E-Mail-Support: <strong>${s.lv_support_email}</strong></li>
      <li>Supportzeiten: <strong>${s.lv_support_zeiten}</strong></li>
      <li>Für Enterprise-Kunden steht ein priorisierter Support zur Verfügung.</li>
    </ol>
  </div>

  <!-- §8 -->
  <div class="section">
    <h2>§ 8 &nbsp;Pflichten des Kunden</h2>
    <p>Der Kunde verpflichtet sich:</p>
    <ul>
      <li>korrekte und vollständige Daten anzugeben;</li>
      <li>Zugangsdaten sicher aufzubewahren und nicht an Dritte weiterzugeben;</li>
      <li>keine rechtswidrigen Inhalte zu speichern oder zu verarbeiten;</li>
      <li>die Software ausschließlich im Rahmen der vereinbarten Lizenz zu nutzen.</li>
    </ul>
  </div>

  <!-- §9 -->
  <div class="section">
    <h2>§ 9 &nbsp;Datenschutz (DSGVO)</h2>
    <ol>
      <li>Der Anbieter verarbeitet personenbezogene Daten ausschließlich im Rahmen der DSGVO und des BDSG.</li>
      <li>Zwischen Anbieter und Kunde wird eine separate <strong>Auftragsverarbeitungsvereinbarung (AVV)</strong> geschlossen.</li>
      <li>Der Kunde bleibt Verantwortlicher im Sinne der DSGVO für die von ihm eingegebenen Daten.</li>
      <li>Der Anbieter hostet alle Daten auf Servern innerhalb der EU.</li>
    </ol>
  </div>

  <!-- §10 -->
  <div class="section">
    <h2>§ 10 &nbsp;Haftung</h2>
    <ol>
      <li>Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit.</li>
      <li>Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den vertragstypischen, vorhersehbaren Schaden.</li>
      <li>Eine Haftung für Datenverluste durch fehlerhafte Bedienung durch den Kunden ist ausgeschlossen.</li>
    </ol>
  </div>

  <!-- §11 -->
  <div class="section">
    <h2>§ 11 &nbsp;Laufzeit und Kündigung</h2>
    <ol>
      <li>Der Vertrag wird auf unbestimmte Zeit geschlossen.</li>
      <li>Kündigungsfrist: <strong>${s.lv_kuendigungsfrist}</strong></li>
      <li>Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</li>
      <li>Nach Vertragsende wird der Zugang gesperrt. Gespeicherte Daten können nach einer Frist von <strong>${s.lv_datenspeicherung_tage} Tagen</strong> unwiderruflich gelöscht werden.</li>
    </ol>
  </div>

  <!-- §12 -->
  <div class="section">
    <h2>§ 12 &nbsp;Weiterentwicklung</h2>
    <p>Der Anbieter ist berechtigt, die Software laufend weiterzuentwickeln und Funktionen anzupassen oder zu erweitern, sofern dies den Kunden nicht wesentlich beeinträchtigt. Über wesentliche Änderungen wird der Kunde rechtzeitig informiert.</p>
  </div>

  <!-- §13 -->
  <div class="section">
    <h2>§ 13 &nbsp;Schlussbestimmungen</h2>
    <ol>
      <li>Es gilt das Recht der Bundesrepublik Deutschland.</li>
      <li>Gerichtsstand ist – soweit rechtlich zulässig – <strong>${s.lv_gerichtsstand}</strong>.</li>
      <li>Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam. Die unwirksame Bestimmung ist durch eine wirksame zu ersetzen, die dem wirtschaftlichen Zweck am nächsten kommt.</li>
      <li>Änderungen und Ergänzungen bedürfen der Schriftform.</li>
    </ol>
  </div>

  <!-- Unterschriften -->
  <div class="signatures">
    <div class="sig-block">
      <p>Ort, Datum: ________________________________</p>
      <div style="height:18mm;"></div>
      <div class="sig-line">
        <strong>${s.lv_anbieter_name}</strong><br>
        (Anbieter)
      </div>
    </div>
    <div class="sig-block">
      <p>Ort, Datum: ${sigTimestamp ? sigTimestamp.split('T')[0].split('-').reverse().join('.') : '________________________________'}</p>
      ${sigDataUrl
        ? `<img src="${sigDataUrl}" style="height:18mm; max-width:80mm; display:block; margin-bottom:1mm; object-fit:contain;">`
        : '<div style="height:18mm;"></div>'
      }
      <div class="sig-line">
        <strong>${sigName || dojo?.dojoname || '________________________________'}</strong><br>
        (Kunde)
        ${sigTimestamp ? `<br><span class="sig-meta">Elektronisch signiert · ${new Date(sigTimestamp).toLocaleString('de-DE')} · IP: ${sigIp || '–'}</span>` : ''}
      </div>
    </div>
  </div>

  <div class="footer">
    ${s.lv_anbieter_name} · ${anbieterAdresse || s.lv_anbieter_website} · ${s.lv_anbieter_email}
    ${s.lv_anbieter_steuernr ? '· St-Nr: ' + s.lv_anbieter_steuernr : ''}
    ${s.lv_anbieter_ust_id ? '· USt-ID: ' + s.lv_anbieter_ust_id : ''}
  </div>

</div>
</body>
</html>`;
}

// ── Komponente ────────────────────────────────────────────────────────────────
export default function LizenzDokumente({ dojos = [] }) {
  const token = getAuthToken();
  const [activeSection, setActiveSection] = useState('generator'); // 'generator' | 'settings' | 'signaturen'
  const [settings, setSettings]           = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving]   = useState(false);
  const [settingsMsg, setSettingsMsg]         = useState('');

  const [selectedDojoId, setSelectedDojoId]     = useState('');
  const [selectedPlan, setSelectedPlan]         = useState('starter');
  const [selectedInterval, setSelectedInterval] = useState('monthly');
  const [showPreview, setShowPreview]           = useState(false);
  const [pdfLoading, setPdfLoading]             = useState(false);

  // Signatur
  const [signerName, setSignerName]   = useState('');
  const [sigEmpty, setSigEmpty]       = useState(true);
  const [signaturen, setSignaturen]   = useState([]);
  const [sigListLoading, setSigListLoading] = useState(false);

  const previewRef = useRef(null);
  const sigPadRef  = useRef(null);
  const headers    = { Authorization: `Bearer ${token}` };
  const selectedDojo = dojos.find(d => String(d.id) === String(selectedDojoId));

  // Settings laden
  useEffect(() => {
    axios.get('/admin/lizenzvertrag/settings', { headers })
      .then(r => { if (r.data.success) setSettings(r.data.settings); })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  // Signaturen laden
  const loadSignaturen = useCallback(() => {
    setSigListLoading(true);
    axios.get('/admin/lizenzvertrag/signaturen', { headers })
      .then(r => { if (r.data.success) setSignaturen(r.data.signaturen); })
      .catch(() => {})
      .finally(() => setSigListLoading(false));
  }, []);

  useEffect(() => {
    if (activeSection === 'signaturen') loadSignaturen();
  }, [activeSection, loadSignaturen]);

  // Callback-Ref: wird aufgerufen sobald das Canvas-Element im DOM erscheint
  const canvasCallbackRef = useCallback((canvas) => {
    // Cleanup alter Instanz
    if (sigPadRef.current) {
      sigPadRef.current.off();
      sigPadRef.current = null;
    }
    if (!canvas) return;

    // Canvas auf physische Pixel skalieren BEVOR SignaturePad initialisiert wird
    const ratio = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: '#1a1a1a',
      minWidth: 0.8,
      maxWidth: 2.5,
    });
    pad.addEventListener('endStroke', () => setSigEmpty(pad.isEmpty()));
    sigPadRef.current = pad;
    setSigEmpty(true);
  }, []);

  const clearSignature = () => {
    sigPadRef.current?.clear();
    setSigEmpty(true);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      await axios.put('/admin/lizenzvertrag/settings', settings, { headers });
      setSettingsMsg('✅ Einstellungen gespeichert');
      setTimeout(() => setSettingsMsg(''), 3000);
    } catch {
      setSettingsMsg('❌ Fehler beim Speichern');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Unsigniertes PDF (Entwurf) — Backend baut das HTML
  const downloadDraftPDF = async () => {
    if (!selectedDojoId) return;
    setPdfLoading(true);
    try {
      const resp = await axios.post('/admin/lizenzvertrag/pdf', {
        dojoId:   selectedDojoId,
        plan:     selectedPlan,
        interval: selectedInterval,
      }, { headers, responseType: 'blob' });
      triggerDownload(resp.data, `Lizenzvertrag_Entwurf_${selectedDojo?.dojoname?.replace(/\s+/g, '_') || 'Dojo'}.pdf`);
    } catch {
      alert('Fehler beim PDF-Download');
    } finally {
      setPdfLoading(false);
    }
  };

  // Signiertes PDF — nur Signatur-Bild + Parameter senden, Backend baut HTML
  const signAndDownload = async () => {
    if (!selectedDojoId) { alert('Kein Dojo ausgewählt'); return; }
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) { alert('Bitte zuerst unterschreiben'); return; }
    setPdfLoading(true);
    try {
      const sigDataUrl = sigPadRef.current.toDataURL('image/png');
      const resp = await axios.post('/admin/lizenzvertrag/sign', {
        sigDataUrl,
        dojoId:   selectedDojoId,
        plan:     selectedPlan,
        interval: selectedInterval,
        signedBy: signerName || selectedDojo?.dojoname || '',
      }, { headers, responseType: 'blob' });
      triggerDownload(resp.data, `Lizenzvertrag_${selectedDojo?.dojoname?.replace(/\s+/g, '_') || 'Dojo'}_signiert.pdf`);
      clearSignature();
    } catch (err) {
      let msg = 'Fehler beim Signieren';
      if (err.response) {
        try {
          const text = err.response.data instanceof Blob
            ? await err.response.data.text()
            : JSON.stringify(err.response.data);
          const parsed = JSON.parse(text);
          msg = `Fehler ${err.response.status}: ${parsed.error || text}`;
        } catch {
          msg = `Fehler ${err.response.status}`;
        }
      } else if (err.message) {
        msg = err.message;
      }
      alert(msg);
    } finally {
      setPdfLoading(false);
    }
  };

  function triggerDownload(data, filename) {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const contractHtml = selectedDojoId
    ? buildContractHTML(settings, selectedDojo, selectedPlan, selectedInterval)
    : null;

  return (
    <div className="lv-wrapper">
      {/* Section Switcher */}
      <div className="lv-nav">
        <button className={`lv-nav-btn${activeSection === 'generator' ? ' active' : ''}`} onClick={() => setActiveSection('generator')}>
          <FileText size={15} /> Vertrag erstellen
        </button>
        <button className={`lv-nav-btn${activeSection === 'settings' ? ' active' : ''}`} onClick={() => setActiveSection('settings')}>
          <Settings size={15} /> Anbieter-Einstellungen
        </button>
        <button className={`lv-nav-btn${activeSection === 'signaturen' ? ' active' : ''}`} onClick={() => setActiveSection('signaturen')}>
          <List size={15} /> Unterschriften-Log
        </button>
      </div>

      {/* ── GENERATOR ── */}
      {activeSection === 'generator' && (
        <div className="lv-generator">
          {/* Auswahl */}
          <div className="lv-form-row">
            <div className="lv-form-group">
              <label>Dojo / Kunde</label>
              <select value={selectedDojoId} onChange={e => setSelectedDojoId(e.target.value)}>
                <option value="">– Dojo auswählen –</option>
                {dojos.map(d => (
                  <option key={d.id} value={d.id}>{d.dojoname} ({d.subdomain})</option>
                ))}
              </select>
            </div>
            <div className="lv-form-group">
              <label>Lizenzplan</label>
              <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}>
                {Object.entries(PLAN_PRICES)
                  .filter(([k]) => !['trial', 'basic', 'free'].includes(k))
                  .map(([k, v]) => (
                    <option key={k} value={k}>{v.label} – {v.monatlich} €/Monat</option>
                  ))}
              </select>
            </div>
            <div className="lv-form-group">
              <label>Abrechnung</label>
              <select value={selectedInterval} onChange={e => setSelectedInterval(e.target.value)}>
                <option value="monthly">Monatlich</option>
                <option value="yearly">Jährlich (–10 %)</option>
              </select>
            </div>
          </div>

          {!selectedDojoId && (
            <div className="lv-hint">Bitte zuerst ein Dojo auswählen.</div>
          )}

          {/* Unterschrift-Canvas */}
          {selectedDojoId && (
            <div className="lv-sig-section">
              <div className="lv-sig-header">
                <PenLine size={15} />
                <span>Elektronische Unterschrift (Kunde)</span>
              </div>
              <div className="lv-form-group" style={{ maxWidth: 320 }}>
                <label>Name des Unterzeichners</label>
                <input
                  className="lv-sig-name-input"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder={selectedDojo?.dojoname || 'Name eingeben…'}
                />
              </div>
              <div className="lv-canvas-wrap">
                <canvas ref={canvasCallbackRef} className="lv-sig-canvas" />
                <div className="lv-canvas-hint">Hier mit Maus oder Finger unterschreiben</div>
              </div>
              <div className="lv-sig-tools">
                <button className="lv-btn lv-btn-secondary" onClick={clearSignature}>
                  <Trash2 size={13} /> Löschen
                </button>
                {!sigEmpty && (
                  <span className="lv-sig-ok"><CheckCircle size={13} /> Unterschrift vorhanden</span>
                )}
              </div>
            </div>
          )}

          {/* Aktionen */}
          {selectedDojoId && (
            <div className="lv-actions">
              <button
                className="lv-btn lv-btn-secondary"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye size={15} /> {showPreview ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
              </button>
              <button
                className="lv-btn lv-btn-secondary"
                onClick={downloadDraftPDF}
                disabled={pdfLoading}
                title="PDF ohne Unterschrift (Entwurf)"
              >
                <Download size={15} /> Entwurf PDF
              </button>
              <button
                className="lv-btn lv-btn-primary"
                onClick={signAndDownload}
                disabled={sigEmpty || pdfLoading}
                title={sigEmpty ? 'Bitte zuerst unterschreiben' : 'Signiert & IP-geloggt'}
              >
                <CheckCircle size={15} /> {pdfLoading ? 'Generiere…' : 'Signieren & PDF'}
              </button>
            </div>
          )}

          {/* Vorschau */}
          {showPreview && contractHtml && (
            <div className="lv-preview-wrap">
              <div className="lv-preview-label">Vorschau (A4) — ohne Unterschrift</div>
              <iframe
                className="lv-preview-iframe"
                ref={previewRef}
                srcDoc={contractHtml}
                title="Vertragsvorschau"
              />
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {activeSection === 'settings' && (
        <div className="lv-settings">
          <div className="lv-settings-header">
            <div>
              <h3><Building2 size={16} /> Anbieter-Einstellungen</h3>
              <p>Diese Daten erscheinen in jedem generierten Lizenzvertrag.</p>
            </div>
            <div className="lv-settings-actions">
              {settingsMsg && <span className="lv-msg">{settingsMsg}</span>}
              <button className="lv-btn lv-btn-primary" onClick={saveSettings} disabled={settingsSaving}>
                <Save size={15} /> {settingsSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>

          {settingsLoading ? (
            <div className="lv-loading">Laden...</div>
          ) : (
            <div className="lv-settings-grid">
              <div className="lv-settings-section">
                <h4><Building2 size={14} /> Anbieter / Gesellschaft</h4>
                <div className="lv-field">
                  <label>Firmenname / Gesellschaft *</label>
                  <input value={settings.lv_anbieter_name} onChange={e => setSettings(s => ({ ...s, lv_anbieter_name: e.target.value }))} placeholder="Tiger & Dragon Association – International" />
                </div>
                <div className="lv-field">
                  <label>Straße &amp; Hausnummer</label>
                  <input value={settings.lv_anbieter_strasse} onChange={e => setSettings(s => ({ ...s, lv_anbieter_strasse: e.target.value }))} placeholder="Musterstraße 1" />
                </div>
                <div className="lv-field">
                  <label>PLZ &amp; Ort</label>
                  <input value={settings.lv_anbieter_plz_ort} onChange={e => setSettings(s => ({ ...s, lv_anbieter_plz_ort: e.target.value }))} placeholder="12345 Musterstadt" />
                </div>
                <div className="lv-field-row">
                  <div className="lv-field">
                    <label><Mail size={12} /> E-Mail</label>
                    <input type="email" value={settings.lv_anbieter_email} onChange={e => setSettings(s => ({ ...s, lv_anbieter_email: e.target.value }))} placeholder="info@tda-intl.com" />
                  </div>
                  <div className="lv-field">
                    <label><Phone size={12} /> Telefon</label>
                    <input value={settings.lv_anbieter_telefon} onChange={e => setSettings(s => ({ ...s, lv_anbieter_telefon: e.target.value }))} placeholder="+49 ..." />
                  </div>
                </div>
                <div className="lv-field">
                  <label><Globe size={12} /> Website</label>
                  <input value={settings.lv_anbieter_website} onChange={e => setSettings(s => ({ ...s, lv_anbieter_website: e.target.value }))} placeholder="www.tda-intl.com" />
                </div>
                <div className="lv-field-row">
                  <div className="lv-field">
                    <label>Steuernummer</label>
                    <input value={settings.lv_anbieter_steuernr} onChange={e => setSettings(s => ({ ...s, lv_anbieter_steuernr: e.target.value }))} placeholder="12/345/67890" />
                  </div>
                  <div className="lv-field">
                    <label>USt-IdNr.</label>
                    <input value={settings.lv_anbieter_ust_id} onChange={e => setSettings(s => ({ ...s, lv_anbieter_ust_id: e.target.value }))} placeholder="DE123456789" />
                  </div>
                </div>
              </div>

              <div className="lv-settings-section">
                <h4><Shield size={14} /> Vertragskonditionen</h4>
                <div className="lv-field">
                  <label><Mail size={12} /> Support-E-Mail</label>
                  <input value={settings.lv_support_email} onChange={e => setSettings(s => ({ ...s, lv_support_email: e.target.value }))} placeholder="info@tda-intl.com" />
                </div>
                <div className="lv-field">
                  <label><Clock size={12} /> Support-Zeiten</label>
                  <input value={settings.lv_support_zeiten} onChange={e => setSettings(s => ({ ...s, lv_support_zeiten: e.target.value }))} placeholder="Mo–Fr, 09:00–17:00 Uhr" />
                </div>
                <div className="lv-field">
                  <label>Verfügbarkeitsgarantie (%)</label>
                  <input value={settings.lv_verfuegbarkeit_prozent} onChange={e => setSettings(s => ({ ...s, lv_verfuegbarkeit_prozent: e.target.value }))} placeholder="99" />
                </div>
                <div className="lv-field">
                  <label>Kündigungsfrist</label>
                  <input value={settings.lv_kuendigungsfrist} onChange={e => setSettings(s => ({ ...s, lv_kuendigungsfrist: e.target.value }))} placeholder="30 Tage zum Monatsende" />
                </div>
                <div className="lv-field">
                  <label>Datenspeicherung nach Vertragsende (Tage)</label>
                  <input type="number" value={settings.lv_datenspeicherung_tage} onChange={e => setSettings(s => ({ ...s, lv_datenspeicherung_tage: e.target.value }))} placeholder="30" />
                </div>
                <div className="lv-field">
                  <label><MapPin size={12} /> Gerichtsstand</label>
                  <input value={settings.lv_gerichtsstand} onChange={e => setSettings(s => ({ ...s, lv_gerichtsstand: e.target.value }))} placeholder="Sitz des Anbieters" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UNTERSCHRIFTEN-LOG ── */}
      {activeSection === 'signaturen' && (
        <div className="lv-sig-log">
          <div className="lv-sig-log-header">
            <h3><List size={16} /> Unterschriften-Protokoll</h3>
            <button className="lv-btn lv-btn-secondary" onClick={loadSignaturen} disabled={sigListLoading}>
              {sigListLoading ? 'Lädt…' : 'Aktualisieren'}
            </button>
          </div>
          {sigListLoading ? (
            <div className="lv-loading">Lädt...</div>
          ) : signaturen.length === 0 ? (
            <div className="lv-hint">Noch keine signierten Verträge.</div>
          ) : (
            <table className="lv-sig-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Dojo</th>
                  <th>Unterzeichner</th>
                  <th>Plan</th>
                  <th>IP-Adresse</th>
                  <th>Datei</th>
                </tr>
              </thead>
              <tbody>
                {signaturen.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.signed_at).toLocaleString('de-DE')}</td>
                    <td>{s.dojoname || `#${s.dojo_id}`}</td>
                    <td>{s.signed_by || '–'}</td>
                    <td>{s.plan} / {s.interval_type}</td>
                    <td className="lv-sig-ip">{s.ip_address}</td>
                    <td className="lv-sig-file">{s.pdf_filename}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
