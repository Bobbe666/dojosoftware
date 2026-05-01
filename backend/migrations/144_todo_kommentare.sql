-- Migration 144: Todo-Kommentare Tabelle (Ticketsystem)
CREATE TABLE IF NOT EXISTS todo_kommentare (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  todo_id     INT NOT NULL,
  autor_id    INT NULL,
  autor_name  VARCHAR(100) NULL,
  kommentar   TEXT NOT NULL,
  erstellt_am DATETIME DEFAULT NOW(),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
