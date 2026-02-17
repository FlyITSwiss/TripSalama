/**
 * TripSalama - Smoke Tests
 * Tests rapides de santé de l'application
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const {
    sleep,
    waitForElement,
    checkUrl,
    TestReporter
} = require('./helpers');

async function runSmokeTests() {
    const reporter = new TestReporter('Smoke Tests');
    let browser;
    let page;

    try {
        console.log('\n🚀 Démarrage des Smoke Tests TripSalama\n');

        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // Test 1: Page d'accueil accessible
        await reporter.test('Page d\'accueil accessible', async () => {
            const response = await page.goto(config.baseUrl, {
                waitUntil: 'networkidle0',
                timeout: config.timeouts.navigation
            });

            if (!response || response.status() !== 200) {
                throw new Error(`HTTP ${response?.status() || 'no response'}`);
            }
        });

        // Test 2: Page de login accessible
        await reporter.test('Page de login accessible', async () => {
            const response = await page.goto(`${config.baseUrl}/login`, {
                waitUntil: 'networkidle0'
            });

            if (response.status() !== 200) {
                throw new Error(`HTTP ${response.status()}`);
            }

            const hasForm = await waitForElement(page, config.selectors.loginForm);
            if (!hasForm) {
                throw new Error('Formulaire de login non trouvé');
            }
        });

        // Test 3: Page d'inscription accessible
        await reporter.test('Page inscription passagère accessible', async () => {
            const response = await page.goto(`${config.baseUrl}/register/passenger`, {
                waitUntil: 'networkidle0'
            });

            if (response.status() !== 200) {
                throw new Error(`HTTP ${response.status()}`);
            }

            const hasForm = await waitForElement(page, config.selectors.registerForm);
            if (!hasForm) {
                throw new Error('Formulaire d\'inscription non trouvé');
            }
        });

        // Test 4: CSS chargé
        await reporter.test('Design System CSS chargé', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasCSSVariables = await page.evaluate(() => {
                const style = getComputedStyle(document.documentElement);
                return style.getPropertyValue('--primary') !== '';
            });

            if (!hasCSSVariables) {
                throw new Error('Variables CSS non chargées');
            }
        });

        // Test 5: JS chargé
        await reporter.test('JavaScript core chargé', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasAppConfig = await page.evaluate(() => {
                return typeof window.AppConfig !== 'undefined';
            });

            if (!hasAppConfig) {
                throw new Error('AppConfig non disponible');
            }
        });

        // Test 6: API de santé
        await reporter.test('API répond', async () => {
            const response = await page.goto(`${config.baseUrl}/api/auth.php?action=me`, {
                waitUntil: 'networkidle0'
            });

            // Devrait retourner 401 (non authentifié) ou 200
            if (response.status() !== 401 && response.status() !== 200) {
                throw new Error(`API status: ${response.status()}`);
            }
        });

        // Test 7: Assets statiques
        await reporter.test('Assets CSS accessibles', async () => {
            const response = await page.goto(`${config.baseUrl}/assets/css/tripsalama-core.css`);

            if (response.status() !== 200) {
                throw new Error(`CSS non accessible: ${response.status()}`);
            }
        });

        // Test 8: i18n chargé
        await reporter.test('Traductions chargées', async () => {
            await page.goto(`${config.baseUrl}/login`);

            // Vérifier que la page est en français par défaut
            const pageContent = await page.content();

            if (!pageContent.includes('Connexion') && !pageContent.includes('Login')) {
                throw new Error('Textes de traduction non trouvés');
            }
        });

        // Test 9: Responsive meta tag
        await reporter.test('Viewport mobile configuré', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasViewport = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="viewport"]');
                return meta && meta.content.includes('width=device-width');
            });

            if (!hasViewport) {
                throw new Error('Meta viewport non configuré');
            }
        });

        // Test 10: CSRF token présent
        await reporter.test('CSRF token généré', async () => {
            await page.goto(`${config.baseUrl}/login`);

            const hasCsrf = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="csrf-token"]');
                return meta && meta.content && meta.content.length > 0;
            });

            if (!hasCsrf) {
                throw new Error('CSRF token non trouvé');
            }
        });

    } catch (error) {
        console.error('Erreur fatale:', error);
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
    runSmokeTests();
}

module.exports = { runSmokeTests };
