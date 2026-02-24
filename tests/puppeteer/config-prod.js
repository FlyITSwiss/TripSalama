/**
 * TripSalama - Configuration Puppeteer PRODUCTION
 */

module.exports = {
    // URL de base PRODUCTION
    baseUrl: 'https://stabilis-it.ch/internal/tripsalama',

    // Configuration Puppeteer
    puppeteer: {
        headless: false,  // TOUJOURS visuel
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

    // Timeouts (plus longs pour prod)
    timeout: {
        navigation: 45000,
        element: 15000,
        action: 8000,
        animation: 500
    },

    timeouts: {
        navigation: 45000,
        element: 15000,
        action: 8000,
        animation: 500
    },

    // Utilisateurs de test PRODUCTION
    users: {
        passenger: {
            email: 'passenger@tripsalama.ch',
            password: 'password'
        },
        driver: {
            email: 'driver@tripsalama.ch',
            password: 'password'
        },
        admin: {
            email: 'admin@tripsalama.ch',
            password: 'password'
        }
    },

    // Selectors
    selectors: {
        loginForm: '#loginForm, form[action*="login"], form.login-form',
        registerForm: '#registerForm, form[action*="register"], form.register-form',
        emailInput: '#email, input[name="email"]',
        passwordInput: '#password, input[name="password"]',
        submitBtn: 'button[type="submit"]',
        toast: '.toast, .flash, .notification'
    },

    // Helpers
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    url: function(path = '') {
        return this.baseUrl + '/' + path.replace(/^\//, '');
    }
};
