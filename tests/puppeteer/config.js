/**
 * TripSalama - Configuration Puppeteer
 */

const config = {
    // URL de base
    baseUrl: 'http://127.0.0.1:8080',

    // Options Puppeteer
    puppeteer: {
        headless: false,
        slowMo: 50,
        defaultViewport: {
            width: 1280,
            height: 800
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
        ]
    },

    // Timeouts
    timeouts: {
        navigation: 30000,
        element: 10000,
        animation: 500
    },

    // Utilisateurs de test (depuis demo_data.sql)
    users: {
        passenger: {
            email: 'fatima@example.com',
            password: 'Test1234!',
            firstName: 'Fatima',
            lastName: 'Benali'
        },
        driver: {
            email: 'khadija@example.com',
            password: 'Test1234!',
            firstName: 'Khadija',
            lastName: 'Amrani'
        }
    },

    // Selectors communs
    selectors: {
        // Auth
        emailInput: '#email',
        passwordInput: '#password',
        submitBtn: 'button[type="submit"]',
        loginForm: '#loginForm',
        registerForm: '#registerForm',

        // Navigation
        navLinks: '.nav-link',
        mobileNav: '.mobile-nav',
        userMenu: '.user-menu',

        // Dashboard passenger
        bookRideBtn: '.book-ride-btn',
        activeRideCard: '.active-ride-card',

        // Booking
        pickupInput: '#pickupAddress',
        dropoffInput: '#dropoffAddress',
        mapContainer: '#bookingMap',
        confirmBookingBtn: '#confirmBooking',
        autocompleteResults: '.autocomplete-results',

        // Driver
        availabilityToggle: '#availabilityToggle',
        pendingRidesList: '#pendingRidesList',
        acceptBtn: '.accept-btn',
        rejectBtn: '.reject-btn',

        // Common
        toast: '.toast',
        modal: '.modal',
        loader: '.loader'
    }
};

module.exports = config;
