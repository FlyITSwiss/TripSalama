-- TripSalama - Migration 007
-- Seed: Create admin test user
-- Password: TripSalama2025! (bcrypt hash)

SET NAMES utf8mb4;

-- Insert admin user (password: TripSalama2025!)
-- Hash generated with password_hash('TripSalama2025!', PASSWORD_DEFAULT)
INSERT INTO `users` (
    `email`,
    `password_hash`,
    `first_name`,
    `last_name`,
    `phone`,
    `role`,
    `is_verified`,
    `is_active`,
    `email_verified_at`,
    `identity_verification_status`
) VALUES (
    'admin@tripsalama.ch',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Admin',
    'TripSalama',
    '+41791234567',
    'admin',
    1,
    1,
    NOW(),
    'verified'
) ON DUPLICATE KEY UPDATE
    `password_hash` = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    `is_verified` = 1,
    `is_active` = 1;

-- Also create a test driver
INSERT INTO `users` (
    `email`,
    `password_hash`,
    `first_name`,
    `last_name`,
    `phone`,
    `role`,
    `is_verified`,
    `is_active`,
    `email_verified_at`,
    `identity_verification_status`
) VALUES (
    'driver@tripsalama.ch',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Marie',
    'Conductrice',
    '+41791234568',
    'driver',
    1,
    1,
    NOW(),
    'verified'
) ON DUPLICATE KEY UPDATE
    `password_hash` = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    `is_verified` = 1,
    `is_active` = 1;

-- And a test passenger
INSERT INTO `users` (
    `email`,
    `password_hash`,
    `first_name`,
    `last_name`,
    `phone`,
    `role`,
    `is_verified`,
    `is_active`,
    `email_verified_at`,
    `identity_verification_status`
) VALUES (
    'passenger@tripsalama.ch',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Sophie',
    'Passagere',
    '+41791234569',
    'passenger',
    1,
    1,
    NOW(),
    'verified'
) ON DUPLICATE KEY UPDATE
    `password_hash` = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    `is_verified` = 1,
    `is_active` = 1;
