SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS exercise_subcategories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dojo_id     INT UNSIGNED NULL DEFAULT NULL,
  name        VARCHAR(100) NOT NULL,
  category    ENUM('kampfsport','fitness','core','ausdauer') NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dojo_cat (dojo_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE exercise_catalog
  ADD COLUMN IF NOT EXISTS subcategory_id INT UNSIGNED NULL DEFAULT NULL AFTER category;

-- Seed global subcategories
INSERT INTO exercise_subcategories (dojo_id, name, category, sort_order) VALUES
(NULL, 'Fausttechniken',        'kampfsport', 1),
(NULL, 'Fußtechniken',          'kampfsport', 2),
(NULL, 'Knie & Ellbogen',       'kampfsport', 3),
(NULL, 'Kombinationen',         'kampfsport', 4),
(NULL, 'Defensiv & Footwork',   'kampfsport', 5),
(NULL, 'Partnerarbeit',         'kampfsport', 6),
(NULL, 'Drücken',               'fitness', 1),
(NULL, 'Ziehen',                'fitness', 2),
(NULL, 'Beine',                 'fitness', 3),
(NULL, 'Ganzkörper',            'fitness', 4),
(NULL, 'Statisch',              'core', 1),
(NULL, 'Dynamisch',             'core', 2),
(NULL, 'Rotation',              'core', 3),
(NULL, 'Hänge & Fortgeschritten', 'core', 4),
(NULL, 'Stabilität',            'core', 5),
(NULL, 'Sprint & Lauf',         'ausdauer', 1),
(NULL, 'Seilspringen',          'ausdauer', 2),
(NULL, 'Sprünge',               'ausdauer', 3),
(NULL, 'Koordination',          'ausdauer', 4),
(NULL, 'Ergometer',             'ausdauer', 5),
(NULL, 'Speed & Kondition',     'ausdauer', 6);

-- Assign subcategories using name-based subqueries
-- Fausttechniken
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Fausttechniken' AND es.category = 'kampfsport' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Jab','Cross','Hook','Uppercut','Jab-Cross','Jab-Cross-Hook','Jab-Cross-Hook-Uppercut');

-- Fußtechniken
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Fußtechniken' AND es.category = 'kampfsport' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Roundkick Tief','Roundkick Mittel','Roundkick High','Frontkick','Sidekick','Backkick','Spinning Back Kick','Jumping Roundkick','Doppel-Kick');

-- Knie & Ellbogen
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Knie & Ellbogen' AND es.category = 'kampfsport' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Kniestöße','Ellbogenstoß','Clinch-Knie');

-- Kombinationen
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Kombinationen' AND es.category = 'kampfsport' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Körperkick-Kombination','Kombination 3er','Kombination 5er');

-- Defensiv & Footwork
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Defensiv & Footwork' AND es.category = 'kampfsport' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Bob & Weave','Footwork Defensiv','Slip & Konter','Tigersprung');

-- Partnerarbeit
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Partnerarbeit' AND es.category = 'kampfsport' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Shadowboxing','Sandsack-Kombination','Pratzenarbeit','Clinch-Arbeit');

-- Drücken
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Drücken' AND es.category = 'fitness' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Liegestütze','Dips','Overhead Press','Push Press','Arnold Press','Pike Push-Up','Bankdrücken');

-- Ziehen
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Ziehen' AND es.category = 'fitness' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Klimmzüge','Klimmzüge eng','Kurzhantelrudern');

-- Beine
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Beine' AND es.category = 'fitness' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Kniebeugen','Ausfallschritte','Romanian Deadlift','Hip Thrust','Goblet Squat','Sumo Squat','Romanian Split Squat','Seitliche Ausfallschritte','Langhantel-Squat','Kreuzheben');

-- Ganzkörper
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Ganzkörper' AND es.category = 'fitness' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Burpees','Turkish Get-Up','Thrusters','Bear Crawl','Wall Balls','Farmers Walk','Box Jumps','Jump Squats','Medicine Ball Slam','Kettlebell Swing');

-- Statisch
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Statisch' AND es.category = 'core' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Plank','Side Plank','Hollow Body Hold','L-Sit','Superman Hold','Copenhagen Plank');

-- Dynamisch
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Dynamisch' AND es.category = 'core' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Crunches','Bicycle Crunches','V-Ups','Leg Raises','Flutter Kicks','Sit-Ups','Reverse Crunches','Mountain Climbers','Plank Shoulder Tap','Plank mit Rotation');

-- Rotation
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Rotation' AND es.category = 'core' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Russian Twist','Windshield Wiper','Pallof Press','Stir the Pot');

-- Hänge & Fortgeschritten
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Hänge & Fortgeschritten' AND es.category = 'core' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Hanging Knee Raises','Toes to Bar','Dragon Flag','Ab Wheel Rollout');

-- Stabilität
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Stabilität' AND es.category = 'core' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Dead Bug','Bird Dog','Good Morning','Kreuzheben einbeinig','Seitstütz mit Hüftheben','Suitcase Carry');

-- Sprint & Lauf
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Sprint & Lauf' AND es.category = 'ausdauer' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Sprint 30m','Sprint 60m','Shuttle Run','Intervall-Lauf','Treppen-Sprint','Laufband-Sprint','Tabata Sprints');

-- Seilspringen
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Seilspringen' AND es.category = 'ausdauer' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Seilspringen','Double Unders');

-- Sprünge
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Sprünge' AND es.category = 'ausdauer' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Jumping Lunges','Burpee Box Jump','Broad Jump','Jumping Jacks','Star Jumps','Seitwärtssprünge','Power Skip','Pogos','Lateral Bounds');

-- Koordination
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Koordination' AND es.category = 'ausdauer' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Agility Ladder','Ickey Shuffle','Crab Walk','Lateral Shuffle','High Knees','Butt Kicks','Box Step-Ups','Hampelmann');

-- Ergometer
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Ergometer' AND es.category = 'ausdauer' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Assault Bike','Ski Erg','Rowing Ergometer');

-- Speed & Kondition
UPDATE exercise_catalog ec
  JOIN exercise_subcategories es ON es.name = 'Speed & Kondition' AND es.category = 'ausdauer' AND es.dojo_id IS NULL
SET ec.subcategory_id = es.id
WHERE ec.dojo_id IS NULL AND ec.name IN ('Speed Squats');
