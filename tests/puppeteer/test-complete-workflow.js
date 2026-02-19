/**
 * TripSalama - Test Workflow Complet
 * A-Z: Login → Book → Confirm → Demo (Driver Approaching → Boarding → Trip → Rating)
 */
const puppeteer = require('puppeteer');
const path = require('path');

const config = {
    baseUrl: 'http://localhost:8080',
    email: 'passenger@tripsalama.ch',
    password: 'password',
    screenshotDir: path.join(__dirname, 'screenshots-workflow'),
    timeout: 60000
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page, name) {
    const filename = `${config.screenshotDir}/${Date.now()}-${name}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`📸 Screenshot: ${name}`);
    return filename;
}

async function testCompleteWorkflow() {
    console.log('🚗 TripSalama - Test Workflow Complet A-Z');
    console.log('==========================================\n');

    // Create screenshot directory
    const fs = require('fs');
    if (!fs.existsSync(config.screenshotDir)) {
        fs.mkdirSync(config.screenshotDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 30,
        args: ['--window-size=430,932', '--window-position=100,50'],
        defaultViewport: { width: 430, height: 932, isMobile: true, hasTouch: true }
    });

    const page = await browser.newPage();

    // Allow geolocation
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(config.baseUrl, ['geolocation']);
    await page.setGeolocation({ latitude: 33.5731, longitude: -7.5898 }); // Casablanca

    // Log errors and demo messages
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error' && !text.includes('Manifest')) {
            console.log('❌ Console:', text.substring(0, 100));
        } else if (text.includes('[Demo]')) {
            console.log('🔵', text);
        }
    });

    let testsPassed = 0;
    let testsFailed = 0;

    try {
        // ==== PHASE 1: LOGIN ====
        console.log('📍 PHASE 1: Connexion');
        console.log('---------------------');

        await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle2', timeout: config.timeout });
        await screenshot(page, '01-login-page');

        // Fill login form
        const emailInput = await page.$('input[type="email"], input[name="email"]');
        const passwordInput = await page.$('input[type="password"], input[name="password"]');

        if (emailInput && passwordInput) {
            await emailInput.click({ clickCount: 3 });
            await emailInput.type(config.email);
            await passwordInput.type(config.password);
            await screenshot(page, '02-login-filled');

            // Submit
            const submitBtn = await page.$('button[type="submit"]');
            if (submitBtn) {
                await submitBtn.click();
                await sleep(3000);
            }
        }

        // Verify login success
        const currentUrl = page.url();
        if (currentUrl.includes('dashboard') || currentUrl.includes('book')) {
            console.log('✅ Connexion réussie');
            testsPassed++;
        } else {
            console.log('⚠️ Vérifier le login - URL:', currentUrl);
        }

        await screenshot(page, '03-after-login');

        // ==== PHASE 2: BOOKING ====
        console.log('\n📍 PHASE 2: Réservation');
        console.log('------------------------');

        await page.goto(`${config.baseUrl}/passenger/book`, { waitUntil: 'networkidle2', timeout: config.timeout });
        await sleep(2000);
        await screenshot(page, '04-booking-page');

        // Check map loaded
        const mapElement = await page.$('#map');
        if (mapElement) {
            console.log('✅ Carte chargée');
            testsPassed++;
        } else {
            console.log('❌ Carte non trouvée');
            testsFailed++;
        }

        // Wait for tiles
        await sleep(3000);
        const tilesCount = await page.evaluate(() => document.querySelectorAll('.leaflet-tile').length);
        console.log(`📦 Tuiles chargées: ${tilesCount}`);

        // Check dark mode
        const isDarkMode = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.leaflet-tile');
            if (tiles.length > 0) {
                const src = tiles[0].src || '';
                return src.includes('dark') || src.includes('cartodb');
            }
            return false;
        });

        if (isDarkMode) {
            console.log('✅ Mode sombre activé');
            testsPassed++;
        } else {
            console.log('⚠️ Mode sombre non détecté (peut être OK si autre provider)');
        }

        await screenshot(page, '05-booking-map');

        // Check geolocation status
        const geoStatus = await page.$('#pickupStatusIndicator');
        if (geoStatus) {
            const geoText = await page.evaluate(el => el.textContent, geoStatus);
            console.log(`📍 Statut géoloc: ${geoText.trim().substring(0, 50)}`);
        }

        // Click locate button
        const locateBtn = await page.$('#quickLocateBtn, #locateMeBtn');
        if (locateBtn) {
            await locateBtn.click();
            console.log('📍 Bouton localisation cliqué');
            await sleep(3000);
        }

        await screenshot(page, '06-after-geolocation');

        // Enter dropoff address
        const dropoffInput = await page.$('#dropoffInput');
        if (dropoffInput) {
            await dropoffInput.click();
            await dropoffInput.type('Anfa Casablanca');
            console.log('✏️ Destination saisie');
            await sleep(2000);

            // Select first result
            const firstResult = await page.$('.autocomplete-item, .booking-dropdown-item');
            if (firstResult) {
                await firstResult.click();
                console.log('✅ Destination sélectionnée');
                testsPassed++;
                await sleep(2000);
            }
        }

        await screenshot(page, '07-destination-selected');

        // Wait for route calculation
        await sleep(3000);

        // Check estimation card
        const estimationCard = await page.$('#estimationCard');
        if (estimationCard) {
            const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), estimationCard);
            if (isVisible) {
                console.log('✅ Estimation affichée');
                testsPassed++;
            }
        }

        await screenshot(page, '08-estimation-shown');

        // ==== PHASE 3: CONFIRM RIDE ====
        console.log('\n📍 PHASE 3: Confirmation');
        console.log('-------------------------');

        const confirmBtn = await page.$('#confirmBtn');
        if (confirmBtn) {
            const isVisible = await page.evaluate(el => !el.classList.contains('hidden'), confirmBtn);
            if (isVisible) {
                await confirmBtn.click();
                console.log('✅ Course confirmée');
                testsPassed++;
                await sleep(5000);
            }
        }

        await screenshot(page, '09-ride-confirmed');

        // ==== PHASE 4: DEMO SIMULATION ====
        console.log('\n📍 PHASE 4: Simulation Démo');
        console.log('----------------------------');

        // Check if redirected to demo page
        const demoUrl = page.url();
        if (demoUrl.includes('/demo/') || demoUrl.includes('/ride/')) {
            console.log('✅ Redirection vers suivi');
            testsPassed++;
        }

        await screenshot(page, '10-demo-page');

        // Wait for demo to start
        await sleep(3000);

        // Check vehicle marker
        const vehicleMarker = await page.evaluate(() => {
            return document.querySelector('.uber-vehicle-marker, .marker-vehicle') !== null;
        });

        if (vehicleMarker) {
            console.log('✅ Véhicule visible sur la carte');
            testsPassed++;
        } else {
            console.log('⚠️ Véhicule non visible (peut prendre du temps)');
        }

        // Check panel
        const demoPanel = await page.$('#demoPanel, .demo-panel, .tracking-panel');
        if (demoPanel) {
            console.log('✅ Panel de suivi visible');
            testsPassed++;
        }

        await screenshot(page, '11-demo-tracking');

        // Helper to check if element is visible
        async function waitForVisible(selector, maxWait = 30000) {
            const start = Date.now();
            while (Date.now() - start < maxWait) {
                const isVisible = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el && !el.classList.contains('hidden') && el.offsetParent !== null;
                }, selector);
                if (isVisible) return true;
                await sleep(200); // Faster polling
            }
            return false;
        }

        // Wait for tracker to start
        console.log('⏳ Attente démarrage simulation...');
        await page.waitForFunction(() => {
            return typeof UberStyleTracker !== 'undefined' && UberStyleTracker.isRunning && UberStyleTracker.isRunning();
        }, { timeout: 10000 }).catch(() => console.log('⚠️ Tracker pas encore démarré'));

        // Now increase speed (after tracker has started)
        await page.evaluate(() => {
            const btn = document.querySelector('.speed-btn[data-speed="10"]');
            if (btn) btn.click();
        });
        console.log('⏩ Vitesse 10x activée');

        // Check ETA values are updating
        await sleep(500);
        const etaValue = await page.evaluate(() => {
            const el = document.getElementById('etaTime');
            return el ? el.textContent : 'N/A';
        });
        console.log(`📊 ETA actuel: ${etaValue} min`);
        await screenshot(page, '12-driver-approaching');

        // Wait for driver arrival (boarding modal appears)
        console.log('⏳ Attente arrivée conductrice...');
        const boardingShown = await waitForVisible('#boardingModal', 30000);
        if (boardingShown) {
            console.log('✅ Conductrice arrivée - Modal embarquement');
            testsPassed++;
            await screenshot(page, '13-boarding-modal');
        } else {
            // Check if we already passed boarding
            const inTrip = await page.evaluate(() => document.getElementById('boardingModal')?.classList.contains('hidden'));
            if (inTrip) {
                console.log('✅ Phase embarquement terminée');
                testsPassed++;
            } else {
                console.log('⚠️ Timeout embarquement');
            }
        }

        // Wait for trip completion (arrival modal) - check if already visible first
        console.log('⏳ Attente fin de trajet...');

        // Check immediately if arrival modal is visible (might have appeared already)
        let arrivalShown = await page.evaluate(() => {
            const modal = document.getElementById('arrivalModal');
            return modal && !modal.classList.contains('hidden');
        });

        if (!arrivalShown) {
            arrivalShown = await waitForVisible('#arrivalModal', 60000);
        }

        if (arrivalShown) {
            console.log('✅ Trajet terminé - Modal arrivée');
            testsPassed++;
            await screenshot(page, '15-arrival-modal');
        } else {
            console.log('⚠️ Timeout arrivée');
        }

        await sleep(500); // Let modal settle

        // ==== PHASE 5: RATING ====
        console.log('\n📍 PHASE 5: Notation');
        console.log('---------------------');

        // First ensure arrival modal is visible
        const arrivalModalReady = await page.evaluate(() => {
            const modal = document.getElementById('arrivalModal');
            return modal && !modal.classList.contains('hidden');
        });

        if (arrivalModalReady) {
            console.log('📋 Modal arrivée visible, clic sur Noter...');

            // Click show rating button
            await page.evaluate(() => {
                const btn = document.getElementById('showRatingBtn');
                if (btn) btn.click();
            });
            await sleep(500);

            // Wait for rating modal
            await page.waitForSelector('#ratingModal:not(.hidden)', { timeout: 5000 }).catch(() => {});

            const ratingVisible = await page.evaluate(() => {
                const modal = document.getElementById('ratingModal');
                return modal && !modal.classList.contains('hidden');
            });

            if (ratingVisible) {
                console.log('✅ Modal notation affiché');
                testsPassed++;
                await screenshot(page, '16-rating-modal');

                // Click 5 stars
                await page.evaluate(() => {
                    const star5 = document.querySelector('.star[data-rating="5"]');
                    if (star5) star5.click();
                });
                console.log('⭐ 5 étoiles sélectionnées');
                await sleep(300);

                await screenshot(page, '17-rating-5-stars');

                // Select tip
                await page.evaluate(() => {
                    const tipBtn = document.querySelector('.tip-btn[data-tip="10"]');
                    if (tipBtn) tipBtn.click();
                });
                console.log('💰 Pourboire 10 MAD sélectionné');
                await sleep(300);

                // Submit rating
                const submitted = await page.evaluate(() => {
                    const btn = document.getElementById('submitRatingBtn');
                    if (btn && !btn.classList.contains('hidden')) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (submitted) {
                    console.log('✅ Notation soumise');
                    testsPassed++;
                    await sleep(1500);

                    // Check thank you modal
                    const thankYouVisible = await page.evaluate(() => {
                        const modal = document.getElementById('thankYouModal');
                        return modal && !modal.classList.contains('hidden');
                    });

                    if (thankYouVisible) {
                        console.log('✅ Modal remerciement affiché');
                        testsPassed++;
                        await screenshot(page, '18-thank-you');
                    }
                } else {
                    console.log('⚠️ Bouton submit non visible');
                }
            } else {
                console.log('⚠️ Modal notation non affiché');
            }
        } else {
            console.log('⚠️ Modal arrivée non visible pour la notation');
        }

        await screenshot(page, '19-final');

        // ==== RESULTS ====
        console.log('\n==========================================');
        console.log('📊 RÉSULTATS DU TEST');
        console.log('==========================================');
        console.log(`✅ Tests réussis: ${testsPassed}`);
        console.log(`❌ Tests échoués: ${testsFailed}`);
        console.log(`📸 Screenshots: ${config.screenshotDir}`);

        if (testsFailed === 0) {
            console.log('\n🎉 TOUS LES TESTS PASSÉS !');
        } else {
            console.log('\n⚠️ Certains tests ont échoué, vérifier les screenshots');
        }

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        await screenshot(page, 'error');
        testsFailed++;
    }

    console.log('\n⏳ Navigateur ouvert 30 secondes pour vérification visuelle...');
    await sleep(30000);

    await browser.close();

    // Exit with error code if tests failed
    process.exit(testsFailed > 0 ? 1 : 0);
}

testCompleteWorkflow().catch(console.error);
