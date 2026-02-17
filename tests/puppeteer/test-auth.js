/**
 * TripSalama - Tests Authentification
 * Tests E2E pour login, inscription, logout
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const {
    sleep,
    waitForElement,
    clickElement,
    fillInput,
    login,
    logout,
    checkToast,
    checkUrl,
    takeScreenshot,
    TestReporter
} = require('./helpers');

async function runAuthTests() {
    const reporter = new TestReporter('Authentication Tests');
    let browser;
    let page;

    try {
        console.log('\n🔐 Démarrage des Tests Authentification TripSalama\n');

        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // ===== TESTS LOGIN =====

        // Test 1: Login passagère valide
        await reporter.test('Login passagère avec identifiants valides', async () => {
            await page.goto(`${config.baseUrl}/login`);
            await waitForElement(page, config.selectors.loginForm);

            await fillInput(page, config.selectors.emailInput, config.users.passenger.email);
            await fillInput(page, config.selectors.passwordInput, config.users.passenger.password);

            await clickElement(page, config.selectors.submitBtn);

            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: config.timeouts.navigation });

            // Vérifier redirection vers dashboard passagère
            if (!checkUrl(page, 'passenger/dashboard')) {
                throw new Error('Redirection vers dashboard échouée');
            }

            // Vérifier présence du nom d'utilisateur
            const hasUserName = await page.evaluate((name) => {
                return document.body.textContent.includes(name);
            }, config.users.passenger.firstName);

            if (!hasUserName) {
                throw new Error('Nom utilisateur non affiché');
            }

            await logout(page);
        });

        // Test 2: Login conductrice valide
        await reporter.test('Login conductrice avec identifiants valides', async () => {
            await page.goto(`${config.baseUrl}/login`);
            await waitForElement(page, config.selectors.loginForm);

            await fillInput(page, config.selectors.emailInput, config.users.driver.email);
            await fillInput(page, config.selectors.passwordInput, config.users.driver.password);

            await clickElement(page, config.selectors.submitBtn);

            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: config.timeouts.navigation });

            // Vérifier redirection vers dashboard conductrice
            if (!checkUrl(page, 'driver/dashboard')) {
                throw new Error('Redirection vers dashboard conductrice échouée');
            }

            await logout(page);
        });

        // Test 3: Login avec email invalide
        await reporter.test('Login avec email invalide affiche erreur', async () => {
            await page.goto(`${config.baseUrl}/login`);
            await waitForElement(page, config.selectors.loginForm);

            await fillInput(page, config.selectors.emailInput, 'invalid@example.com');
            await fillInput(page, config.selectors.passwordInput, 'wrongpassword');

            await clickElement(page, config.selectors.submitBtn);

            await sleep(1000);

            // Vérifier qu'on reste sur la page de login
            if (!checkUrl(page, 'login')) {
                throw new Error('Ne devrait pas quitter la page de login');
            }

            // Vérifier message d'erreur
            const hasError = await page.evaluate(() => {
                return document.body.textContent.includes('Erreur') ||
                       document.body.textContent.includes('Invalid') ||
                       document.querySelector('.alert-danger, .error, .toast-error') !== null;
            });

            if (!hasError) {
                throw new Error('Message d\'erreur non affiché');
            }
        });

        // Test 4: Champs requis
        await reporter.test('Validation champs requis', async () => {
            await page.goto(`${config.baseUrl}/login`);
            await waitForElement(page, config.selectors.loginForm);

            // Soumettre formulaire vide
            await clickElement(page, config.selectors.submitBtn);

            // Vérifier validation HTML5
            const emailValid = await page.$eval(config.selectors.emailInput, el => el.validity.valid);

            if (emailValid) {
                throw new Error('Validation champ email devrait échouer');
            }
        });

        // ===== TESTS INSCRIPTION =====

        // Test 5: Page choix inscription
        await reporter.test('Page choix inscription affiche options', async () => {
            await page.goto(`${config.baseUrl}/register`);

            // Vérifier les deux options
            const hasPassengerOption = await waitForElement(page, 'a[href*="register/passenger"]');
            const hasDriverOption = await waitForElement(page, 'a[href*="register/driver"]');

            if (!hasPassengerOption || !hasDriverOption) {
                throw new Error('Options d\'inscription non affichées');
            }
        });

        // Test 6: Formulaire inscription passagère
        await reporter.test('Formulaire inscription passagère complet', async () => {
            await page.goto(`${config.baseUrl}/register/passenger`);
            await waitForElement(page, config.selectors.registerForm);

            // Vérifier les champs requis
            const fields = ['#first_name', '#last_name', '#email', '#phone', '#password', '#password_confirm'];

            for (const field of fields) {
                const exists = await waitForElement(page, field);
                if (!exists) {
                    throw new Error(`Champ ${field} non trouvé`);
                }
            }
        });

        // Test 7: Validation mot de passe
        await reporter.test('Validation complexité mot de passe', async () => {
            await page.goto(`${config.baseUrl}/register/passenger`);
            await waitForElement(page, config.selectors.registerForm);

            // Remplir avec mot de passe faible
            await fillInput(page, '#first_name', 'Test');
            await fillInput(page, '#last_name', 'User');
            await fillInput(page, '#email', 'test.new@example.com');
            await fillInput(page, '#phone', '+41791234567');
            await fillInput(page, '#password', '123'); // Trop faible
            await fillInput(page, '#password_confirm', '123');

            await clickElement(page, config.selectors.submitBtn);

            await sleep(500);

            // Devrait rester sur la page avec erreur
            if (!checkUrl(page, 'register/passenger')) {
                // Si formulaire HTML5, la validation devrait bloquer
                const passwordValid = await page.$eval('#password', el => el.validity.valid);
                if (passwordValid) {
                    throw new Error('Validation mot de passe trop permissive');
                }
            }
        });

        // Test 8: Formulaire inscription conductrice avec véhicule
        await reporter.test('Formulaire inscription conductrice avec véhicule', async () => {
            await page.goto(`${config.baseUrl}/register/driver`);
            await waitForElement(page, config.selectors.registerForm);

            // Vérifier les champs véhicule
            const vehicleFields = ['#vehicle_brand', '#vehicle_model', '#vehicle_color', '#vehicle_license_plate'];

            for (const field of vehicleFields) {
                const exists = await waitForElement(page, field);
                if (!exists) {
                    throw new Error(`Champ véhicule ${field} non trouvé`);
                }
            }
        });

        // ===== TESTS LOGOUT =====

        // Test 9: Logout fonctionnel
        await reporter.test('Logout redirige vers login', async () => {
            // Se connecter d'abord
            await login(page, 'passenger');

            // Se déconnecter
            await page.goto(`${config.baseUrl}/logout`);

            await page.waitForNavigation({ waitUntil: 'networkidle0' });

            // Vérifier redirection
            if (!checkUrl(page, 'login')) {
                throw new Error('Redirection vers login après logout échouée');
            }
        });

        // Test 10: Accès protégé après logout
        await reporter.test('Pages protégées inaccessibles après logout', async () => {
            // S'assurer d'être déconnecté
            await page.goto(`${config.baseUrl}/logout`);
            await sleep(500);

            // Tenter d'accéder au dashboard
            await page.goto(`${config.baseUrl}/passenger/dashboard`);

            await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});

            // Devrait être redirigé vers login
            if (!checkUrl(page, 'login')) {
                throw new Error('Page protégée accessible sans auth');
            }
        });

        // ===== TESTS SESSION =====

        // Test 11: Session persistante
        await reporter.test('Session persiste après navigation', async () => {
            await login(page, 'passenger');

            // Naviguer vers différentes pages
            await page.goto(`${config.baseUrl}/passenger/history`);
            await sleep(500);

            // Vérifier toujours connecté
            const hasUserName = await page.evaluate((name) => {
                return document.body.textContent.includes(name);
            }, config.users.passenger.firstName);

            if (!hasUserName) {
                throw new Error('Session perdue après navigation');
            }

            await logout(page);
        });

    } catch (error) {
        console.error('Erreur fatale:', error);
        await takeScreenshot(page, 'auth-error');
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    const success = reporter.summary();
    process.exit(success ? 0 : 1);
}

// Exécuter si appelé directement
if (require.main === module) {
    runAuthTests();
}

module.exports = { runAuthTests };
