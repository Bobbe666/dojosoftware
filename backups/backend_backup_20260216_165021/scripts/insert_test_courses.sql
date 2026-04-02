-- Insert Courses and Stundenplan entries for Monday-Sunday, 7:00-22:00
-- Generated for local testing purposes

-- First, let's add some trainers if needed
INSERT IGNORE INTO trainer (vorname, nachname, email, telefon, stil, dojo_id) VALUES
('Thomas', 'Mueller', 'thomas.mueller@dojo.de', '0170 1234567', 'Karate', 1),
('Sandra', 'Schmidt', 'sandra.schmidt@dojo.de', '0171 2345678', 'Kickboxen', 1),
('Michael', 'Weber', 'michael.weber@dojo.de', '0172 3456789', 'ShieldX', 1),
('Lisa', 'Hoffmann', 'lisa.hoffmann@dojo.de', '0173 4567890', 'BJJ', 1),
('Peter', 'Becker', 'peter.becker@dojo.de', '0174 5678901', 'Karate', 1),
('Anna', 'Fischer', 'anna.fischer@dojo.de', '0175 6789012', 'Kickboxen', 1);

-- Get trainer IDs
SET @trainer1 = (SELECT trainer_id FROM trainer WHERE vorname = 'Thomas' LIMIT 1);
SET @trainer2 = (SELECT trainer_id FROM trainer WHERE vorname = 'Sandra' LIMIT 1);
SET @trainer3 = (SELECT trainer_id FROM trainer WHERE vorname = 'Michael' LIMIT 1);
SET @trainer4 = (SELECT trainer_id FROM trainer WHERE vorname = 'Lisa' LIMIT 1);
SET @trainer5 = (SELECT trainer_id FROM trainer WHERE vorname = 'Peter' LIMIT 1);
SET @trainer6 = (SELECT trainer_id FROM trainer WHERE vorname = 'Anna' LIMIT 1);

-- Create courses for different styles and times
-- Each course is 1 hour

-- Morning courses (7:00 - 12:00)
INSERT INTO kurse (gruppenname, stil, trainer_id, beginn, ende, dojo_id, probetraining_erlaubt) VALUES
('Frueh-Karate Anfaenger', 'Enso Karate', @trainer1, '07:00:00', '08:00:00', 1, 1),
('Frueh-Karate Fortgeschritten', 'Enso Karate', @trainer5, '08:00:00', '09:00:00', 1, 1),
('Morning ShieldX', 'ShieldX', @trainer3, '07:00:00', '08:00:00', 1, 1),
('Kickboxen Morgen', 'Kickboxen', @trainer2, '08:00:00', '09:00:00', 1, 1),
('BJJ Fundamentals AM', 'Brazilian Jiu Jitsu', @trainer4, '09:00:00', '10:00:00', 1, 1),
('Karate Kids Morgen', 'Enso Karate', @trainer1, '10:00:00', '11:00:00', 1, 1),
('Selbstverteidigung Morgen', 'ShieldX', @trainer3, '11:00:00', '12:00:00', 1, 1);

-- Afternoon courses (12:00 - 17:00)
INSERT INTO kurse (gruppenname, stil, trainer_id, beginn, ende, dojo_id, probetraining_erlaubt) VALUES
('Mittagstraining Karate', 'Enso Karate', @trainer5, '12:00:00', '13:00:00', 1, 1),
('Power Kickboxen', 'Kickboxen', @trainer6, '13:00:00', '14:00:00', 1, 1),
('BJJ No-Gi', 'Brazilian Jiu Jitsu', @trainer4, '14:00:00', '15:00:00', 1, 1),
('Kinder Karate I', 'Enso Karate', @trainer1, '15:00:00', '16:00:00', 1, 1),
('Kinder Karate II', 'Enso Karate', @trainer5, '16:00:00', '17:00:00', 1, 1),
('Jugend Kickboxen', 'Kickboxen', @trainer2, '15:00:00', '16:00:00', 1, 1),
('ShieldX Teens', 'ShieldX', @trainer3, '16:00:00', '17:00:00', 1, 1);

-- Evening courses (17:00 - 22:00)
INSERT INTO kurse (gruppenname, stil, trainer_id, beginn, ende, dojo_id, probetraining_erlaubt) VALUES
('Karate Erwachsene I', 'Enso Karate', @trainer1, '17:00:00', '18:00:00', 1, 1),
('Karate Erwachsene II', 'Enso Karate', @trainer5, '18:00:00', '19:00:00', 1, 1),
('Kickboxen Abend', 'Kickboxen', @trainer2, '17:00:00', '18:00:00', 1, 1),
('Kickboxen Intensiv', 'Kickboxen', @trainer6, '18:00:00', '19:00:00', 1, 1),
('Kickboxen Fortgeschritten', 'Kickboxen', @trainer2, '19:00:00', '20:00:00', 1, 1),
('ShieldX Abend', 'ShieldX', @trainer3, '17:00:00', '18:00:00', 1, 1),
('ShieldX Intensiv', 'ShieldX', @trainer3, '19:00:00', '20:00:00', 1, 1),
('BJJ Gi-Training', 'Brazilian Jiu Jitsu', @trainer4, '18:00:00', '19:00:00', 1, 1),
('BJJ Competition', 'Brazilian Jiu Jitsu', @trainer4, '19:00:00', '20:00:00', 1, 1),
('Karate Schwarzgurt', 'Enso Karate', @trainer1, '20:00:00', '21:00:00', 1, 1),
('Open Mat BJJ', 'Brazilian Jiu Jitsu', @trainer4, '20:00:00', '21:00:00', 1, 1),
('Spaettraining Kickboxen', 'Kickboxen', @trainer6, '21:00:00', '22:00:00', 1, 1),
('Spaettraining ShieldX', 'ShieldX', @trainer3, '21:00:00', '22:00:00', 1, 1);

-- Now create the stundenplan (schedule) entries
-- Days: Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag, Sonntag

-- Delete existing stundenplan entries to avoid duplicates
DELETE FROM stundenplan WHERE kurs_id IN (SELECT kurs_id FROM kurse WHERE dojo_id = 1);

-- Insert stundenplan for each day
-- We'll create a comprehensive schedule

DELIMITER //

DROP PROCEDURE IF EXISTS create_stundenplan//

CREATE PROCEDURE create_stundenplan()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_kurs_id INT;
    DECLARE v_beginn TIME;
    DECLARE v_ende TIME;
    DECLARE v_trainer_id INT;

    -- Cursor for all courses
    DECLARE cur CURSOR FOR SELECT kurs_id, beginn, ende, trainer_id FROM kurse WHERE dojo_id = 1;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Array of days
    SET @tage = 'Montag,Dienstag,Mittwoch,Donnerstag,Freitag,Samstag,Sonntag';

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_kurs_id, v_beginn, v_ende, v_trainer_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        -- Insert for each weekday based on course type
        -- Morning courses: all days
        -- Kids courses: Mon-Fri
        -- Adult evening: Mon-Thu + Sat
        -- Weekend specials: Sat + Sun

        -- For simplicity, we'll assign courses to specific days based on a pattern

        -- Morning courses (before 12:00) - Mon, Wed, Fri, Sat
        IF v_beginn < '12:00:00' THEN
            INSERT INTO stundenplan (tag, uhrzeit_start, uhrzeit_ende, kurs_id, trainer_id) VALUES
            ('Montag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Mittwoch', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Freitag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Samstag', v_beginn, v_ende, v_kurs_id, v_trainer_id);

        -- Afternoon courses (12:00-17:00) - varies
        ELSEIF v_beginn >= '12:00:00' AND v_beginn < '17:00:00' THEN
            INSERT INTO stundenplan (tag, uhrzeit_start, uhrzeit_ende, kurs_id, trainer_id) VALUES
            ('Montag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Dienstag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Mittwoch', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Donnerstag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Freitag', v_beginn, v_ende, v_kurs_id, v_trainer_id);

        -- Evening courses (17:00+) - Mon-Thu + Sat
        ELSE
            INSERT INTO stundenplan (tag, uhrzeit_start, uhrzeit_ende, kurs_id, trainer_id) VALUES
            ('Montag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Dienstag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Mittwoch', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Donnerstag', v_beginn, v_ende, v_kurs_id, v_trainer_id),
            ('Samstag', v_beginn, v_ende, v_kurs_id, v_trainer_id);
        END IF;

    END LOOP;

    CLOSE cur;

    -- Add special Sunday courses
    INSERT INTO stundenplan (tag, uhrzeit_start, uhrzeit_ende, kurs_id, trainer_id)
    SELECT 'Sonntag', beginn, ende, kurs_id, trainer_id
    FROM kurse
    WHERE gruppenname LIKE '%Open Mat%'
       OR gruppenname LIKE '%Frueh%'
       OR gruppenname LIKE '%Morning%'
       OR beginn >= '09:00:00' AND beginn <= '14:00:00';

END//

DELIMITER ;

-- Execute procedure
CALL create_stundenplan();

-- Cleanup
DROP PROCEDURE IF EXISTS create_stundenplan;

-- Show results
SELECT 'Kurse erstellt:' as Info, COUNT(*) as Anzahl FROM kurse WHERE dojo_id = 1
UNION ALL
SELECT 'Stundenplan-Eintraege:', COUNT(*) FROM stundenplan;

-- Show schedule overview
SELECT tag, COUNT(*) as Kurse_pro_Tag FROM stundenplan GROUP BY tag ORDER BY FIELD(tag, 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag');
