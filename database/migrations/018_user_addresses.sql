-- Migration: 018_user_addresses.sql
-- Description: Ajouter les colonnes pour les adresses sauvegardées (maison, travail)
-- Date: 2026-03-05

ALTER TABLE users
ADD COLUMN home_address VARCHAR(500) NULL AFTER phone,
ADD COLUMN home_lat DECIMAL(10, 8) NULL AFTER home_address,
ADD COLUMN home_lng DECIMAL(11, 8) NULL AFTER home_lat,
ADD COLUMN work_address VARCHAR(500) NULL AFTER home_lng,
ADD COLUMN work_lat DECIMAL(10, 8) NULL AFTER work_address,
ADD COLUMN work_lng DECIMAL(11, 8) NULL AFTER work_lat;

-- Index pour améliorer les recherches géospatiales si besoin
CREATE INDEX idx_users_home_coords ON users (home_lat, home_lng);
CREATE INDEX idx_users_work_coords ON users (work_lat, work_lng);
