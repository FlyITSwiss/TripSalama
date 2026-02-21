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

    // Pricing par défaut (utilisé si pays non détecté)
    'pricing' => [
        'base_price' => 3.50,      // Prix de base
        'price_per_km' => 1.20,    // Prix par km
        'price_per_min' => 0.25,   // Prix par minute
        'min_price' => 5.00,       // Prix minimum
        'currency' => 'EUR',       // Devise par défaut
    ],

    // Configuration multi-pays
    'countries' => [
        'FR' => [
            'name' => 'France',
            'currency' => 'EUR',
            'currency_symbol' => '€',
            'currency_position' => 'after', // 12,50 €
            'decimal_separator' => ',',
            'thousands_separator' => ' ',
            'timezone' => 'Europe/Paris',
            'pricing' => [
                'base_price' => 2.50,
                'price_per_km' => 1.10,
                'price_per_min' => 0.20,
                'min_price' => 4.00,
            ],
        ],
        'MA' => [
            'name' => 'Maroc',
            'currency' => 'MAD',
            'currency_symbol' => 'DH',
            'currency_position' => 'after', // 50,00 DH
            'decimal_separator' => ',',
            'thousands_separator' => ' ',
            'timezone' => 'Africa/Casablanca',
            'pricing' => [
                'base_price' => 10.00,
                'price_per_km' => 5.00,
                'price_per_min' => 1.00,
                'min_price' => 15.00,
            ],
        ],
    ],

    // Pays par défaut si détection échoue
    'default_country' => $_ENV['DEFAULT_COUNTRY'] ?? 'FR',

    // Simulation
    'simulation' => [
        'default_speed_kmh' => 30,     // Vitesse par défaut
        'update_interval_ms' => 1000,  // Intervalle de mise à jour
    ],
];
