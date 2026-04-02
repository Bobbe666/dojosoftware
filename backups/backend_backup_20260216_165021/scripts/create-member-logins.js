/**
 * Script: Erstelle User-Accounts für alle Mitglieder
 *
 * Username: vorname.nachname (kleingeschrieben, Umlaute ersetzt)
 * Passwort: Geburtsdatum im Format TT.MM.JJJJ
 *
 * Verwendung: node scripts/create-member-logins.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Datenbankverbindung
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dojosoftware'
};

// Umlaute ersetzen
function replaceUmlauts(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/á/g, 'a')
    .replace(/à/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ó/g, 'o')
    .replace(/ò/g, 'o')
    .replace(/ô/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ù/g, 'u')
    .replace(/û/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9.-]/g, '') // Nur erlaubte Zeichen
    .trim();
}

// Geburtsdatum formatieren (TT.MM.JJJJ)
function formatBirthdate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}.${month}.${year}`;
}

// Eindeutigen Username generieren
async function generateUniqueUsername(connection, vorname, nachname, existingUsernames) {
  let baseUsername = `${replaceUmlauts(vorname)}.${replaceUmlauts(nachname)}`;

  // Falls leer, Fallback
  if (!baseUsername || baseUsername === '.') {
    baseUsername = 'mitglied';
  }

  let username = baseUsername;
  let counter = 1;

  // Prüfe ob Username bereits existiert (in DB oder in dieser Session)
  while (existingUsernames.has(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  // Zusätzlich in DB prüfen
  const [existing] = await connection.query(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );

  while (existing.length > 0 || existingUsernames.has(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
    const [check] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (check.length === 0 && !existingUsernames.has(username)) break;
  }

  return username;
}

async function main() {
  console.log('🚀 Starte Erstellung von Mitglieder-Zugangsdaten...\n');

  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Datenbankverbindung hergestellt\n');

    // Alle Mitglieder ohne User-Account holen
    const [members] = await connection.query(`
      SELECT
        m.mitglied_id,
        m.vorname,
        m.nachname,
        m.email,
        m.geburtsdatum
      FROM mitglieder m
      LEFT JOIN users u ON u.mitglied_id = m.mitglied_id
      WHERE u.id IS NULL
        AND m.vorname IS NOT NULL
        AND m.nachname IS NOT NULL
        AND m.geburtsdatum IS NOT NULL
      ORDER BY m.nachname, m.vorname
    `);

    console.log(`📋 ${members.length} Mitglieder ohne User-Account gefunden\n`);

    if (members.length === 0) {
      console.log('✅ Alle Mitglieder haben bereits einen User-Account.');
      return;
    }

    const existingUsernames = new Set();
    const createdAccounts = [];
    const errors = [];

    for (const member of members) {
      try {
        // Username generieren
        const username = await generateUniqueUsername(
          connection,
          member.vorname,
          member.nachname,
          existingUsernames
        );

        // Passwort aus Geburtsdatum
        const password = formatBirthdate(member.geburtsdatum);

        if (!password) {
          errors.push({
            mitglied_id: member.mitglied_id,
            name: `${member.vorname} ${member.nachname}`,
            error: 'Ungültiges Geburtsdatum'
          });
          continue;
        }

        // Passwort hashen
        const hashedPassword = await bcrypt.hash(password, 10);

        // User erstellen
        const [result] = await connection.query(`
          INSERT INTO users (username, email, password, role, mitglied_id, created_at)
          VALUES (?, ?, ?, 'member', ?, NOW())
        `, [
          username,
          member.email || null,
          hashedPassword,
          member.mitglied_id
        ]);

        existingUsernames.add(username);

        createdAccounts.push({
          mitglied_id: member.mitglied_id,
          name: `${member.vorname} ${member.nachname}`,
          username: username,
          password: password, // Klartext für Ausgabe
          user_id: result.insertId
        });

        console.log(`✅ ${member.vorname} ${member.nachname} → ${username}`);

      } catch (err) {
        errors.push({
          mitglied_id: member.mitglied_id,
          name: `${member.vorname} ${member.nachname}`,
          error: err.message
        });
        console.error(`❌ Fehler bei ${member.vorname} ${member.nachname}: ${err.message}`);
      }
    }

    // Zusammenfassung
    console.log('\n' + '='.repeat(60));
    console.log('📊 ZUSAMMENFASSUNG');
    console.log('='.repeat(60));
    console.log(`✅ Erfolgreich erstellt: ${createdAccounts.length}`);
    console.log(`❌ Fehler: ${errors.length}`);

    if (createdAccounts.length > 0) {
      console.log('\n📋 ERSTELLTE ZUGANGSDATEN:');
      console.log('-'.repeat(60));
      console.log('Name | Username | Passwort (Geburtsdatum)');
      console.log('-'.repeat(60));

      for (const acc of createdAccounts) {
        console.log(`${acc.name} | ${acc.username} | ${acc.password}`);
      }
    }

    if (errors.length > 0) {
      console.log('\n❌ FEHLER:');
      console.log('-'.repeat(60));
      for (const err of errors) {
        console.log(`${err.name}: ${err.error}`);
      }
    }

    console.log('\n✅ Script abgeschlossen!');

  } catch (error) {
    console.error('💥 Kritischer Fehler:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
