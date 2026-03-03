<?php

declare(strict_types=1);

/**
 * TripSalama - Configuration Routes
 */

return [
    // Pages publiques
    'GET /' => ['AuthController', 'showLogin'],

    // Demo et Tests (accessible sans auth pour presentation)
    'GET /demo' => ['DemoController', 'tracking'],
    'GET /test/tracking' => ['DemoController', 'trackingTest'],
    'GET /login' => ['AuthController', 'showLogin'],
    'GET /register' => ['AuthController', 'showRegisterChoice'],
    'GET /register/passenger' => ['AuthController', 'showRegisterPassenger'],
    'GET /register/driver' => ['AuthController', 'showRegisterDriver'],

    // Password reset
    'GET /forgot-password' => ['AuthController', 'showForgotPassword'],
    'POST /forgot-password' => ['AuthController', 'processForgotPassword'],
    'GET /reset-password/{token}' => ['AuthController', 'showResetPassword'],
    'POST /reset-password' => ['AuthController', 'processResetPassword'],

    // Actions auth
    'POST /login' => ['AuthController', 'processLogin'],
    'POST /register/passenger' => ['AuthController', 'processRegisterPassenger'],
    'POST /register/driver' => ['AuthController', 'processRegisterDriver'],
    'POST /logout' => ['AuthController', 'logout'],
    'GET /logout' => ['AuthController', 'logout'],
    'GET /identity-verification' => ['AuthController', 'showIdentityVerification', 'auth' => true],

    // Dashboard passagere (auth required)
    'GET /passenger/dashboard' => ['PassengerController', 'dashboard', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/book' => ['PassengerController', 'bookRide', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/ride/{id}' => ['PassengerController', 'trackRide', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/demo/{id}' => ['PassengerController', 'demoRide', 'auth' => true, 'role' => 'passenger'],
    'GET /passenger/history' => ['PassengerController', 'history', 'auth' => true, 'role' => 'passenger'],

    // Dashboard conductrice (auth required)
    'GET /driver/dashboard' => ['DriverController', 'dashboard', 'auth' => true, 'role' => 'driver'],
    'GET /driver/ride/{id}' => ['DriverController', 'rideDetails', 'auth' => true, 'role' => 'driver'],
    'GET /driver/navigation/{id}' => ['DriverController', 'navigation', 'auth' => true, 'role' => 'driver'],

    // Profil (auth required)
    'GET /profile' => ['UserController', 'profile', 'auth' => true],
    'GET /profile/edit' => ['UserController', 'editProfile', 'auth' => true],
    'POST /profile/update' => ['UserController', 'updateProfile', 'auth' => true],
    'GET /profile/password' => ['UserController', 'changePassword', 'auth' => true],
    'POST /profile/password' => ['UserController', 'processChangePassword', 'auth' => true],

    // Admin (auth required, admin role)
    'GET /admin/settings' => ['AdminController', 'settings', 'auth' => true, 'role' => 'admin'],
    'POST /admin/settings' => ['AdminController', 'updateSettings', 'auth' => true, 'role' => 'admin'],
    'GET /admin/dashboard' => ['AdminController', 'dashboard', 'auth' => true, 'role' => 'admin'],
    'GET /admin/countries' => ['AdminController', 'countries', 'auth' => true, 'role' => 'admin'],
];
