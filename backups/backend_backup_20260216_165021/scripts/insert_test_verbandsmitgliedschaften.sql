-- Insert 500 Test Verbandsmitgliedschaften into dojo_test database
-- Mix of Dojo and Einzelperson memberships

DELIMITER //

DROP PROCEDURE IF EXISTS insert_test_verbandsmitgliedschaften//

CREATE PROCEDURE insert_test_verbandsmitgliedschaften()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE v_typ ENUM('dojo','einzelperson');
    DECLARE v_mitgliedsnummer VARCHAR(20);
    DECLARE v_dojo_counter INT DEFAULT 1;
    DECLARE v_einzel_counter INT DEFAULT 1;
    DECLARE v_status VARCHAR(20);
    DECLARE v_jahresbeitrag DECIMAL(10,2);
    DECLARE v_gueltig_von DATE;
    DECLARE v_gueltig_bis DATE;
    DECLARE v_zahlungsart VARCHAR(20);

    -- Random data arrays
    SET @vornamen = 'Thomas,Michael,Stefan,Andreas,Christian,Markus,Martin,Peter,Daniel,Frank,Oliver,Sascha,Patrick,Marco,Florian,Tobias,Sebastian,Alexander,Matthias,Benjamin,Anna,Julia,Laura,Sarah,Lisa,Lena,Marie,Sophie,Katharina,Christina,Sandra,Melanie,Nicole,Stefanie,Claudia,Martina,Andrea,Susanne,Birgit,Petra';
    SET @nachnamen = 'Mueller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker,Schulz,Hoffmann,Koch,Richter,Bauer,Klein,Wolf,Schroeder,Neumann,Schwarz,Zimmermann,Braun,Krueger,Hofmann,Hartmann,Lange,Schmitt,Werner,Schmitz,Krause,Meier,Lehmann';
    SET @dojo_namen = 'Kampfkunst Akademie,Budo Center,Martial Arts School,Fight Club,Karate Dojo,Taekwondo Schule,Judo Verein,Aikido Center,Kung Fu Schule,MMA Gym,Kickbox Studio,Self Defense Academy,Tiger Dojo,Dragon Academy,Samurai Dojo,Ninja School,Shaolin Center,Combat Sports,Power Gym,Elite Fighting,Warriors Dojo,Champions Academy,Victory Martial Arts,Phoenix Dojo,Eagle Fighters,Lion Heart Dojo,Thunder Kicks,Storm Warriors,Fire Dragons,Ice Tigers';
    SET @staedte = 'Berlin,Hamburg,Muenchen,Koeln,Frankfurt,Stuttgart,Duesseldorf,Dortmund,Essen,Leipzig,Bremen,Dresden,Hannover,Nuernberg,Duisburg,Bochum,Wuppertal,Bielefeld,Bonn,Muenster,Karlsruhe,Mannheim,Augsburg,Wiesbaden,Aachen,Braunschweig,Kiel,Magdeburg,Freiburg,Luebeck';
    SET @strassen = 'Hauptstrasse,Schulstrasse,Gartenstrasse,Bahnhofstrasse,Dorfstrasse,Bergstrasse,Kirchstrasse,Waldstrasse,Industriestrasse,Sportplatzweg,Am Markt,Ringstrasse,Schlossstrasse,Parkstrasse,Muehlenweg';
    SET @plz_liste = '10115,20095,80331,50667,60311,70173,40213,44135,45127,04109,28195,01067,30159,90402,47051,44787,42103,33602,53111,48143,76131,68161,86150,65183,52062,38100,24103,39104,79098,23552';

    -- Update sequence numbers first
    UPDATE verband_nummern_sequenz SET aktuelle_nummer = 1 WHERE typ = 'dojo';
    UPDATE verband_nummern_sequenz SET aktuelle_nummer = 1 WHERE typ = 'einzelperson';

    WHILE i <= 500 DO
        -- 60% Dojo, 40% Einzelperson
        IF RAND() < 0.6 THEN
            SET v_typ = 'dojo';
            SET v_mitgliedsnummer = CONCAT('TDA-D-', LPAD(v_dojo_counter + 1, 4, '0'));
            SET v_dojo_counter = v_dojo_counter + 1;
            SET v_jahresbeitrag = 99.00;
        ELSE
            SET v_typ = 'einzelperson';
            SET v_mitgliedsnummer = CONCAT('TDA-E-', LPAD(v_einzel_counter, 4, '0'));
            SET v_einzel_counter = v_einzel_counter + 1;
            SET v_jahresbeitrag = 49.00;
        END IF;

        -- Random status (70% aktiv, 15% ausstehend, 10% abgelaufen, 5% gekuendigt)
        SET @status_rand = RAND();
        IF @status_rand < 0.70 THEN
            SET v_status = 'aktiv';
        ELSEIF @status_rand < 0.85 THEN
            SET v_status = 'ausstehend';
        ELSEIF @status_rand < 0.95 THEN
            SET v_status = 'abgelaufen';
        ELSE
            SET v_status = 'gekuendigt';
        END IF;

        -- Random dates (last 3 years)
        SET v_gueltig_von = DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 1095) DAY);
        SET v_gueltig_bis = DATE_ADD(v_gueltig_von, INTERVAL 1 YEAR);

        -- Random payment method
        SET @zahl_rand = RAND();
        IF @zahl_rand < 0.5 THEN
            SET v_zahlungsart = 'lastschrift';
        ELSEIF @zahl_rand < 0.75 THEN
            SET v_zahlungsart = 'rechnung';
        ELSEIF @zahl_rand < 0.9 THEN
            SET v_zahlungsart = 'ueberweisung';
        ELSE
            SET v_zahlungsart = 'paypal';
        END IF;

        -- Random indices for data selection
        SET @vorname_idx = 1 + FLOOR(RAND() * 40);
        SET @nachname_idx = 1 + FLOOR(RAND() * 30);
        SET @dojo_idx = 1 + FLOOR(RAND() * 30);
        SET @stadt_idx = 1 + FLOOR(RAND() * 30);
        SET @strasse_idx = 1 + FLOOR(RAND() * 15);

        IF v_typ = 'dojo' THEN
            -- Insert Dojo membership
            INSERT INTO verbandsmitgliedschaften (
                typ, mitgliedsnummer, jahresbeitrag, status, zahlungsart,
                gueltig_von, gueltig_bis,
                dojo_name, dojo_inhaber, dojo_strasse, dojo_plz, dojo_ort, dojo_land,
                dojo_email, dojo_telefon, dojo_mitglieder_anzahl,
                kommunikation_email, newsletter,
                agb_akzeptiert, agb_akzeptiert_am,
                dsgvo_akzeptiert, dsgvo_akzeptiert_am,
                widerrufsrecht_akzeptiert, widerrufsrecht_akzeptiert_am,
                created_at
            ) VALUES (
                v_typ, v_mitgliedsnummer, v_jahresbeitrag, v_status, v_zahlungsart,
                v_gueltig_von, v_gueltig_bis,
                CONCAT(
                    SUBSTRING_INDEX(SUBSTRING_INDEX(@dojo_namen, ',', @dojo_idx), ',', -1),
                    ' ',
                    SUBSTRING_INDEX(SUBSTRING_INDEX(@staedte, ',', @stadt_idx), ',', -1)
                ),
                CONCAT(
                    SUBSTRING_INDEX(SUBSTRING_INDEX(@vornamen, ',', @vorname_idx), ',', -1),
                    ' ',
                    SUBSTRING_INDEX(SUBSTRING_INDEX(@nachnamen, ',', @nachname_idx), ',', -1)
                ),
                CONCAT(
                    SUBSTRING_INDEX(SUBSTRING_INDEX(@strassen, ',', @strasse_idx), ',', -1),
                    ' ',
                    FLOOR(1 + RAND() * 100)
                ),
                SUBSTRING_INDEX(SUBSTRING_INDEX(@plz_liste, ',', @stadt_idx), ',', -1),
                SUBSTRING_INDEX(SUBSTRING_INDEX(@staedte, ',', @stadt_idx), ',', -1),
                'Deutschland',
                CONCAT('info@', LOWER(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(@dojo_namen, ',', @dojo_idx), ',', -1), ' ', '-')), '-', LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(@staedte, ',', @stadt_idx), ',', -1)), '.de'),
                CONCAT('0', FLOOR(100 + RAND() * 900), ' ', FLOOR(1000000 + RAND() * 9000000)),
                FLOOR(20 + RAND() * 200),
                1, IF(RAND() < 0.6, 1, 0),
                1, v_gueltig_von,
                1, v_gueltig_von,
                1, v_gueltig_von,
                DATE_SUB(v_gueltig_von, INTERVAL FLOOR(RAND() * 7) DAY)
            );
        ELSE
            -- Insert Einzelperson membership
            INSERT INTO verbandsmitgliedschaften (
                typ, mitgliedsnummer, jahresbeitrag, status, zahlungsart,
                gueltig_von, gueltig_bis,
                person_vorname, person_nachname, person_email, person_telefon,
                person_strasse, person_plz, person_ort, person_land,
                person_geburtsdatum,
                kommunikation_email, newsletter,
                agb_akzeptiert, agb_akzeptiert_am,
                dsgvo_akzeptiert, dsgvo_akzeptiert_am,
                widerrufsrecht_akzeptiert, widerrufsrecht_akzeptiert_am,
                created_at
            ) VALUES (
                v_typ, v_mitgliedsnummer, v_jahresbeitrag, v_status, v_zahlungsart,
                v_gueltig_von, v_gueltig_bis,
                SUBSTRING_INDEX(SUBSTRING_INDEX(@vornamen, ',', @vorname_idx), ',', -1),
                SUBSTRING_INDEX(SUBSTRING_INDEX(@nachnamen, ',', @nachname_idx), ',', -1),
                CONCAT(
                    LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(@vornamen, ',', @vorname_idx), ',', -1)),
                    '.',
                    LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(@nachnamen, ',', @nachname_idx), ',', -1)),
                    i,
                    '@test.de'
                ),
                CONCAT('0', FLOOR(150 + RAND() * 30), ' ', FLOOR(10000000 + RAND() * 90000000)),
                CONCAT(
                    SUBSTRING_INDEX(SUBSTRING_INDEX(@strassen, ',', @strasse_idx), ',', -1),
                    ' ',
                    FLOOR(1 + RAND() * 150)
                ),
                SUBSTRING_INDEX(SUBSTRING_INDEX(@plz_liste, ',', @stadt_idx), ',', -1),
                SUBSTRING_INDEX(SUBSTRING_INDEX(@staedte, ',', @stadt_idx), ',', -1),
                'Deutschland',
                DATE_SUB(CURDATE(), INTERVAL (18 + FLOOR(RAND() * 50)) YEAR),
                1, IF(RAND() < 0.5, 1, 0),
                1, v_gueltig_von,
                1, v_gueltig_von,
                1, v_gueltig_von,
                DATE_SUB(v_gueltig_von, INTERVAL FLOOR(RAND() * 7) DAY)
            );
        END IF;

        SET i = i + 1;
    END WHILE;

    -- Update sequence counters
    UPDATE verband_nummern_sequenz SET aktuelle_nummer = v_dojo_counter WHERE typ = 'dojo';
    UPDATE verband_nummern_sequenz SET aktuelle_nummer = v_einzel_counter WHERE typ = 'einzelperson';

END//

DELIMITER ;

-- Execute procedure
CALL insert_test_verbandsmitgliedschaften();

-- Cleanup
DROP PROCEDURE IF EXISTS insert_test_verbandsmitgliedschaften;

-- Now add Zahlungen for aktive memberships
INSERT INTO verbandsmitgliedschaft_zahlungen (
    verbandsmitgliedschaft_id, rechnungsnummer, rechnungsdatum, faellig_am,
    betrag_netto, mwst_satz, mwst_betrag, betrag_brutto,
    zeitraum_von, zeitraum_bis, status, bezahlt_am, zahlungsart
)
SELECT
    id,
    CONCAT('VR-2026-', LPAD(id, 5, '0')),
    gueltig_von,
    DATE_ADD(gueltig_von, INTERVAL 14 DAY),
    ROUND(jahresbeitrag / 1.19, 2),
    19.00,
    ROUND(jahresbeitrag - (jahresbeitrag / 1.19), 2),
    jahresbeitrag,
    gueltig_von,
    gueltig_bis,
    'bezahlt',
    DATE_ADD(gueltig_von, INTERVAL FLOOR(RAND() * 14) DAY),
    zahlungsart
FROM verbandsmitgliedschaften
WHERE status = 'aktiv' AND id > 2;

-- Show results
SELECT 'Ergebnis:' as Info, '' as Wert
UNION ALL
SELECT 'Gesamt Verbandsmitgliedschaften:', COUNT(*) FROM verbandsmitgliedschaften
UNION ALL
SELECT '  - Dojo-Mitgliedschaften:', COUNT(*) FROM verbandsmitgliedschaften WHERE typ = 'dojo'
UNION ALL
SELECT '  - Einzelmitgliedschaften:', COUNT(*) FROM verbandsmitgliedschaften WHERE typ = 'einzelperson'
UNION ALL
SELECT '', ''
UNION ALL
SELECT 'Status-Verteilung:', ''
UNION ALL
SELECT CONCAT('  - ', status, ':'), COUNT(*) FROM verbandsmitgliedschaften GROUP BY status;

-- Status breakdown
SELECT status, COUNT(*) as Anzahl FROM verbandsmitgliedschaften GROUP BY status;
