/**
 * TripSalama - Audit Fonctionnel Complet
 * Tests BA - Vérification de chaque feature
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:8080';
const SCREENSHOTS_DIR = 'tests/playwright/audit-screenshots';

// Créer le dossier de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Rapport de bugs
const bugs = [];
function reportBug(severity, category, description, screenshot = null) {
    bugs.push({ severity, category, description, screenshot, timestamp: new Date().toISOString() });
    console.log(`🐛 [${severity}] ${category}: ${description}`);
}

test.describe('AUDIT FONCTIONNEL - TripSalama', () => {

    test.afterAll(async () => {
        // Sauvegarder le rapport de bugs
        const reportPath = path.join(SCREENSHOTS_DIR, 'bug-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(bugs, null, 2));
        console.log(`\n📋 Rapport sauvegardé: ${reportPath}`);
        console.log(`Total bugs trouvés: ${bugs.length}`);
    });

    // ==========================================
    // 1. PAGE DE CONNEXION
    // ==========================================
    test('1.1 - Page de connexion - Design et éléments', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Screenshot
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png`, fullPage: true });

        // Vérifier les éléments requis
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
        const submitBtn = page.locator('button[type="submit"]').first();
        const logo = page.locator('img[alt*="logo"], .logo, [class*="logo"]').first();

        // Tests
        if (!await emailInput.isVisible()) reportBug('HIGH', 'Login', 'Champ email non visible');
        if (!await passwordInput.isVisible()) reportBug('HIGH', 'Login', 'Champ mot de passe non visible');
        if (!await submitBtn.isVisible()) reportBug('HIGH', 'Login', 'Bouton de connexion non visible');

        // Vérifier le placeholder
        const emailPlaceholder = await emailInput.getAttribute('placeholder');
        const pwdPlaceholder = await passwordInput.getAttribute('placeholder');
        console.log(`Email placeholder: ${emailPlaceholder}`);
        console.log(`Password placeholder: ${pwdPlaceholder}`);

        // Vérifier lien inscription
        const registerLink = page.locator('a[href*="register"], a:has-text("inscription"), a:has-text("créer")').first();
        if (!await registerLink.isVisible().catch(() => false)) {
            reportBug('MEDIUM', 'Login', 'Lien vers inscription non visible');
        }

        // Vérifier lien mot de passe oublié
        const forgotLink = page.locator('a[href*="forgot"], a[href*="reset"], a:has-text("oublié")').first();
        if (!await forgotLink.isVisible().catch(() => false)) {
            reportBug('LOW', 'Login', 'Lien mot de passe oublié non visible');
        }
    });

    test('1.2 - Login - Validation des erreurs', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Test avec champs vides
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-login-empty-validation.png` });

        // Test avec email invalide
        await page.locator('input[type="email"], input[name="email"]').first().fill('invalid-email');
        await page.locator('input[type="password"], input[name="password"]').first().fill('test');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-login-invalid-email.png` });

        // Test avec mauvais credentials
        await page.locator('input[type="email"], input[name="email"]').first().fill('wrong@test.com');
        await page.locator('input[type="password"], input[name="password"]').first().fill('wrongpassword');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-login-wrong-credentials.png` });

        // Vérifier message d'erreur
        const errorMsg = page.locator('.error, .alert-danger, .alert-error, [class*="error"]').first();
        if (!await errorMsg.isVisible().catch(() => false)) {
            reportBug('MEDIUM', 'Login', 'Pas de message d\'erreur visible pour mauvais credentials');
        }
    });

    // ==========================================
    // 2. PAGE D'INSCRIPTION
    // ==========================================
    test('2.1 - Page inscription - Accès et design', async ({ page }) => {
        await page.goto(`${BASE_URL}/register`);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-register-page.png`, fullPage: true });

        // Vérifier les champs
        const fields = [
            { selector: 'input[name="name"], input[name="firstname"]', name: 'Prénom' },
            { selector: 'input[name="lastname"], input[name="surname"]', name: 'Nom' },
            { selector: 'input[type="email"], input[name="email"]', name: 'Email' },
            { selector: 'input[name="phone"], input[type="tel"]', name: 'Téléphone' },
            { selector: 'input[type="password"], input[name="password"]', name: 'Mot de passe' },
        ];

        for (const field of fields) {
            const el = page.locator(field.selector).first();
            if (!await el.isVisible().catch(() => false)) {
                reportBug('HIGH', 'Inscription', `Champ ${field.name} non visible`);
            }
        }

        // Vérifier choix du rôle (passagère/conductrice)
        const roleSelector = page.locator('select[name="role"], input[name="role"], [class*="role"]').first();
        const hasRoleChoice = await roleSelector.isVisible().catch(() => false);
        console.log(`Choix du rôle visible: ${hasRoleChoice}`);
    });

    test('2.2 - Inscription passagère - Flow complet', async ({ page }) => {
        await page.goto(`${BASE_URL}/register`);
        await page.waitForLoadState('networkidle');

        // Générer un email unique
        const uniqueEmail = `test_${Date.now()}@example.com`;

        // Remplir le formulaire
        const fillField = async (selector, value) => {
            const field = page.locator(selector).first();
            if (await field.isVisible().catch(() => false)) {
                await field.fill(value);
                return true;
            }
            return false;
        };

        await fillField('input[name="name"], input[name="firstname"]', 'Test');
        await fillField('input[name="lastname"]', 'User');
        await fillField('input[type="email"], input[name="email"]', uniqueEmail);
        await fillField('input[name="phone"], input[type="tel"]', '+212600000000');
        await fillField('input[type="password"], input[name="password"]', 'Test1234!');
        await fillField('input[name="password_confirmation"], input[name="confirm_password"]', 'Test1234!');

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-register-filled.png`, fullPage: true });

        // Soumettre
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-register-result.png`, fullPage: true });

        console.log(`URL après inscription: ${page.url()}`);
    });

    // ==========================================
    // 3. DASHBOARD PASSAGÈRE
    // ==========================================
    test('3.1 - Dashboard passagère - Vue générale', async ({ page }) => {
        // Login
        await page.goto(BASE_URL);
        await page.locator('input[type="email"]').first().fill('fatima@example.com');
        await page.locator('input[type="password"]').first().fill('Test1234!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/dashboard|passenger/, { timeout: 10000 });
        await page.waitForTimeout(2000);

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-passenger-dashboard.png`, fullPage: true });

        // Vérifier la carte
        const mapContainer = page.locator('#map, .map, .maplibregl-canvas, .leaflet-container, [class*="map"]').first();
        if (!await mapContainer.isVisible().catch(() => false)) {
            reportBug('HIGH', 'Dashboard', 'Carte non visible sur le dashboard');
        }

        // Vérifier navigation bottom
        const bottomNav = page.locator('.mobile-nav, .bottom-nav, nav').first();
        if (!await bottomNav.isVisible().catch(() => false)) {
            reportBug('MEDIUM', 'Dashboard', 'Navigation mobile non visible');
        }

        // Vérifier les éléments de réservation
        const pickupInput = page.locator('#pickupAddress, input[placeholder*="départ"], input[placeholder*="pickup"]').first();
        const dropoffInput = page.locator('#dropoffAddress, input[placeholder*="destination"], input[placeholder*="arrivée"]').first();

        console.log(`Champ départ visible: ${await pickupInput.isVisible().catch(() => false)}`);
        console.log(`Champ destination visible: ${await dropoffInput.isVisible().catch(() => false)}`);
    });

    test('3.2 - Dashboard - Test responsive mobile', async ({ page }) => {
        // Login
        await page.goto(BASE_URL);
        await page.locator('input[type="email"]').first().fill('fatima@example.com');
        await page.locator('input[type="password"]').first().fill('Test1234!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/dashboard|passenger/, { timeout: 10000 });

        // Test différentes tailles
        const viewports = [
            { width: 320, height: 568, name: 'iPhone SE' },
            { width: 375, height: 667, name: 'iPhone 8' },
            { width: 390, height: 844, name: 'iPhone 14' },
            { width: 414, height: 896, name: 'iPhone XR' },
        ];

        for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(500);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-responsive-${vp.name.replace(' ', '-')}.png`, fullPage: true });

            // Vérifier overflow horizontal
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });

            if (hasHorizontalScroll) {
                reportBug('MEDIUM', 'Responsive', `Overflow horizontal sur ${vp.name} (${vp.width}px)`);
            }
        }
    });

    test('3.3 - Dashboard - Vérifier glitches visuels', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.locator('input[type="email"]').first().fill('fatima@example.com');
        await page.locator('input[type="password"]').first().fill('Test1234!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/dashboard|passenger/, { timeout: 10000 });
        await page.waitForTimeout(2000);

        // Vérifier les éléments qui débordent
        const overflowIssues = await page.evaluate(() => {
            const issues = [];
            const elements = document.querySelectorAll('*');

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                // Vérifier si l'élément déborde de l'écran
                if (rect.right > window.innerWidth + 5) {
                    issues.push({
                        tag: el.tagName,
                        class: el.className,
                        overflow: 'right',
                        amount: rect.right - window.innerWidth
                    });
                }

                // Vérifier texte tronqué sans ellipsis
                if (el.scrollWidth > el.clientWidth && style.overflow !== 'hidden' && style.textOverflow !== 'ellipsis') {
                    if (el.innerText && el.innerText.length > 10) {
                        issues.push({
                            tag: el.tagName,
                            class: el.className,
                            issue: 'text-overflow',
                            text: el.innerText.substring(0, 30)
                        });
                    }
                }
            });

            return issues.slice(0, 10); // Limiter à 10
        });

        if (overflowIssues.length > 0) {
            console.log('Problèmes de débordement trouvés:', overflowIssues);
            overflowIssues.forEach(issue => {
                reportBug('LOW', 'Design', `Élément déborde: ${issue.tag}.${issue.class} - ${issue.overflow || issue.issue}`);
            });
        }

        // Vérifier les images cassées
        const brokenImages = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const broken = [];
            images.forEach(img => {
                if (!img.complete || img.naturalHeight === 0) {
                    broken.push(img.src);
                }
            });
            return broken;
        });

        if (brokenImages.length > 0) {
            brokenImages.forEach(src => {
                reportBug('MEDIUM', 'Design', `Image cassée: ${src}`);
            });
        }

        // Vérifier les erreurs console
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.reload();
        await page.waitForTimeout(2000);

        if (consoleErrors.length > 0) {
            consoleErrors.forEach(err => {
                reportBug('LOW', 'Console', `Erreur JS: ${err.substring(0, 100)}`);
            });
        }
    });

    // ==========================================
    // 4. HISTORIQUE
    // ==========================================
    test('4.1 - Page historique', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.locator('input[type="email"]').first().fill('fatima@example.com');
        await page.locator('input[type="password"]').first().fill('Test1234!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/dashboard|passenger/, { timeout: 10000 });

        // Naviguer vers historique
        await page.goto(`${BASE_URL}/passenger/history`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-history-page.png`, fullPage: true });

        // Vérifier structure
        const hasEmptyState = await page.locator('.empty, .no-rides, [class*="empty"]').first().isVisible().catch(() => false);
        const hasList = await page.locator('.ride-item, .history-item, [class*="ride"]').first().isVisible().catch(() => false);

        console.log(`État vide visible: ${hasEmptyState}`);
        console.log(`Liste de courses visible: ${hasList}`);

        if (!hasEmptyState && !hasList) {
            reportBug('MEDIUM', 'Historique', 'Ni liste ni état vide affiché');
        }
    });

    // ==========================================
    // 5. PROFIL
    // ==========================================
    test('5.1 - Page profil', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.locator('input[type="email"]').first().fill('fatima@example.com');
        await page.locator('input[type="password"]').first().fill('Test1234!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/dashboard|passenger/, { timeout: 10000 });

        // Naviguer vers profil
        await page.goto(`${BASE_URL}/profile`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-profile-page.png`, fullPage: true });

        // Vérifier les éléments du profil
        const avatar = page.locator('.avatar, img[class*="avatar"], img[class*="profile"]').first();
        const nameField = page.locator('input[name="name"], .profile-name, [class*="name"]').first();

        console.log(`Avatar visible: ${await avatar.isVisible().catch(() => false)}`);
        console.log(`Nom visible: ${await nameField.isVisible().catch(() => false)}`);

        // Vérifier bouton logout
        const logoutBtn = page.locator('button:has-text("déconnexion"), a:has-text("déconnexion"), [class*="logout"]').first();
        if (!await logoutBtn.isVisible().catch(() => false)) {
            reportBug('MEDIUM', 'Profil', 'Bouton de déconnexion non visible');
        }
    });

    // ==========================================
    // 6. DASHBOARD CONDUCTRICE
    // ==========================================
    test('6.1 - Dashboard conductrice', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.locator('input[type="email"]').first().fill('khadija@example.com');
        await page.locator('input[type="password"]').first().fill('Test1234!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);

        await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-driver-dashboard.png`, fullPage: true });

        console.log(`URL conductrice: ${page.url()}`);

        // Vérifier éléments conductrice
        const statusToggle = page.locator('[class*="status"], [class*="online"], [class*="toggle"]').first();
        const earningsDisplay = page.locator('[class*="earning"], [class*="revenue"], [class*="gain"]').first();

        console.log(`Toggle status visible: ${await statusToggle.isVisible().catch(() => false)}`);
        console.log(`Revenus visible: ${await earningsDisplay.isVisible().catch(() => false)}`);

        // Vérifier la carte
        const mapContainer = page.locator('#map, .map, .maplibregl-canvas').first();
        if (!await mapContainer.isVisible().catch(() => false)) {
            reportBug('HIGH', 'Driver', 'Carte non visible sur dashboard conductrice');
        }
    });

    // ==========================================
    // 7. VÉRIFICATIONS GLOBALES
    // ==========================================
    test('7.1 - Vérifier toutes les pages accessibles', async ({ page }) => {
        const pagesToCheck = [
            { url: '/', name: 'Accueil/Login' },
            { url: '/register', name: 'Inscription' },
            { url: '/login', name: 'Login' },
            { url: '/passenger/dashboard', name: 'Dashboard Passagère' },
            { url: '/passenger/history', name: 'Historique' },
            { url: '/profile', name: 'Profil' },
            { url: '/driver/dashboard', name: 'Dashboard Conductrice' },
        ];

        for (const p of pagesToCheck) {
            const response = await page.goto(`${BASE_URL}${p.url}`);
            const status = response?.status() || 0;
            console.log(`${p.name} (${p.url}): ${status}`);

            if (status >= 400 && status !== 401 && status !== 403) {
                reportBug('HIGH', 'Pages', `Page ${p.name} retourne erreur ${status}`);
            }

            await page.screenshot({ path: `${SCREENSHOTS_DIR}/page-${p.url.replace(/\//g, '-')}.png` });
        }
    });

    test('7.2 - Vérifier les traductions/textes', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');

        // Chercher du texte non traduit ou des clés i18n visibles
        const pageText = await page.evaluate(() => document.body.innerText);

        // Patterns problématiques
        const issues = [];

        // Clés i18n non traduites
        if (pageText.match(/\b[a-z]+\.[a-z]+\.[a-z]+\b/g)) {
            issues.push('Possible clé i18n non traduite');
        }

        // Lorem ipsum
        if (pageText.toLowerCase().includes('lorem ipsum')) {
            issues.push('Lorem ipsum trouvé');
        }

        // TODO/FIXME visible
        if (pageText.includes('TODO') || pageText.includes('FIXME')) {
            issues.push('TODO/FIXME visible');
        }

        // undefined/null visible
        if (pageText.includes('undefined') || pageText.includes('null')) {
            issues.push('undefined/null visible dans le texte');
        }

        issues.forEach(issue => {
            reportBug('LOW', 'Texte', issue);
        });

        console.log(`Vérification texte: ${issues.length} problèmes trouvés`);
    });

});
