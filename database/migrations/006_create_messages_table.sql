-- ============================================
-- TripSalama - Migration 006
-- Table des messages de chat conductrice-passagère
-- ============================================

CREATE TABLE IF NOT EXISTS ride_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ride_id INT UNSIGNED NOT NULL,
    sender_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'quick') DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Clés étrangères
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Index pour optimisation
    INDEX idx_ride_messages_ride (ride_id),
    INDEX idx_ride_messages_sender (sender_id),
    INDEX idx_ride_messages_created (created_at),
    INDEX idx_ride_messages_unread (ride_id, sender_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
