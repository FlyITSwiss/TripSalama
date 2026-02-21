/**
 * TripSalama - Configuration Puppeteer
 */

module.exports = {
    // URL de base
    baseUrl: 'http://127.0.0.1:8080',

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

    // Timeouts
    timeout: {
        navigation: 30000,
        element: 10000,
        action: 5000,
        animation: 500
    },

    // Alias pour compatibilité
    timeouts: {
        navigation: 30000,
        element: 10000,
        action: 5000,
        animation: 500
    },

    // Utilisateurs de test
    users: {
        passenger: {
            email: 'fatima@example.com',
            password: 'Test1234!'
        },
        driver: {
            email: 'khadija@example.com',
            password: 'Test1234!'
        }
    },

    // Sélecteurs communs
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

    // URL helpers
    url: function(path = '') {
        return this.baseUrl + '/' + path.replace(/^\//, '');
    }
};
