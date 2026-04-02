-- Migration: Add dojo_id to zahllaeufe table
-- Date: 2025-01-08
-- Description: Fügt dojo_id Spalte zu zahllaeufe hinzu für Multi-Dojo-Support

-- Füge dojo_id Spalte hinzu
ALTER TABLE zahllaeufe
ADD COLUMN dojo_id INT NULL AFTER zahllauf_id,
ADD INDEX idx_dojo_id (dojo_id);

-- Setze dojo_id für existierende Zahlläufe
-- Logik: Ermittle dojo_id aus den zugehörigen Mandaten/Mitgliedern
-- Wenn ein Zahllauf mehrere Dojos umfasst, nehme den häufigsten
UPDATE zahllaeufe z
LEFT JOIN (
    SELECT
        lm.zahllauf_id,
        m.dojo_id,
        COUNT(*) as anzahl
    FROM lastschrift_mandate lm
    INNER JOIN mitglieder m ON lm.mitglied_id = m.mitglied_id
    WHERE lm.zahllauf_id IS NOT NULL
    GROUP BY lm.zahllauf_id, m.dojo_id
    ORDER BY lm.zahllauf_id, COUNT(*) DESC
) AS dojo_count ON z.zahllauf_id = dojo_count.zahllauf_id
SET z.dojo_id = dojo_count.dojo_id
WHERE z.dojo_id IS NULL AND dojo_count.dojo_id IS NOT NULL;

-- Für Zahlläufe ohne Zuordnung: Setze auf dojo_id 1 (Standard)
UPDATE zahllaeufe
SET dojo_id = 1
WHERE dojo_id IS NULL;

-- Kommentar hinzufügen
ALTER TABLE zahllaeufe
MODIFY COLUMN dojo_id INT NULL COMMENT 'Dojo-Zugehörigkeit für Multi-Dojo-Support';
