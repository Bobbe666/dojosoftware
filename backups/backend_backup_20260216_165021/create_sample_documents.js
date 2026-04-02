const db = require('./db.js');

const sampleDocuments = [
    {
        dojo_id: 2, // Dojo ID anpassen falls nötig
        dokumenttyp: 'agb',
        version: '1.0',
        titel: 'Allgemeine Geschäftsbedingungen',
        gueltig_ab: '2025-01-01',
        aktiv: true,
        inhalt: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <h1 style="text-align: center; color: #1a1a2e; border-bottom: 3px solid #ffd700; padding-bottom: 10px;">
        Allgemeine Geschäftsbedingungen (AGB)
    </h1>

    <p style="text-align: center; color: #666; margin: 20px 0;">
        <strong>Dojo Kampfsportschule</strong><br>
        Version 1.0 | Gültig ab 01.01.2025
    </p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§1 Geltungsbereich</h2>
    <p>Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge zwischen der Dojo Kampfsportschule
    (nachfolgend "Dojo" genannt) und den Mitgliedern (nachfolgend "Mitglied" genannt).</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§2 Vertragsschluss</h2>
    <p>Der Vertrag kommt durch die Anmeldung des Mitglieds und die Bestätigung durch das Dojo zustande.
    Die Mitgliedschaft beginnt mit dem im Vertrag vereinbarten Datum.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§3 Leistungen</h2>
    <p>Das Dojo bietet Trainingseinheiten in verschiedenen Kampfsportarten an. Der Umfang richtet sich
    nach dem gewählten Tarif. Das Dojo behält sich vor, Trainingszeiten und -orte nach vorheriger
    Ankündigung zu ändern.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§4 Mitgliedsbeiträge</h2>
    <p>Die Höhe der Mitgliedsbeiträge richtet sich nach dem gewählten Tarif. Die Zahlung erfolgt
    wahlweise monatlich, vierteljährlich oder jährlich im Voraus per SEPA-Lastschrift oder Überweisung.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§5 Vertragslaufzeit und Kündigung</h2>
    <p>Die Mindestvertragslaufzeit beträgt 12 Monate. Der Vertrag verlängert sich automatisch um weitere
    12 Monate, wenn er nicht mit einer Frist von 3 Monaten zum Vertragsende gekündigt wird. Die Kündigung
    muss schriftlich erfolgen.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§6 Haftung</h2>
    <p>Das Mitglied nimmt auf eigene Gefahr am Training teil. Das Dojo haftet nur bei Vorsatz und
    grober Fahrlässigkeit. Für Wertgegenstände wird keine Haftung übernommen.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§7 Hausordnung und Dojo-Regeln</h2>
    <p>Das Mitglied verpflichtet sich, die Hausordnung und die Dojo-Regeln (Dojokun) einzuhalten.
    Bei schwerwiegenden Verstößen kann das Dojo eine fristlose Kündigung aussprechen.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">§8 Datenschutz</h2>
    <p>Das Dojo verarbeitet personenbezogene Daten gemäß der Datenschutzgrundverordnung (DSGVO).
    Weitere Informationen entnehmen Sie bitte unserer Datenschutzerklärung.</p>

    <div style="margin-top: 60px; padding-top: 20px; border-top: 2px solid #ffd700;">
        <p style="font-size: 0.9em; color: #666;">
            <strong>Dojo Kampfsportschule</strong><br>
            Musterstraße 123, 12345 Musterstadt<br>
            Tel: 0123-456789 | Email: info@dojo-kampfsport.de
        </p>
    </div>
</div>
        `
    },
    {
        dojo_id: 2,
        dokumenttyp: 'datenschutz',
        version: '1.0',
        titel: 'Datenschutzerklärung',
        gueltig_ab: '2025-01-01',
        aktiv: true,
        inhalt: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <h1 style="text-align: center; color: #1a1a2e; border-bottom: 3px solid #ffd700; padding-bottom: 10px;">
        Datenschutzerklärung
    </h1>

    <p style="text-align: center; color: #666; margin: 20px 0;">
        <strong>Dojo Kampfsportschule</strong><br>
        Version 1.0 | Gültig ab 01.01.2025
    </p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">1. Verantwortlicher</h2>
    <p><strong>Dojo Kampfsportschule</strong><br>
    Musterstraße 123<br>
    12345 Musterstadt<br>
    Tel: 0123-456789<br>
    Email: info@dojo-kampfsport.de</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">2. Erhebung und Speicherung personenbezogener Daten</h2>
    <p>Wir erheben und verarbeiten folgende personenbezogene Daten:</p>
    <ul>
        <li>Name, Vorname</li>
        <li>Geburtsdatum</li>
        <li>Kontaktdaten (Adresse, Telefon, E-Mail)</li>
        <li>Bankverbindung für SEPA-Lastschrift</li>
        <li>Gesundheitsdaten (nur mit ausdrücklicher Einwilligung)</li>
        <li>Trainingsdaten und Anwesenheit</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">3. Zweck der Datenverarbeitung</h2>
    <p>Die Verarbeitung Ihrer personenbezogenen Daten erfolgt zu folgenden Zwecken:</p>
    <ul>
        <li>Verwaltung der Mitgliedschaft</li>
        <li>Abwicklung von Zahlungen</li>
        <li>Kommunikation mit Mitgliedern</li>
        <li>Organisation des Trainingsbetriebs</li>
        <li>Erfüllung rechtlicher Verpflichtungen</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">4. Rechtsgrundlage</h2>
    <p>Die Verarbeitung erfolgt auf Grundlage von:</p>
    <ul>
        <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)</li>
        <li>Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung)</li>
        <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">5. Speicherdauer</h2>
    <p>Wir speichern Ihre Daten solange, wie dies für die Erfüllung der Vertragszwecke erforderlich ist
    oder gesetzliche Aufbewahrungspflichten bestehen (in der Regel 10 Jahre für steuerrechtliche Dokumente).</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">6. Ihre Rechte</h2>
    <p>Sie haben folgende Rechte:</p>
    <ul>
        <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
        <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
        <li>Recht auf Löschung (Art. 17 DSGVO)</li>
        <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">7. Beschwerderecht</h2>
    <p>Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.</p>

    <div style="margin-top: 60px; padding-top: 20px; border-top: 2px solid #ffd700;">
        <p style="font-size: 0.9em; color: #666;">
            Stand: Januar 2025
        </p>
    </div>
</div>
        `
    },
    {
        dojo_id: 2,
        dokumenttyp: 'dojokun',
        version: '1.0',
        titel: 'Dojo-Regeln (Dojokun) - Die 20 Gebote des Karate',
        gueltig_ab: '2025-01-01',
        aktiv: true,
        inhalt: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <h1 style="text-align: center; color: #1a1a2e; border-bottom: 3px solid #ffd700; padding-bottom: 10px;">
        🥋 Dojo-Regeln (Dojokun)
    </h1>

    <h2 style="text-align: center; color: #ffd700; margin: 20px 0;">
        Die 20 Gebote des Karate nach Gichin Funakoshi
    </h2>

    <p style="text-align: center; color: #666; font-style: italic; margin: 30px 0;">
        "Der Weg ist das Ziel - Die Kampfkunst beginnt mit Respekt und endet mit Respekt"
    </p>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">1. Karate beginnt mit Respekt und endet mit Respekt</h3>
        <p style="color: #666;">空手道は礼に始まり礼に終ることを忘るな (Karate-dō wa rei ni hajimari rei ni owaru koto wo wasuru na)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">2. Im Karate gibt es keinen ersten Angriff</h3>
        <p style="color: #666;">空手に先手なし (Karate ni sente nashi)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">3. Karate ist ein Helfer der Gerechtigkeit</h3>
        <p style="color: #666;">空手は義の補け (Karate wa gi no tasuke)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">4. Erkenne zuerst dich selbst, dann den anderen</h3>
        <p style="color: #666;">先づ自己を知れ而して他を知れ (Mazu jiko wo shire shikashite ta wo shire)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">5. Die Kunst des Geistes kommt vor der Kunst der Technik</h3>
        <p style="color: #666;">技術より心術 (Gijutsu yori shinjutsu)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">6. Es geht einzig darum, den Geist zu befreien</h3>
        <p style="color: #666;">心は放たんことを要す (Kokoro wa hanatan koto wo yōsu)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">7. Unglück geschieht immer durch Unachtsamkeit</h3>
        <p style="color: #666;">禍は懈怠に生ず (Wazawai wa ketai ni shōzu)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">8. Denke nicht, dass Karate nur im Dojo stattfindet</h3>
        <p style="color: #666;">道場のみの空手と思うな (Dōjō nomi no karate to omou na)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">9. Karate üben heißt, ein Leben lang arbeiten</h3>
        <p style="color: #666;">空手の修行は一生である (Karate no shugyō wa isshō de aru)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">10. Verbinde dein alltägliches Leben mit Karate</h3>
        <p style="color: #666;">凡ゆるものを空手化せよ (Arayuru mono wo karateka seyo)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">11. Karate ist wie heißes Wasser, das abkühlt, wenn du es nicht ständig wärmst</h3>
        <p style="color: #666;">空手は湯の如し絶えず熱を与えざれば元の水に返る (Karate wa yu no gotoshi taezu netsu wo ataezareba moto no mizu ni kaeru)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">12. Denke nicht an das Gewinnen, doch denke darüber nach, wie du nicht verlierst</h3>
        <p style="color: #666;">勝つ考えは持つな負けぬ考えは必要 (Katsu kangae wa motsu na makenu kangae wa hitsuyō)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">13. Wandle dich abhängig vom Gegner</h3>
        <p style="color: #666;">敵に因って転化せよ (Teki ni yotte tenka seyo)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">14. Der Kampf hängt von der Handhabung des Treffens und des Nicht-Treffens ab</h3>
        <p style="color: #666;">戦は虚実の操縦如何に在り (Ikusa wa kyojitsu no sōjū ikan ni ari)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">15. Stelle dir die Hände und Füße des Gegners als Schwerter vor</h3>
        <p style="color: #666;">人の手足を剣と思え (Hito no teashi wo ken to omoe)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">16. Sobald man vor die Tür tritt, findet man eine Vielzahl von Feinden vor</h3>
        <p style="color: #666;">男子門を出づれば百万の敵あり (Danshi mon wo izureba hyakuman no teki ari)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">17. Feste Stellungen gibt es für Anfänger, später bewegt man sich natürlich</h3>
        <p style="color: #666;">構えは初心者に後は自然体 (Kamae wa shoshinsha ni ato wa shizentai)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">18. Die Kata darf nicht verändert werden, im Kampf jedoch gilt das Gegenteil</h3>
        <p style="color: #666;">型は正しく実戦は別物 (Kata wa tadashiku jissen wa betsu mono)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">19. Hart und weich, Spannung und Entspannung, langsam und schnell</h3>
        <p style="color: #666;">力の強弱体の伸縮技の緩急を忘るな (Chikara no kyōjaku, karada no shinshuku, waza no kankyū wo wasuru na)</p>
    </div>

    <div style="background: #f8f9fa; padding: 30px; border-left: 4px solid #ffd700; margin: 30px 0;">
        <h3 style="color: #1a1a2e; margin-top: 0;">20. Denke immer nach und versuche dich ständig an Neuem</h3>
        <p style="color: #666;">常に思念工夫せよ (Tsune ni shinen kufū seyo)</p>
    </div>

    <div style="margin-top: 60px; padding: 30px; background: linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,107,53,0.1)); border-radius: 10px;">
        <h3 style="color: #1a1a2e; text-align: center; margin-top: 0;">Zusätzliche Dojo-Regeln</h3>
        <ul style="color: #666;">
            <li>Sei pünktlich zum Training</li>
            <li>Grüße beim Betreten und Verlassen des Dojos</li>
            <li>Trage saubere und ordentliche Trainingskleidung</li>
            <li>Respektiere deine Trainingspartner und Lehrer</li>
            <li>Verlasse das Dojo nur mit Erlaubnis des Trainers</li>
            <li>Kein Essen, Trinken oder Kaugummi im Trainingsbereich</li>
            <li>Halte das Dojo sauber</li>
        </ul>
    </div>

    <div style="margin-top: 60px; padding-top: 20px; border-top: 2px solid #ffd700;">
        <p style="font-size: 0.9em; color: #666; text-align: center;">
            <strong>Dojo Kampfsportschule</strong><br>
            "Der Weg ist das Ziel"<br>
            <em>Oss!</em>
        </p>
    </div>
</div>
        `
    },
    {
        dojo_id: 2,
        dokumenttyp: 'hausordnung',
        version: '1.0',
        titel: 'Hausordnung',
        gueltig_ab: '2025-01-01',
        aktiv: true,
        inhalt: `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <h1 style="text-align: center; color: #1a1a2e; border-bottom: 3px solid #ffd700; padding-bottom: 10px;">
        Hausordnung
    </h1>

    <p style="text-align: center; color: #666; margin: 20px 0;">
        <strong>Dojo Kampfsportschule</strong><br>
        Version 1.0 | Gültig ab 01.01.2025
    </p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">1. Öffnungszeiten</h2>
    <p>Das Dojo ist zu folgenden Zeiten geöffnet:</p>
    <ul>
        <li>Montag - Freitag: 16:00 - 22:00 Uhr</li>
        <li>Samstag: 10:00 - 18:00 Uhr</li>
        <li>Sonntag: 10:00 - 14:00 Uhr</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">2. Zutritt</h2>
    <p>Zutritt zum Dojo haben nur Mitglieder und deren Gäste (nach vorheriger Anmeldung).
    Der Mitgliedsausweis ist auf Verlangen vorzuzeigen.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">3. Verhalten im Dojo</h2>
    <ul>
        <li>Respektvolles und höfliches Verhalten ist Pflicht</li>
        <li>Anweisungen der Trainer sind Folge zu leisten</li>
        <li>Störungen des Trainingsbetriebs sind zu unterlassen</li>
        <li>Lärm ist zu vermeiden</li>
        <li>Rauchen ist im gesamten Gebäude verboten</li>
        <li>Alkohol und Drogen sind strengstens untersagt</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">4. Hygiene und Sauberkeit</h2>
    <ul>
        <li>Saubere Sportkleidung ist Pflicht</li>
        <li>Duschen nach dem Training wird empfohlen</li>
        <li>Straßenschuhe sind vor dem Trainingsbereich auszuziehen</li>
        <li>Umkleiden und Sanitäranlagen sind sauber zu halten</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">5. Sicherheit</h2>
    <ul>
        <li>Schmuck und Uhren sind vor dem Training abzulegen</li>
        <li>Lange Haare sind zusammenzubinden</li>
        <li>Finger- und Fußnägel sind kurz zu halten</li>
        <li>Bei Verletzungen ist sofort ein Trainer zu informieren</li>
    </ul>

    <h2 style="color: #1a1a2e; margin-top: 30px;">6. Haftung</h2>
    <p>Für Wertsachen wird keine Haftung übernommen. Spinde stehen zur Verfügung und
    sollten verschlossen werden.</p>

    <h2 style="color: #1a1a2e; margin-top: 30px;">7. Verstöße</h2>
    <p>Bei Verstößen gegen die Hausordnung kann ein Hausverbot ausgesprochen werden.
    In schwerwiegenden Fällen erfolgt eine fristlose Kündigung der Mitgliedschaft.</p>

    <div style="margin-top: 60px; padding-top: 20px; border-top: 2px solid #ffd700;">
        <p style="font-size: 0.9em; color: #666;">
            Vielen Dank für Ihr Verständnis und Ihre Kooperation!<br>
            <strong>Ihr Dojo-Team</strong>
        </p>
    </div>
</div>
        `
    }
];

let completed = 0;
const total = sampleDocuments.length;

console.log(`📚 Erstelle ${total} Musterdokumente...`);

sampleDocuments.forEach((doc, index) => {
    const sql = `
        INSERT INTO vertragsdokumente
        (dojo_id, dokumenttyp, version, titel, inhalt, gueltig_ab, aktiv)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        titel = VALUES(titel),
        inhalt = VALUES(inhalt),
        gueltig_ab = VALUES(gueltig_ab),
        aktiv = VALUES(aktiv)
    `;

    const values = [
        doc.dojo_id,
        doc.dokumenttyp,
        doc.version,
        doc.titel,
        doc.inhalt,
        doc.gueltig_ab,
        doc.aktiv
    ];

    db.query(sql, values, (err, result) => {
        completed++;

        if (err) {
            console.error(`❌ Fehler bei ${doc.dokumenttyp}:`, err.message);
        } else {
            console.log(`✅ ${completed}/${total} - ${doc.dokumenttyp}: ${doc.titel}`);
        }

        if (completed === total) {
            console.log('\n🎉 Alle Musterdokumente erfolgreich erstellt!');
            process.exit(0);
        }
    });
});
