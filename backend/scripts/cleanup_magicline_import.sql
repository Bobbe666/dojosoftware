-- Cleanup Script: Löscht alle MagicLine importierten Daten
-- VORSICHT: Dieses Script löscht ALLE Daten, die aus MagicLine importiert wurden!

-- 1. Lösche alle Dokumente von MagicLine-Mitgliedern
DELETE FROM mitglieder_dokumente
WHERE mitglied_id IN (
  SELECT mitglied_id FROM mitglieder
  WHERE magicline_customer_number IS NOT NULL
);

-- 2. Lösche alle SEPA-Mandate von MagicLine-Mitgliedern
DELETE FROM sepa_mandate
WHERE mitglied_id IN (
  SELECT mitglied_id FROM mitglieder
  WHERE magicline_customer_number IS NOT NULL
);

-- 3. Lösche alle Verträge von MagicLine-Mitgliedern
DELETE FROM vertraege
WHERE mitglied_id IN (
  SELECT mitglied_id FROM mitglieder
  WHERE magicline_customer_number IS NOT NULL
);

-- 4. Lösche alle MagicLine-Mitglieder
DELETE FROM mitglieder
WHERE magicline_customer_number IS NOT NULL;

-- 5. Zeige Zusammenfassung
SELECT
  (SELECT COUNT(*) FROM mitglieder WHERE magicline_customer_number IS NOT NULL) as remaining_members,
  (SELECT COUNT(*) FROM vertraege WHERE magicline_contract_id IS NOT NULL) as remaining_contracts,
  (SELECT COUNT(*) FROM sepa_mandate WHERE mandatsreferenz LIKE 'MLREF%' OR mandatsreferenz LIKE 'IMPORT-%') as remaining_mandates;
