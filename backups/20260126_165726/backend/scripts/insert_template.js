const fs = require('fs');
const path = require('path');
const db = require('../db');

// HTML-Vorlage laden
const htmlPath = path.join(__dirname, '..', 'templates', 'mitgliedsvertrag_vorlage.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// CSS aus HTML extrahieren (zwischen <style> Tags)
const cssMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
const cssContent = cssMatch ? cssMatch[1] : '';

// HTML ohne style tags
const htmlWithoutStyle = htmlContent.replace(/<style>[\s\S]*?<\/style>/, '');

// Erst ein Dojo auswählen (erstes verfügbares Dojo)
const selectDojoQuery = 'SELECT id FROM dojo LIMIT 1';

db.query(selectDojoQuery, (err, dojos) => {
  if (err) {
    console.error('❌ Fehler beim Abrufen des Dojos:', err.message);
    process.exit(1);
  }

  if (dojos.length === 0) {
    console.error('❌ Kein Dojo gefunden!');
    process.exit(1);
  }

  const dojoId = dojos[0].id;
  console.log(`📍 Verwende Dojo ID: ${dojoId}`);

  // In Datenbank einfügen
  const insertQuery = `
    INSERT INTO vertragsvorlagen (
      dojo_id,
      name,
      beschreibung,
      template_type,
      grapesjs_html,
      grapesjs_css,
      is_default,
      aktiv,
      version,
      erstellt_am,
      aktualisiert_am
    ) VALUES (
      ?,
      'Mitgliedsvertrag - TDA Style',
      'Professionelle Vertragsvorlage basierend auf TDA Vilsbiburg Design mit 3 Seiten: Mitgliedsvertrag, SEPA-Lastschriftmandat und Zahlungstermine',
      'vertrag',
      ?,
      ?,
      1,
      1,
      '1.0',
      NOW(),
      NOW()
    )
  `;

  db.query(insertQuery, [dojoId, htmlContent, cssContent], (err, result) => {
    if (err) {
      console.error('❌ Fehler beim Einfügen der Vorlage:', err.message);
      process.exit(1);
    }

    console.log('✅ Vertragsvorlage erfolgreich eingefügt!');
    console.log(`📄 Vorlage ID: ${result.insertId}`);
    console.log(`📝 Name: Mitgliedsvertrag - TDA Style`);
    console.log(`🔗 Aufrufbar unter: http://localhost:5173/dashboard/vertragsdokumente`);

    db.end();
    process.exit(0);
  });
});
