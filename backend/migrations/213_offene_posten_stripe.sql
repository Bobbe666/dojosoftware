-- Migration: offene_posten -> Stripe-Payment-Intent-Verknuepfung
-- Erstellt: 2026-06-23
-- Beschreibung: Phase 2 (10er-Karten Auto-Abbuchung nach Aufladung).
--   Speichert den Stripe-PaymentIntent pro offenem Posten zur Nachverfolgung
--   und als Idempotenz-Anker (status 'gebucht' + payment_intent gesetzt).

ALTER TABLE offene_posten
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255) DEFAULT NULL;
