// Spezielle Migration für Verträge-Tabellen-Erweiterung
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dojo',
    multipleStatements: false
  });

  console.log('🚀 Starte Vertrags-Migration...\n');

  // Liste der hinzuzufügenden Spalten
  const columns = [
    { name: 'vertragsnummer', definition: "VARCHAR(50) UNIQUE COMMENT 'Eindeutige Vertragsnummer'" },
    { name: 'kuendigungsfrist_monate', definition: "INT DEFAULT 3 COMMENT 'Kündigungsfrist in Monaten vor Vertragsende'" },
    { name: 'mindestlaufzeit_monate', definition: "INT DEFAULT 12 COMMENT 'Mindestvertragslaufzeit in Monaten'" },
    { name: 'automatische_verlaengerung', definition: "BOOLEAN DEFAULT TRUE COMMENT 'Verlängert sich automatisch?'" },
    { name: 'verlaengerung_monate', definition: "INT DEFAULT 12 COMMENT 'Um wie viele Monate verlängert sich der Vertrag?'" },
    { name: 'faelligkeit_tag', definition: "INT DEFAULT 1 COMMENT 'Tag im Monat an dem Zahlung fällig ist'" },
    { name: 'rabatt_prozent', definition: "DECIMAL(5,2) DEFAULT 0 COMMENT 'Rabatt in Prozent'" },
    { name: 'rabatt_grund', definition: "VARCHAR(255) COMMENT 'Grund für Rabatt'" },
    { name: 'sepa_mandat_id', definition: "INT COMMENT 'Verknüpfung mit SEPA-Mandat'" },
    { name: 'agb_version', definition: "VARCHAR(20) COMMENT 'Version der akzeptierten AGB'" },
    { name: 'agb_akzeptiert_am', definition: "DATETIME COMMENT 'Zeitpunkt der AGB-Akzeptanz'" },
    { name: 'datenschutz_version', definition: "VARCHAR(20) COMMENT 'Version der Datenschutzerklärung'" },
    { name: 'datenschutz_akzeptiert_am', definition: "DATETIME COMMENT 'Zeitpunkt der Datenschutz-Akzeptanz'" },
    { name: 'widerruf_akzeptiert_am', definition: "DATETIME COMMENT 'Widerrufsbelehrung akzeptiert'" },
    { name: 'hausordnung_akzeptiert_am', definition: "DATETIME COMMENT 'Hausordnung akzeptiert'" },
    { name: 'gesundheitserklaerung', definition: "BOOLEAN DEFAULT FALSE COMMENT 'Gesundheitliche Eignung bestätigt'" },
    { name: 'gesundheitserklaerung_datum', definition: "DATETIME COMMENT 'Zeitpunkt der Gesundheitserklärung'" },
    { name: 'haftungsausschluss_akzeptiert', definition: "BOOLEAN DEFAULT FALSE COMMENT 'Haftungsausschluss akzeptiert'" },
    { name: 'haftungsausschluss_datum', definition: "DATETIME COMMENT 'Zeitpunkt der Haftungsausschluss-Akzeptanz'" },
    { name: 'foto_einverstaendnis', definition: "BOOLEAN DEFAULT FALSE COMMENT 'Foto/Video-Einwilligung'" },
    { name: 'foto_einverstaendnis_datum', definition: "DATETIME COMMENT 'Zeitpunkt der Foto-Einwilligung'" },
    { name: 'unterschrift_datum', definition: "DATETIME COMMENT 'Datum + Uhrzeit der Vertragsunterzeichnung'" },
    { name: 'unterschrift_digital', definition: "LONGTEXT COMMENT 'Base64-kodierte digitale Unterschrift'" },
    { name: 'unterschrift_ip', definition: "VARCHAR(45) COMMENT 'IP-Adresse bei Unterzeichnung'" },
    { name: 'vertragstext_pdf_path', definition: "VARCHAR(255) COMMENT 'Pfad zum Vertrags-PDF'" },
    { name: 'created_by', definition: "INT COMMENT 'Erstellt von Benutzer-ID'" },
    { name: 'updated_by', definition: "INT COMMENT 'Zuletzt bearbeitet von'" },
    { name: 'updated_at', definition: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Letzte Änderung'" }
  ];

  // Füge Spalten hinzu
  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const col of columns) {
    try {
      await connection.execute(`ALTER TABLE vertraege ADD COLUMN ${col.name} ${col.definition}`);
      console.log(`✅ Spalte hinzugefügt: ${col.name}`);
      added++;
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`⏭️  Spalte existiert bereits: ${col.name}`);
        skipped++;
      } else {
        console.error(`❌ Fehler bei ${col.name}:`, err.message);
        errors++;
      }
    }
  }

  console.log('\n=== TABELLENERWEITERUNG ABGESCHLOSSEN ===');
  console.log(`✅ Hinzugefügt: ${added}`);
  console.log(`⏭️  Übersprungen: ${skipped}`);
  console.log(`❌ Fehler: ${errors}\n`);

  // Erstelle neue Tabellen
  console.log('📋 Erstelle zusätzliche Tabellen...\n');

  // 1. Vertragsdokumente
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vertragsdokumente (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dojo_id INT NOT NULL COMMENT 'Zugehöriges Dojo',
        dokumenttyp ENUM('agb', 'datenschutz', 'widerruf', 'hausordnung', 'haftung', 'sonstiges') NOT NULL,
        version VARCHAR(20) NOT NULL,
        titel VARCHAR(255) NOT NULL,
        inhalt LONGTEXT,
        pdf_pfad VARCHAR(255),
        gueltig_ab DATE NOT NULL,
        gueltig_bis DATE,
        aktiv BOOLEAN DEFAULT TRUE,
        erstellt_von INT,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (dojo_id) REFERENCES dojo(id) ON DELETE CASCADE,
        INDEX idx_dojo_dokumenttyp (dojo_id, dokumenttyp),
        INDEX idx_aktiv (aktiv),
        UNIQUE KEY unique_dojo_dokumenttyp_version (dojo_id, dokumenttyp, version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Rechtliche Dokumente (AGB, Datenschutz, etc.) pro Dojo'
    `);
    console.log('✅ Tabelle erstellt: vertragsdokumente');
  } catch (err) {
    console.log('⏭️  Tabelle vertragsdokumente existiert bereits');
  }

  // 2. Vertragshistorie
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vertragshistorie (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vertrag_id INT NOT NULL,
        aenderung_typ ENUM('erstellt', 'geaendert', 'gekuendigt', 'pausiert', 'reaktiviert', 'beendet') NOT NULL,
        aenderung_beschreibung TEXT,
        aenderung_details JSON,
        geaendert_von INT,
        geaendert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_adresse VARCHAR(45),
        FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE,
        INDEX idx_vertrag_datum (vertrag_id, geaendert_am)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Protokolliert alle Änderungen an Verträgen'
    `);
    console.log('✅ Tabelle erstellt: vertragshistorie');
  } catch (err) {
    console.log('⏭️  Tabelle vertragshistorie existiert bereits');
  }

  // 3. Vertragsleistungen
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vertragsleistungen (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vertrag_id INT NOT NULL,
        beschreibung TEXT,
        anzahl_einheiten_pro_woche INT DEFAULT 2,
        standorte TEXT,
        inkludierte_kurse TEXT,
        zusatzleistungen TEXT,
        ausschluesse TEXT,
        urlaubstage_pro_jahr INT DEFAULT 0,
        urlaubsregelung TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vertrag_id) REFERENCES vertraege(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Leistungsumfang des Vertrags'
    `);
    console.log('✅ Tabelle erstellt: vertragsleistungen');
  } catch (err) {
    console.log('⏭️  Tabelle vertragsleistungen existiert bereits');
  }

  // Füge Standard-Dokumente für Dojos hinzu
  console.log('\n📄 Erstelle Standard-Dokumente für Dojos...\n');

  const [dojos] = await connection.execute('SELECT id, dojoname, strasse, hausnummer, plz, ort, inhaber, email FROM dojo WHERE ist_aktiv = TRUE');

  for (const dojo of dojos) {
    // AGB
    const agbContent = `<h1>Allgemeine Geschäftsbedingungen</h1>
<h2>§1 Vertragsparteien</h2>
<p>Dieser Vertrag wird geschlossen zwischen:</p>
<p><strong>${dojo.dojoname}</strong><br>
${dojo.strasse || ''} ${dojo.hausnummer || ''}<br>
${dojo.plz || ''} ${dojo.ort || ''}<br>
vertreten durch: ${dojo.inhaber || ''}</p>
<p>- nachfolgend "Verein" genannt - und dem Mitglied gemäß den im Vertrag angegebenen Daten.</p>

<h2>§2 Kündigungsfrist</h2>
<p><strong>⚠️ WICHTIG:</strong> Die Kündigungsfrist bezieht sich auf das im Vertrag angegebene <strong>Vertragsende</strong>, nicht auf die Laufzeit.</p>
<p>Bei einer Kündigungsfrist von 3 Monaten bedeutet dies:<br>
Die Kündigung muss <strong>mindestens 3 Monate VOR dem Vertragsende</strong> beim Verein eingehen.
Der Vertrag endet dann zum ursprünglich vereinbarten Vertragsende.</p>
<p><em>Beispiel:</em> Bei einem Vertrag mit Laufzeit bis 31.12.2025 und 3 Monaten Kündigungsfrist
muss die Kündigung spätestens am 30.09.2025 beim Verein vorliegen. Der Vertrag endet dann am 31.12.2025.</p>

<h2>§3 Automatische Vertragsverlängerung</h2>
<p>Sofern im Vertrag nicht anders vereinbart, verlängert sich der Vertrag automatisch um die angegebene Verlängerungsdauer,
wenn er nicht fristgerecht gekündigt wird.</p>

<h2>§4 Zahlungsbedingungen</h2>
<p>Die Beitragszahlung erfolgt gemäß dem im Vertrag angegebenen Zahlungsintervall.
Die erste Zahlung ist mit Vertragsbeginn fällig.</p>
<p>Bei Zahlungsverzug behält sich der Verein vor, das Mitglied vom Training auszuschließen.</p>

<h2>§5 Haftung</h2>
<p>Das Mitglied nimmt am Training auf eigene Gefahr teil.
Der Verein haftet nicht für Schäden, die während des Trainings entstehen,
es sei denn, diese beruhen auf Vorsatz oder grober Fahrlässigkeit.</p>
<p>Das Mitglied wird dringend empfohlen, eine private Unfallversicherung abzuschließen.</p>`;

    try {
      await connection.execute(`
        INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, aktiv)
        VALUES (?, 'agb', '1.0', 'Allgemeine Geschäftsbedingungen', ?, CURDATE(), TRUE)
        ON DUPLICATE KEY UPDATE inhalt = VALUES(inhalt)
      `, [dojo.id, agbContent]);
      console.log(`✅ AGB erstellt für: ${dojo.dojoname}`);
    } catch (err) {
      console.log(`⏭️  AGB existiert bereits für: ${dojo.dojoname}`);
    }

    // Datenschutzerklärung
    const datenschutzContent = `<h1>Datenschutzerklärung</h1>
<p>Verantwortlich: <strong>${dojo.dojoname}</strong><br>
${dojo.strasse || ''} ${dojo.hausnummer || ''}<br>
${dojo.plz || ''} ${dojo.ort || ''}<br>
E-Mail: ${dojo.email || ''}</p>

<h2>1. Datenverarbeitung</h2>
<p>Wir verarbeiten Ihre personenbezogenen Daten (Name, Adresse, Geburtsdatum, Kontaktdaten, Bankverbindung)
ausschließlich zum Zweck der Vertragsdurchführung und -verwaltung.</p>

<h2>2. Rechtsgrundlage</h2>
<p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).</p>

<h2>3. Speicherdauer</h2>
<p>Ihre Daten werden für die Dauer der Vertragslaufzeit sowie gemäß den gesetzlichen Aufbewahrungsfristen gespeichert.</p>

<h2>4. Ihre Rechte</h2>
<p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
Datenübertragbarkeit und Widerspruch.</p>
<p>Kontakt: ${dojo.email || ''}</p>`;

    try {
      await connection.execute(`
        INSERT INTO vertragsdokumente (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, aktiv)
        VALUES (?, 'datenschutz', '1.0', 'Datenschutzerklärung', ?, CURDATE(), TRUE)
        ON DUPLICATE KEY UPDATE inhalt = VALUES(inhalt)
      `, [dojo.id, datenschutzContent]);
      console.log(`✅ Datenschutz erstellt für: ${dojo.dojoname}`);
    } catch (err) {
      console.log(`⏭️  Datenschutz existiert bereits für: ${dojo.dojoname}`);
    }
  }

  await connection.end();
  console.log('\n✅ MIGRATION ERFOLGREICH ABGESCHLOSSEN!\n');
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 MIGRATION FEHLGESCHLAGEN:', err);
    process.exit(1);
  });
