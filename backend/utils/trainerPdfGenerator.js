/**
 * trainerPdfGenerator.js
 * =======================
 * Erzeugt PDFs für Trainer-Dokumente:
 *   - Trainervereinbarung über freie Mitarbeit (vollständig mit §§ 1–14)
 *   - Infoblatt Trainervereinbarung
 *   - generateFromTemplate(): Wrapper für VorlagenVerwaltung-Integration
 *
 * Design: Rot + KKS-Logo (Kampfkunstschule Schreiner Branding)
 * Nutzt Puppeteer für pixelgenaues A4-Rendering.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ── Logo als Base64 laden ──────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, '../assets/kks-logo.png');
let LOGO_B64 = null;
try {
  const buf = fs.readFileSync(LOGO_PATH);
  LOGO_B64 = `data:image/png;base64,${buf.toString('base64')}`;
} catch (e) {
  LOGO_B64 = null;
}

// ── Farben ─────────────────────────────────────────────────────────────────────
const ROT = '#8B0000';       // KKS Dunkelrot
const ROT_HELL = '#C0392B';  // Akzent
const ROT_BG = '#fff5f5';    // Leichter Rotton für Boxen
const ROT_BORDER = '#e8c8c8';

// ── Basis-CSS für alle Trainer-Dokumente ─────────────────────────────────────
function getBaseCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      font-size: 10.5pt;
      color: #1a1a1a;
      line-height: 1.65;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0 20mm 20mm 20mm;
      position: relative;
    }

    /* ── Kopfzeile ── */
    .doc-header {
      background: ${ROT};
      margin: 0 -20mm 8mm -20mm;
      padding: 0;
      color: #fff;
    }
    /* Logo-Zeile oben */
    .doc-header-logo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6mm 20mm 5mm 20mm;
      border-bottom: 2px solid rgba(255,255,255,0.2);
    }
    .doc-header-logo {
      height: 18mm;
      max-width: 70mm;
      object-fit: contain;
      display: block;
    }
    .doc-header-meta {
      text-align: right;
      font-size: 8.5pt;
      color: rgba(255,255,255,0.8);
      line-height: 1.6;
    }
    /* Titel-Zeile unten */
    .doc-header-title-row {
      padding: 5mm 20mm 6mm 20mm;
    }
    .doc-header-title-row h1 {
      font-size: 20pt;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.04em;
      line-height: 1.15;
      margin: 0;
    }
    .doc-header-title-row .subtitle {
      font-size: 10pt;
      color: rgba(255,255,255,0.85);
      margin-top: 3px;
    }

    /* ── Rote Trennlinie ── */
    .red-rule { height: 3px; background: ${ROT_HELL}; margin-bottom: 6mm; }

    /* ── Paragraphen ── */
    h2 {
      font-size: 10.5pt;
      font-weight: 700;
      color: ${ROT};
      margin: 6mm 0 2mm 0;
      padding-bottom: 1.5mm;
      border-bottom: 1.5px solid ${ROT_BORDER};
    }
    p { margin-bottom: 2.5mm; }
    ul { margin: 1.5mm 0 2.5mm 5mm; }
    li { margin-bottom: 1.5mm; }

    /* ── Ausfüll-Felder (Unterstrich) ── */
    .blank { display: inline-block; border-bottom: 1px solid #666; min-width: 45mm; margin: 0 0.5mm; }
    .blank-wide { min-width: 80mm; }
    .blank-sm { min-width: 20mm; }
    .blank-km { min-width: 12mm; }

    /* ── Parteien-Box ── */
    .parties {
      display: grid;
      grid-template-columns: 1fr 26mm 1fr;
      gap: 3mm;
      margin: 4mm 0 3mm 0;
      align-items: start;
    }
    .party-box {
      background: ${ROT_BG};
      border: 1px solid ${ROT_BORDER};
      border-left: 3px solid ${ROT};
      border-radius: 3px;
      padding: 3.5mm 4mm;
      font-size: 9.5pt;
    }
    .party-box strong {
      font-size: 10pt;
      display: block;
      margin-bottom: 1.5mm;
      color: ${ROT};
    }
    .party-label {
      text-align: center;
      font-weight: 700;
      font-size: 10.5pt;
      color: #555;
      padding-top: 8mm;
    }

    /* ── Tabellen ── */
    table { width: 100%; border-collapse: collapse; margin: 2.5mm 0 4mm; font-size: 9.5pt; }
    th {
      background: ${ROT};
      color: #fff;
      padding: 2mm 3mm;
      text-align: left;
      font-weight: 600;
      border: 1px solid ${ROT};
    }
    td { padding: 2mm 3mm; border: 1px solid ${ROT_BORDER}; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .row-total td { background: ${ROT_BG}; font-weight: 700; border-top: 1.5px solid ${ROT_BORDER}; }

    /* ── Info-Boxen ── */
    .info-box {
      background: ${ROT_BG};
      border-left: 3px solid ${ROT};
      padding: 3mm 4mm;
      margin: 3mm 0;
      font-size: 9.5pt;
    }
    .info-box.warn { background: #fff8e0; border-left-color: #c08000; }
    .info-box.green { background: #f0fbf4; border-left-color: #2e7d32; }

    /* ── Unterschriften ── */
    .sig-block {
      margin-top: 14mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12mm;
    }
    .sig-space { height: 14mm; }
    .sig-line {
      border-top: 1.5px solid ${ROT};
      padding-top: 2mm;
      font-size: 9pt;
      color: #333;
    }
    .sig-label { font-size: 8.5pt; color: #888; margin-top: 1mm; }

    /* ── Fußzeile ── */
    .footer {
      position: fixed;
      bottom: 8mm;
      left: 20mm;
      right: 20mm;
      font-size: 7.5pt;
      color: #aaa;
      border-top: 1px solid ${ROT_BORDER};
      padding-top: 2mm;
      display: flex;
      justify-content: space-between;
    }

    /* ── Seitenumbruch-Helfer ── */
    .page-break { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
  `;
}

function htmlShell(title, content) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<style>${getBaseCss()}</style>
</head>
<body>
<div class="page">
${content}
</div>
</body>
</html>`;
}

// ── Hilfsfunktion: Leerzeile für Ausfüllfeld ─────────────────────────────────
function blank(text, cssClass = '') {
  if (text && text !== '____________________' && text !== '___') {
    return `<span style="font-weight:600">${text}</span>`;
  }
  return `<span class="blank ${cssClass}">&nbsp;</span>`;
}

// ── Vereinbarung HTML ─────────────────────────────────────────────────────────

function buildVereinbarungHtml(trainer, dojo, params) {
  const {
    mitgliedsbeitrag_monatlich = '___',
    sachleistungen_jahreswert = '___',
    vertragsbeginn = '___',
    wettbewerb_radius = '10',
    trainingsbereich = '___',
  } = params || {};

  const trainerName = trainer?.vorname && trainer?.nachname
    ? `${trainer.vorname} ${trainer.nachname}`
    : '____________________';
  const trainerAnschrift = trainer?.anschrift || '____________________';
  const trainerGeb = trainer?.geburtsdatum
    ? new Date(trainer.geburtsdatum).toLocaleDateString('de-DE')
    : '____________________';
  const trainerGrad = trainer?.graduierung
    ? `${trainer.graduierung}. Dan / Schwarzgurt`
    : '____________________. Dan / Schwarzgurt';
  const trainerSteuer = trainer?.steuer_id || '____________________';

  const dojoName = dojo?.dojoname || dojo?.name || 'Kampfkunstschule Schreiner';
  const dojoInhaber = dojo?.inhaber || '____________________';
  const dojoAnschrift = [dojo?.strasse, dojo?.hausnummer, dojo?.plz, dojo?.ort].filter(Boolean).join(', ') || '____________________';
  const dojoSteuernr = dojo?.steuernummer || '____________________';

  const vbeginn = vertragsbeginn && vertragsbeginn !== '___'
    ? new Date(vertragsbeginn).toLocaleDateString('de-DE')
    : '____________________';
  const mbMonat = mitgliedsbeitrag_monatlich !== '___'
    ? `€ ${parseFloat(mitgliedsbeitrag_monatlich).toFixed(2)}`
    : '€ _______';
  const mbJahr = mitgliedsbeitrag_monatlich !== '___'
    ? `€ ${(parseFloat(mitgliedsbeitrag_monatlich) * 12).toFixed(2)}`
    : '€ _______';
  const sjWert = sachleistungen_jahreswert !== '___'
    ? `€ ${parseFloat(sachleistungen_jahreswert).toFixed(2)}`
    : '€ _______';
  const bereich = trainingsbereich !== '___' ? trainingsbereich : '<span class="blank blank-wide">&nbsp;</span>';
  const radius = wettbewerb_radius !== '___' ? wettbewerb_radius : '<span class="blank blank-km">&nbsp;</span>';

  const today = new Date().toLocaleDateString('de-DE');

  const kurseRows = (trainer?.kurse || []).map(k =>
    `<tr><td>${k.gruppenname || '–'}</td><td>${k.stil || '–'}</td><td></td><td></td></tr>`
  ).join('') || '<tr><td colspan="4" style="color:#999;font-style:italic;text-align:center">Wird gemeinsam festgelegt</td></tr>';

  const logoTag = LOGO_B64
    ? `<img src="${LOGO_B64}" class="doc-header-logo" alt="KKS Logo" />`
    : `<span style="color:#fff;font-weight:700;font-size:13pt">${dojoName}</span>`;

  return htmlShell('Trainervereinbarung', `
  <div class="doc-header">
    <div class="doc-header-logo-row">
      ${logoTag}
      <div class="doc-header-meta">
        ${dojoName}<br/>
        Erstellt: ${today}
      </div>
    </div>
    <div class="doc-header-title-row">
      <h1>TRAINERVEREINBARUNG</h1>
      <div class="subtitle">über freie Mitarbeit als Kampfkunsttrainer &bull; Sachleistungsvergütung</div>
    </div>
  </div>

  <h2>§ 1 – Vertragsparteien</h2>
  <div class="parties">
    <div class="party-box">
      <strong>Auftraggeber</strong>
      ${dojoName}<br/>
      Inhaber: ${dojoInhaber}<br/>
      Anschrift: ${dojoAnschrift}<br/>
      Steuernummer: ${dojoSteuernr}<br/>
      <span style="font-size:8.5pt;color:#888">– nachfolgend „Auftraggeber" genannt –</span>
    </div>
    <div class="party-label">und</div>
    <div class="party-box">
      <strong>Trainer (freier Mitarbeiter)</strong>
      Name: ${trainerName}<br/>
      Anschrift: ${trainerAnschrift}<br/>
      Geburtsdatum: ${trainerGeb}<br/>
      Graduierung: ${trainerGrad}<br/>
      Steuer-ID: ${trainerSteuer}<br/>
      <span style="font-size:8.5pt;color:#888">– nachfolgend „Trainer" genannt –</span>
    </div>
  </div>
  <p>wird folgende Vereinbarung geschlossen:</p>

  <h2>§ 2 – Vertragsgegenstand und Rechtsstellung</h2>
  <p>(1) Der Trainer übernimmt für den Auftraggeber die Durchführung von Kampfkunsttrainingseinheiten als <strong>freier Mitarbeiter</strong>. Der Trainer ist nicht in die betriebliche Organisation des Auftraggebers eingegliedert und unterliegt keinem arbeitsrechtlichen Weisungsrecht.</p>
  <p>(2) Ein Arbeitsverhältnis im Sinne des Arbeitsrechts wird durch diese Vereinbarung ausdrücklich <strong>nicht</strong> begründet. Es bestehen keine Ansprüche auf Entgeltfortzahlung im Krankheitsfall, bezahlten Urlaub oder sonstige arbeitnehmerähnliche Leistungen.</p>
  <p>(3) Der Trainer ist berechtigt, auch für andere Auftraggeber tätig zu werden, sofern dies nicht in direktem Wettbewerb zur ${dojoName} steht.</p>

  <h2>§ 3 – Art und Umfang der Tätigkeit</h2>
  <p>(1) Der Trainer verpflichtet sich, folgende Tätigkeiten zu übernehmen:</p>
  <ul>
    <li>Eigenverantwortliche Durchführung von Trainingseinheiten im Bereich: ${bereich}</li>
    <li>Vorbereitung und Nachbereitung des Trainings</li>
    <li>Sicherstellung der Einhaltung von Sicherheits- und Hygienevorschriften während des Trainings</li>
    <li>Beaufsichtigung der Trainingsteilnehmer während der Trainingseinheiten</li>
  </ul>
  <p>(2) Der vereinbarte Leistungsumfang beträgt mindestens <strong>4 Trainingsstunden pro Woche</strong> (ca. 16–20 Stunden pro Monat). Die genaue Einteilung der Trainingszeiten erfolgt in Absprache zwischen den Vertragsparteien unter Berücksichtigung des laufenden Kursplans.</p>
  <p>(3) Der Trainer gestaltet die Trainingseinheiten inhaltlich und methodisch eigenverantwortlich im Rahmen des vom Auftraggeber vorgegebenen übergeordneten Lehrplans und Stilkonzepts.</p>
  <p>(4) Der Trainer ist berechtigt, bei Verhinderung einen gleichwertig qualifizierten Vertreter zu stellen, sofern dieser vom Auftraggeber vorab genehmigt wurde. Die Verhinderung ist dem Auftraggeber unverzüglich mitzuteilen.</p>

  <p><strong>Trainingszeiten und -tage (konkrete Einteilung):</strong></p>
  <table>
    <thead><tr><th>Tag</th><th>Uhrzeit</th><th>Kurs / Gruppe</th><th>Dauer</th></tr></thead>
    <tbody>${kurseRows}</tbody>
  </table>

  <h2>§ 4 – Vergütung (Sachleistungen)</h2>
  <p>(1) Als Vergütung für die in § 3 genannten Leistungen erhält der Trainer vom Auftraggeber folgende Sachleistungen:</p>
  <ul>
    <li>Vollständiger Erlass des monatlichen Mitgliedsbeitrags in Höhe von derzeit <strong>${mbMonat}/Monat</strong> (Jahreswert: <strong>${mbJahr}</strong>). Der Trainer ist berechtigt, sämtliche Trainingsangebote der ${dojoName} als Teilnehmer zu nutzen.</li>
    <li>Kostenlose Bereitstellung der Trainingsausrüstung, die der Trainer für seine Tätigkeit und sein eigenes Training benötigt (z.&nbsp;B. Kampfkunstanzug, Schutzausrüstung, Pratzen etc.). Die Ausrüstung verbleibt im Eigentum des Auftraggebers und ist bei Vertragsende zurückzugeben, sofern sie nicht bestimmungsgemäß verbraucht wurde.</li>
  </ul>
  <table>
    <thead><tr><th>Sachleistung</th><th>Monatlicher Wert</th><th>Jährlicher Wert</th></tr></thead>
    <tbody>
      <tr><td>Erlass Mitgliedsbeitrag</td><td>${mbMonat}</td><td>${mbJahr}</td></tr>
      <tr><td>Trainingsausrüstung (geschätzter Durchschnitt)</td><td>€ _______</td><td>€ _______</td></tr>
      <tr class="row-total"><td><strong>Gesamtwert der Sachleistungen</strong></td><td><strong>€ _______</strong></td><td><strong>${sjWert}</strong></td></tr>
    </tbody>
  </table>
  <p>(2) Der Gesamtwert der Sachleistungen beträgt jährlich ca. ${sjWert}. Der Trainer ist selbst dafür verantwortlich, den geldwerten Vorteil aus diesen Sachleistungen gegenüber dem Finanzamt zu erklären, soweit eine Steuerpflicht besteht.</p>
  <p>(3) Eine darüber hinausgehende monetäre Vergütung wird nicht geschuldet. Anfallende Fahrtkosten und sonstige Aufwendungen sind mit den Sachleistungen abgegolten, sofern nicht schriftlich anders vereinbart.</p>
  <p>(4) Bei einer Erhöhung des regulären Mitgliedsbeitrags erhöht sich der Wert der Sachleistung entsprechend, ohne dass es einer Änderung dieser Vereinbarung bedarf.</p>

  <h2>§ 5 – Pflichten des Trainers</h2>
  <p>Der Trainer verpflichtet sich:</p>
  <ul>
    <li>die übernommenen Trainingseinheiten zuverlässig, pünktlich und gewissenhaft durchzuführen</li>
    <li>die Sicherheit und körperliche Unversehrtheit der Trainingsteilnehmer zu gewährleisten und die Aufsichtspflicht während des Trainings wahrzunehmen</li>
    <li>einen gültigen Erste-Hilfe-Nachweis vorzuhalten (nicht älter als 2 Jahre) und dem Auftraggeber auf Verlangen vorzulegen</li>
    <li>sich regelmäßig im Rahmen seiner Kampfkunst fortzubilden</li>
    <li>die überlassene Ausrüstung und die Trainingsstätte pfleglich zu behandeln</li>
    <li>Verhinderungen (Krankheit, Urlaub etc.) mindestens 48 Stunden im Voraus mitzuteilen, sofern dies zumutbar ist</li>
    <li>keine Handlungen vorzunehmen, die dem Ruf der ${dojoName} schaden könnten</li>
  </ul>

  <h2>§ 6 – Pflichten des Auftraggebers</h2>
  <p>Der Auftraggeber verpflichtet sich:</p>
  <ul>
    <li>dem Trainer geeignete Räumlichkeiten und Trainingsgeräte für die Durchführung der Trainingseinheiten bereitzustellen</li>
    <li>die in § 4 genannten Sachleistungen dauerhaft und ununterbrochen zu gewähren, solange der Vertrag besteht</li>
    <li>den Trainer rechtzeitig über Änderungen im Kursplan oder organisatorische Änderungen zu informieren</li>
    <li>für einen angemessenen Versicherungsschutz in den Trainingsstätten (Betriebshaftpflicht) zu sorgen</li>
  </ul>

  <h2>§ 7 – Haftung und Versicherung</h2>
  <p>(1) Der Trainer haftet für Schäden, die er im Rahmen seiner Tätigkeit vorsätzlich oder grob fahrlässig verursacht.</p>
  <p>(2) Der Auftraggeber unterhält eine Betriebshaftpflichtversicherung, die auch die Tätigkeit des Trainers im Rahmen dieser Vereinbarung abdeckt. Der Trainer kann auf Wunsch in den Versicherungsschutz Einsicht nehmen.</p>
  <p>(3) Dem Trainer wird empfohlen, eine eigene Berufshaftpflichtversicherung für seine Tätigkeit als freier Trainer abzuschließen. Die Kosten hierfür trägt der Trainer selbst.</p>
  <p>(4) Für Unfälle, die der Trainer während der Ausübung seiner Tätigkeit erleidet, haftet der Auftraggeber nur bei Vorsatz oder grober Fahrlässigkeit. Der Trainer ist für seinen eigenen Unfallversicherungsschutz selbst verantwortlich.</p>

  <div class="page-break"></div>

  <h2>§ 8 – Verschwiegenheit und Datenschutz</h2>
  <p>(1) Der Trainer verpflichtet sich, über alle ihm im Rahmen seiner Tätigkeit bekannt werdenden Betriebs- und Geschäftsgeheimnisse des Auftraggebers Stillschweigen zu bewahren. Diese Pflicht besteht auch nach Beendigung des Vertragsverhältnisses fort.</p>
  <p>(2) Personenbezogene Daten der Trainingsteilnehmer (insbesondere Gesundheitsdaten, Kontaktdaten) dürfen vom Trainer ausschließlich für die Durchführung des Trainings verwendet und nicht an Dritte weitergegeben werden. Die Bestimmungen der DSGVO und des BDSG sind einzuhalten.</p>

  <h2>§ 9 – Wettbewerbsregelung</h2>
  <p>(1) Der Trainer verpflichtet sich, während der Vertragslaufzeit im Umkreis von ${radius} km keine konkurrierende Kampfkunstschule zu eröffnen oder für eine solche tätig zu werden, sofern dies die gleiche Stilrichtung betrifft.</p>
  <p>(2) Diese Wettbewerbsregelung gilt für einen Zeitraum von 6 Monaten nach Beendigung des Vertragsverhältnisses fort, sofern der Vertrag mindestens 12 Monate bestanden hat.</p>
  <p>(3) Die Ausübung von Kampfkunst in anderen Stilrichtungen oder das Abhalten von Seminaren und Lehrgängen außerhalb des Einzugsgebiets ist hiervon nicht betroffen.</p>

  <h2>§ 10 – Vertragsdauer und Kündigung</h2>
  <p>(1) Diese Vereinbarung tritt am <strong>${vbeginn}</strong> in Kraft und wird auf unbestimmte Zeit geschlossen.</p>
  <p>(2) Die Vereinbarung kann von beiden Seiten mit einer Frist von <strong>4 Wochen zum Monatsende</strong> schriftlich gekündigt werden.</p>
  <p>(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt für beide Vertragsparteien unberührt. Ein wichtiger Grund liegt insbesondere vor, wenn:</p>
  <ul>
    <li>der Trainer wiederholt und trotz Abmahnung seinen Verpflichtungen aus § 3 und § 5 nicht nachkommt</li>
    <li>der Trainer gegen die Verschwiegenheitspflicht gemäß § 8 verstößt</li>
    <li>der Auftraggeber die vereinbarten Sachleistungen gemäß § 4 nicht erbringt</li>
    <li>der Trainer seine Graduierung verliert oder das Vertrauensverhältnis nachhaltig zerstört ist</li>
  </ul>
  <p>(4) Bei Beendigung des Vertragsverhältnisses hat der Trainer die ihm überlassene Ausrüstung gemäß § 4 Abs. 1 unverzüglich zurückzugeben.</p>

  <h2>§ 11 – Statusfeststellung (Scheinselbständigkeit)</h2>
  <p>(1) Die Vertragsparteien sind sich bewusst, dass die Abgrenzung zwischen freier Mitarbeit und abhängiger Beschäftigung im Einzelfall schwierig sein kann. Zur Vermeidung einer Scheinselbständigkeit wird Folgendes festgehalten:</p>
  <ul>
    <li>Der Trainer bestimmt Ort, Zeit und inhaltliche Ausgestaltung seiner Tätigkeit grundsätzlich selbst, soweit dies mit dem Kursplan vereinbar ist.</li>
    <li>Der Trainer unterliegt keiner Pflicht zur persönlichen Leistungserbringung und darf Vertreter stellen (§ 3 Abs. 4).</li>
    <li>Der Trainer nutzt keine betrieblichen Arbeitsmittel (Büro, E-Mail-Adressen etc.) des Auftraggebers.</li>
    <li>Der Trainer ist für seine steuerlichen und sozialversicherungsrechtlichen Pflichten selbst verantwortlich.</li>
  </ul>
  <p>(2) Hinweis: Den Vertragsparteien wird empfohlen, bei der Deutschen Rentenversicherung ein Statusfeststellungsverfahren nach § 7a SGB IV zu beantragen, um Rechtssicherheit über die sozialversicherungsrechtliche Einordnung zu erlangen.</p>

  <h2>§ 12 – Steuerliche Hinweise</h2>
  <p>(1) Die Sachleistungen gemäß § 4 stellen für den Trainer einen geldwerten Vorteil dar, der grundsätzlich einkommensteuerpflichtig ist. Der Trainer ist verpflichtet, diesen Vorteil in seiner Einkommensteuererklärung anzugeben.</p>
  <p>(2) Der Auftraggeber ist berechtigt, den Wert der Sachleistungen als Betriebsausgabe steuerlich geltend zu machen.</p>
  <p>(3) Diese Vereinbarung stellt keine steuerliche Beratung dar. Beiden Vertragsparteien wird empfohlen, sich hinsichtlich der steuerlichen Behandlung an einen Steuerberater zu wenden.</p>

  <h2>§ 13 – Salvatorische Klausel</h2>
  <p>Sollte eine Bestimmung dieser Vereinbarung unwirksam oder undurchführbar sein oder werden, so wird dadurch die Wirksamkeit der übrigen Bestimmungen nicht berührt. Die Vertragsparteien verpflichten sich, die unwirksame Bestimmung durch eine Regelung zu ersetzen, die dem wirtschaftlichen Zweck möglichst nahekommt.</p>

  <h2>§ 14 – Schlussbestimmungen</h2>
  <p>(1) Änderungen und Ergänzungen dieser Vereinbarung bedürfen der Schriftform. Dies gilt auch für die Aufhebung dieses Schriftformerfordernisses.</p>
  <p>(2) Mündliche Nebenabreden bestehen nicht.</p>
  <p>(3) Gerichtsstand für alle Streitigkeiten ist, soweit gesetzlich zulässig, der Sitz des Auftraggebers.</p>
  <p>(4) Es gilt das Recht der Bundesrepublik Deutschland.</p>

  <div class="sig-block no-break">
    <div>
      <div class="sig-space"></div>
      <div class="sig-line">Ort, Datum &amp; Unterschrift</div>
      <div class="sig-label">${dojoName} (Auftraggeber)</div>
    </div>
    <div>
      <div class="sig-space"></div>
      <div class="sig-line">Ort, Datum &amp; Unterschrift</div>
      <div class="sig-label">${trainerName} (Trainer / freier Mitarbeiter)</div>
    </div>
  </div>

  <!-- ── ANHANG A ── -->
  <div class="page-break"></div>
  <div style="background:${ROT};color:#fff;padding:6mm 0 4mm;margin:0 -20mm 6mm -20mm;padding-left:20mm;padding-right:20mm;">
    <h1 style="font-size:14pt;font-weight:700;color:#fff">ANHANG A – Leistungsübersicht</h1>
    <div style="font-size:9pt;color:rgba(255,255,255,0.85)">Die folgende Übersicht konkretisiert die vereinbarten Leistungen und deren Wert</div>
  </div>

  <table>
    <thead><tr><th>Sachleistung</th><th>Monatlicher Wert</th><th>Jährlicher Wert</th></tr></thead>
    <tbody>
      <tr><td>Erlass Mitgliedsbeitrag</td><td>${mbMonat}</td><td>${mbJahr}</td></tr>
      <tr><td>Trainingsausrüstung (geschätzter Durchschnitt)</td><td>€ _______</td><td>€ _______</td></tr>
      <tr class="row-total"><td><strong>Gesamtwert der Sachleistungen</strong></td><td><strong>€ _______</strong></td><td><strong>${sjWert}</strong></td></tr>
    </tbody>
  </table>

  <p style="margin-top:4mm"><strong>Trainingszeiten und -tage (konkrete Einteilung):</strong></p>
  <table>
    <thead><tr><th>Tag</th><th>Uhrzeit</th><th>Kurs / Gruppe</th><th>Dauer</th></tr></thead>
    <tbody>${kurseRows}</tbody>
  </table>

  <div class="sig-block no-break" style="margin-top:20mm">
    <div>
      <div class="sig-space"></div>
      <div class="sig-line">Ort, Datum &amp; Unterschrift</div>
      <div class="sig-label">Auftraggeber</div>
    </div>
    <div>
      <div class="sig-space"></div>
      <div class="sig-line">Ort, Datum &amp; Unterschrift</div>
      <div class="sig-label">Trainer</div>
    </div>
  </div>

  <div class="footer">
    <span>${dojoName} &mdash; Trainervereinbarung</span>
    <span>Erstellt am ${today}</span>
  </div>
  `);
}

// ── Infoblatt HTML ────────────────────────────────────────────────────────────

function buildInfoblattHtml(trainer, dojo) {
  const trainerName = trainer?.vorname && trainer?.nachname
    ? `${trainer.vorname} ${trainer.nachname}`
    : '____________________';
  const dojoName = dojo?.dojoname || dojo?.name || 'Kampfkunstschule Schreiner';
  const today = new Date().toLocaleDateString('de-DE');

  const logoTag = LOGO_B64
    ? `<img src="${LOGO_B64}" class="doc-header-logo" alt="KKS Logo" />`
    : `<span style="color:#fff;font-weight:700;font-size:13pt">${dojoName}</span>`;

  return htmlShell('Infoblatt Trainervereinbarung', `
  <div class="doc-header">
    <div class="doc-header-logo-row">
      ${logoTag}
      <div class="doc-header-meta">
        ${dojoName}<br/>
        ${today}<br/>
        für: <strong style="color:#fff">${trainerName}</strong>
      </div>
    </div>
    <div class="doc-header-title-row">
      <h1>DEIN WEG ALS TRAINER</h1>
      <div class="subtitle">Was sich für dich als Schwarzgurt ändert – und was nicht</div>
    </div>
  </div>

  <p>Liebe Trainerin, lieber Trainer,</p>
  <p>wir professionalisieren unsere Kampfkunstschule gerade – nicht weil irgendetwas schlecht läuft, sondern weil wir euch als Trainer besser absichern wollen. Bisher lief vieles auf Handschlag und Vertrauen. Daran ändert sich nichts – aber wir legen jetzt zusätzlich eine schriftliche Vereinbarung dazu, die euch und uns schützt.</p>
  <div class="info-box green"><strong>Kurz gesagt: Es wird nichts schlechter. Es wird nur offiziell.</strong></div>

  <h2>Was bleibt gleich?</h2>
  <ul>
    <li>Du zahlst weiterhin keinen Mitgliedsbeitrag</li>
    <li>Du bekommst weiterhin deine Ausrüstung kostenlos gestellt</li>
    <li>Du trainierst weiterhin in allen Kursen mit</li>
    <li>Du gestaltest dein Training weiterhin eigenverantwortlich</li>
    <li>Wir sind weiterhin ein Team – daran ändert kein Vertrag etwas</li>
  </ul>

  <h2>Was ist neu?</h2>
  <table>
    <thead><tr><th>Thema</th><th>Bisher</th><th>Ab jetzt</th></tr></thead>
    <tbody>
      <tr><td>Mitgliedsbeitrag</td><td>Wurde erlassen (mündlich)</td><td>Erlass steht schriftlich im Vertrag</td></tr>
      <tr><td>Ausrüstung</td><td>Wurde gestellt (informell)</td><td>Anspruch ist vertraglich geregelt</td></tr>
      <tr><td>Trainingszeiten</td><td>Nach Absprache</td><td>Ca. 4 Std./Woche, gemeinsam festgelegt</td></tr>
      <tr><td>Vertretung</td><td>Musste man sich schlecht fühlen</td><td>Du darfst offiziell jemanden schicken</td></tr>
      <tr><td>Versicherung</td><td>Unklar</td><td>Betriebshaftpflicht deckt dich ab</td></tr>
      <tr><td>Kündigung</td><td>Unklar</td><td>4 Wochen zum Monatsende, fair für beide</td></tr>
    </tbody>
  </table>

  <h2>Warum machen wir das?</h2>
  <ul>
    <li><strong>Euer Schutz:</strong> Bei einem Unfall oder Versicherungsfall steht ihr ohne Vertrag mit leeren Händen da.</li>
    <li><strong>Klarheit:</strong> Keine Missverständnisse mehr über Erwartungen und Leistungen.</li>
    <li><strong>Professionalisierung:</strong> Wir strukturieren die Schule um und legen alles auf ein solides Fundament.</li>
  </ul>

  <div class="info-box warn">
    <strong>Kurz zum Thema Steuern – kein Grund zur Sorge:</strong><br/>
    Der Erlass des Mitgliedsbeitrags und die Ausrüstung gelten als „geldwerter Vorteil". Bei den üblichen Beträgen fällt das steuerlich kaum ins Gewicht. Euer Steuerberater trägt das in zwei Minuten ein.
  </div>

  <h2>Was erwarten wir von dir?</h2>
  <ul>
    <li>Ca. <strong>4 Trainingsstunden pro Woche</strong> – Zeiten legen wir gemeinsam fest</li>
    <li><strong>Zuverlässigkeit</strong> – wenn du mal nicht kannst, rechtzeitig melden (oder Vertreter schicken)</li>
    <li><strong>Aktueller Erste-Hilfe-Schein</strong> – nicht älter als 2 Jahre</li>
    <li>Eigenverantwortliches Training im Rahmen unseres Lehrplans</li>
  </ul>

  <h2>Häufige Fragen</h2>
  <table>
    <tbody>
      <tr>
        <td style="width:36%;font-weight:600;color:${ROT}">Bin ich jetzt angestellt?</td>
        <td>Nein. Du bist und bleibst freier Mitarbeiter. Kein Arbeitsvertrag, keine Sozialabgaben, keine Weisungsgebundenheit.</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:${ROT}">Kann ich gekündigt werden?</td>
        <td>Ja, aber nur mit 4 Wochen Frist zum Monatsende aus nachvollziehbaren Gründen. Du kannst genauso kündigen.</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:${ROT}">Darf ich woanders unterrichten?</td>
        <td>Klar – solange es nicht die gleiche Stilrichtung in unmittelbarer Konkurrenz ist. Seminare, andere Stile: kein Problem.</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:${ROT}">Muss ich sofort unterschreiben?</td>
        <td>Nein. Nimm dir Zeit, lies in Ruhe durch, stell Fragen. Wir füllen ihn dann gemeinsam aus.</td>
      </tr>
    </tbody>
  </table>

  <div class="info-box green" style="margin-top:6mm">
    Ihr seid das Rückgrat unserer Schule. Ohne euch läuft hier nichts. Dieser Vertrag ist kein Misstrauen – er ist unsere Art zu sagen: <strong>Wir nehmen euren Einsatz ernst.</strong>
    <br/><br/>
    Bei Fragen – sprecht uns jederzeit an.<br/>
    <em>Euer Team der ${dojoName}</em>
  </div>

  <div class="sig-block no-break">
    <div>
      <div class="sig-space"></div>
      <div class="sig-line">Ort, Datum &amp; Unterschrift</div>
      <div class="sig-label">${trainerName}</div>
    </div>
    <div>
      <div class="sig-space"></div>
      <div class="sig-line">Ort, Datum &amp; Unterschrift</div>
      <div class="sig-label">${dojoName}</div>
    </div>
  </div>

  <div class="footer">
    <span>${dojoName} &mdash; Infoblatt Trainervereinbarung</span>
    <span>Erstellt am ${today}</span>
  </div>
  `);
}

// ── Puppeteer PDF-Export ──────────────────────────────────────────────────────

async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  generateVereinbarungPdf: async (trainer, dojo, params) => {
    const html = buildVereinbarungHtml(trainer, dojo, params);
    return generatePdf(html);
  },
  generateInfoblattPdf: async (trainer, dojo) => {
    const html = buildInfoblattHtml(trainer, dojo);
    return generatePdf(html);
  },
  // Für VorlagenVerwaltung: HTML aus System-Template → in Trainer-Design wrappen
  generateVereinbarungHtml: buildVereinbarungHtml,
  generateInfoblattHtml: buildInfoblattHtml,
};
