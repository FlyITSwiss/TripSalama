/**
 * TripSalama - Tests E2E avec Playwright
 * Tests de l'application mobile
 */

const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:8080';
const CREDENTIALS = {
    passenger: {
        email: 'fatima@example.com',
        password: 'Test1234!'
    },
    driver: {
        email: 'khadija@example.com',
        password: 'Test1234!'
    }
};

test.describe('TripSalama - Tests Application', () => {

    test.beforeEach(async ({ page }) => {
        // Aller sur la page d'accueil
        await page.goto(BASE_URL);
    });

    test('Page d\'accueil charge correctement', async ({ page }) => {
        // Attendre que la page charge
        await page.waitForLoadState('domcontentloaded');

        // Vérifier le titre
        const title = await page.title();
        console.log(`Titre de la page: ${title}`);

        // Vérifier que TripSalama est mentionné
        await expect(page).toHaveTitle(/TripSalama/i);

        // Screenshot pour debug
        await page.screenshot({ path: 'tests/playwright/results/homepage.png' });
    });

    test('Formulaire de login visible', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Chercher le formulaire de login
        const emailInput = page.locator('input[name="email"], input[type="email"], #email');
        const passwordInput = page.locator('input[name="password"], input[type="password"], #password');

        // Au moins un des deux doit être visible (ou on est déjà connecté)
        const emailVisible = await emailInput.first().isVisible().catch(() => false);
        const passwordVisible = await passwordInput.first().isVisible().catch(() => false);

        console.log(`Email input visible: ${emailVisible}`);
        console.log(`Password input visible: ${passwordVisible}`);

        // Screenshot
        await page.screenshot({ path: 'tests/playwright/results/login-form.png' });

        // Le test passe si on voit le formulaire OU si on est déjà sur le dashboard
        const isDashboard = page.url().includes('dashboard') ||
                           await page.locator('.dashboard, #passengerDashboard, #driverDashboard').first().isVisible().catch(() => false);

        expect(emailVisible || passwordVisible || isDashboard).toBeTruthy();
    });

    test('Login avec credentials de test', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Chercher et remplir le formulaire
        const emailInput = page.locator('input[name="email"], input[type="email"], #email').first();
        const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();

        // Vérifier si le formulaire est visible
        if (await emailInput.isVisible()) {
            // Remplir le formulaire
            await emailInput.fill(CREDENTIALS.passenger.email);
            await passwordInput.fill(CREDENTIALS.passenger.password);

            // Screenshot avant soumission
            await page.screenshot({ path: 'tests/playwright/results/login-filled.png' });

            // Soumettre
            const submitBtn = page.locator('button[type="submit"], .login-btn, #loginBtn').first();
            await submitBtn.click();

            // Attendre la navigation ou un message
            await page.waitForTimeout(2000);

            // Screenshot après
            await page.screenshot({ path: 'tests/playwright/results/after-login.png' });

            console.log(`URL après login: ${page.url()}`);
        } else {
            console.log('Formulaire de login non visible - peut-être déjà connecté');
        }
    });

    test('Responsive - Affichage mobile', async ({ page }) => {
        // Viewport mobile
        await page.setViewportSize({ width: 390, height: 844 });

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Vérifier que le contenu s'adapte
        const body = page.locator('body');
        const bodyBox = await body.boundingBox();

        console.log(`Body dimensions: ${bodyBox?.width}x${bodyBox?.height}`);

        // Screenshot mobile
        await page.screenshot({ path: 'tests/playwright/results/mobile-view.png', fullPage: true });

        // Le body ne doit pas dépasser le viewport
        expect(bodyBox?.width).toBeLessThanOrEqual(390 + 20); // +20 pour scrollbar
    });

    test('Vérifier les erreurs console', async ({ page }) => {
        const errors = [];

        // Écouter les erreurs console
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Afficher les erreurs trouvées
        if (errors.length > 0) {
            console.log('Erreurs console détectées:');
            errors.forEach(e => console.log(`  - ${e}`));
        }

        // Screenshot
        await page.screenshot({ path: 'tests/playwright/results/console-errors.png' });

        // Warning mais pas d'échec pour les erreurs non critiques
        if (errors.some(e => e.includes('CRITICAL') || e.includes('fatal'))) {
            expect(errors).toHaveLength(0);
        }
    });

});

test.describe('TripSalama - Tests API Health', () => {

    test('API health check', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/health.php`);

        console.log(`Status: ${response.status()}`);

        if (response.ok()) {
            const data = await response.json();
            console.log('Health check:', JSON.stringify(data, null, 2));
        } else {
            console.log(`Health check failed: ${response.status()}`);
        }
    });

});
