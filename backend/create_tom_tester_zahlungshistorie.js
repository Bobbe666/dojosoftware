const db = require('./db.js');

async function createTomTesterZahlungshistorie() {
    try {
        console.log('💰 Erstelle Zahlungshistorie für Tom Tester (ID 58)...');

        // Lösche bestehende Transaktionen
        await db.promise().query(`DELETE FROM transaktionen WHERE mitglied_id = 58`);
        console.log('🗑️ Bestehende Transaktionen gelöscht');

        // Erstelle Transaktionen
        const transaktionen = [
            // Mitgliedsbeiträge
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Januar', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Februar', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag März', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag April', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Mai', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Juni', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Juli', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag August', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag September', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Oktober', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag November', betrag: 49.90, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Mitgliedsbeitrag Dezember', betrag: 49.90, status: 'offen' },
            
            // Prüfungsgebühren
            { mitglied_id: 58, typ: 'Prüfungsgebühr Taekwon-Do Gelbgurt', betrag: 35.00, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Prüfungsgebühr Enso Karate Grüngurt', betrag: 40.00, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Prüfungsgebühr Kickboxen Fortgeschritten', betrag: 30.00, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Prüfungsgebühr BJJ Braungurt', betrag: 45.00, status: 'bezahlt' },
            
            // Sonderbeiträge
            { mitglied_id: 58, typ: 'Neuer Gürtel Taekwon-Do', betrag: 25.00, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Handschuhe Kickboxen', betrag: 15.00, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Schutzausrüstung BJJ', betrag: 20.00, status: 'bezahlt' },
            { mitglied_id: 58, typ: 'Trainingsanzug', betrag: 30.00, status: 'bezahlt' }
        ];

        // Füge Transaktionen ein
        for (const transaktion of transaktionen) {
            await db.promise().query(
                'INSERT INTO transaktionen (mitglied_id, typ, betrag, status) VALUES (?, ?, ?, ?)',
                [transaktion.mitglied_id, transaktion.typ, transaktion.betrag, transaktion.status]
            );
            console.log(`✅ ${transaktion.typ} - ${transaktion.betrag}€ (${transaktion.status})`);
        }

        // Zeige Statistiken
        console.log('\n📊 Statistiken:');
        const [stats] = await db.promise().query(`
            SELECT 
                typ,
                COUNT(*) as anzahl,
                SUM(betrag) as gesamtbetrag,
                status
            FROM transaktionen 
            WHERE mitglied_id = 58
            GROUP BY typ, status
            ORDER BY typ
        `);

        console.table(stats);

        // Gesamtstatistiken
        const [gesamt] = await db.promise().query(`
            SELECT 
                COUNT(*) as anzahl_transaktionen,
                SUM(betrag) as gesamtbetrag,
                SUM(CASE WHEN status = 'bezahlt' THEN betrag ELSE 0 END) as bezahlt,
                SUM(CASE WHEN status = 'offen' THEN betrag ELSE 0 END) as offen
            FROM transaktionen 
            WHERE mitglied_id = 58
        `);

        console.log('\n💰 Gesamtstatistiken:');
        console.table(gesamt);

        console.log('\n🎉 Zahlungshistorie für Tom Tester erfolgreich erstellt!');

    } catch (error) {
        console.error('❌ Fehler:', error.message);
    } finally {
        process.exit();
    }
}

createTomTesterZahlungshistorie();