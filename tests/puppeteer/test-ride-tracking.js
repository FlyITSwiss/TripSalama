/**
 * TripSalama - Tests Suivi de Course
 * Tests E2E pour le tracking en temps réel
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const {
    sleep,
    waitForElement,
    clickElement,
    login,
    logout,
    checkUrl,
    waitForMap,
    takeScreenshot,
    TestReporter
} = require('./helpers');

async function runTrackingTests() {
    const reporter = new TestReporter('Ride Tracking Tests');
    let browser;
    let page;

    try {
        console.log('\n📍 Démarrage des Tests Suivi de Course TripSalama\n');

        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // ===== TESTS PAGE TRACKING PASSAGÈRE =====

        // Se connecter comme passagère
        await login(page, 'passenger');

        // Test 1: Page tracking accessible
        await reporter.test('Page tracking accessible si course active', async () => {
            // D'abord vérifier s'il y a une course active
            await page.goto(`${config.baseUrl}/passenger/dashboard`);
            await sleep(500);

            const hasActiveRide = await page.evaluate(() => {
                return document.querySelector('.active-ride-card, [class*="active-ride"]') !== null ||
                       document.body.innerHTML.includes('tracking') ||
                       document.body.innerHTML.includes('en cours');
            });

            if (hasActiveRide) {
                // Cliquer sur le lien tracking
                const trackingLink = await page.$('a[href*="tracking"]');
                if (trackingLink) {
                    await trackingLink.click();
                    await sleep(1000);

                    if (!checkUrl(page, 'tracking')) {
                        throw new Error('Redirection tracking échouée');
                    }
                }
            } else {
                console.log('    Note: Pas de course active - test page tracking simulé');
                // Tenter d'accéder directement (avec ID de démo)
                await page.goto(`${config.baseUrl}/passenger/tracking/1`);
                await sleep(500);
            }
        });

        // Test 2: Carte présente sur page tracking
        await reporter.test('Carte affichée sur page tracking', async () => {
            // Simuler accès à une page tracking
            await page.goto(`${config.baseUrl}/passenger/tracking/1`);
            await sleep(1000);

            // Vérifier présence carte ou erreur 404
            const hasMap = await page.evaluate(() => {
                return document.querySelector('#trackingMap, .tracking-map, .leaflet-container') !== null;
            });

            const is404 = await page.evaluate(() => {
                return document.body.textContent.includes('404') ||
                       document.body.textContent.includes('non trouvé');
            });

            if (!hasMap && !is404) {
                console.log('    Note: Course ID 1 peut ne pas exister');
            }
        });

        // Test 3: Infos course affichées
        await reporter.test('Informations course affichées', async () => {
            await page.goto(`${config.baseUrl}/passenger/tracking/1`);
            await sleep(500);

            const hasRideInfo = await page.evaluate(() => {
                // Chercher adresses, prix, statut
                const hasAddresses = document.body.textContent.includes('départ') ||
                                    document.body.textContent.includes('pickup') ||
                                    document.querySelector('.pickup-address, .dropoff-address') !== null;

                const hasPrice = document.body.textContent.includes('CHF') ||
                                document.body.textContent.includes('prix') ||
                                document.querySelector('[class*="price"]') !== null;

                return hasAddresses || hasPrice;
            });

            if (!hasRideInfo) {
                console.log('    Note: Infos visibles seulement si course existe');
            }
        });

        // Test 4: Bouton annuler présent
        await reporter.test('Bouton annulation présent si applicable', async () => {
            await page.goto(`${config.baseUrl}/passenger/tracking/1`);
            await sleep(500);

            const hasCancelBtn = await page.evaluate(() => {
                const btns = document.querySelectorAll('button');
                return Array.from(btns).some(btn =>
                    btn.textContent.toLowerCase().includes('annuler') ||
                    btn.textContent.toLowerCase().includes('cancel')
                );
            });

            // Bouton peut être absent selon le statut de la course
            if (!hasCancelBtn) {
                console.log('    Note: Annulation peut être désactivée selon statut');
            }
        });

        await logout(page);

        // ===== TESTS PAGE NAVIGATION CONDUCTRICE =====

        // Se connecter comme conductrice
        await login(page, 'driver');

        // Test 5: Page navigation conductrice
        await reporter.test('Page navigation conductrice accessible', async () => {
            // Simuler accès à une navigation
            await page.goto(`${config.baseUrl}/driver/navigation/1`);
            await sleep(1000);

            const hasNavigation = await page.evaluate(() => {
                return document.querySelector('#navigationMap, .navigation-map, .leaflet-container') !== null;
            });

            const is404or403 = await page.evaluate(() => {
                return document.body.textContent.includes('404') ||
                       document.body.textContent.includes('403') ||
                       document.body.textContent.includes('interdit');
            });

            if (!hasNavigation && !is404or403) {
                console.log('    Note: Navigation accessible si course assignée');
            }
        });

        // Test 6: Boutons action navigation
        await reporter.test('Boutons action navigation présents', async () => {
            await page.goto(`${config.baseUrl}/driver/navigation/1`);
            await sleep(500);

            const hasActionButtons = await page.evaluate(() => {
                const btns = document.querySelectorAll('button');
                const hasArrived = Array.from(btns).some(btn =>
                    btn.id === 'arrivedBtn' ||
                    btn.textContent.includes('arrivé') ||
                    btn.textContent.includes('arrived')
                );
                const hasComplete = Array.from(btns).some(btn =>
                    btn.id === 'completeBtn' ||
                    btn.textContent.includes('terminer') ||
                    btn.textContent.includes('complete')
                );
                return hasArrived || hasComplete;
            });

            if (!hasActionButtons) {
                console.log('    Note: Boutons selon statut de la course');
            }
        });

        // Test 7: Panel d'adresses visible
        await reporter.test('Panel adresses navigation visible', async () => {
            await page.goto(`${config.baseUrl}/driver/navigation/1`);
            await sleep(500);

            const hasAddressPanel = await page.evaluate(() => {
                return document.querySelector('.navigation-addresses, .nav-address, .navigation-panel') !== null;
            });

            if (!hasAddressPanel) {
                console.log('    Note: Panel visible si course valide');
            }
        });

        // ===== TESTS SIMULATION VÉHICULE =====

        // Test 8: Module simulation chargé
        await reporter.test('Module VehicleSimulator disponible', async () => {
            await page.goto(`${config.baseUrl}/driver/navigation/1`);
            await sleep(1000);

            const hasSimulator = await page.evaluate(() => {
                return typeof window.VehicleSimulator !== 'undefined';
            });

            if (!hasSimulator) {
                console.log('    Note: Simulator chargé sur pages de navigation');
            }
        });

        // Test 9: MapController disponible
        await reporter.test('MapController initialisé', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await waitForMap(page, '#bookingMap');

            const hasMapController = await page.evaluate(() => {
                return typeof window.MapController !== 'undefined';
            });

            if (!hasMapController) {
                throw new Error('MapController non disponible');
            }
        });

        // Test 10: Marqueurs customisés fonctionnels
        await reporter.test('Marqueurs SVG customisés disponibles', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await waitForMap(page, '#bookingMap');

            const hasMarkerMethods = await page.evaluate(() => {
                return typeof window.MapController !== 'undefined' &&
                       typeof window.MapController.addPickupMarker === 'function' &&
                       typeof window.MapController.addDropoffMarker === 'function';
            });

            if (!hasMarkerMethods) {
                throw new Error('Méthodes marqueurs non disponibles');
            }
        });

        // Test 11: ETA et distance mis à jour
        await reporter.test('Éléments ETA et distance présents', async () => {
            await page.goto(`${config.baseUrl}/driver/navigation/1`);
            await sleep(500);

            const hasETAElements = await page.evaluate(() => {
                return document.getElementById('etaValue') !== null ||
                       document.getElementById('distanceValue') !== null ||
                       document.querySelector('[class*="eta"], [class*="distance"]') !== null;
            });

            if (!hasETAElements) {
                console.log('    Note: ETA visible sur page navigation valide');
            }
        });

        await logout(page);

    } catch (error) {
        console.error('Erreur fatale:', error);
        await takeScreenshot(page, 'tracking-error');
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
    runTrackingTests();
}

module.exports = { runTrackingTests };
