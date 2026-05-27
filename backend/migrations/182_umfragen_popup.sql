-- Migration 182: Umfragen als_popup Flag
ALTER TABLE umfragen
  ADD COLUMN als_popup TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
