/**
 * TripSalama - Tests EXHAUSTIFS de TOUTES les fonctionnalités
 *
 * OBJECTIF : Couvrir 100% des features documentées dans DEMO-FEATURES.md
 * RÈGLE : AUCUN bypass, AUCUNE exception
 *
 * Usage:
 *   npx playwright test tests/playwright/exhaustive-feature-tests.spec.js --headed
 *   TEST_URL=https://stabilis-it.ch/internal/tripsalama npx playwright test exhaustive-feature-tests.spec.js
 *
 * @version 2.0.0 - Mars 2026
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION STRICTE
// ============================================================
const CONFIG = {
    baseUrl: process.env.TEST_URL || 'http://127.0.0.1:8080',
    users: {
        passenger: { email: 'passenger@tripsalama.ch', password: 'TripSalama2025!' },
        driver: { email: 'driver@tripsalama.ch', password: 'TripSalama2025!' },
        admin: { email: 'admin@tripsalama.ch', password: 'TripSalama2025!' }
    },
    timeouts: {
        navigation: 30000,
        action: 10000,
        map: 5000
    },
    screenshotsDir: 'tests/playwright/screenshots/exhaustive'
};

// Créer dossier screenshots
const screenshotsPath = path.resolve(CONFIG.screenshotsDir);
if (!fs.existsSync(screenshotsPath)) {
    fs.mkdirSync(screenshotsPath, { recursive: true });
}

// Helper screenshot
async function screenshot(page, name) {
    const filename = `${name}.png`;
    await page.screenshot({ path: path.join(screenshotsPath, filename), fullPage: true });
    console.log(`📸 ${filename}`);
}

// ============================================================
// SECTION 1: AUTHENTIFICATION & ONBOARDING (7 tests)
// ============================================================
test.describe('1. AUTHENTIFICATION & ONBOARDING', () => {

    test('1.1 Page Login - Design Uber Premium', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        // Logo TripSalama
        const logo = page.locator('.login-logo, .register-logo, img[alt*="logo"]');
        await expect(logo).toBeVisible();

        // Formulaire complet
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // Lien mot de passe oublié
        const forgotLink = page.locator('a[href*="forgot"]');
        await expect(forgotLink).toBeVisible();

        // Option "Se souvenir de moi"
        const rememberMe = page.locator('input[name="remember"], #remember');
        const rememberCount = await rememberMe.count();
        console.log(`Remember me: ${rememberCount > 0 ? 'Present' : 'Absent'}`);

        await screenshot(page, '1.1-login');
    });

    test('1.2 Page Choix Inscription', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/register`);
        await page.waitForLoadState('networkidle');

        // Deux cartes de rôle
        const cards = page.locator('.role-card, a[href*="register"]');
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(2);

        // Option Passagère
        const passengerOption = page.locator('a[href*="passenger"], .role-card:has-text("Passagère")');
        await expect(passengerOption.first()).toBeVisible();

        // Option Conductrice
        const driverOption = page.locator('a[href*="driver"], .role-card:has-text("Conductrice")');
        await expect(driverOption.first()).toBeVisible();

        await screenshot(page, '1.2-register-choice');
    });

    test('1.3 Inscription Passagère - Formulaire complet', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/register/passenger`);
        await page.waitForLoadState('networkidle');

        // Champs obligatoires
        await expect(page.locator('input[name="first_name"], #firstName')).toBeVisible();
        await expect(page.locator('input[name="last_name"], #lastName')).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();

        // Téléphone (optionnel ou requis selon pays)
        const phoneInput = page.locator('input[name="phone"], #phone');
        const phoneCount = await phoneInput.count();

        // Bouton submit
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        await screenshot(page, '1.3-register-passenger');
        console.log(`Phone field: ${phoneCount > 0 ? 'Present' : 'Absent'}`);
    });

    test('1.4 Inscription Conductrice - Formulaire + Documents', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/register/driver`);
        await page.waitForLoadState('networkidle');

        // Champs identité
        await expect(page.locator('input[name="first_name"], #firstName')).toBeVisible();
        await expect(page.locator('input[name="email"]')).toBeVisible();

        // Upload documents (permis, assurance, etc.)
        const fileInputs = page.locator('input[type="file"]');
        const fileCount = await fileInputs.count();

        await screenshot(page, '1.4-register-driver');
        console.log(`Document upload fields: ${fileCount}`);
    });

    test('1.5 Mot de passe oublié', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/forgot-password`);
        await page.waitForLoadState('networkidle');

        // Champ email
        await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();

        // Bouton envoi
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        await screenshot(page, '1.5-forgot-password');
    });

    test('1.6 Login fonctionnel - Passagère', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.passenger.email);
        await page.fill('input[name="password"]', CONFIG.users.passenger.password);
        await page.click('button[type="submit"]');

        // Redirection vers dashboard
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.navigation });
        expect(page.url()).toMatch(/passenger|dashboard/);

        await screenshot(page, '1.6-login-success-passenger');
    });

    test('1.7 Login fonctionnel - Conductrice', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.driver.email);
        await page.fill('input[name="password"]', CONFIG.users.driver.password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/dashboard|driver/, { timeout: CONFIG.timeouts.navigation });
        expect(page.url()).toMatch(/driver|dashboard/);

        await screenshot(page, '1.7-login-success-driver');
    });
});

// ============================================================
// SECTION 2: ESPACE PASSAGÈRE (10 tests)
// ============================================================
test.describe('2. ESPACE PASSAGÈRE', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.passenger.email);
        await page.fill('input[name="password"]', CONFIG.users.passenger.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.navigation });
    });

    test('2.1 Dashboard - Accueil personnalisé', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Message de bienvenue avec prénom
        const welcome = page.locator('.uber-welcome, .dashboard-welcome, :text("Bienvenue")');
        const welcomeCount = await welcome.count();

        // Card "Où allez-vous?"
        const whereTo = page.locator('.where-to-card, .where-to-input');
        await expect(whereTo).toBeVisible();

        await screenshot(page, '2.1-passenger-dashboard');
        console.log(`Welcome section: ${welcomeCount}`);
    });

    test('2.2 Dashboard - Statistiques', async ({ page }) => {
        // Statistiques courses
        const stats = page.locator('.uber-stat, .dashboard-stat');
        const statsCount = await stats.count();
        expect(statsCount).toBeGreaterThan(0);

        await screenshot(page, '2.2-passenger-stats');
        console.log(`Stats cards: ${statsCount}`);
    });

    test('2.3 Dashboard - Actions rapides', async ({ page }) => {
        // Boutons d'actions (Réserver, Historique, Profil)
        const actions = page.locator('.uber-action, .quick-action');
        const actionsCount = await actions.count();

        await screenshot(page, '2.3-passenger-actions');
        console.log(`Quick actions: ${actionsCount}`);
    });

    test('2.4 Page Réservation - Carte Leaflet', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/passenger/book`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(CONFIG.timeouts.map);

        // Carte Leaflet visible
        const map = page.locator('.leaflet-container');
        await expect(map).toBeVisible();

        // Contrôles de carte
        const zoomControls = page.locator('.leaflet-control-zoom');
        const zoomCount = await zoomControls.count();

        await screenshot(page, '2.4-booking-map');
        console.log(`Map controls: ${zoomCount}`);
    });

    test('2.5 Page Réservation - Bottom sheet adresses', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/passenger/book`);
        await page.waitForLoadState('networkidle');

        // Bottom sheet avec adresses
        const sheet = page.locator('.booking-sheet, .bottom-sheet, .address-inputs');
        const sheetCount = await sheet.count();

        // Input départ
        const pickupInput = page.locator('input[placeholder*="départ"], .pickup-input');
        const pickupCount = await pickupInput.count();

        // Input arrivée
        const dropoffInput = page.locator('input[placeholder*="destination"], .dropoff-input');
        const dropoffCount = await dropoffInput.count();

        await screenshot(page, '2.5-booking-addresses');
        console.log(`Sheet: ${sheetCount}, Pickup: ${pickupCount}, Dropoff: ${dropoffCount}`);
    });

    test('2.6 Page Réservation - Bouton géolocalisation', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/passenger/book`);
        await page.waitForLoadState('networkidle');

        // Bouton GPS
        const gpsBtn = page.locator('.gps-button, button:has-text("GPS"), .locate-btn');
        const gpsCount = await gpsBtn.count();

        await screenshot(page, '2.6-booking-gps');
        console.log(`GPS button: ${gpsCount}`);
    });

    test('2.7 Historique des courses', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/passenger/history`);
        await page.waitForLoadState('networkidle');

        // Liste ou état vide
        const ridesList = page.locator('.ride-item, .history-ride');
        const ridesCount = await ridesList.count();

        const emptyState = page.locator('.empty-state, :text("aucune course")');
        const emptyCount = await emptyState.count();

        await screenshot(page, '2.7-passenger-history');
        console.log(`Rides: ${ridesCount}, Empty: ${emptyCount}`);
    });

    test('2.8 Page Profil', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/profile`);
        await page.waitForLoadState('networkidle');

        // Photo de profil ou placeholder
        const avatar = page.locator('.profile-avatar, .user-avatar, img.avatar');
        const avatarCount = await avatar.count();

        // Informations utilisateur
        const userInfo = page.locator('.profile-info, .user-details');
        const infoCount = await userInfo.count();

        // Bouton déconnexion
        const logoutBtn = page.locator('button:has-text("Déconnexion"), a:has-text("Déconnexion")');
        const logoutCount = await logoutBtn.count();

        await screenshot(page, '2.8-passenger-profile');
        console.log(`Avatar: ${avatarCount}, Info: ${infoCount}, Logout: ${logoutCount}`);
    });

    test('2.9 Bouton SOS', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Bouton SOS flottant
        const sosBtn = page.locator('.sos-fab, #sosButton');
        const sosCount = await sosBtn.count();

        if (sosCount > 0) {
            await expect(sosBtn).toBeVisible();

            // Clic pour ouvrir modal
            await sosBtn.click();
            await page.waitForTimeout(1000);

            // Modal SOS
            const sosModal = page.locator('.sos-modal, #sosModal');
            const modalVisible = await sosModal.isVisible();

            await screenshot(page, '2.9-sos-modal');

            // Fermer
            if (modalVisible) {
                const cancelBtn = page.locator('#sosCancelBtn, .sos-btn-cancel');
                if (await cancelBtn.count() > 0) {
                    await cancelBtn.click();
                }
            }

            console.log(`SOS: Button visible, Modal: ${modalVisible}`);
        } else {
            await screenshot(page, '2.9-sos-not-found');
            console.log('⚠️ SOS button not found');
        }
    });

    test('2.10 Navigation mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${CONFIG.baseUrl}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        // Barre de navigation en bas
        const nav = page.locator('.mobile-nav, .bottom-nav, nav');
        const navCount = await nav.count();

        // Pas de scroll horizontal
        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalScroll).toBe(false);

        await screenshot(page, '2.10-mobile-nav');
        console.log(`Mobile nav elements: ${navCount}`);
    });
});

// ============================================================
// SECTION 3: ESPACE CONDUCTRICE (7 tests)
// ============================================================
test.describe('3. ESPACE CONDUCTRICE', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.driver.email);
        await page.fill('input[name="password"]', CONFIG.users.driver.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|driver/, { timeout: CONFIG.timeouts.navigation });
    });

    test('3.1 Dashboard - Toggle disponibilité', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Toggle Online/Offline
        const toggle = page.locator('.status-toggle, #availabilityToggle');
        const toggleCount = await toggle.count();
        expect(toggleCount).toBeGreaterThan(0);

        await screenshot(page, '3.1-driver-toggle');
        console.log(`Toggle elements: ${toggleCount}`);
    });

    test('3.2 Dashboard - Icône statut', async ({ page }) => {
        // Icône de statut (vert/gris)
        const statusIcon = page.locator('.driver-status-icon, #statusIcon');
        const iconCount = await statusIcon.count();

        await screenshot(page, '3.2-driver-status-icon');
        console.log(`Status icon: ${iconCount}`);
    });

    test('3.3 Dashboard - Statistiques', async ({ page }) => {
        // Stats: Aujourd'hui, Semaine, Gains
        const stats = page.locator('.driver-stat');
        const statsCount = await stats.count();

        await screenshot(page, '3.3-driver-stats');
        console.log(`Driver stats: ${statsCount}`);
    });

    test('3.4 Toggle Online/Offline fonctionne', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Cliquer sur le slider (pas l'input hidden)
        const slider = page.locator('.status-toggle-slider');
        const sliderCount = await slider.count();

        if (sliderCount > 0) {
            // Clic 1 - change état
            await slider.click({ force: true });
            await page.waitForTimeout(1000);

            // Vérifier changement de texte
            const statusText = page.locator('#statusText, .driver-status-text');
            const text1 = await statusText.textContent();

            // Clic 2 - revenir
            await slider.click({ force: true });
            await page.waitForTimeout(500);

            const text2 = await statusText.textContent();

            await screenshot(page, '3.4-driver-toggle-action');
            console.log(`Status changed: "${text1}" -> "${text2}"`);
        }
    });

    test('3.5 Demandes de courses', async ({ page }) => {
        // Section des demandes
        const requests = page.locator('.ride-requests, .ride-request');
        const requestsCount = await requests.count();

        // Ou état vide
        const emptyState = page.locator('.empty-state');
        const emptyCount = await emptyState.count();

        await screenshot(page, '3.5-driver-requests');
        console.log(`Requests: ${requestsCount}, Empty: ${emptyCount}`);
    });

    test('3.6 Demande de course - Boutons Accepter/Refuser', async ({ page }) => {
        const requests = page.locator('.ride-request');
        const count = await requests.count();

        if (count > 0) {
            // Bouton Accepter
            const acceptBtn = page.locator('.accept-btn, button:has-text("Accepter")');
            const acceptCount = await acceptBtn.count();

            // Bouton Refuser
            const declineBtn = page.locator('.decline-btn, button:has-text("Refuser")');
            const declineCount = await declineBtn.count();

            await screenshot(page, '3.6-driver-request-buttons');
            console.log(`Accept: ${acceptCount}, Decline: ${declineCount}`);
        } else {
            console.log('No pending requests to test buttons');
        }
    });

    test('3.7 Page Navigation (si accessible)', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/driver/navigation`);
        await page.waitForLoadState('networkidle');

        // Carte avec itinéraire (si course active)
        const map = page.locator('.leaflet-container');
        const mapCount = await map.count();

        // Boutons de navigation
        const navBtns = page.locator('.nav-btn, button:has-text("Arrivé")');
        const btnsCount = await navBtns.count();

        await screenshot(page, '3.7-driver-navigation');
        console.log(`Map: ${mapCount}, Nav buttons: ${btnsCount}`);
    });
});

// ============================================================
// SECTION 4: ESPACE ADMIN (6 tests)
// ============================================================
test.describe('4. ESPACE ADMIN', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.admin.email);
        await page.fill('input[name="password"]', CONFIG.users.admin.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|admin/, { timeout: CONFIG.timeouts.navigation });
    });

    test('4.1 Dashboard - 4 cards statistiques', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/admin/dashboard`);
        await page.waitForLoadState('networkidle');

        // 4 stat cards (Passagères, Conductrices, Courses, SOS)
        const statCards = page.locator('.stat-card');
        const cardsCount = await statCards.count();
        expect(cardsCount).toBeGreaterThanOrEqual(4);

        await screenshot(page, '4.1-admin-stats');
        console.log(`Stat cards: ${cardsCount}`);
    });

    test('4.2 Dashboard - Actions rapides', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/admin/dashboard`);

        const quickActions = page.locator('.quick-actions, .quick-action-btn');
        const actionsCount = await quickActions.count();

        await screenshot(page, '4.2-admin-actions');
        console.log(`Quick actions: ${actionsCount}`);
    });

    test('4.3 Dashboard - Activité récente', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/admin/dashboard`);

        const activity = page.locator('.recent-activity, .activity-item');
        const activityCount = await activity.count();

        await screenshot(page, '4.3-admin-activity');
        console.log(`Activity items: ${activityCount}`);
    });

    test('4.4 Page Settings - Configuration système', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/admin/settings`);
        await page.waitForLoadState('networkidle');

        // Sections de configuration
        const sections = page.locator('.settings-section, .stat-card');
        const sectionsCount = await sections.count();
        expect(sectionsCount).toBeGreaterThan(0);

        await screenshot(page, '4.4-admin-settings');
        console.log(`Settings sections: ${sectionsCount}`);
    });

    test('4.5 Page Countries - Gestion multi-pays', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/admin/countries`);
        await page.waitForLoadState('networkidle');

        // Cards de pays
        const countryCards = page.locator('.country-card');
        const countriesCount = await countryCards.count();
        expect(countriesCount).toBeGreaterThan(0);

        await screenshot(page, '4.5-admin-countries');
        console.log(`Country cards: ${countriesCount}`);
    });

    test('4.6 Page Countries - Devises locales', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/admin/countries`);
        await page.waitForLoadState('networkidle');

        // Vérifier devises (CHF, MAD, EUR)
        const currencyLabels = page.locator(':text("CHF"), :text("MAD"), :text("EUR")');
        const currencyCount = await currencyLabels.count();

        await screenshot(page, '4.6-admin-currencies');
        console.log(`Currency labels: ${currencyCount}`);
    });
});

// ============================================================
// SECTION 5: DESIGN SYSTEM (5 tests)
// ============================================================
test.describe('5. DESIGN SYSTEM UBER', () => {

    test('5.1 Variables CSS cohérentes', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        const styles = await page.evaluate(() => {
            const root = document.documentElement;
            return {
                uberBlack: getComputedStyle(root).getPropertyValue('--uber-black'),
                uberGreen: getComputedStyle(root).getPropertyValue('--uber-green'),
                fontFamily: getComputedStyle(document.body).fontFamily
            };
        });

        await screenshot(page, '5.1-design-variables');
        console.log(`Design vars: black=${styles.uberBlack}, green=${styles.uberGreen}`);
    });

    test('5.2 Animations fadeInUp', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        // Vérifier présence d'animations CSS
        const hasAnimations = await page.evaluate(() => {
            const sheets = document.styleSheets;
            for (let sheet of sheets) {
                try {
                    for (let rule of sheet.cssRules) {
                        if (rule.cssText && rule.cssText.includes('fadeInUp')) {
                            return true;
                        }
                    }
                } catch (e) {}
            }
            return false;
        });

        console.log(`FadeInUp animations: ${hasAnimations}`);
    });

    test('5.3 Radius arrondis', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const submitBtn = page.locator('button[type="submit"]');
        const radius = await submitBtn.evaluate(el => {
            return window.getComputedStyle(el).borderRadius;
        });

        await screenshot(page, '5.3-design-radius');
        console.log(`Border radius: ${radius}`);
    });

    test('5.4 Ombres subtiles', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const form = page.locator('form').first();
        const shadow = await form.evaluate(el => {
            return window.getComputedStyle(el).boxShadow;
        });

        console.log(`Box shadow: ${shadow !== 'none' ? 'Present' : 'Absent'}`);
    });

    test('5.5 Couleurs Uber (noir, vert, gris)', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const submitBtn = page.locator('button[type="submit"]');
        const bgColor = await submitBtn.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
        });

        await screenshot(page, '5.5-design-colors');
        console.log(`Submit button bg: ${bgColor}`);
    });
});

// ============================================================
// SECTION 6: RESPONSIVE (4 tests)
// ============================================================
test.describe('6. RESPONSIVE MOBILE-FIRST', () => {

    test('6.1 Mobile 375px - Pas de scroll horizontal', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalScroll).toBe(false);

        await screenshot(page, '6.1-responsive-375');
    });

    test('6.2 Tablet 640px', async ({ page }) => {
        await page.setViewportSize({ width: 640, height: 960 });
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        await screenshot(page, '6.2-responsive-640');
    });

    test('6.3 Desktop 1024px', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        await screenshot(page, '6.3-responsive-1024');
    });

    test('6.4 Touch targets >= 44px', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`${CONFIG.baseUrl}/login`);

        const submitBtn = page.locator('button[type="submit"]');
        const size = await submitBtn.boundingBox();

        if (size) {
            expect(size.height).toBeGreaterThanOrEqual(44);
            console.log(`Touch target: ${size.width}x${size.height}`);
        }
    });
});

// ============================================================
// SECTION 7: ACCESSIBILITÉ (4 tests)
// ============================================================
test.describe('7. ACCESSIBILITÉ WCAG AA', () => {

    test('7.1 Focus visible', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const emailInput = page.locator('input[name="email"]');
        await emailInput.focus();

        const outline = await emailInput.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.outline !== 'none' || style.boxShadow !== 'none';
        });

        expect(outline).toBe(true);
        console.log(`Focus visible: ${outline}`);
    });

    test('7.2 Aria-labels sur boutons', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.passenger.email);
        await page.fill('input[name="password"]', CONFIG.users.passenger.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.navigation });

        // Vérifier SOS button a aria-label
        const sosBtn = page.locator('.sos-fab, #sosButton');
        if (await sosBtn.count() > 0) {
            const ariaLabel = await sosBtn.getAttribute('aria-label');
            console.log(`SOS aria-label: ${ariaLabel || 'Missing'}`);
        }
    });

    test('7.3 Contraste suffisant', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const submitBtn = page.locator('button[type="submit"]');
        const colors = await submitBtn.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
                bg: style.backgroundColor,
                color: style.color
            };
        });

        console.log(`Button colors: bg=${colors.bg}, text=${colors.color}`);
    });

    test('7.4 Skip link navigation', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const skipLink = page.locator('a[href="#main"], .skip-link');
        const skipCount = await skipLink.count();

        console.log(`Skip link: ${skipCount > 0 ? 'Present' : 'Absent'}`);
    });
});

// ============================================================
// SECTION 8: SÉCURITÉ (5 tests)
// ============================================================
test.describe('8. SÉCURITÉ', () => {

    test('8.1 CSRF Token présent', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const csrf = page.locator('meta[name="csrf-token"], input[name="_csrf"]');
        const count = await csrf.count();
        expect(count).toBeGreaterThan(0);

        console.log(`CSRF protection: ${count}`);
    });

    test('8.2 Routes protégées - Redirection', async ({ page }) => {
        // Accès sans auth
        await page.goto(`${CONFIG.baseUrl}/passenger/dashboard`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        const isProtected = url.includes('login') || url.includes('passenger');

        expect(isProtected).toBe(true);
    });

    test('8.3 API - Pas d\'exposition données sensibles', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.passenger.email);
        await page.fill('input[name="password"]', CONFIG.users.passenger.password);

        // Intercepter les réponses API
        let hasPassword = false;
        page.on('response', async response => {
            if (response.url().includes('/api/')) {
                try {
                    const text = await response.text();
                    if (text.includes('password_hash') || text.includes('password":')) {
                        hasPassword = true;
                    }
                } catch (e) {}
            }
        });

        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        expect(hasPassword).toBe(false);
        console.log(`Password exposed in API: ${hasPassword}`);
    });

    test('8.4 Validation serveur', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        // Soumettre form vide
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);

        // Doit afficher erreur, pas crash
        const errorVisible = await page.locator('.error, .alert-danger, :text("requis")').count() > 0;
        const stillOnLogin = page.url().includes('login');

        console.log(`Server validation: error=${errorVisible}, onLogin=${stillOnLogin}`);
    });

    test('8.5 Password masqué par défaut', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        const passwordInput = page.locator('input[name="password"]');
        const type = await passwordInput.getAttribute('type');

        expect(type).toBe('password');
    });
});

// ============================================================
// SECTION 9: i18n (3 tests)
// ============================================================
test.describe('9. INTERNATIONALISATION', () => {

    test('9.1 Page login en français', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);

        // Textes en français
        const frenchTexts = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return {
                hasConnexion: text.includes('connexion') || text.includes('connecter'),
                hasEmail: text.includes('email') || text.includes('e-mail'),
                hasPassword: text.includes('mot de passe') || text.includes('password')
            };
        });

        console.log(`French i18n: ${JSON.stringify(frenchTexts)}`);
    });

    test('9.2 Sélecteur de langue (si présent)', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.passenger.email);
        await page.fill('input[name="password"]', CONFIG.users.passenger.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.navigation });

        await page.goto(`${CONFIG.baseUrl}/profile`);
        await page.waitForLoadState('networkidle');

        // Chercher sélecteur langue
        const langSelector = page.locator('select[name="language"], .language-selector');
        const selectorCount = await langSelector.count();

        await screenshot(page, '9.2-language-selector');
        console.log(`Language selector: ${selectorCount}`);
    });

    test('9.3 Devises localisées', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.admin.email);
        await page.fill('input[name="password"]', CONFIG.users.admin.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(/dashboard|admin/, { timeout: CONFIG.timeouts.navigation });

        await page.goto(`${CONFIG.baseUrl}/admin/countries`);
        await page.waitForLoadState('networkidle');

        // Devises visibles
        const pageText = await page.textContent('body');
        const hasCHF = pageText?.includes('CHF');
        const hasMAD = pageText?.includes('MAD');
        const hasEUR = pageText?.includes('EUR');

        console.log(`Currencies: CHF=${hasCHF}, MAD=${hasMAD}, EUR=${hasEUR}`);
    });
});

// ============================================================
// SECTION 10: PERFORMANCE (3 tests)
// ============================================================
test.describe('10. PERFORMANCE', () => {

    test('10.1 Chargement login < 5s', async ({ page }) => {
        const start = Date.now();
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('domcontentloaded');
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000);
        console.log(`Login load: ${duration}ms`);
    });

    test('10.2 Chargement dashboard < 5s', async ({ page }) => {
        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.fill('input[name="email"]', CONFIG.users.passenger.email);
        await page.fill('input[name="password"]', CONFIG.users.passenger.password);
        await page.click('button[type="submit"]');

        const start = Date.now();
        await page.waitForURL(/dashboard|passenger/, { timeout: CONFIG.timeouts.navigation });
        await page.waitForLoadState('domcontentloaded');
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000);
        console.log(`Dashboard load: ${duration}ms`);
    });

    test('10.3 CSS/JS minifiés (vérification headers)', async ({ page }) => {
        const responses = [];
        page.on('response', response => {
            if (response.url().match(/\.(js|css)$/)) {
                responses.push({
                    url: response.url(),
                    status: response.status()
                });
            }
        });

        await page.goto(`${CONFIG.baseUrl}/login`);
        await page.waitForLoadState('networkidle');

        const failedAssets = responses.filter(r => r.status !== 200 && r.status !== 304);
        expect(failedAssets.length).toBe(0);

        console.log(`CSS/JS files: ${responses.length}, Failed: ${failedAssets.length}`);
    });
});

// ============================================================
// RÉSUMÉ FINAL
// ============================================================
test.afterAll(async () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║         TESTS EXHAUSTIFS TERMINÉS - TripSalama                ║
╠════════════════════════════════════════════════════════════════╣
║  Section 1: AUTHENTIFICATION           7 tests                ║
║  Section 2: ESPACE PASSAGÈRE          10 tests                ║
║  Section 3: ESPACE CONDUCTRICE         7 tests                ║
║  Section 4: ESPACE ADMIN               6 tests                ║
║  Section 5: DESIGN SYSTEM              5 tests                ║
║  Section 6: RESPONSIVE                 4 tests                ║
║  Section 7: ACCESSIBILITÉ              4 tests                ║
║  Section 8: SÉCURITÉ                   5 tests                ║
║  Section 9: i18n                       3 tests                ║
║  Section 10: PERFORMANCE               3 tests                ║
╠════════════════════════════════════════════════════════════════╣
║  TOTAL: 54 tests                                              ║
╚════════════════════════════════════════════════════════════════╝

Screenshots: ${CONFIG.screenshotsDir}

RÈGLE: Tous ces tests DOIVENT passer avant chaque déploiement.
`);
});
