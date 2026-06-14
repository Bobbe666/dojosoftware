-- Migration 204: WhatsApp-Integration (Enterprise) — Tabellen analog zu Messenger.
-- dojo_whatsapp_config: WhatsApp Cloud API Zugang pro Dojo.
-- whatsapp_conversations: Mapping WhatsApp-Nutzer (wa_id) → chat_room, inkl. 24h-Fenster.

CREATE TABLE IF NOT EXISTS dojo_whatsapp_config (
  id int(11) NOT NULL AUTO_INCREMENT,
  dojo_id int(11) NOT NULL,
  phone_number_id varchar(100) DEFAULT NULL,   -- WhatsApp Cloud API Phone-Number-ID
  waba_id varchar(100) DEFAULT NULL,           -- WhatsApp Business Account ID
  access_token text DEFAULT NULL,              -- permanenter Token
  app_secret varchar(255) DEFAULT NULL,        -- für Webhook-HMAC
  verify_token varchar(255) DEFAULT NULL,      -- Webhook-Verifizierung
  display_number varchar(50) DEFAULT NULL,     -- lesbare Nummer (Anzeige)
  is_active tinyint(1) DEFAULT 0,
  created_at timestamp NULL DEFAULT current_timestamp(),
  updated_at timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY dojo_id (dojo_id),
  CONSTRAINT dojo_whatsapp_config_ibfk_1 FOREIGN KEY (dojo_id) REFERENCES dojo (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id int(11) NOT NULL AUTO_INCREMENT,
  dojo_id int(11) NOT NULL,
  wa_id varchar(255) NOT NULL,                 -- WhatsApp-Nutzer-ID (Telefon im internat. Format)
  wa_name varchar(255) DEFAULT NULL,           -- Profilname
  chat_room_id int(11) NOT NULL,
  last_message_at timestamp NULL DEFAULT NULL,
  window_expires_at timestamp NULL DEFAULT NULL, -- 24h-Kundendienstfenster (außerhalb nur Templates)
  created_at timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_dojo_waid (dojo_id, wa_id),
  UNIQUE KEY uq_room (chat_room_id),
  CONSTRAINT whatsapp_conversations_ibfk_1 FOREIGN KEY (chat_room_id) REFERENCES chat_rooms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
