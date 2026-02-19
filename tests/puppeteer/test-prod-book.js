/**
 * TripSalama - Test Production /book page
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://stabilis-it.ch/internal/tripsalama';
const VIEWPORT = { width: 420, height: 896 };
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'prod-book');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
    console.log('\n🚀 Test Production - Page /book');
    console.log('═'.repeat(50));

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=420,896', '--ignore-certificate-errors']
    });

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    try {
        // 1. Login
        console.log('\n📱 1. Login...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login.png') });

        await page.type('input[name="email"]', 'fatima@example.com');
        await page.type('input[name="password"]', 'Test1234!');

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
            page.click('button[type="submit"]')
        ]).catch(() => {});
        await sleep(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-dashboard.png') });
        console.log('  ✅ Connecté');

        // 2. Go to /book
        console.log('\n📱 2. Page /book...');
        await page.goto(`${BASE_URL}/passenger/book`, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-book-page.png') });

        // Check elements
        const hasPickupInput = await page.$('#pickupInput') !== null;
        const hasDropoffInput = await page.$('#dropoffInput') !== null;
        const hasMap = await page.$('#map') !== null;
        const hasBottomSheet = await page.$('.booking-sheet') !== null;

        console.log(`  📍 Pickup input: ${hasPickupInput ? '✅' : '❌'}`);
        console.log(`  📍 Dropoff input: ${hasDropoffInput ? '✅' : '❌'}`);
        console.log(`  🗺️  Map: ${hasMap ? '✅' : '❌'}`);
        console.log(`  📋 Bottom sheet: ${hasBottomSheet ? '✅' : '❌'}`);

        // Check if bottom sheet is visible and not under footer
        const sheetBounds = await page.evaluate(() => {
            const sheet = document.querySelector('.booking-sheet');
            if (!sheet) return null;
            const rect = sheet.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, height: rect.height };
        });

        if (sheetBounds) {
            console.log(`  📐 Sheet position: top=${Math.round(sheetBounds.top)}px, height=${Math.round(sheetBounds.height)}px`);
            const viewportHeight = 896;
            const navHeight = 64;
            const maxBottom = viewportHeight - navHeight;

            if (sheetBounds.bottom <= viewportHeight) {
                console.log('  ✅ Bottom sheet ne passe pas sous le footer');
            } else {
                console.log(`  ⚠️  Bottom sheet dépasse (bottom: ${Math.round(sheetBounds.bottom)}px > viewport: ${viewportHeight}px)`);
            }
        }

        // 3. Check history for pending rides
        console.log('\n📱 3. Vérification historique...');
        await page.goto(`${BASE_URL}/passenger/history`, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1500);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-history.png') });

        const pendingRides = await page.evaluate(() => {
            const badges = Array.from(document.querySelectorAll('.ride-status, .status-badge'));
            return badges.filter(b =>
                b.textContent.toLowerCase().includes('attente') ||
                b.textContent.toLowerCase().includes('pending')
            ).length;
        });

        console.log(`  📊 Courses en attente: ${pendingRides}`);
        if (pendingRides === 0) {
            console.log('  ✅ Aucune course en attente');
        } else {
            console.log('  ⚠️  Des courses en attente existent encore');
        }

        console.log('\n' + '═'.repeat(50));
        console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);
        console.log('✅ Test terminé\n');

        await sleep(5000);

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') });
    } finally {
        await browser.close();
    }
}

runTest().catch(console.error);
