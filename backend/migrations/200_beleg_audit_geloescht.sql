-- Audit-Log: Aktion 'geloescht' für das harte Löschen von Belegen (DELETE /belege/:id)
ALTER TABLE buchhaltung_audit_log
  MODIFY COLUMN aktion ENUM('erstellt','geaendert','festgeschrieben','storniert','export','geloescht') NOT NULL;
