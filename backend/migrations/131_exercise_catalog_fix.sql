-- Migration 131: Fix Umlaut-Encoding in exercise_catalog + add description column
-- Ursache: Migration 130 wurde ohne --default-character-set=utf8mb4 importiert
-- Fix: Globale Einträge löschen und korrekt neu einfügen

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Description-Spalte hinzufügen
ALTER TABLE exercise_catalog
  ADD COLUMN IF NOT EXISTS description TEXT NULL DEFAULT NULL AFTER name;

-- Alle globalen Einträge bereinigen und neu einfügen
DELETE FROM exercise_catalog WHERE dojo_id IS NULL;

-- ── Kampfsport ────────────────────────────────────────────────────────────────
INSERT INTO exercise_catalog (dojo_id, name, category) VALUES
(NULL, 'Jab', 'kampfsport'),
(NULL, 'Cross', 'kampfsport'),
(NULL, 'Hook', 'kampfsport'),
(NULL, 'Uppercut', 'kampfsport'),
(NULL, 'Jab-Cross', 'kampfsport'),
(NULL, 'Jab-Cross-Hook', 'kampfsport'),
(NULL, 'Jab-Cross-Hook-Uppercut', 'kampfsport'),
(NULL, 'Roundkick Tief', 'kampfsport'),
(NULL, 'Roundkick Mittel', 'kampfsport'),
(NULL, 'Roundkick High', 'kampfsport'),
(NULL, 'Frontkick', 'kampfsport'),
(NULL, 'Sidekick', 'kampfsport'),
(NULL, 'Backkick', 'kampfsport'),
(NULL, 'Spinning Back Kick', 'kampfsport'),
(NULL, 'Jumping Roundkick', 'kampfsport'),
(NULL, 'Kniestöße', 'kampfsport'),
(NULL, 'Ellbogenstoß', 'kampfsport'),
(NULL, 'Körperkick-Kombination', 'kampfsport'),
(NULL, 'Shadowboxing', 'kampfsport'),
(NULL, 'Sandsack-Kombination', 'kampfsport'),
(NULL, 'Pratzenarbeit', 'kampfsport'),
(NULL, 'Bob & Weave', 'kampfsport'),
(NULL, 'Clinch-Arbeit', 'kampfsport'),
(NULL, 'Footwork Defensiv', 'kampfsport'),
(NULL, 'Tigersprung', 'kampfsport'),
(NULL, 'Slip & Konter', 'kampfsport'),
(NULL, 'Doppel-Kick', 'kampfsport'),
(NULL, 'Kombination 3er', 'kampfsport'),
(NULL, 'Kombination 5er', 'kampfsport'),
(NULL, 'Clinch-Knie', 'kampfsport');

-- ── Fitness ───────────────────────────────────────────────────────────────────
INSERT INTO exercise_catalog (dojo_id, name, category) VALUES
(NULL, 'Liegestütze', 'fitness'),
(NULL, 'Kniebeugen', 'fitness'),
(NULL, 'Ausfallschritte', 'fitness'),
(NULL, 'Klimmzüge', 'fitness'),
(NULL, 'Dips', 'fitness'),
(NULL, 'Burpees', 'fitness'),
(NULL, 'Box Jumps', 'fitness'),
(NULL, 'Kettlebell Swing', 'fitness'),
(NULL, 'Goblet Squat', 'fitness'),
(NULL, 'Romanian Deadlift', 'fitness'),
(NULL, 'Hip Thrust', 'fitness'),
(NULL, 'Overhead Press', 'fitness'),
(NULL, 'Turkish Get-Up', 'fitness'),
(NULL, 'Medicine Ball Slam', 'fitness'),
(NULL, 'Thrusters', 'fitness'),
(NULL, 'Farmers Walk', 'fitness'),
(NULL, 'Bear Crawl', 'fitness'),
(NULL, 'Wall Balls', 'fitness'),
(NULL, 'Push Press', 'fitness'),
(NULL, 'Romanian Split Squat', 'fitness'),
(NULL, 'Sumo Squat', 'fitness'),
(NULL, 'Arnold Press', 'fitness'),
(NULL, 'Kreuzheben', 'fitness'),
(NULL, 'Bankdrücken', 'fitness'),
(NULL, 'Kurzhantelrudern', 'fitness'),
(NULL, 'Langhantel-Squat', 'fitness'),
(NULL, 'Klimmzüge eng', 'fitness'),
(NULL, 'Pike Push-Up', 'fitness'),
(NULL, 'Seitliche Ausfallschritte', 'fitness'),
(NULL, 'Jump Squats', 'fitness');

-- ── Core ──────────────────────────────────────────────────────────────────────
INSERT INTO exercise_catalog (dojo_id, name, category) VALUES
(NULL, 'Plank', 'core'),
(NULL, 'Side Plank', 'core'),
(NULL, 'Crunches', 'core'),
(NULL, 'Bicycle Crunches', 'core'),
(NULL, 'Russian Twist', 'core'),
(NULL, 'Dead Bug', 'core'),
(NULL, 'Bird Dog', 'core'),
(NULL, 'Hollow Body Hold', 'core'),
(NULL, 'V-Ups', 'core'),
(NULL, 'Leg Raises', 'core'),
(NULL, 'Flutter Kicks', 'core'),
(NULL, 'Sit-Ups', 'core'),
(NULL, 'Ab Wheel Rollout', 'core'),
(NULL, 'Hanging Knee Raises', 'core'),
(NULL, 'Dragon Flag', 'core'),
(NULL, 'Superman Hold', 'core'),
(NULL, 'Windshield Wiper', 'core'),
(NULL, 'Toes to Bar', 'core'),
(NULL, 'L-Sit', 'core'),
(NULL, 'Pallof Press', 'core'),
(NULL, 'Plank Shoulder Tap', 'core'),
(NULL, 'Mountain Climbers', 'core'),
(NULL, 'Reverse Crunches', 'core'),
(NULL, 'Seitstütz mit Hüftheben', 'core'),
(NULL, 'Kreuzheben einbeinig', 'core'),
(NULL, 'Good Morning', 'core'),
(NULL, 'Plank mit Rotation', 'core'),
(NULL, 'Stir the Pot', 'core'),
(NULL, 'Copenhagen Plank', 'core'),
(NULL, 'Suitcase Carry', 'core');

-- ── Ausdauer ──────────────────────────────────────────────────────────────────
INSERT INTO exercise_catalog (dojo_id, name, category) VALUES
(NULL, 'Seilspringen', 'ausdauer'),
(NULL, 'Double Unders', 'ausdauer'),
(NULL, 'Sprint 30m', 'ausdauer'),
(NULL, 'Sprint 60m', 'ausdauer'),
(NULL, 'Shuttle Run', 'ausdauer'),
(NULL, 'Intervall-Lauf', 'ausdauer'),
(NULL, 'High Knees', 'ausdauer'),
(NULL, 'Butt Kicks', 'ausdauer'),
(NULL, 'Lateral Shuffle', 'ausdauer'),
(NULL, 'Agility Ladder', 'ausdauer'),
(NULL, 'Jumping Lunges', 'ausdauer'),
(NULL, 'Speed Squats', 'ausdauer'),
(NULL, 'Burpee Box Jump', 'ausdauer'),
(NULL, 'Assault Bike', 'ausdauer'),
(NULL, 'Ski Erg', 'ausdauer'),
(NULL, 'Rowing Ergometer', 'ausdauer'),
(NULL, 'Tabata Sprints', 'ausdauer'),
(NULL, 'Treppen-Sprint', 'ausdauer'),
(NULL, 'Laufband-Sprint', 'ausdauer'),
(NULL, 'Box Step-Ups', 'ausdauer'),
(NULL, 'Crab Walk', 'ausdauer'),
(NULL, 'Lateral Bounds', 'ausdauer'),
(NULL, 'Ickey Shuffle', 'ausdauer'),
(NULL, 'Power Skip', 'ausdauer'),
(NULL, 'Pogos', 'ausdauer'),
(NULL, 'Broad Jump', 'ausdauer'),
(NULL, 'Jumping Jacks', 'ausdauer'),
(NULL, 'Star Jumps', 'ausdauer'),
(NULL, 'Seitwärtssprünge', 'ausdauer'),
(NULL, 'Hampelmann', 'ausdauer');
