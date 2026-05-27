-- Migration 181: News als_popup Flag
-- Ermöglicht es, News als wichtige Info-Popup auf der Mitglieder-Startseite anzuzeigen

ALTER TABLE news_articles
  ADD COLUMN als_popup TINYINT(1) NOT NULL DEFAULT 0 AFTER featured;
