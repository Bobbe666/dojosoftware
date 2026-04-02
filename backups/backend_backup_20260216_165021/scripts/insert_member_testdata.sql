-- =============================================
-- TESTDATEN FÜR MEMBER DASHBOARD
-- =============================================
-- Dieses Script fügt Anwesenheits- und Vertragsdaten für Tom ein
-- So dass das Member Dashboard echte Statistiken anzeigt

-- 1. Tom Tester - Mitglied-ID = 3
SET @tom_id = 3;
SET @dojo_id = (SELECT dojo_id FROM mitglieder WHERE mitglied_id = @tom_id);

SELECT CONCAT('Tom Tester Mitglied-ID: ', @tom_id, ', Dojo-ID: ', IFNULL(@dojo_id, 'NICHT GEFUNDEN')) AS Info;

-- 2. ANWESENHEITSDATEN EINFÜGEN
-- Erstelle Anwesenheitsdaten für die letzten 60 Tage
-- Ca. 3x pro Woche = ca. 25 Einträge in 60 Tagen

INSERT INTO anwesenheit (mitglied_id, datum, anwesend, dojo_id, erstellt_am)
SELECT
    @tom_id,
    DATE_SUB(CURDATE(), INTERVAL n DAY) as datum,
    1 as anwesend,
    @dojo_id,
    NOW()
FROM (
    -- Montag, Mittwoch, Freitag der letzten 8 Wochen
    SELECT 0 as n UNION SELECT 2 UNION SELECT 4 UNION  -- Woche 1
    SELECT 7 UNION SELECT 9 UNION SELECT 11 UNION -- Woche 2
    SELECT 14 UNION SELECT 16 UNION SELECT 18 UNION -- Woche 3
    SELECT 21 UNION SELECT 23 UNION SELECT 25 UNION -- Woche 4
    SELECT 28 UNION SELECT 30 UNION SELECT 32 UNION -- Woche 5
    SELECT 35 UNION SELECT 37 UNION SELECT 39 UNION -- Woche 6
    SELECT 42 UNION SELECT 44 UNION SELECT 46 UNION -- Woche 7
    SELECT 49 UNION SELECT 51 UNION SELECT 53 UNION -- Woche 8
    SELECT 56 UNION SELECT 58 -- Woche 9
) days
WHERE @tom_id IS NOT NULL
ON DUPLICATE KEY UPDATE anwesend = 1;

SELECT CONCAT('✅ ', ROW_COUNT(), ' Anwesenheitseinträge erstellt') AS Status;

-- 3. VERTRAG FÜR TOM ERSTELLEN (falls nicht vorhanden)
-- Erst prüfen, ob bereits ein Vertrag existiert
SET @existing_vertrag = (SELECT COUNT(*) FROM vertraege WHERE mitglied_id = @tom_id);

INSERT INTO vertraege (
    mitglied_id,
    tarif_id,
    start_datum,
    ende_datum,
    status,
    zahlungsart,
    monatlicher_betrag,
    naechste_zahlung,
    erstellt_am,
    dojo_id
)
SELECT
    @tom_id,
    (SELECT tarif_id FROM tarife WHERE dojo_id = @dojo_id LIMIT 1) as tarif_id,
    DATE_SUB(CURDATE(), INTERVAL 6 MONTH) as start_datum,
    NULL as ende_datum,
    'aktiv' as status,
    'lastschrift' as zahlungsart,
    59.90 as monatlicher_betrag,
    DATE_ADD(CURDATE(), INTERVAL 1 MONTH) as naechste_zahlung,
    NOW() as erstellt_am,
    @dojo_id
FROM DUAL
WHERE @tom_id IS NOT NULL
  AND @existing_vertrag = 0
LIMIT 1;

SELECT CONCAT('✅ Vertrag erstellt (oder existiert bereits): ',
              IF(@existing_vertrag > 0, 'bereits vorhanden', 'neu erstellt')) AS Status;

-- 4. ÜBERSICHT DER ERSTELLTEN DATEN
SELECT
    '=== ÜBERSICHT TESTDATEN ===' as Info;

SELECT
    CONCAT('Mitglied: ', m.vorname, ' ', m.nachname, ' (ID: ', m.mitglied_id, ')') as Mitglied,
    CONCAT('Anwesenheiten: ', COUNT(a.id)) as Anwesenheiten,
    CONCAT('Zeitraum: ', MIN(a.datum), ' bis ', MAX(a.datum)) as Zeitraum
FROM mitglieder m
LEFT JOIN anwesenheit a ON m.mitglied_id = a.mitglied_id
WHERE m.mitglied_id = @tom_id
GROUP BY m.mitglied_id, m.vorname, m.nachname;

SELECT
    CONCAT('Vertrag-ID: ', v.vertrag_id) as Vertrag,
    CONCAT('Status: ', v.status) as Status,
    CONCAT('Betrag: ', v.monatlicher_betrag, ' €') as Betrag,
    CONCAT('Seit: ', v.start_datum) as Seit,
    CONCAT('Nächste Zahlung: ', v.naechste_zahlung) as NaechsteZahlung
FROM vertraege v
WHERE v.mitglied_id = @tom_id;

SELECT '✅ TESTDATEN ERFOLGREICH EINGEFÜGT!' as Ergebnis;
