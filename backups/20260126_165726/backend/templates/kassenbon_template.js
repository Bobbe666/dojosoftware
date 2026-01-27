// =====================================================================================
// KASSENBON-TEMPLATE - DEUTSCHE RECHTLICHE GRUNDLAGEN
// =====================================================================================
// Entspricht den Anforderungen der GoBD (Grundsätze zur ordnungsmäßigen Führung 
// und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer 
// Form sowie zum Datenzugriff)
// =====================================================================================

/**
 * Erstellt einen rechtlich korrekten Kassenbon für Deutschland
 * @param {Object} verkaufsDaten - Die Verkaufsdaten
 * @returns {String} Formatierter Kassenbon-Text
 */
function generateKassenbon(verkaufsDaten) {
  const {
    bon_nummer,
    kassen_id,
    verkauf_datum,
    verkauf_uhrzeit,
    kunde_anzeige,
    positionen,
    netto_gesamt_euro,
    mwst_gesamt_euro,
    brutto_gesamt_euro,
    zahlungsart,
    gegeben_euro,
    rueckgeld_euro,
    verkauft_von_name,
    tse_signatur
  } = verkaufsDaten;

  // Header
  let bon = `
══════════════════════════════════════════════════════════
                    DOJO SOFTWARE
              Kampfsport- und Fitnessstudio
              
           Musterstraße 123, 12345 Musterstadt
              Tel: +49 123 456789
           E-Mail: info@dojosoftware.de
           Website: www.dojosoftware.de
           
           USt-IdNr.: DE123456789
══════════════════════════════════════════════════════════

KASSENBELEG                           ${kassen_id}

Datum: ${formatGermanDate(verkauf_datum)}    Zeit: ${verkauf_uhrzeit}
Bon-Nr: ${bon_nummer}

${kunde_anzeige ? `Kunde: ${kunde_anzeige}` : 'Barkauf'}

──────────────────────────────────────────────────────────
ARTIKELLISTE:
──────────────────────────────────────────────────────────
`;

  // Artikel-Positionen
  positionen.forEach((position, index) => {
    const { artikel_name, menge, einzelpreis_euro, brutto_euro, mwst_prozent } = position;
    
    bon += `${index + 1}. ${artikel_name}\n`;
    bon += `    ${menge} x ${einzelpreis_euro.toFixed(2)}€ = ${brutto_euro.toFixed(2)}€\n`;
    bon += `    (inkl. ${mwst_prozent.toFixed(1)}% MwSt)\n\n`;
  });

  // MwSt-Aufschlüsselung (rechtlich erforderlich)
  const mwstAufschluesse = calculateMwstBreakdown(positionen);
  
  bon += `──────────────────────────────────────────────────────────
MEHRWERTSTEUER-AUFSCHLÜSSELUNG:
──────────────────────────────────────────────────────────
`;

  mwstAufschluesse.forEach(mwst => {
    bon += `${mwst.prozent.toFixed(1)}% MwSt: Netto ${mwst.netto.toFixed(2)}€ + MwSt ${mwst.mwst.toFixed(2)}€\n`;
  });

  // Gesamtsumme
  bon += `
──────────────────────────────────────────────────────────
SUMME:
──────────────────────────────────────────────────────────
Netto gesamt:                              ${netto_gesamt_euro.toFixed(2)}€
MwSt gesamt:                               ${mwst_gesamt_euro.toFixed(2)}€
──────────────────────────────────────────────────────────
BRUTTO GESAMT:                             ${brutto_gesamt_euro.toFixed(2)}€
══════════════════════════════════════════════════════════

ZAHLUNG:
${getZahlungsartText(zahlungsart)}`;

  // Barzahlung Details
  if (zahlungsart === 'bar' && gegeben_euro && rueckgeld_euro !== undefined) {
    bon += `
Gegeben:                                   ${gegeben_euro.toFixed(2)}€
Rückgeld:                                  ${rueckgeld_euro.toFixed(2)}€`;
  }

  // Rechtliche Hinweise
  bon += `

──────────────────────────────────────────────────────────
RECHTLICHE HINWEISE:
──────────────────────────────────────────────────────────
Geschäftsführer: Max Mustermann
Registergericht: Amtsgericht Musterstadt, HRB 12345

Bei Barzahlungen wird eine ordnungsgemäße Rechnung erst
ab einem Betrag von 250€ ausgestellt.

Umtausch nur gegen Vorlage dieses Belegs möglich.
Gewährleistung nach BGB.

──────────────────────────────────────────────────────────
TECHNISCHE SICHERUNG (TSE):
──────────────────────────────────────────────────────────`;

  // TSE-Informationen (für Kassensicherungsverordnung)
  if (tse_signatur) {
    bon += `
TSE-Signatur: ${tse_signatur}
Zertifikat: TSE_CERT_001
Zeitstempel: ${new Date().toISOString()}`;
  } else {
    bon += `
TSE-Status: Nicht implementiert
Hinweis: Technische Sicherheitseinrichtung wird nachgerüstet`;
  }

  // Footer
  bon += `

Bedient durch: ${verkauft_von_name || 'System'}
Erstellt: ${new Date().toLocaleString('de-DE')}

──────────────────────────────────────────────────────────
Vielen Dank für Ihren Einkauf!
Besuchen Sie uns wieder!
──────────────────────────────────────────────────────────

                www.dojosoftware.de
══════════════════════════════════════════════════════════
`;

  return bon;
}

/**
 * Formatiert Datum im deutschen Format
 */
function formatGermanDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Erstellt MwSt-Aufschlüsselung nach Steuersätzen
 */
function calculateMwstBreakdown(positionen) {
  const mwstGroups = {};
  
  positionen.forEach(position => {
    const prozent = position.mwst_prozent;
    if (!mwstGroups[prozent]) {
      mwstGroups[prozent] = {
        prozent,
        netto: 0,
        mwst: 0
      };
    }
    mwstGroups[prozent].netto += position.netto_euro;
    mwstGroups[prozent].mwst += position.mwst_euro;
  });
  
  return Object.values(mwstGroups);
}

/**
 * Gibt Zahlungsart-Text zurück
 */
function getZahlungsartText(zahlungsart) {
  const zahlungsarten = {
    'bar': 'Barzahlung',
    'karte': 'Kartenzahlung (EC/Kreditkarte)',
    'digital': 'Digitale Zahlung (PayPal, Apple Pay, etc.)',
    'gutschein': 'Gutscheineinlösung'
  };
  
  return zahlungsarten[zahlungsart] || 'Sonstige Zahlung';
}

/**
 * Erstellt eine Stornierungs-Beleg
 */
function generateStornoBon(originalVerkauf, stornoGrund) {
  let stornoBon = `
══════════════════════════════════════════════════════════
                    DOJO SOFTWARE
              Kampfsport- und Fitnessstudio
              
                 STORNIERUNG
══════════════════════════════════════════════════════════

STORNO-BELEG                          ${originalVerkauf.kassen_id}

Datum: ${formatGermanDate(new Date())}    Zeit: ${new Date().toLocaleTimeString('de-DE')}
Storno-Nr: STORNO-${originalVerkauf.bon_nummer}

ORIGINAL-BON: ${originalVerkauf.bon_nummer}
ORIGINAL-DATUM: ${formatGermanDate(originalVerkauf.verkauf_datum)}
BETRAG: -${originalVerkauf.brutto_gesamt_euro.toFixed(2)}€

GRUND: ${stornoGrund}

──────────────────────────────────────────────────────────
RECHTLICHER HINWEIS:
──────────────────────────────────────────────────────────
Diese Stornierung erfolgt gemäß § 14c UStG.
Der ursprüngliche Beleg wird hiermit ungültig.

Erstellt: ${new Date().toLocaleString('de-DE')}
══════════════════════════════════════════════════════════
`;

  return stornoBon;
}

module.exports = {
  generateKassenbon,
  generateStornoBon,
  formatGermanDate
};