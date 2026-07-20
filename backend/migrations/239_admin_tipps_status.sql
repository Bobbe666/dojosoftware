-- ============================================================================
-- 239: Admin-Tipps ("Wusstest du schon…?" Feature-Tipps im Dashboard)
--
-- Speichert pro Mitarbeiter (admin_users.id) den Lese-Status der kuratierten
-- Tipps (Tipp-Texte liegen im Code: backend/data/adminTipps.js) sowie die
-- globale Ein/Aus-Einstellung ("keine Tipps mehr anzeigen").
--
-- HINWEIS: Auf Prod gibt es KEINEN Migrations-Runner (dojo.migrations existiert
-- nicht) → diese Datei ist nur das Repo-Abbild; die Tabellen wurden per direktem
-- SQL angelegt. CREATE TABLE IF NOT EXISTS ist auf MariaDB unbedenklich
-- (im Gegensatz zu ADD COLUMN IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_tipp_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  tipp_id INT NOT NULL,
  status ENUM('erledigt','spaeter') NOT NULL,
  aktualisiert_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_tipp (admin_id, tipp_id),
  KEY idx_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_tipp_einstellung (
  admin_id INT NOT NULL PRIMARY KEY,
  aktiv TINYINT(1) NOT NULL DEFAULT 1,
  aktualisiert_am DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
