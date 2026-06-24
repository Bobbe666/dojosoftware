// =====================================================================================
// Willkommens-/Mitgliedsvertrag-Mail im zentralen Dojo-Mail-Layout (wie Zugangsdaten-Mail).
// Liefert { subject, html, text } — den PDF-Anhang fügt der Aufrufer hinzu.
// =====================================================================================
const { renderEmail, getDojoMailTheme } = require('./emailLayout');

/**
 * @param {object} mitglied  Objekt mit vorname, mitglied_id (oder mitgliedsnummer), dojo_id
 * @param {string} dojoName
 * @param {boolean} korrigiert  true = ersetzt eine fehlerhafte Vorversion (mit Platzhaltern)
 */
async function buildWelcomeContractMail({ mitglied, dojoName, korrigiert = false }) {
  const m = mitglied || {};
  const theme = await getDojoMailTheme({ dojoId: m.dojo_id });
  const nummer = m.mitgliedsnummer || m.mitglied_id || '';

  const korrHinweis = korrigiert
    ? `<div class="box"><p>Hinweis: Eine zuvor versandte Version enthielt versehentlich Platzhalter statt deiner Daten. Bitte verwende diese korrigierte Fassung – die vorherige ist ungültig.</p></div>`
    : '';

  const bodyHtml = `
    <p style="font-size:16px;margin:0 0 14px;color:#1e293b;">Hallo ${m.vorname || ''},</p>
    <p style="margin:0 0 14px;">vielen Dank für deine Registrierung bei <strong style="color:#1e293b;">${dojoName}</strong>. Deine Mitgliedschaft ist angelegt – wir freuen uns auf dich!</p>
    <div class="box">
      <p><strong style="color:#1e293b;">Mitgliedsnummer:</strong> ${nummer}</p>
      <p><strong style="color:#1e293b;">Mitgliedsvertrag:</strong> als PDF im Anhang dieser E-Mail</p>
    </div>
    ${korrHinweis}
    <p style="margin:14px 0 0;">Bei Fragen melde dich einfach bei uns.</p>
    <p style="margin:12px 0 0;">Sportliche Grüße<br><strong style="color:#1e293b;">${dojoName}</strong></p>`;

  const html = renderEmail({
    theme,
    anlass: 'begruessung',
    titel: 'Willkommen',
    subtitel: 'Deine Mitgliedschaft ist bestätigt',
    bodyHtml,
  });

  const text = `Hallo ${m.vorname || ''},\n\n`
    + `vielen Dank für deine Registrierung bei ${dojoName}. Deine Mitgliedschaft ist angelegt.\n\n`
    + `Mitgliedsnummer: ${nummer}\n`
    + `Mitgliedsvertrag: als PDF im Anhang.\n`
    + (korrigiert ? `\nHinweis: Diese Fassung ersetzt eine zuvor versandte Version mit Platzhaltern – die vorherige ist ungültig.\n` : '')
    + `\nBei Fragen melde dich bei uns.\n\nSportliche Grüße\n${dojoName}`;

  return { subject: `Willkommen bei ${dojoName} – deine Mitgliedschaft`, html, text };
}

module.exports = { buildWelcomeContractMail };
