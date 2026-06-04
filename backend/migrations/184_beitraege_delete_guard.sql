-- ============================================================================
-- Migration 184: DB-Guard gegen Löschen referenzierter Beiträge
-- ----------------------------------------------------------------------------
-- Hintergrund: Im Frühjahr 2026 wurden bei einem einmaligen Vorfall Beiträge
-- (ca. Feb–April) gelöscht, während sie noch von Stripe-Lastschrift-Transaktionen
-- referenziert wurden. Folge: verwaiste Referenzen ("Datensatz erneuert/unbekannt").
--
-- Dieser BEFORE-DELETE-Trigger verhindert das endgültig: Ein Beitrag, der von
-- einer Stripe-Transaktion mit Status 'processing' (in Abbuchung) oder
-- 'succeeded' (abgebucht) referenziert wird, kann nicht mehr gelöscht werden.
--
-- Ausnahme: Legitime Komplett-Archivierung eines Mitglieds setzt zuvor
--   SET @allow_beitrag_delete = 1
-- (siehe routes/mitglieder.js, Flows /:id/archivieren + /bulk-archivieren).
-- Der Trigger überspringt dann die Prüfung. Die Anwendung setzt die Variable
-- unmittelbar danach wieder auf 0 zurück (pollution-sicher bei Pool-Verbindungen).
-- ============================================================================

DROP TRIGGER IF EXISTS trg_beitraege_block_referenced_delete;

CREATE TRIGGER trg_beitraege_block_referenced_delete
BEFORE DELETE ON beitraege
FOR EACH ROW
BEGIN
  DECLARE v_ref INT DEFAULT 0;

  -- Ausnahme für ausdrücklich erlaubte Lösch-Flows (z. B. Mitglied archivieren)
  IF COALESCE(@allow_beitrag_delete, 0) = 0 THEN
    SELECT COUNT(*) INTO v_ref
    FROM stripe_lastschrift_transaktion t
    WHERE t.status IN ('processing', 'succeeded')
      AND t.beitrag_ids IS NOT NULL
      AND JSON_VALID(t.beitrag_ids)
      AND JSON_CONTAINS(t.beitrag_ids, CAST(OLD.beitrag_id AS CHAR), '$');

    IF v_ref > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'GUARD: Beitrag ist von einer aktiven oder abgeschlossenen Stripe-Lastschrift referenziert und darf nicht geloescht werden.';
    END IF;
  END IF;
END;
