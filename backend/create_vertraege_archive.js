// Create archive table for deleted contracts
const db = require('./db');

async function createArchiveTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS vertraege_geloescht (
            id INT PRIMARY KEY,
            mitglied_id INT NOT NULL,
            dojo_id INT NOT NULL,
            tarif_id INT,
            status VARCHAR(50),
            vertragsbeginn DATE,
            vertragsende DATE,
            billing_cycle VARCHAR(50),
            payment_method VARCHAR(50),
            monatsbeitrag DECIMAL(10,2),
            kuendigung_eingegangen DATE,
            kuendigungsgrund VARCHAR(255),
            kuendigungsdatum DATE,
            ruhepause_von DATE,
            ruhepause_bis DATE,
            ruhepause_dauer_monate INT,
            agb_akzeptiert_am DATETIME,
            datenschutz_akzeptiert_am DATETIME,
            hausordnung_akzeptiert_am DATETIME,
            unterschrift_datum DATETIME,
            unterschrift_ip VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            geloescht_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            geloescht_von VARCHAR(100),
            geloescht_grund TEXT,
            INDEX idx_mitglied_id (mitglied_id),
            INDEX idx_dojo_id (dojo_id),
            INDEX idx_geloescht_am (geloescht_am)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='Archiv für gelöschte Verträge'
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('❌ Fehler beim Erstellen der Tabelle:', err);
            process.exit(1);
        }

        console.log('✅ Tabelle vertraege_geloescht erfolgreich erstellt!');
        process.exit(0);
    });
}

createArchiveTable();
