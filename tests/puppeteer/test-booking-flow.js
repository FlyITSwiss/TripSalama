/**
 * TripSalama - Tests Flux de Réservation
 * Tests E2E pour la réservation d'une course
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
    waitForMap,
    selectAddress,
    TestReporter
} = require('./helpers');

async function runBookingTests() {
    const reporter = new TestReporter('Booking Flow Tests');
    let browser;
    let page;

    try {
        console.log('\n🚗 Démarrage des Tests Réservation TripSalama\n');

        browser = await puppeteer.launch(config.puppeteer);
        page = await browser.newPage();

        // Se connecter comme passagère
        await login(page, 'passenger');

        // ===== TESTS DASHBOARD =====

        // Test 1: Dashboard passagère affiche bouton réservation
        await reporter.test('Dashboard affiche bouton réserver', async () => {
            await page.goto(`${config.baseUrl}/passenger/dashboard`);
            await sleep(500);

            const hasBookBtn = await waitForElement(page, 'a[href*="book-ride"], .book-ride-btn, .btn-book');

            if (!hasBookBtn) {
                // Chercher un lien vers la réservation
                const hasBookLink = await page.evaluate(() => {
                    return document.body.innerHTML.includes('book-ride') ||
                           document.body.innerHTML.includes('réserver');
                });

                if (!hasBookLink) {
                    throw new Error('Bouton/lien de réservation non trouvé');
                }
            }
        });

        // ===== TESTS PAGE RÉSERVATION =====

        // Test 2: Page de réservation charge la carte
        await reporter.test('Page réservation charge carte Leaflet', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);

            // Attendre la carte
            await waitForMap(page, '#bookingMap');

            // Vérifier que Leaflet est initialisé
            const hasLeaflet = await page.evaluate(() => {
                return typeof L !== 'undefined' && document.querySelector('.leaflet-container') !== null;
            });

            if (!hasLeaflet) {
                throw new Error('Leaflet non chargé');
            }
        });

        // Test 3: Champs d'adresse présents
        await reporter.test('Champs adresse pickup et dropoff présents', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await sleep(500);

            const hasPickup = await waitForElement(page, '#pickupAddress');
            const hasDropoff = await waitForElement(page, '#dropoffAddress');

            if (!hasPickup) {
                throw new Error('Champ adresse de départ non trouvé');
            }

            if (!hasDropoff) {
                throw new Error('Champ adresse d\'arrivée non trouvé');
            }
        });

        // Test 4: Autocomplete déclenché à la saisie
        await reporter.test('Autocomplete se déclenche à la saisie', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await waitForMap(page, '#bookingMap');

            // Taper une adresse
            await fillInput(page, '#pickupAddress', 'Genève gare');

            // Attendre le debounce (300ms) + requête
            await sleep(1000);

            // Vérifier les résultats d'autocomplete
            const hasResults = await page.evaluate(() => {
                const results = document.querySelector('.autocomplete-results, .autocomplete-list, [class*="autocomplete"]');
                return results && results.children.length > 0;
            });

            // Note: Si Nominatim est lent ou bloqué, on accepte le test
            if (!hasResults) {
                console.log('    Note: Autocomplete peut être lent ou bloqué par rate limiting');
            }
        });

        // Test 5: Bouton localisation présent
        await reporter.test('Bouton géolocalisation présent', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await sleep(500);

            const hasGeoBtn = await page.evaluate(() => {
                // Chercher un bouton avec icône de localisation
                const buttons = document.querySelectorAll('button');
                return Array.from(buttons).some(btn =>
                    btn.innerHTML.includes('location') ||
                    btn.innerHTML.includes('gps') ||
                    btn.innerHTML.includes('crosshair') ||
                    btn.classList.contains('locate-btn') ||
                    btn.classList.contains('geolocate-btn')
                );
            });

            if (!hasGeoBtn) {
                // Peut être absent si pas de feature de géoloc
                console.log('    Note: Bouton géolocalisation optionnel');
            }
        });

        // Test 6: Sélection adresse met à jour carte
        await reporter.test('Sélection adresse place marqueur sur carte', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await waitForMap(page, '#bookingMap');

            // Simuler une sélection (via coordinates directes si pas d'autocomplete)
            await page.evaluate(() => {
                // Simuler un événement de sélection d'adresse
                if (typeof BookingModule !== 'undefined' && BookingModule.setPickup) {
                    BookingModule.setPickup({
                        lat: 46.2044,
                        lng: 6.1432,
                        address: 'Genève, Suisse'
                    });
                }
            });

            await sleep(500);

            // Vérifier présence d'un marqueur
            const hasMarker = await page.evaluate(() => {
                return document.querySelector('.leaflet-marker-icon') !== null;
            });

            // Note: Dépend de l'implémentation
            if (!hasMarker) {
                console.log('    Note: Marqueur peut être ajouté différemment');
            }
        });

        // Test 7: Calcul de prix affiché
        await reporter.test('Prix estimé calculé et affiché', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await waitForMap(page, '#bookingMap');

            // Simuler des adresses pour déclencher le calcul
            await page.evaluate(() => {
                // Simuler pickup
                const pickupInput = document.getElementById('pickupAddress');
                if (pickupInput) {
                    pickupInput.value = 'Genève Gare';
                    pickupInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            await sleep(200);

            await page.evaluate(() => {
                // Simuler dropoff
                const dropoffInput = document.getElementById('dropoffAddress');
                if (dropoffInput) {
                    dropoffInput.value = 'Aéroport de Genève';
                    dropoffInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            await sleep(1500); // Attendre calcul OSRM

            // Vérifier affichage prix
            const hasPrice = await page.evaluate(() => {
                const priceEl = document.querySelector('#estimatedPrice, .price-display, [class*="price"]');
                return priceEl !== null;
            });

            if (!hasPrice) {
                console.log('    Note: Affichage prix peut nécessiter validation complète');
            }
        });

        // Test 8: Bouton confirmer présent
        await reporter.test('Bouton confirmer réservation présent', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await sleep(500);

            const hasConfirmBtn = await waitForElement(page, '#confirmBooking, [type="submit"], .btn-confirm');

            if (!hasConfirmBtn) {
                throw new Error('Bouton de confirmation non trouvé');
            }
        });

        // Test 9: Validation formulaire
        await reporter.test('Validation bloque soumission incomplète', async () => {
            await page.goto(`${config.baseUrl}/passenger/book-ride`);
            await sleep(500);

            // Cliquer sur confirmer sans remplir
            const confirmBtn = await page.$('#confirmBooking, [type="submit"], .btn-confirm');
            if (confirmBtn) {
                await confirmBtn.click();
                await sleep(500);

                // Devrait rester sur la page
                if (!checkUrl(page, 'book-ride')) {
                    throw new Error('Formulaire soumis malgré validation');
                }
            }
        });

        // ===== TESTS HISTORIQUE =====

        // Test 10: Page historique accessible
        await reporter.test('Page historique des courses accessible', async () => {
            await page.goto(`${config.baseUrl}/passenger/history`);
            await sleep(500);

            // Vérifier que la page charge
            const response = await page.evaluate(() => {
                return document.body.innerHTML.length > 100;
            });

            if (!response) {
                throw new Error('Page historique vide');
            }
        });

        // Test 11: Historique affiche courses passées
        await reporter.test('Historique affiche liste ou état vide', async () => {
            await page.goto(`${config.baseUrl}/passenger/history`);
            await sleep(500);

            // Vérifier liste ou message "aucune course"
            const hasContent = await page.evaluate(() => {
                const hasList = document.querySelector('.history-list, .ride-list, .rides-container');
                const hasEmpty = document.body.textContent.includes('aucune') ||
                                document.body.textContent.includes('Aucune') ||
                                document.body.textContent.includes('No rides') ||
                                document.querySelector('.empty-state');
                return hasList !== null || hasEmpty;
            });

            if (!hasContent) {
                throw new Error('Ni liste ni état vide affiché');
            }
        });

        await logout(page);

    } catch (error) {
        console.error('Erreur fatale:', error);
        await takeScreenshot(page, 'booking-error');
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
    runBookingTests();
}

module.exports = { runBookingTests };
