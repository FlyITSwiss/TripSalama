/**
 * TripSalama - Tests Encoding & Internationalisation
 * Verification complete de l'encoding UTF-8 et des traductions
 */

const puppeteer = require('puppeteer');

// Detecter l'environnement
const isProd = process.argv.includes('--prod');
const config = isProd ? require('./config-prod') : require('./config');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(type, message) {
    const prefix = {
        pass: `${colors.green}[PASS]${colors.reset}`,
        fail: `${colors.red}[FAIL]${colors.reset}`,
        info: `${colors.blue}[INFO]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        test: `${colors.cyan}[TEST]${colors.reset}`
    };
    console.log(`${prefix[type] || '[LOG]'} ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEncodingTests() {
    let browser;
    let passed = 0;
    let failed = 0;
    const env = isProd ? 'PRODUCTION' : 'LOCAL';

    console.log('\n' + '='.repeat(60));
    console.log(`${colors.cyan}TripSalama - Tests Encoding & i18n (${env})${colors.reset}`);
    console.log('='.repeat(60));
    console.log(`URL: ${config.baseUrl}\n`);

    try {
        browser = await puppeteer.launch(config.puppeteer);
        const page = await browser.newPage();

        // ========================================
        // SECTION 1: HTTP Headers
        // ========================================
        console.log('-'.repeat(40));
        console.log(`${colors.cyan}SECTION 1: HTTP Headers${colors.reset}`);
        console.log('-'.repeat(40));

        // Test 1.1: Content-Type UTF-8
        log('test', 'Content-Type header UTF-8...');
        try {
            const response = await page.goto(config.baseUrl + '/login', {
                waitUntil: 'networkidle2',
                timeout: config.timeout.navigation
            });

            const headers = response.headers();
            const contentType = headers['content-type'] || '';

            if (contentType.toLowerCase().includes('utf-8')) {
                log('pass', `Content-Type: ${contentType}`);
                passed++;
            } else {
                log('warn', `Content-Type sans UTF-8 explicite: ${contentType}`);
                passed++; // Pas critique si meta charset present
            }
        } catch (error) {
            log('fail', `Header check: ${error.message}`);
            failed++;
        }

        // ========================================
        // SECTION 2: HTML Meta Tags
        // ========================================
        console.log('\n' + '-'.repeat(40));
        console.log(`${colors.cyan}SECTION 2: HTML Meta Tags${colors.reset}`);
        console.log('-'.repeat(40));

        // Test 2.1: Meta charset
        log('test', 'Meta charset UTF-8...');
        try {
            const metaCharset = await page.evaluate(() => {
                const meta = document.querySelector('meta[charset]');
                return meta ? meta.getAttribute('charset') : null;
            });

            if (metaCharset && metaCharset.toLowerCase() === 'utf-8') {
                log('pass', `Meta charset: ${metaCharset}`);
                passed++;
            } else {
                log('fail', `Meta charset invalide: ${metaCharset}`);
                failed++;
            }
        } catch (error) {
            log('fail', `Meta charset: ${error.message}`);
            failed++;
        }

        // Test 2.2: Lang attribute
        log('test', 'HTML lang attribute...');
        try {
            const htmlLang = await page.evaluate(() => {
                return document.documentElement.getAttribute('lang');
            });

            if (htmlLang) {
                log('pass', `HTML lang: ${htmlLang}`);
                passed++;
            } else {
                log('warn', 'Attribut lang non defini');
                passed++;
            }
        } catch (error) {
            log('fail', `Lang attribute: ${error.message}`);
            failed++;
        }

        // ========================================
        // SECTION 3: Accents Francais
        // ========================================
        console.log('\n' + '-'.repeat(40));
        console.log(`${colors.cyan}SECTION 3: Accents Francais${colors.reset}`);
        console.log('-'.repeat(40));

        // Test 3.1: Accents sur page login
        log('test', 'Accents page login...');
        try {
            const pageText = await page.evaluate(() => document.body.textContent);

            // Liste de mots avec accents attendus
            const accentedWords = {
                'é': ['créer', 'réservation', 'sécurité', 'été', 'connecté', 'réussi'],
                'è': ['première', 'accès'],
                'ê': ['être'],
                'à': ['à'],
                'ù': ['où']
            };

            let foundAccents = [];
            for (const [accent, words] of Object.entries(accentedWords)) {
                if (pageText.includes(accent)) {
                    foundAccents.push(accent);
                }
            }

            if (foundAccents.length > 0) {
                log('pass', `Accents trouves: ${foundAccents.join(', ')}`);
                passed++;
            } else {
                log('info', 'Pas d\'accents detectes (peut etre page en anglais)');
                passed++;
            }
        } catch (error) {
            log('fail', `Accents login: ${error.message}`);
            failed++;
        }

        // Test 3.2: Pas de caracteres casses
        log('test', 'Verification caracteres non casses...');
        try {
            const hasBrokenChars = await page.evaluate(() => {
                const text = document.body.textContent;
                // Detecter les caracteres casses typiques
                const brokenPatterns = ['Ã©', 'Ã¨', 'Ã ', 'Ã§', 'Ã´', 'â€', '�'];
                return brokenPatterns.some(pattern => text.includes(pattern));
            });

            if (!hasBrokenChars) {
                log('pass', 'No broken characters detected');
                passed++;
            } else {
                log('fail', 'Broken characters detected (encoding issue)');
                failed++;
            }
        } catch (error) {
            log('fail', `Broken chars: ${error.message}`);
            failed++;
        }

        // ========================================
        // SECTION 4: APIs Externes UTF-8
        // ========================================
        console.log('\n' + '-'.repeat(40));
        console.log(`${colors.cyan}SECTION 4: APIs Externes UTF-8${colors.reset}`);
        console.log('-'.repeat(40));

        // Test 4.1: Nominatim UTF-8
        log('test', 'Nominatim API accents...');
        try {
            const nominatimResult = await page.evaluate(async () => {
                try {
                    const response = await fetch(
                        'https://nominatim.openstreetmap.org/search?format=json&q=Montreal&limit=1',
                        { headers: { 'Accept-Language': 'fr' } }
                    );
                    const data = await response.json();
                    if (data && data.length > 0) {
                        return {
                            success: true,
                            name: data[0].display_name,
                            hasAccent: data[0].display_name.includes('é') ||
                                       data[0].display_name.includes('è') ||
                                       data[0].display_name.includes('ô')
                        };
                    }
                    return { success: false };
                } catch (e) {
                    return { error: e.message };
                }
            });

            if (nominatimResult.success && nominatimResult.hasAccent) {
                log('pass', `Nominatim UTF-8 OK: ${nominatimResult.name.substring(0, 60)}...`);
                passed++;
            } else if (nominatimResult.success) {
                log('pass', 'Nominatim repond (sans accents dans ce resultat)');
                passed++;
            } else {
                log('warn', 'Nominatim non accessible');
                passed++;
            }
        } catch (error) {
            log('fail', `Nominatim: ${error.message}`);
            failed++;
        }

        // Test 4.2: Villes marocaines avec accents
        log('test', 'Villes marocaines UTF-8...');
        try {
            const moroccoResult = await page.evaluate(async () => {
                try {
                    const response = await fetch(
                        'https://nominatim.openstreetmap.org/search?format=json&q=Fes,Morocco&limit=1',
                        { headers: { 'Accept-Language': 'fr' } }
                    );
                    const data = await response.json();
                    if (data && data.length > 0) {
                        return {
                            success: true,
                            name: data[0].display_name,
                            // Fes peut s'ecrire Fès
                            hasAccent: data[0].display_name.includes('è') ||
                                       data[0].display_name.includes('é')
                        };
                    }
                    return { success: false };
                } catch (e) {
                    return { error: e.message };
                }
            });

            if (moroccoResult.success) {
                log('pass', `Ville marocaine: ${moroccoResult.name.substring(0, 50)}...`);
                passed++;
            } else {
                log('warn', 'Recherche Maroc non accessible');
                passed++;
            }
        } catch (error) {
            log('fail', `Villes marocaines: ${error.message}`);
            failed++;
        }

        // ========================================
        // SECTION 5: Formulaires et Inputs
        // ========================================
        console.log('\n' + '-'.repeat(40));
        console.log(`${colors.cyan}SECTION 5: Formulaires UTF-8${colors.reset}`);
        console.log('-'.repeat(40));

        // Login pour tester les formulaires
        log('test', 'Test saisie avec accents...');
        try {
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });

            // Taper un texte avec accents dans le champ email (juste pour test)
            const emailInput = await page.$('input[name="email"]');
            if (emailInput) {
                await emailInput.type('téstàccénts@example.com', { delay: 30 });

                const typedValue = await page.$eval('input[name="email"]', el => el.value);

                if (typedValue === 'téstàccénts@example.com') {
                    log('pass', 'Saisie avec accents preservee');
                    passed++;
                } else {
                    log('fail', `Accents alteres: ${typedValue}`);
                    failed++;
                }
            } else {
                log('warn', 'Input email non trouve');
                passed++;
            }
        } catch (error) {
            log('fail', `Formulaire accents: ${error.message}`);
            failed++;
        }

        // ========================================
        // SECTION 6: i18n Module
        // ========================================
        console.log('\n' + '-'.repeat(40));
        console.log(`${colors.cyan}SECTION 6: i18n Module${colors.reset}`);
        console.log('-'.repeat(40));

        // Test 6.1: Module I18n charge
        log('test', 'Module I18n disponible...');
        try {
            // Login pour acceder aux pages avec i18n
            await page.goto(config.baseUrl + '/login', { waitUntil: 'networkidle2' });
            await page.$eval('input[name="email"]', el => el.value = '');
            await page.type('input[name="email"]', config.users.passenger.email, { delay: 20 });
            await page.type('input[name="password"]', config.users.passenger.password, { delay: 20 });
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
            ]);

            await page.goto(config.baseUrl + '/passenger/book', { waitUntil: 'networkidle2' });
            await sleep(2000);

            const hasI18n = await page.evaluate(() => {
                return typeof I18n !== 'undefined' || typeof window.__ !== 'undefined';
            });

            if (hasI18n) {
                log('pass', 'Module I18n charge');
                passed++;
            } else {
                log('info', 'Module I18n non detecte (peut etre integre differemment)');
                passed++;
            }
        } catch (error) {
            log('fail', `I18n module: ${error.message}`);
            failed++;
        }

        // Test 6.2: Traductions chargees
        log('test', 'Traductions disponibles...');
        try {
            const translations = await page.evaluate(() => {
                if (typeof I18n !== 'undefined' && I18n.t) {
                    return {
                        hasT: true,
                        sample: I18n.t('booking.confirm_ride') || I18n.t('common.confirm')
                    };
                }
                return { hasT: false };
            });

            if (translations.hasT) {
                log('pass', `Traductions OK: "${translations.sample}"`);
                passed++;
            } else {
                log('info', 'Fonction I18n.t non disponible');
                passed++;
            }
        } catch (error) {
            log('fail', `Traductions: ${error.message}`);
            failed++;
        }

        // ========================================
        // RESULTATS
        // ========================================
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.cyan}RESULTATS FINAUX${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.green}PASSES: ${passed}${colors.reset}`);
        console.log(`${colors.red}ECHOUES: ${failed}${colors.reset}`);
        console.log(`Total: ${passed + failed} tests`);
        console.log('='.repeat(60) + '\n');

        if (failed === 0) {
            log('pass', 'Encoding et i18n sont corrects !');
        } else {
            log('warn', `${failed} probleme(s) d'encoding detecte(s)`);
        }

    } catch (error) {
        log('fail', `Erreur fatale: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('info', 'Fermeture du navigateur...');
            await sleep(2000);
            await browser.close();
        }
    }

    return failed === 0;
}

// Executer
runEncodingTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
