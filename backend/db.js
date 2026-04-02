const mysql = require('mysql2');
require('dotenv').config();

let db;

// Funktion zum Aufbau der Datenbankverbindung
function connectDatabase() {
    // Validiere dass alle erforderlichen Umgebungsvariablen gesetzt sind
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
        console.error("❌ KRITISCHER FEHLER: Datenbank-Konfiguration fehlt!");
        console.error("Bitte stelle sicher, dass DB_HOST, DB_USER, DB_PASSWORD und DB_NAME in der .env Datei gesetzt sind.");
        process.exit(1);
    }

    db = mysql.createPool({
        // PERFORMANCE: Connection Pool erhöht für bessere Skalierbarkeit
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 50,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        queueLimit: 0,
        charset: 'UTF8MB4_UNICODE_CI',
        // PERFORMANCE: Keep-Alive für stabile Verbindungen
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
    });

    // Teste die Verbindung beim Start
    db.getConnection((err, connection) => {
        if (err) {
            console.error("❌ Fehler bei der MySQL-Verbindung:", err);
            setTimeout(connectDatabase, 5000); // Nach 5s neu versuchen
        } else {
            console.log("✅ Verbunden mit MySQL als ID", connection.threadId);

            // Setze Charset explizit für jede Verbindung
            connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'", (charsetErr) => {
                if (charsetErr) {
                    console.error("⚠️ Fehler beim Setzen des Charset:", charsetErr);
                } else {
                    console.log("✅ Charset auf utf8mb4 gesetzt");
                }
                connection.release();
            });
        }
    });

    // Fehlerhandling bei Verbindungsabbrüchen
    db.on("error", (err) => {
        // Verbindungs-Fehler (ETIMEDOUT, ECONNRESET, PROTOCOL_CONNECTION_LOST etc.)
        // sollen den Prozess NICHT crashen — mysql2 Pool erholt sich automatisch
        const connectionErrors = [
            "PROTOCOL_CONNECTION_LOST",
            "ETIMEDOUT",
            "ECONNRESET",
            "ECONNREFUSED",
            "ENOTFOUND",
        ];
        if (connectionErrors.includes(err.code) || err.fatal) {
            console.error("⚠️ MySQL Verbindungsfehler (wird ignoriert):", err.code || err.message);
        } else {
            // Nur bei echten, unerwarteten Pool-Fehlern weiterschmeißen
            console.error("❌ MySQL Fehler (unerwartet):", err);
            throw err;
        }
    });
}

// **Starte die Verbindung**
connectDatabase();

// **Exportiere die Verbindung**
module.exports = db;
