-- Insert 400 Test Members into dojo_test database
-- Generated for local testing purposes

SET @vornamen = 'Max,Felix,Leon,Paul,Lukas,Jonas,Tim,David,Finn,Luca,Ben,Elias,Moritz,Jan,Tom,Noah,Luis,Niklas,Julian,Simon,Fabian,Philipp,Alexander,Maximilian,Sebastian,Michael,Daniel,Andreas,Thomas,Christian,Stefan,Markus,Martin,Peter,Marco,Kevin,Marcel,Patrick,Dennis,Dominik,Florian,Tobias,Benjamin,Manuel,Christopher,Oliver,Mario,Sascha,Robert,Johannes,Anna,Julia,Laura,Sarah,Lisa,Lena,Marie,Sophie,Leonie,Emily,Hannah,Mia,Emma,Sophia,Lea,Johanna,Paula,Clara,Nele,Amelie,Luisa,Nina,Katharina,Christina,Sandra,Melanie,Sabrina,Jennifer,Jessica,Michelle,Nicole,Vanessa,Stefanie,Claudia,Martina,Monika,Petra,Andrea,Susanne,Birgit,Karin,Maria,Eva,Elisabeth,Barbara,Christine,Brigitte,Renate';

SET @nachnamen = 'Mueller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker,Schulz,Hoffmann,Koch,Richter,Bauer,Klein,Wolf,Schroeder,Neumann,Schwarz,Zimmermann,Braun,Krueger,Hofmann,Hartmann,Lange,Schmitt,Werner,Schmitz,Krause,Meier,Lehmann,Schmid,Schulze,Maier,Koehler,Herrmann,Koenig,Walter,Mayer,Huber,Kaiser,Fuchs,Peters,Lang,Scholz,Moeller,Weiss,Jung,Hahn,Schubert,Vogel,Friedrich,Keller,Guenther,Frank,Berger,Winkler,Roth,Beck,Lorenz,Baumann,Franke,Albrecht,Schuster,Simon,Ludwig,Boehm,Winter,Kraus,Martin,Schumacher,Kraemer,Vogt,Stein,Jansen,Otto,Sommer,Gross,Seidel,Heinrich,Brandt,Haas,Schreiber,Graf,Schulte,Dietrich,Ziegler,Kuhn,Kuehn,Pohl,Engel,Horn,Busch,Bergmann,Thomas,Voigt,Sauer,Arnold,Wolff,Pfeiffer';

-- German streets
SET @strassen = 'Hauptstrasse,Schulstrasse,Gartenstrasse,Bahnhofstrasse,Dorfstrasse,Bergstrasse,Kirchstrasse,Waldstrasse,Wiesenstrasse,Muehlenweg,Lindenstrasse,Rosenweg,Am Markt,Friedhofstrasse,Birkenweg,Eichenweg,Feldstrasse,Jaegerstrasse,Ringstrasse,Schlossstrasse,Parkstrasse,Industriestrasse,Am Bach,Sonnenweg,Blumenstrasse,Ahornweg,Buchenweg,Tannenweg,Fichtenweg,Ulmenstrasse';

-- German cities
SET @staedte = 'Berlin,Hamburg,Muenchen,Koeln,Frankfurt,Stuttgart,Duesseldorf,Dortmund,Essen,Leipzig,Bremen,Dresden,Hannover,Nuernberg,Duisburg,Bochum,Wuppertal,Bielefeld,Bonn,Muenster,Karlsruhe,Mannheim,Augsburg,Wiesbaden,Gelsenkirchen,Moenchengladbach,Braunschweig,Chemnitz,Kiel,Aachen';

-- Active styles: 2 (ShieldX), 4 (Kickboxen), 5 (Enso Karate), 20 (BJJ)
SET @aktive_stile = '2,4,5,20';

DELIMITER //

DROP PROCEDURE IF EXISTS insert_test_members//

CREATE PROCEDURE insert_test_members()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE v_vorname VARCHAR(50);
    DECLARE v_nachname VARCHAR(50);
    DECLARE v_email VARCHAR(100);
    DECLARE v_telefon VARCHAR(25);
    DECLARE v_strasse VARCHAR(100);
    DECLARE v_hausnummer VARCHAR(10);
    DECLARE v_plz VARCHAR(10);
    DECLARE v_ort VARCHAR(50);
    DECLARE v_geburtsdatum DATE;
    DECLARE v_geschlecht ENUM('m','w','d');
    DECLARE v_stil_id INT;
    DECLARE v_graduierung_id INT;
    DECLARE v_eintrittsdatum DATE;
    DECLARE v_gurtfarbe VARCHAR(30);

    -- Arrays for random selection
    SET @vornamen_arr = 'Max,Felix,Leon,Paul,Lukas,Jonas,Tim,David,Finn,Luca,Ben,Elias,Moritz,Jan,Tom,Noah,Luis,Niklas,Julian,Simon,Fabian,Philipp,Alexander,Maximilian,Sebastian,Michael,Daniel,Andreas,Thomas,Christian,Stefan,Markus,Martin,Peter,Marco,Kevin,Marcel,Patrick,Dennis,Dominik,Florian,Tobias,Benjamin,Manuel,Christopher,Oliver,Mario,Sascha,Robert,Johannes,Anna,Julia,Laura,Sarah,Lisa,Lena,Marie,Sophie,Leonie,Emily,Hannah,Mia,Emma,Sophia,Lea,Johanna,Paula,Clara,Nele,Amelie,Luisa,Nina,Katharina,Christina,Sandra,Melanie,Sabrina,Jennifer,Jessica,Michelle,Nicole,Vanessa,Stefanie,Claudia,Martina,Monika,Petra,Andrea,Susanne,Birgit,Karin,Maria,Eva,Elisabeth,Barbara,Christine,Brigitte,Renate';
    SET @nachnamen_arr = 'Mueller,Schmidt,Schneider,Fischer,Weber,Meyer,Wagner,Becker,Schulz,Hoffmann,Koch,Richter,Bauer,Klein,Wolf,Schroeder,Neumann,Schwarz,Zimmermann,Braun,Krueger,Hofmann,Hartmann,Lange,Schmitt,Werner,Schmitz,Krause,Meier,Lehmann,Schmid,Schulze,Maier,Koehler,Herrmann,Koenig,Walter,Mayer,Huber,Kaiser,Fuchs,Peters,Lang,Scholz,Moeller,Weiss,Jung,Hahn,Schubert,Vogel,Friedrich,Keller,Guenther,Frank,Berger,Winkler,Roth,Beck,Lorenz,Baumann,Franke,Albrecht,Schuster,Simon,Ludwig,Boehm,Winter,Kraus,Martin,Schumacher,Kraemer,Vogt,Stein,Jansen,Otto,Sommer,Gross,Seidel,Heinrich,Brandt,Haas,Schreiber,Graf,Schulte,Dietrich,Ziegler,Kuhn,Kuehn,Pohl,Engel,Horn,Busch,Bergmann,Thomas,Voigt,Sauer,Arnold,Wolff,Pfeiffer';
    SET @strassen_arr = 'Hauptstrasse,Schulstrasse,Gartenstrasse,Bahnhofstrasse,Dorfstrasse,Bergstrasse,Kirchstrasse,Waldstrasse,Wiesenstrasse,Muehlenweg,Lindenstrasse,Rosenweg,Am Markt,Friedhofstrasse,Birkenweg,Eichenweg,Feldstrasse,Jaegerstrasse,Ringstrasse,Schlossstrasse,Parkstrasse,Industriestrasse,Am Bach,Sonnenweg,Blumenstrasse,Ahornweg,Buchenweg,Tannenweg,Fichtenweg,Ulmenstrasse';
    SET @staedte_arr = 'Berlin,Hamburg,Muenchen,Koeln,Frankfurt,Stuttgart,Duesseldorf,Dortmund,Essen,Leipzig,Bremen,Dresden,Hannover,Nuernberg,Duisburg,Bochum,Wuppertal,Bielefeld,Bonn,Muenster,Karlsruhe,Mannheim,Augsburg,Wiesbaden,Gelsenkirchen,Moenchengladbach,Braunschweig,Chemnitz,Kiel,Aachen';
    SET @plz_arr = '10115,20095,80331,50667,60311,70173,40213,44135,45127,04109,28195,01067,30159,90402,47051,44787,42103,33602,53111,48143,76131,68161,86150,65183,45879,41061,38100,09111,24103,52062';
    SET @gurtfarben = 'Weiss,Gelb,Orange,Gruen,Blau,Braun,Schwarz';

    WHILE i <= 400 DO
        -- Random vorname (1-100)
        SET v_vorname = SUBSTRING_INDEX(SUBSTRING_INDEX(@vornamen_arr, ',', 1 + FLOOR(RAND() * 100)), ',', -1);

        -- Random nachname (1-100)
        SET v_nachname = SUBSTRING_INDEX(SUBSTRING_INDEX(@nachnamen_arr, ',', 1 + FLOOR(RAND() * 100)), ',', -1);

        -- Generate email
        SET v_email = CONCAT(LOWER(v_vorname), '.', LOWER(v_nachname), i, '@test.de');

        -- Random telefon
        SET v_telefon = CONCAT('0', FLOOR(100 + RAND() * 900), ' ', FLOOR(1000000 + RAND() * 9000000));

        -- Random strasse
        SET v_strasse = SUBSTRING_INDEX(SUBSTRING_INDEX(@strassen_arr, ',', 1 + FLOOR(RAND() * 30)), ',', -1);

        -- Random hausnummer
        SET v_hausnummer = FLOOR(1 + RAND() * 150);

        -- Random PLZ and Stadt (matching)
        SET @stadt_index = 1 + FLOOR(RAND() * 30);
        SET v_plz = SUBSTRING_INDEX(SUBSTRING_INDEX(@plz_arr, ',', @stadt_index), ',', -1);
        SET v_ort = SUBSTRING_INDEX(SUBSTRING_INDEX(@staedte_arr, ',', @stadt_index), ',', -1);

        -- Random Geburtsdatum (age 5-65)
        SET v_geburtsdatum = DATE_SUB(CURDATE(), INTERVAL (5 + FLOOR(RAND() * 60)) YEAR);
        SET v_geburtsdatum = DATE_SUB(v_geburtsdatum, INTERVAL FLOOR(RAND() * 365) DAY);

        -- Random Geschlecht (based on vorname position - first 60 are male)
        SET v_geschlecht = IF(RAND() < 0.5, 'm', 'w');

        -- Random active style (2, 4, 5, or 20)
        SET @stil_rand = FLOOR(RAND() * 4);
        SET v_stil_id = CASE @stil_rand
            WHEN 0 THEN 2  -- ShieldX
            WHEN 1 THEN 4  -- Kickboxen
            WHEN 2 THEN 5  -- Enso Karate
            ELSE 20        -- BJJ
        END;

        -- Random Gurtfarbe
        SET @gurt_rand = FLOOR(RAND() * 7);
        SET v_gurtfarbe = CASE @gurt_rand
            WHEN 0 THEN 'Weiss'
            WHEN 1 THEN 'Gelb'
            WHEN 2 THEN 'Orange'
            WHEN 3 THEN 'Gruen'
            WHEN 4 THEN 'Blau'
            WHEN 5 THEN 'Braun'
            ELSE 'Schwarz'
        END;

        -- Random Eintrittsdatum (last 5 years)
        SET v_eintrittsdatum = DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 1825) DAY);

        -- Insert member
        INSERT INTO mitglieder (
            vorname, nachname, email, telefon, telefon_mobil,
            strasse, hausnummer, plz, ort, land,
            geburtsdatum, geschlecht, stil_id, gurtfarbe,
            eintrittsdatum, aktiv, dojo_id,
            zahlungsmethode, newsletter_abo, foto_einverstaendnis,
            hausordnung_akzeptiert, datenschutz_akzeptiert,
            trainingsstunden
        ) VALUES (
            v_vorname, v_nachname, v_email, v_telefon, v_telefon,
            v_strasse, v_hausnummer, v_plz, v_ort, 'Deutschland',
            v_geburtsdatum, v_geschlecht, v_stil_id, v_gurtfarbe,
            v_eintrittsdatum, IF(RAND() < 0.9, 1, 0), 1,
            ELT(1 + FLOOR(RAND() * 3), 'Lastschrift', 'Bar', 'Überweisung'),
            IF(RAND() < 0.7, 1, 0),
            IF(RAND() < 0.8, 1, 0),
            1, 1,
            FLOOR(RAND() * 500)
        );

        SET i = i + 1;
    END WHILE;
END//

DELIMITER ;

-- Execute procedure
CALL insert_test_members();

-- Cleanup
DROP PROCEDURE IF EXISTS insert_test_members;

-- Show result
SELECT COUNT(*) as 'Neue Mitglieder eingefuegt' FROM mitglieder;
