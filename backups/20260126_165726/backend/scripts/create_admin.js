#!/usr/bin/env node

/**
 * Admin-Benutzer Erstellungs-Script
 *
 * Verwendung:
 * - Lokal: node scripts/create_admin.js
 * - Server: cd ~/dojosoftware/backend && node scripts/create_admin.js
 *
 * Das Script fragt interaktiv nach Username, Email und Passwort
 * oder verwendet Default-Werte wenn keine Eingabe erfolgt.
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Readline Interface für User-Input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisifizierte Question-Funktion
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdminUser() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   DOJOSOFTWARE - ADMIN-BENUTZER ERSTELLEN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Datenbank-Verbindung
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'dojo'
        });

        console.log('✅ Datenbankverbindung hergestellt\n');

        // Prüfen ob bereits Admin-User existiert
        const [existingUsers] = await connection.execute(
            'SELECT COUNT(*) as count FROM users WHERE role = ?',
            ['admin']
        );

        if (existingUsers[0].count > 0) {
            console.log(`⚠️  Es existieren bereits ${existingUsers[0].count} Admin-Benutzer.`);
            const confirm = await question('Trotzdem fortfahren? (j/n): ');
            if (confirm.toLowerCase() !== 'j' && confirm.toLowerCase() !== 'y') {
                console.log('Abgebrochen.');
                rl.close();
                await connection.end();
                process.exit(0);
            }
        }

        // User-Daten abfragen
        console.log('\n📝 Geben Sie die Admin-Daten ein (Enter für Default-Werte):\n');

        const username = await question('Username [admin]: ') || 'admin';
        const email = await question('Email [admin@tda-intl.org]: ') || 'admin@tda-intl.org';
        let password = await question('Password [admin123]: ') || 'admin123';

        // Passwort-Bestätigung wenn custom password
        if (password !== 'admin123') {
            const passwordConfirm = await question('Password wiederholen: ');
            if (password !== passwordConfirm) {
                console.error('\n❌ Passwörter stimmen nicht überein!');
                rl.close();
                await connection.end();
                process.exit(1);
            }
        }

        // Prüfen ob Username/Email bereits existiert
        const [existingUser] = await connection.execute(
            'SELECT username, email FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            console.error('\n❌ Username oder Email bereits vergeben!');
            console.log('Existierender User:', existingUser[0]);
            rl.close();
            await connection.end();
            process.exit(1);
        }

        // Passwort hashen
        console.log('\n🔐 Hashe Passwort...');
        const hashedPassword = await bcrypt.hash(password, 10);

        // User erstellen
        console.log('💾 Erstelle Admin-Benutzer...');
        const [result] = await connection.execute(
            `INSERT INTO users (username, email, password, role, mitglied_id)
             VALUES (?, ?, ?, 'admin', NULL)`,
            [username, email, hashedPassword]
        );

        console.log('\n✅ Admin-Benutzer erfolgreich erstellt!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Login-Daten:');
        console.log(`   ID:       ${result.insertId}`);
        console.log(`   Username: ${username}`);
        console.log(`   Email:    ${email}`);
        console.log(`   Password: ${password}`);
        console.log('   Role:     admin');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n⚠️  WICHTIG:');
        console.log('   - Notieren Sie diese Login-Daten!');
        console.log('   - Ändern Sie das Passwort nach dem ersten Login!');
        console.log('   - Löschen Sie diese Ausgabe aus dem Terminal-Verlauf!\n');

        // Cleanup
        rl.close();
        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Fehler:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            console.error('   → Username oder Email bereits vergeben.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('   → Datenbank-Verbindung fehlgeschlagen. Läuft MySQL?');
        }
        rl.close();
        process.exit(1);
    }
}

// Script ausführen
createAdminUser();
