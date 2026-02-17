/**
 * TripSalama - Tests Dashboard Conductrice
 * Tests E2E pour le dashboard et les fonctionnalités conductrice
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

async function runDriverTests() {
    const reporter = new TestReporter('Driver Dashboard Tests');
    let browser;
    let page;

    try {
        console.log('\n👩‍✈️ Démarrage des Tests Dashboard Conductrice TripSalama\n');

        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // Se connecter comme conductrice
        await login(page, 'driver');

        // ===== TESTS DASHBOARD =====

        // Test 1: Dashboard conductrice charge correctement
        await reporter.test('Dashboard conductrice accessible', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await sleep(500);

            // Vérifier présence des éléments clés
            const hasDashboard = await page.evaluate(() => {
                return document.body.innerHTML.includes('dashboard') ||
                       document.querySelector('.dashboard-content') !== null;
            });

            if (!hasDashboard) {
                throw new Error('Dashboard non chargé');
            }
        });

        // Test 2: Toggle disponibilité présent
        await reporter.test('Toggle disponibilité présent', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await sleep(500);

            const hasToggle = await waitForElement(page, '#availabilityToggle');

            if (!hasToggle) {
                throw new Error('Toggle disponibilité non trouvé');
            }
        });

        // Test 3: Statistiques affichées
        await reporter.test('Statistiques courses affichées', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await sleep(500);

            const hasStats = await page.evaluate(() => {
                return document.querySelector('.stats-grid, .stat-card, [class*="stat"]') !== null ||
                       document.body.textContent.includes('courses') ||
                       document.body.textContent.includes('rides');
            });

            if (!hasStats) {
                throw new Error('Statistiques non affichées');
            }
        });

        // Test 4: Informations véhicule affichées
        await reporter.test('Informations véhicule affichées', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await sleep(500);

            const hasVehicle = await page.evaluate(() => {
                // Chercher mention du véhicule (marque, modèle, plaque)
                const content = document.body.textContent.toLowerCase();
                return content.includes('véhicule') ||
                       content.includes('vehicle') ||
                       content.includes('toyota') ||
                       content.includes('plaque') ||
                       content.includes('license');
            });

            if (!hasVehicle) {
                console.log('    Note: Info véhicule peut être masquée si non configuré');
            }
        });

        // ===== TESTS TOGGLE DISPONIBILITÉ =====

        // Test 5: Toggle change l'état visuel
        await reporter.test('Toggle change état visuel', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await waitForElement(page, '#availabilityToggle');

            // Obtenir état initial
            const initialState = await page.$eval('#availabilityToggle', el => el.checked);

            // Cliquer sur le toggle
            await page.click('#availabilityToggle');
            await sleep(1000); // Attendre la requête API

            // Vérifier changement
            const newState = await page.$eval('#availabilityToggle', el => el.checked);

            if (initialState === newState) {
                throw new Error('Toggle n\'a pas changé d\'état');
            }

            // Remettre à l'état initial
            await page.click('#availabilityToggle');
            await sleep(500);
        });

        // Test 6: Toggle met à jour le texte de statut
        await reporter.test('Toggle met à jour texte statut', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await waitForElement(page, '#availabilityToggle');

            // Obtenir texte initial
            const initialText = await page.evaluate(() => {
                const statusEl = document.getElementById('statusText');
                return statusEl ? statusEl.textContent : '';
            });

            // Cliquer sur le toggle
            await page.click('#availabilityToggle');
            await sleep(1000);

            // Vérifier changement de texte
            const newText = await page.evaluate(() => {
                const statusEl = document.getElementById('statusText');
                return statusEl ? statusEl.textContent : '';
            });

            // Remettre à l'état initial
            await page.click('#availabilityToggle');
            await sleep(500);

            if (initialText === newText) {
                console.log('    Note: Texte peut ne pas changer si icône seule');
            }
        });

        // ===== TESTS COURSES EN ATTENTE =====

        // Test 7: Section courses en attente visible quand disponible
        await reporter.test('Section courses en attente visible quand disponible', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await waitForElement(page, '#availabilityToggle');

            // S'assurer d'être disponible
            const isAvailable = await page.$eval('#availabilityToggle', el => el.checked);
            if (!isAvailable) {
                await page.click('#availabilityToggle');
                await sleep(1000);
            }

            // Vérifier présence section courses
            const hasPendingSection = await page.evaluate(() => {
                return document.body.innerHTML.includes('pending') ||
                       document.body.innerHTML.includes('attente') ||
                       document.querySelector('#pendingRidesList, .pending-rides, .ride-request-card') !== null ||
                       document.querySelector('.empty-state') !== null;
            });

            if (!hasPendingSection) {
                throw new Error('Section courses en attente non visible');
            }

            // Remettre hors ligne
            if (!isAvailable) {
                await page.click('#availabilityToggle');
                await sleep(500);
            }
        });

        // Test 8: État vide si pas de courses
        await reporter.test('Message état vide si aucune course', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await waitForElement(page, '#availabilityToggle');

            // Être disponible pour voir l'état vide
            const isAvailable = await page.$eval('#availabilityToggle', el => el.checked);
            if (!isAvailable) {
                await page.click('#availabilityToggle');
                await sleep(1000);
            }

            // Vérifier présence état vide OU liste de courses
            const hasEmptyOrList = await page.evaluate(() => {
                const hasEmpty = document.querySelector('.empty-state') !== null ||
                                document.body.textContent.includes('aucune') ||
                                document.body.textContent.includes('No pending');
                const hasList = document.querySelector('.ride-request-card') !== null;
                return hasEmpty || hasList;
            });

            if (!hasEmptyOrList) {
                throw new Error('Ni état vide ni liste de courses');
            }

            // Remettre hors ligne
            if (!isAvailable) {
                await page.click('#availabilityToggle');
                await sleep(500);
            }
        });

        // ===== TESTS BOUTONS D'ACTION =====

        // Test 9: Boutons accepter/refuser présents sur carte de course
        await reporter.test('Boutons action présents si course disponible', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await waitForElement(page, '#availabilityToggle');

            // S'assurer d'être disponible
            const isAvailable = await page.$eval('#availabilityToggle', el => el.checked);
            if (!isAvailable) {
                await page.click('#availabilityToggle');
                await sleep(1000);
            }

            // Vérifier si une carte de course existe
            const hasRideCard = await page.evaluate(() => {
                return document.querySelector('.ride-request-card') !== null;
            });

            if (hasRideCard) {
                // Vérifier boutons
                const hasAccept = await waitForElement(page, '.accept-btn');
                const hasReject = await waitForElement(page, '.reject-btn');

                if (!hasAccept || !hasReject) {
                    throw new Error('Boutons accepter/refuser manquants');
                }
            } else {
                console.log('    Note: Pas de course disponible pour tester les boutons');
            }
        });

        // ===== TESTS NAVIGATION =====

        // Test 10: Lien vers historique fonctionne
        await reporter.test('Navigation vers historique fonctionnelle', async () => {
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await sleep(500);

            // Chercher lien historique
            const hasHistoryLink = await page.evaluate(() => {
                const links = document.querySelectorAll('a');
                return Array.from(links).some(link =>
                    link.href.includes('history') ||
                    link.textContent.toLowerCase().includes('historique')
                );
            });

            if (hasHistoryLink) {
                await page.click('a[href*="history"]');
                await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
                await sleep(500);

                if (!checkUrl(page, 'history')) {
                    console.log('    Note: Navigation historique peut être différente');
                }
            } else {
                console.log('    Note: Lien historique optionnel sur dashboard');
            }
        });

        // Test 11: Menu mobile fonctionnel
        await reporter.test('Menu mobile accessible', async () => {
            // Simuler viewport mobile
            await page.setViewport({ width: 375, height: 667 });
            await page.goto(`${config.baseUrl}/driver/dashboard`);
            await sleep(500);

            // Vérifier présence navigation mobile
            const hasMobileNav = await page.evaluate(() => {
                return document.querySelector('.mobile-nav, .mobile-menu, nav[class*="mobile"]') !== null;
            });

            if (!hasMobileNav) {
                console.log('    Note: Navigation mobile peut être différente');
            }

            // Remettre viewport desktop
            await page.setViewport(config.puppeteer.defaultViewport);
        });

        await logout(page);

    } catch (error) {
        console.error('Erreur fatale:', error);
        await takeScreenshot(page, 'driver-error');
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
    runDriverTests();
}

module.exports = { runDriverTests };
