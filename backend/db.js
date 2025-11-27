const mysql = require('mysql2');
require('dotenv').config();

let db;

// Funktion zum Aufbau der Datenbankverbindung
function connectDatabase() {
    db = mysql.createPool({
        connectionLimit: 10,
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "dojoUser",
        password: process.env.DB_PASSWORD || "DojoServer2025!",
        database: process.env.DB_NAME || "dojo",
        waitForConnections: true,
        queueLimit: 0,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci',
        connectionConfig: {
            charset: 'UTF8MB4_UNICODE_CI'
        }
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
        console.error("❌ MySQL Fehler:", err);
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
            console.log("🔄 Verbindung verloren... Reconnect wird durchgeführt.");
            connectDatabase(); // Erneute Verbindung
        } else {
            throw err;
        }
    });
}

// **Starte die Verbindung**
connectDatabase();

// **Exportiere die Verbindung**
module.exports = db;
