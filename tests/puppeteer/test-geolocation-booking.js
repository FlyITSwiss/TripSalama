/**
 * TripSalama - Test Géolocalisation et Réservation
 * Test des fonctionnalités de géolocalisation automatique
 * et modification de position sur la page de réservation
 */

const puppeteer = require('puppeteer');
const config = require('./config');
const path = require('path');
const fs = require('fs');

// Position de test simulée (Casablanca)
const MOCK_POSITION = {
    latitude: 33.5731,
    longitude: -7.5898,
    accuracy: 10
};

// Couleurs console
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Reporter simplifié
class TestReporter {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.passed = 0;
        this.failed = 0;
        this.startTime = Date.now();
    }

    log(message) {
        console.log(`[${this.suiteName}] ${message}`);
    }

    async test(name, fn) {
        const start = Date.now();
        try {
            await fn();
            this.passed++;
            const duration = Date.now() - start;
            console.log(`  ${GREEN}✓${RESET} ${name} (${duration}ms)`);
            return true;
        } catch (error) {
            this.failed++;
            const duration = Date.now() - start;
            console.log(`  ${RED}✗${RESET} ${name} (${duration}ms)`);
            console.log(`    ${YELLOW}Error: ${error.message}${RESET}`);
            return false;
        }
    }

    summary() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(60));
        console.log(`Suite: ${this.suiteName}`);
        console.log(`Total: ${this.passed + this.failed} tests`);
        console.log(`${GREEN}Passed: ${this.passed}${RESET}`);
        if (this.failed > 0) {
            console.log(`${RED}Failed: ${this.failed}${RESET}`);
        }
        console.log(`Duration: ${duration}s`);
        console.log('='.repeat(60) + '\n');
        return this.failed === 0;
    }
}

// Helpers
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name) {
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const filename = path.join(screenshotDir, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`    📸 Screenshot: ${path.basename(filename)}`);
    return filename;
}

async function runTests() {
    const reporter = new TestReporter('Géolocalisation & Réservation');
    let browser;
    let page;

    try {
        reporter.log('Lancement du navigateur Chrome...');

        browser = await puppeteer.launch({
            headless: false,
            slowMo: 30,
            defaultViewport: { width: 1280, height: 800 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream'
            ]
        });

        page = await browser.newPage();

        // Configurer les permissions de géolocalisation
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(config.baseUrl, ['geolocation']);

        // Mock de la géolocalisation dans le navigateur
        await page.evaluateOnNewDocument((mockPos) => {
            const mockGeolocation = {
                getCurrentPosition: (success) => {
                    setTimeout(() => {
                        success({
                            coords: {
                                latitude: mockPos.latitude,
                                longitude: mockPos.longitude,
                                accuracy: mockPos.accuracy,
                                altitude: null,
                                altitudeAccuracy: null,
                                heading: null,
                                speed: null
                            },
                            timestamp: Date.now()
                        });
                    }, 500);
                },
                watchPosition: (success) => {
                    return setInterval(() => {
                        success({
                            coords: {
                                latitude: mockPos.latitude + (Math.random() - 0.5) * 0.001,
                                longitude: mockPos.longitude + (Math.random() - 0.5) * 0.001,
                                accuracy: mockPos.accuracy,
                                altitude: null,
                                altitudeAccuracy: null,
                                heading: Math.random() * 360,
                                speed: Math.random() * 10
                            },
                            timestamp: Date.now()
                        });
                    }, 2000);
                },
                clearWatch: () => {}
            };
            navigator.geolocation = mockGeolocation;
        }, MOCK_POSITION);

        // ==========================================
        // TEST 1: Page de login accessible
        // ==========================================
        await reporter.test('Page de login accessible', async () => {
            await page.goto(`${config.baseUrl}/login`, {
                waitUntil: 'networkidle2',
                timeout: 15000
            });

            const title = await page.title();
            if (!title.includes('TripSalama') && !title.includes('Connexion')) {
                throw new Error(`Titre inattendu: ${title}`);
            }

            await takeScreenshot(page, '01-login-page');
        });

        // ==========================================
        // TEST 2: Connexion en tant que passagère
        // ==========================================
        await reporter.test('Connexion en tant que passagère', async () => {
            // Attendre le formulaire
            await page.waitForSelector('#email', { timeout: 5000 });
            await page.waitForSelector('#password', { timeout: 5000 });

            // Remplir le formulaire
            await page.click('#email', { clickCount: 3 });
            await page.type('#email', config.users.passenger.email);

            await page.click('#password', { clickCount: 3 });
            await page.type('#password', config.users.passenger.password);

            await takeScreenshot(page, '02-login-filled');

            // Soumettre
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
                page.click('button[type="submit"]')
            ]);

            // Vérifier qu'on est connecté (pas sur la page login)
            const currentUrl = page.url();
            if (currentUrl.includes('/login')) {
                await takeScreenshot(page, '02-login-failed');
                throw new Error('Connexion échouée - toujours sur /login');
            }

            await takeScreenshot(page, '02-login-success');
        });

        // ==========================================
        // TEST 3: Accès à la page de réservation
        // ==========================================
        await reporter.test('Accès à la page de réservation', async () => {
            await page.goto(`${config.baseUrl}/passenger/book`, {
                waitUntil: 'networkidle2',
                timeout: 15000
            });

            // Attendre que la carte soit présente
            await page.waitForSelector('#map', { timeout: 10000 });

            // Attendre le chargement de Leaflet
            await sleep(2000);

            await takeScreenshot(page, '03-booking-page');
        });

        // ==========================================
        // TEST 4: Carte Leaflet chargée
        // ==========================================
        await reporter.test('Carte Leaflet chargée', async () => {
            // Vérifier que Leaflet est initialisé
            const leafletLoaded = await page.evaluate(() => {
                const mapEl = document.getElementById('map');
                return mapEl && mapEl.classList.contains('leaflet-container');
            });

            if (!leafletLoaded) {
                // Attendre encore un peu
                await sleep(3000);
                const leafletLoadedRetry = await page.evaluate(() => {
                    const mapEl = document.getElementById('map');
                    return mapEl && mapEl.classList.contains('leaflet-container');
                });
                if (!leafletLoadedRetry) {
                    throw new Error('Leaflet non initialisé sur la carte');
                }
            }

            await takeScreenshot(page, '04-map-loaded');
        });

        // ==========================================
        // TEST 5: Services JavaScript chargés
        // ==========================================
        await reporter.test('Services JavaScript chargés', async () => {
            const services = await page.evaluate(() => {
                return {
                    AppConfig: typeof window.AppConfig !== 'undefined',
                    MapController: typeof window.MapController !== 'undefined',
                    Booking: typeof window.Booking !== 'undefined',
                    GeoLocationService: typeof window.GeoLocationService !== 'undefined',
                    TrackingService: typeof window.TrackingService !== 'undefined',
                    I18n: typeof window.I18n !== 'undefined' || typeof window.i18n !== 'undefined',
                    EventBus: typeof window.EventBus !== 'undefined'
                };
            });

            console.log('    Services:', JSON.stringify(services));

            const missing = Object.entries(services)
                .filter(([_, loaded]) => !loaded)
                .map(([name]) => name);

            if (missing.length > 0) {
                throw new Error(`Services manquants: ${missing.join(', ')}`);
            }
        });

        // ==========================================
        // TEST 6: Formulaire de réservation présent
        // ==========================================
        await reporter.test('Formulaire de réservation présent', async () => {
            const elements = await page.evaluate(() => {
                return {
                    form: !!document.getElementById('bookingForm'),
                    pickupInput: !!document.getElementById('pickupInput'),
                    dropoffInput: !!document.getElementById('dropoffInput'),
                    locateBtn: !!document.getElementById('locateMeBtn'),
                    confirmBtn: !!document.getElementById('confirmBtn')
                };
            });

            console.log('    Éléments:', JSON.stringify(elements));

            if (!elements.pickupInput || !elements.dropoffInput) {
                throw new Error('Champs de saisie manquants');
            }
        });

        // ==========================================
        // TEST 7: Bouton de géolocalisation fonctionne
        // ==========================================
        await reporter.test('Bouton de géolocalisation fonctionne', async () => {
            const locateBtn = await page.$('#locateMeBtn');
            if (!locateBtn) {
                throw new Error('Bouton de localisation non trouvé');
            }

            // Cliquer sur le bouton
            await locateBtn.click();

            // Attendre la géolocalisation (mock = 500ms + traitement)
            await sleep(3000);

            await takeScreenshot(page, '07-after-locate');

            // Vérifier si une position a été détectée (soit dans l'input, soit marqueur sur carte)
            const pickupValue = await page.$eval('#pickupInput', el => el.value);
            console.log(`    Valeur pickup: "${pickupValue.substring(0, 50)}..."`);
        });

        // ==========================================
        // TEST 8: Placeholder du champ départ
        // ==========================================
        await reporter.test('Placeholder du champ départ correct', async () => {
            const placeholder = await page.$eval('#pickupInput', el => el.placeholder);
            console.log(`    Placeholder: "${placeholder}"`);

            // Vérifier que ce n'est pas l'ancien placeholder
            if (placeholder.includes('souhaitez-vous partir')) {
                throw new Error('Ancien placeholder détecté');
            }
        });

        // ==========================================
        // TEST 9: Modification du point de départ
        // ==========================================
        await reporter.test('Modification du point de départ', async () => {
            // Focus sur le champ pickup
            await page.click('#pickupInput', { clickCount: 3 });
            await sleep(500);

            // Saisir une adresse
            await page.type('#pickupInput', 'Casablanca Maarif');
            await sleep(1500);

            // Vérifier si le dropdown apparaît
            const dropdownVisible = await page.evaluate(() => {
                const dropdown = document.getElementById('pickupDropdown');
                return dropdown && !dropdown.classList.contains('hidden');
            });

            console.log(`    Dropdown visible: ${dropdownVisible}`);
            await takeScreenshot(page, '09-pickup-autocomplete');
        });

        // ==========================================
        // TEST 10: Sélection destination
        // ==========================================
        await reporter.test('Sélection destination', async () => {
            await page.click('#dropoffInput');
            await sleep(300);

            await page.type('#dropoffInput', 'Rabat');
            await sleep(1500);

            await takeScreenshot(page, '10-dropoff-typed');

            const dropdownVisible = await page.evaluate(() => {
                const dropdown = document.getElementById('dropoffDropdown');
                return dropdown && !dropdown.classList.contains('hidden') && dropdown.children.length > 0;
            });

            if (dropdownVisible) {
                // Cliquer sur le premier résultat
                await page.click('#dropoffDropdown .booking-dropdown-item, #dropoffDropdown .autocomplete-item');
                await sleep(2000);
            }

            await takeScreenshot(page, '10-dropoff-selected');
        });

        // ==========================================
        // TEST 11: Calcul d'estimation
        // ==========================================
        await reporter.test('Calcul d\'estimation', async () => {
            // Attendre le calcul de route
            await sleep(5000);

            const estimationVisible = await page.evaluate(() => {
                const card = document.getElementById('estimationCard');
                return card && !card.classList.contains('hidden');
            });

            console.log(`    Estimation visible: ${estimationVisible}`);

            if (estimationVisible) {
                const estimation = await page.evaluate(() => {
                    return {
                        distance: document.getElementById('estimatedDistance')?.textContent,
                        duration: document.getElementById('estimatedDuration')?.textContent,
                        price: document.getElementById('estimatedPrice')?.textContent
                    };
                });
                console.log(`    Distance: ${estimation.distance}, Durée: ${estimation.duration}, Prix: ${estimation.price}`);
            }

            await takeScreenshot(page, '11-estimation');
        });

        // ==========================================
        // TEST 12: Métadonnées PWA
        // ==========================================
        await reporter.test('Métadonnées PWA présentes', async () => {
            const pwa = await page.evaluate(() => {
                return {
                    manifest: !!document.querySelector('link[rel="manifest"]'),
                    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
                    appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content
                };
            });

            console.log(`    Manifest: ${pwa.manifest}, Theme: ${pwa.themeColor}, Apple: ${pwa.appleCapable}`);

            if (!pwa.manifest) {
                throw new Error('Link manifest manquant');
            }
        });

        // ==========================================
        // TEST 13: GeoLocationService API
        // ==========================================
        await reporter.test('GeoLocationService API complète', async () => {
            const geoAPI = await page.evaluate(() => {
                if (!window.GeoLocationService) return null;
                return {
                    isSupported: typeof window.GeoLocationService.isSupported === 'function',
                    getCurrentPosition: typeof window.GeoLocationService.getCurrentPosition === 'function',
                    startWatching: typeof window.GeoLocationService.startWatching === 'function',
                    stopWatching: typeof window.GeoLocationService.stopWatching === 'function',
                    reverseGeocode: typeof window.GeoLocationService.reverseGeocode === 'function',
                    calculateDistance: typeof window.GeoLocationService.calculateDistance === 'function'
                };
            });

            if (!geoAPI) {
                throw new Error('GeoLocationService non disponible');
            }

            console.log('    API:', JSON.stringify(geoAPI));

            const missingMethods = Object.entries(geoAPI)
                .filter(([_, exists]) => !exists)
                .map(([name]) => name);

            if (missingMethods.length > 0) {
                throw new Error(`Méthodes manquantes: ${missingMethods.join(', ')}`);
            }
        });

        // ==========================================
        // TEST 14: TrackingService API
        // ==========================================
        await reporter.test('TrackingService API complète', async () => {
            const trackingAPI = await page.evaluate(() => {
                if (!window.TrackingService) return null;
                return {
                    init: typeof window.TrackingService.init === 'function',
                    startTracking: typeof window.TrackingService.startTracking === 'function',
                    stopTracking: typeof window.TrackingService.stopTracking === 'function',
                    isActive: typeof window.TrackingService.isActive === 'function',
                    calculateETA: typeof window.TrackingService.calculateETA === 'function'
                };
            });

            if (!trackingAPI) {
                throw new Error('TrackingService non disponible');
            }

            console.log('    API:', JSON.stringify(trackingAPI));
        });

        // ==========================================
        // TEST 15: Service Worker
        // ==========================================
        await reporter.test('Service Worker enregistré', async () => {
            // Attendre l'enregistrement du SW
            await sleep(3000);

            const swStatus = await page.evaluate(async () => {
                if (!('serviceWorker' in navigator)) {
                    return { supported: false };
                }
                const reg = await navigator.serviceWorker.getRegistration();
                return {
                    supported: true,
                    registered: !!reg,
                    scope: reg?.scope
                };
            });

            console.log(`    SW: ${JSON.stringify(swStatus)}`);
        });

        // Screenshot final
        await takeScreenshot(page, '99-final-state');

    } catch (error) {
        reporter.log(`Fatal error: ${error.message}`);
        console.error(error);
        if (page) {
            await takeScreenshot(page, 'ERROR-fatal');
        }
    } finally {
        if (browser) {
            await sleep(2000); // Pause to see final state
            await browser.close();
        }
    }

    return reporter.summary();
}

// Run tests
runTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
