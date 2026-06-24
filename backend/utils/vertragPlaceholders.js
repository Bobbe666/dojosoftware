// =====================================================================================
// Zentrales Platzhalter-Mapping für Mitgliedsverträge — EINE Quelle der Wahrheit.
// Wird von der Selbst-Registrierung (public-registration.js) UND vom Admin-Download
// (vertragsvorlagen.js /generate-pdf) genutzt, damit die Logik nicht auseinanderläuft.
//
// Unterstützte Platzhalter-Formate in den Vorlagen:
//   {{kategorie.feld}}  z.B. {{mitglied.vorname}}, {{dojo.dojoname}}
//   {{feld}}            z.B. {{vorname}}, {{plz}}, {{datum}}
//   {{alias}}           z.B. {{dojo_name}}, {{mitglied_id}}, {{anrede}}, {{iban}}, {{betrag}}
// =====================================================================================

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '';
const ANREDE = { m: 'Herr', w: 'Frau', d: '' };

/**
 * Baut das vollständige Platzhalter-Mapping aus echten Mitglieds-/Dojo-/Vertragsdaten.
 * @param {object} mitglied  Zeile aus `mitglieder`
 * @param {object} dojo      Zeile aus `dojo`
 * @param {object|null} vertrag  Zeile aus `vertraege` (optional)
 * @param {object} opts      { glaeubigerId, tarifname, aufnahmegebuehr }
 * @returns {{data:object, aliases:object}}
 */
function buildContractMap(mitglied = {}, dojo = {}, vertrag = null, opts = {}) {
  const m = mitglied || {};
  const d = dojo || {};
  const mitgliedsnr = m.mitgliedsnummer || m.mitglied_id || m.id || '';

  const data = {
    mitglied: {
      vorname: m.vorname || '', nachname: m.nachname || '', email: m.email || '',
      telefon: m.telefon || m.telefon_mobil || '', strasse: m.strasse || '', hausnummer: m.hausnummer || '',
      plz: m.plz || '', ort: m.ort || '', geburtsdatum: fmtDate(m.geburtsdatum),
      mitgliedsnummer: mitgliedsnr,
    },
    vertrag: vertrag ? {
      vertragsnummer: vertrag.vertragsnummer || `V-${vertrag.id}`,
      vertragsbeginn: fmtDate(vertrag.vertragsbeginn), vertragsende: fmtDate(vertrag.vertragsende),
      monatsbeitrag: vertrag.monatsbeitrag || '0.00',
      mindestlaufzeit_monate: vertrag.mindestlaufzeit_monate || '0',
      kuendigungsfrist_monate: vertrag.kuendigungsfrist_monate || '0',
      tarifname: vertrag.tarifname || opts.tarifname || '',
    } : {
      vertragsnummer: '', vertragsbeginn: '', vertragsende: '', monatsbeitrag: '',
      mindestlaufzeit_monate: '', kuendigungsfrist_monate: '', tarifname: opts.tarifname || '',
    },
    dojo: {
      dojoname: d.dojoname || '', strasse: d.strasse || '', hausnummer: d.hausnummer || '',
      plz: d.plz || '', ort: d.ort || '', telefon: d.telefon || '', email: d.email || '', internet: d.internet || '',
    },
    system: {
      datum: new Date().toLocaleDateString('de-DE'),
      uhrzeit: new Date().toLocaleTimeString('de-DE'),
      jahr: new Date().getFullYear().toString(),
      monat: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    },
  };

  const aliases = {
    mitglied_id: mitgliedsnr,
    anrede: ANREDE[(m.geschlecht || '').toLowerCase()] ?? '',
    mobil: m.telefon || m.telefon_mobil || '',
    dojo_name: data.dojo.dojoname,
    dojo_adresse: `${data.dojo.strasse} ${data.dojo.hausnummer}, ${data.dojo.plz} ${data.dojo.ort}`.trim(),
    dojo_kontakt: `Tel: ${data.dojo.telefon} | E-Mail: ${data.dojo.email}`,
    tarif_name: data.vertrag.tarifname,
    betrag: data.vertrag.monatsbeitrag,
    aufnahmegebuehr: opts.aufnahmegebuehr || '0.00',
    mindestlaufzeit: `${data.vertrag.mindestlaufzeit_monate} Monate`,
    nutzungsbeginn: data.vertrag.vertragsbeginn,
    vertragsverlaengerung: '1 Monat',
    kuendigungsfrist: `${data.vertrag.kuendigungsfrist_monate} Monate`,
    zahlweise: 'monatlich',
    zahlungsdienstleister: data.dojo.dojoname,
    glaeubiger_id: opts.glaeubigerId || d.sepa_glaeubiger_id || '',
    kontoinhaber: m.kontoinhaber || `${m.vorname || ''} ${m.nachname || ''}`.trim(),
    kreditinstitut: m.bankname || '',
    bic: m.bic || '',
    iban: m.iban || '',
    sepa_referenz: (vertrag && vertrag.vertragsnummer) || '',
    zahlungstermine: '',
  };

  return { data, aliases };
}

/**
 * Ersetzt alle unterstützten Platzhalter im HTML.
 */
function resolveContractPlaceholders(html, map) {
  const { data, aliases } = map || {};
  let r = html || '';
  if (data) {
    Object.entries(data).forEach(([cat, vals]) => {
      Object.entries(vals).forEach(([key, value]) => {
        r = r.replace(new RegExp(`\\{\\{${cat}\\.${key}\\}\\}`, 'g'), value ?? '');
        r = r.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
      });
    });
  }
  if (aliases) {
    Object.entries(aliases).forEach(([ph, value]) => {
      r = r.replace(new RegExp(`\\{\\{${ph}\\}\\}`, 'g'), value ?? '');
    });
  }
  return r;
}

/**
 * Setzt das Dojo-Logo in den .logo-placeholder-Container ein (falls vorhanden).
 */
function insertDojoLogo(html, logoBase64) {
  if (!logoBase64) return html || '';
  const logoImg = `<img src="${logoBase64}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`;
  return (html || '').replace(
    /<div[^>]*class="[^"]*logo-placeholder[^"]*"[^>]*>[\s\S]*?<\/div>/g,
    (match) => match.replace(/>[\s\S]*?<\/div>/, `>${logoImg}</div>`)
  );
}

module.exports = { buildContractMap, resolveContractPlaceholders, insertDojoLogo };
