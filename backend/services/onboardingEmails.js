// Wiederverwendbare Onboarding-Mails für neue Dojos/Nutzer.
// Parametrisiert (name, dojoName), damit die Vorlage für jeden künftigen Nutzer passt.
//
// Verwendung:
//   const { sendMitgliederAnleitung } = require('./services/onboardingEmails');
//   await sendMitgliederAnleitung({ to: 'info@dojo.de', name: 'Max', dojoName: 'Max Dojo' });
//
const { sendEmail } = require('./emailService');

// ── Vorlage: "Mitglieder anlegen – Kurzanleitung" ────────────────────────────
function renderMitgliederAnleitung({ name = '', dojoName = 'deinem Dojo' } = {}) {
  const anrede = name ? `Hallo ${name},` : 'Hallo,';

  const box = (nr, titel, inhalt) => `
    <div style="background:#f9f9f7;border-left:4px solid #c9a227;border-radius:6px;padding:16px 20px;margin:18px 0;">
      <div style="font-weight:700;font-size:16px;color:#1a1a1a;margin-bottom:6px;">${nr} · ${titel}</div>
      <div style="margin:0;line-height:1.65;color:#333;font-size:14px;">${inhalt}</div>
    </div>`;

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#ffffff;">
  <div style="background:#1a1a1a;padding:26px 32px;border-radius:8px 8px 0 0;text-align:center;">
    <div style="font-size:30px;color:#c9a227;line-height:1;">🥋</div>
    <h1 style="color:#ffffff;font-size:20px;margin:10px 0 0;font-weight:600;">Mitglieder anlegen – so geht's</h1>
    <p style="color:#bdbdbd;font-size:13px;margin:6px 0 0;">Kurzanleitung für ${dojoName}</p>
  </div>
  <div style="padding:26px 32px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
    <p style="line-height:1.65;font-size:14px;">${anrede}</p>
    <p style="line-height:1.65;font-size:14px;">in deiner Dojo-Software kannst du Mitglieder auf mehreren Wegen anlegen – je nachdem, ob es um einen einzelnen Neuzugang geht oder darum, deine ganze bestehende Mitgliederliste zu übernehmen. Hier die Übersicht:</p>

    ${box('1', 'Einzeln von Hand',
      'Im Dashboard unter <strong>Mitgliederverwaltung</strong> auf <strong>„Neues Mitglied anlegen"</strong> klicken, das Formular ausfüllen (Name, Geburtsdatum, Kontaktdaten, Tarif …) und speichern. Doppelte Einträge werden automatisch erkannt.<br><span style="color:#666;">→ Ideal für einzelne neue Mitglieder.</span>')}

    ${box('2', 'Viele auf einmal per CSV-Import',
      '<strong>Mitgliederverwaltung → CSV-Import:</strong><br>' +
      '1. <strong>Vorlage herunterladen</strong> (CSV mit den richtigen Spalten).<br>' +
      '2. In Excel/Numbers ausfüllen – Pflicht sind nur <em>Vorname</em> und <em>Nachname</em>, optional u.a. Geburtsdatum, E-Mail, Telefon, Adresse und Bankverbindung.<br>' +
      '3. Datei wieder <strong>hochladen</strong> – fertig.<br>' +
      '<span style="color:#666;">→ Perfekt, um deine komplette bestehende Mitgliederliste in einem Rutsch zu übernehmen.</span>')}

    ${box('3', 'Aus Interessenten / Probetraining',
      'Wer sich über deine Website zum <strong>Probetraining</strong> anmeldet, landet automatisch in deiner <strong>Interessenten-Liste</strong>. Von dort machst du mit einem Klick (<strong>„zu Mitglied umwandeln"</strong>) ein vollwertiges Mitglied daraus – die Daten werden übernommen.<br><span style="color:#666;">→ Ideal, wenn aus Probetrainings feste Mitgliedschaften werden.</span>')}

    <p style="line-height:1.65;font-size:14px;"><strong>Tipp für den Start:</strong> Am schnellsten holst du deine Bestandsmitglieder über den <strong>CSV-Import (Weg 2)</strong> alle auf einmal rein. Neue Mitglieder danach einfach einzeln (Weg 1) oder über das Probetraining (Weg 3).</p>
    <p style="line-height:1.65;font-size:14px;">Wenn du möchtest, unterstützen wir dich gerne beim ersten CSV-Import oder schauen uns deine Liste vorab an – melde dich einfach.</p>
    <p style="line-height:1.65;font-size:14px;margin-bottom:0;">Sportliche Grüße<br><strong>Sascha</strong><br><span style="color:#888;font-size:12px;">Tiger &amp; Dragon Association – International</span></p>
  </div>
</div>`;

  const text = `${anrede}

in deiner Dojo-Software kannst du Mitglieder auf mehreren Wegen anlegen:

1) EINZELN VON HAND
Dashboard -> Mitgliederverwaltung -> "Neues Mitglied anlegen", Formular ausfüllen und speichern. Doppelte werden erkannt. Ideal für einzelne Neuzugänge.

2) VIELE AUF EINMAL PER CSV-IMPORT
Mitgliederverwaltung -> CSV-Import:
- Vorlage herunterladen (CSV mit den richtigen Spalten)
- In Excel ausfüllen (Pflicht: Vorname, Nachname; optional Geburtsdatum, E-Mail, Telefon, Adresse, Bankverbindung)
- Datei hochladen
Perfekt, um die komplette bestehende Mitgliederliste auf einmal zu übernehmen.

3) AUS INTERESSENTEN / PROBETRAINING
Wer sich über deine Website zum Probetraining anmeldet, landet in der Interessenten-Liste. Von dort mit einem Klick "zu Mitglied umwandeln".

Tipp: Zum Start den CSV-Import (Weg 2) für alle Bestandsmitglieder nutzen, danach einzeln (Weg 1) oder über Probetraining (Weg 3).

Bei Fragen melde dich gerne.

Sportliche Grüße
Sascha
Tiger & Dragon Association - International`;

  return { subject: 'Mitglieder anlegen – deine Kurzanleitung', html, text };
}

async function sendMitgliederAnleitung({ to, name = '', dojoName = 'deinem Dojo' }) {
  const { subject, html, text } = renderMitgliederAnleitung({ name, dojoName });
  return sendEmail({ to, subject, html, text });
}

module.exports = { renderMitgliederAnleitung, sendMitgliederAnleitung };
