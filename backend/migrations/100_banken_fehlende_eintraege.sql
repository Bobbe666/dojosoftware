-- Fehlende Banken in der banken-Tabelle ergänzen
-- VR Bank Vilsbiburg (BLZ 74392300, BIC GENODEF1VIB)
INSERT INTO banken (bankleitzahl, bankname, bic)
VALUES ('74392300', 'VR Bank Vilsbiburg eG', 'GENODEF1VIB')
ON DUPLICATE KEY UPDATE bankname = VALUES(bankname), bic = VALUES(bic);
