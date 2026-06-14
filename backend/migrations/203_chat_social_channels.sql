-- Migration 203: Fundament für Social-Chat-Kanäle (Messenger + WhatsApp)
-- Phase 0: bestehender Messenger war faktisch kaputt — sender_type-ENUM kannte
-- die Werte 'messenger_user'/'messenger_outgoing' nicht (→ Inserts schlugen fehl).
-- Hier erweitern wir die ENUMs um die Kanal-Werte (additiv, bestehende Daten unberührt).

ALTER TABLE chat_messages
  MODIFY COLUMN sender_type
  ENUM('mitglied','trainer','admin','verband',
       'messenger_user','messenger_outgoing',
       'whatsapp_user','whatsapp_outgoing') NOT NULL;

ALTER TABLE chat_rooms
  MODIFY COLUMN source
  ENUM('internal','messenger','whatsapp') DEFAULT 'internal';
