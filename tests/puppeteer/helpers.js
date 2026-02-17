/**
 * TripSalama - Helpers Puppeteer
 */

const config = require('./config');

/**
 * Attendre un délai
 */
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attendre qu'un élément soit visible
 */
async function waitForElement(page, selector, timeout = config.timeouts.element) {
    try {
        await page.waitForSelector(selector, {
            visible: true,
            timeout
        });
        return true;
    } catch (error) {
        console.log(`Element not found: ${selector}`);
        return false;
    }
}

/**
 * Cliquer sur un élément avec attente
 */
async function clickElement(page, selector) {
    await waitForElement(page, selector);
    await page.click(selector);
    await sleep(config.timeouts.animation);
}

/**
 * Remplir un champ de texte
 */
async function fillInput(page, selector, value) {
    await waitForElement(page, selector);
    await page.click(selector, { clickCount: 3 }); // Sélectionner tout
    await page.type(selector, value);
}

/**
 * Se connecter
 */
async function login(page, userType = 'passenger') {
    const user = config.users[userType];

    await page.goto(`${config.baseUrl}/login`);
    await waitForElement(page, config.selectors.loginForm);

    await fillInput(page, config.selectors.emailInput, user.email);
    await fillInput(page, config.selectors.passwordInput, user.password);

    await clickElement(page, config.selectors.submitBtn);

    // Attendre la redirection
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: config.timeouts.navigation });

    return user;
}

/**
 * Se déconnecter
 */
async function logout(page) {
    await page.goto(`${config.baseUrl}/logout`);
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

/**
 * Vérifier la présence d'un toast
 */
async function checkToast(page, type = null) {
    const toastSelector = type ? `.toast.toast-${type}` : config.selectors.toast;
    return await waitForElement(page, toastSelector, 5000);
}

/**
 * Prendre une capture d'écran
 */
async function takeScreenshot(page, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshots/${name}-${timestamp}.png`;

    await page.screenshot({
        path: filename,
        fullPage: true
    });

    console.log(`Screenshot saved: ${filename}`);
    return filename;
}

/**
 * Vérifier l'URL actuelle
 */
async function checkUrl(page, expectedPath) {
    const url = page.url();
    const expected = `${config.baseUrl}${expectedPath}`;
    return url.includes(expectedPath);
}

/**
 * Attendre que la carte soit chargée
 */
async function waitForMap(page, mapSelector = '#bookingMap') {
    await waitForElement(page, mapSelector);
    // Attendre que Leaflet initialise
    await page.waitForFunction(
        (selector) => {
            const map = document.querySelector(selector);
            return map && map.querySelector('.leaflet-tile-loaded');
        },
        { timeout: config.timeouts.navigation },
        mapSelector
    );
    await sleep(1000); // Attendre le rendu complet
}

/**
 * Simuler une sélection d'adresse dans l'autocomplete
 */
async function selectAddress(page, inputSelector, address) {
    await fillInput(page, inputSelector, address);

    // Attendre les résultats d'autocomplete
    await sleep(500); // Debounce

    const resultsSelector = `${inputSelector} + .autocomplete-results, .autocomplete-results`;

    const hasResults = await waitForElement(page, resultsSelector, 3000);

    if (hasResults) {
        // Cliquer sur le premier résultat
        await page.click(`${resultsSelector} .autocomplete-item:first-child`);
    }

    await sleep(config.timeouts.animation);
}

/**
 * Vérifier qu'un élément contient du texte
 */
async function elementContainsText(page, selector, text) {
    try {
        const element = await page.$(selector);
        if (!element) return false;

        const content = await page.evaluate(el => el.textContent, element);
        return content.includes(text);
    } catch (error) {
        return false;
    }
}

/**
 * Reporter de test simple
 */
class TestReporter {
    constructor(suiteName) {
        this.suiteName = suiteName;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.startTime = Date.now();
    }

    log(message) {
        console.log(`[${this.suiteName}] ${message}`);
    }

    async test(name, fn) {
        const testStart = Date.now();
        try {
            await fn();
            this.passed++;
            const duration = Date.now() - testStart;
            console.log(`  \x1b[32m✓\x1b[0m ${name} (${duration}ms)`);
            this.tests.push({ name, status: 'passed', duration });
        } catch (error) {
            this.failed++;
            const duration = Date.now() - testStart;
            console.log(`  \x1b[31m✗\x1b[0m ${name} (${duration}ms)`);
            console.log(`    Error: ${error.message}`);
            this.tests.push({ name, status: 'failed', duration, error: error.message });
        }
    }

    summary() {
        const totalDuration = Date.now() - this.startTime;
        console.log('\n' + '='.repeat(50));
        console.log(`Suite: ${this.suiteName}`);
        console.log(`Total: ${this.passed + this.failed} tests`);
        console.log(`\x1b[32mPassed: ${this.passed}\x1b[0m`);
        if (this.failed > 0) {
            console.log(`\x1b[31mFailed: ${this.failed}\x1b[0m`);
        }
        console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log('='.repeat(50) + '\n');

        return this.failed === 0;
    }
}

module.exports = {
    sleep,
    waitForElement,
    clickElement,
    fillInput,
    login,
    logout,
    checkToast,
    takeScreenshot,
    checkUrl,
    waitForMap,
    selectAddress,
    elementContainsText,
    TestReporter
};
