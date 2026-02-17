<?php

declare(strict_types=1);

/**
 * TripSalama - Configuration Application
 */

return [
    // Application
    'name' => $_ENV['APP_NAME'] ?? 'TripSalama',
    'env' => $_ENV['APP_ENV'] ?? 'local',
    'debug' => filter_var($_ENV['APP_DEBUG'] ?? true, FILTER_VALIDATE_BOOLEAN),
    'url' => $_ENV['APP_URL'] ?? 'http://localhost',
    'base_path' => $_ENV['BASE_PATH'] ?? '',

    // Langues
    'default_lang' => $_ENV['DEFAULT_LANG'] ?? 'fr',
    'available_langs' => ['fr', 'en'],

    // Session
    'session_lifetime' => (int)($_ENV['SESSION_LIFETIME'] ?? 120),
    'session_secure' => filter_var($_ENV['SESSION_SECURE'] ?? false, FILTER_VALIDATE_BOOLEAN),

    // Uploads
    'max_upload_size' => 5 * 1024 * 1024, // 5MB
    'allowed_avatar_types' => ['image/jpeg', 'image/png', 'image/webp'],

    // Pricing
    'pricing' => [
        'base_price' => 3.50,      // Prix de base
        'price_per_km' => 1.20,    // Prix par km
        'price_per_min' => 0.25,   // Prix par minute
        'min_price' => 5.00,       // Prix minimum
        'currency' => 'CHF',
    ],

    // Simulation
    'simulation' => [
        'default_speed_kmh' => 30,     // Vitesse par defaut
        'update_interval_ms' => 1000,  // Interval de mise a jour
    ],
];
