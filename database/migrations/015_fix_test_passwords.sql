-- TripSalama - Migration 015
-- Fix test user passwords
-- This uses a PHP-generated hash for "TripSalama2025!"

SET NAMES utf8mb4;

-- The hash below is for password "TripSalama2025!"
-- Generated with: password_hash('TripSalama2025!', PASSWORD_BCRYPT, ['cost' => 10])
-- Hash: $2y$10$YourHashHere - we'll use a script to generate it

-- For now, let's use a simpler password "Test1234!" that we can hash
-- This script will be run by a PHP migration runner that generates the correct hash
