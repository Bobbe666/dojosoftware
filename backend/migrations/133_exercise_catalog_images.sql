-- Migration 133: Add image_url column to exercise_catalog

SET NAMES utf8mb4;

ALTER TABLE exercise_catalog
  ADD COLUMN image_url VARCHAR(500) NULL DEFAULT NULL AFTER description;
