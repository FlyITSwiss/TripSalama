<?php

declare(strict_types=1);

/**
 * TripSalama - Configuration Routes
 */

return [
    // Pages publiques
    'GET /' => ['AuthController', 'showLogin'],
    'GET /login' => ['AuthController', 'showLogin'],
    'GET /register' => ['AuthController', 'showRegisterChoice'],
    'GET /register/passenger' => ['AuthController', 'showRegisterPassenger'],
    'GET /register/driver' => ['AuthController', 'showRegisterDriver'],

    // Actions auth
    'POST /login' => ['AuthController', 'processLogin'],
    'POST /register/passenger' => ['AuthController', 'processRegisterPassenger'],
    'POST /register/driver' => ['AuthController', 'processRegisterDriver'],
    'POST /logout' => ['AuthController', 'logout'],

    // Dashboard passagere (auth required)
    'GET /passenger/dashboard' => ['PassengerController', 'dashboard', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/book' => ['PassengerController', 'bookRide', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/ride/{id}' => ['PassengerController', 'trackRide', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/history' => ['PassengerController', 'history', 'auth' => true, 'role' => 'passenger'],

    // Dashboard conductrice (auth required)
    'GET /driver/dashboard' => ['DriverController', 'dashboard', 'auth' => true, 'role' => 'driver'],
    'GET /driver/ride/{id}' => ['DriverController', 'rideDetails', 'auth' => true, 'role' => 'driver'],
    'GET /driver/navigation/{id}' => ['DriverController', 'navigation', 'auth' => true, 'role' => 'driver'],

    // Profil (auth required)
    'GET /profile' => ['UserController', 'profile', 'auth' => true],
    'GET /profile/edit' => ['UserController', 'editProfile', 'auth' => true],
    'POST /profile/update' => ['UserController', 'updateProfile', 'auth' => true],
];
