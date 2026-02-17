-- TripSalama - Donnees de demonstration
-- Password: Test1234! (hash bcrypt)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Utilisateurs demo
INSERT INTO `users` (`id`, `email`, `password_hash`, `first_name`, `last_name`, `phone`, `role`, `is_verified`, `is_active`) VALUES
-- Passageres
(1, 'sarah.benali@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sarah', 'Benali', '+41 79 123 45 67', 'passenger', 1, 1),
(2, 'amina.hassan@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Amina', 'Hassan', '+41 79 234 56 78', 'passenger', 1, 1),
(3, 'fatima.omar@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Fatima', 'Omar', '+41 79 345 67 89', 'passenger', 1, 1),

-- Conductrices
(4, 'leila.ahmed@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Leila', 'Ahmed', '+41 79 456 78 90', 'driver', 1, 1),
(5, 'nadia.khalil@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Nadia', 'Khalil', '+41 79 567 89 01', 'driver', 1, 1),
(6, 'yasmine.farah@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Yasmine', 'Farah', '+41 79 678 90 12', 'driver', 1, 1),

-- Admin
(7, 'admin@tripsalama.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'TripSalama', '+41 79 000 00 00', 'admin', 1, 1);

-- Vehicules des conductrices
INSERT INTO `vehicles` (`id`, `driver_id`, `brand`, `model`, `color`, `license_plate`, `year`, `is_active`) VALUES
(1, 4, 'Toyota', 'Corolla', 'Blanc', 'GE 123456', 2022, 1),
(2, 5, 'Volkswagen', 'Golf', 'Noir', 'VD 234567', 2021, 1),
(3, 6, 'Renault', 'Clio', 'Gris', 'ZH 345678', 2023, 1);

-- Statuts des conductrices
INSERT INTO `driver_status` (`driver_id`, `is_available`, `current_lat`, `current_lng`) VALUES
(4, 1, 46.2044, 6.1432),  -- Leila - Geneve centre
(5, 0, 46.5197, 6.6323),  -- Nadia - Lausanne (indisponible)
(6, 1, 47.3769, 8.5417);  -- Yasmine - Zurich

-- Courses demo
INSERT INTO `rides` (`id`, `passenger_id`, `driver_id`, `vehicle_id`, `status`, `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_address`, `dropoff_lat`, `dropoff_lng`, `estimated_distance_km`, `estimated_duration_min`, `estimated_price`, `final_price`, `created_at`, `accepted_at`, `started_at`, `completed_at`) VALUES
-- Course terminee
(1, 1, 4, 1, 'completed', 'Gare de Genève-Cornavin, Genève', 46.2100, 6.1425, 'Aéroport de Genève', 46.2381, 6.1089, 5.2, 12, 9.50, 9.50, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),

-- Course terminee
(2, 2, 5, 2, 'completed', 'Place Saint-François, Lausanne', 46.5198, 6.6335, 'EPFL, Lausanne', 46.5191, 6.5668, 6.8, 15, 11.20, 11.20, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),

-- Course en cours (pour demo simulation)
(3, 3, 6, 3, 'in_progress', 'Hauptbahnhof, Zürich', 47.3782, 8.5403, 'ETH Zürich', 47.3763, 8.5480, 1.5, 8, 6.50, NULL, DATE_SUB(NOW(), INTERVAL 10 MINUTE), DATE_SUB(NOW(), INTERVAL 8 MINUTE), DATE_SUB(NOW(), INTERVAL 5 MINUTE), NULL);

-- Notations
INSERT INTO `ratings` (`ride_id`, `passenger_rating`, `passenger_comment`, `passenger_rated_at`, `driver_rating`, `driver_comment`, `driver_rated_at`) VALUES
(1, 5, 'Excellente conductrice, très professionnelle !', DATE_SUB(NOW(), INTERVAL 3 DAY), 5, 'Passagère ponctuelle et agréable.', DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 4, 'Bonne course, merci !', DATE_SUB(NOW(), INTERVAL 2 DAY), 5, 'Parfait !', DATE_SUB(NOW(), INTERVAL 2 DAY));

SET FOREIGN_KEY_CHECKS = 1;
