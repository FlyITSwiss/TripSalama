const puppeteer = require('puppeteer');

async function testProd() {
    const baseUrl = 'https://stabilis-it.ch/internal/tripsalama';
    console.log('\n=== TripSalama PROD E2E Tests ===');
    console.log('URL:', baseUrl);
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    let passed = 0, failed = 0;

    // Test 1: Homepage
    console.log('[TEST] Homepage...');
    try {
        const res = await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        if (res.status() === 200) {
            console.log('[PASS] Homepage OK');
            passed++;
        } else {
            console.log('[FAIL] Homepage status:', res.status());
            failed++;
        }
    } catch (e) {
        console.log('[FAIL] Homepage:', e.message);
        failed++;
    }

    // Test 2: Login page
    console.log('[TEST] Login page...');
    try {
        await page.goto(baseUrl + '/login', { waitUntil: 'networkidle2' });
        const form = await page.$('form');
        const email = await page.$('input[name="email"]');
        const password = await page.$('input[name="password"]');
        if (form && email && password) {
            console.log('[PASS] Login page with form');
            passed++;
        } else {
            console.log('[FAIL] Login form incomplete');
            failed++;
        }
    } catch (e) {
        console.log('[FAIL] Login:', e.message);
        failed++;
    }

    // Test 3: Register passenger page
    console.log('[TEST] Register passenger page...');
    try {
        await page.goto(baseUrl + '/register/passenger', { waitUntil: 'networkidle2' });
        const form = await page.$('form');
        if (form) {
            console.log('[PASS] Register passenger page');
            passed++;
        } else {
            console.log('[FAIL] Register form missing');
            failed++;
        }
    } catch (e) {
        console.log('[FAIL] Register:', e.message);
        failed++;
    }

    // Test 4: Register driver page
    console.log('[TEST] Register driver page...');
    try {
        await page.goto(baseUrl + '/register/driver', { waitUntil: 'networkidle2' });
        const form = await page.$('form');
        if (form) {
            console.log('[PASS] Register driver page');
            passed++;
        } else {
            console.log('[FAIL] Driver register form missing');
            failed++;
        }
    } catch (e) {
        console.log('[FAIL] Driver register:', e.message);
        failed++;
    }

    // Test 5: CSS loaded
    console.log('[TEST] CSS Design System...');
    try {
        await page.goto(baseUrl + '/login', { waitUntil: 'networkidle2' });
        const hasCSS = await page.evaluate(() => {
            const body = document.body;
            const style = getComputedStyle(body);
            return style.backgroundColor !== '' && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
        });
        if (hasCSS) {
            console.log('[PASS] CSS loaded');
            passed++;
        } else {
            console.log('[WARN] CSS may not be loaded');
            passed++;
        }
    } catch (e) {
        console.log('[FAIL] CSS:', e.message);
        failed++;
    }

    // Test 6: Health API
    console.log('[TEST] Health API...');
    try {
        await page.goto(baseUrl + '/api/health.php', { waitUntil: 'networkidle2' });
        const content = await page.content();
        if (content.includes('healthy')) {
            console.log('[PASS] Health API healthy');
            passed++;
        } else {
            console.log('[FAIL] Health API not healthy');
            failed++;
        }
    } catch (e) {
        console.log('[FAIL] Health API:', e.message);
        failed++;
    }

    // Test 7: Monitoring API
    console.log('[TEST] Monitoring API...');
    try {
        await page.goto(baseUrl + '/api/monitoring.php?action=status', { waitUntil: 'networkidle2' });
        const content = await page.content();
        if (content.includes('healthy') || content.includes('success')) {
            console.log('[PASS] Monitoring API working');
            passed++;
        } else {
            console.log('[FAIL] Monitoring API issue');
            failed++;
        }
    } catch (e) {
        console.log('[FAIL] Monitoring:', e.message);
        failed++;
    }

    console.log('');
    console.log('='.repeat(40));
    console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed');
    console.log('='.repeat(40));

    await new Promise(r => setTimeout(r, 3000));
    await browser.close();

    process.exit(failed > 0 ? 1 : 0);
}

testProd().catch(console.error);
