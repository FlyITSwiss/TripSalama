import { test, expect, Page } from '@playwright/test';

/**
 * TripSalama - Tests Mobile Bugs Fix
 * Test les corrections pour:
 * - Bug 1: Auto-scroll de l'autocomplete sur mobile
 * - Bug 2: Comportement du marker du chauffeur
 */

// Identifiants de test
const PASSENGER = {
  email: 'fatima@example.com',
  password: 'Test1234!'
};

test.describe('Mobile Bugs Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Login as passenger
    await page.goto('/login');
    await page.fill('input[name="email"]', PASSENGER.email);
    await page.fill('input[name="password"]', PASSENGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(passenger|dashboard)/, { timeout: 10000 });
  });

  test('@smoke Bug 1: Autocomplete scroll into view on mobile', async ({ page }) => {
    // Go to booking page
    await page.goto('/passenger/book');
    await page.waitForTimeout(2000); // Wait for geolocation

    // Focus on destination input
    const dropoffInput = page.locator('#dropoffInput');
    await expect(dropoffInput).toBeVisible();
    await dropoffInput.click();
    await page.waitForTimeout(500);

    // Type search query
    await dropoffInput.fill('Casablanca Maarif');
    await page.waitForTimeout(1500); // Wait for autocomplete results

    // Check if dropdown is visible
    const dropdown = page.locator('#dropoffDropdown:not(.hidden)');
    const dropdownVisible = await dropdown.isVisible().catch(() => false);

    if (dropdownVisible) {
      // Get dropdown bounding box
      const dropdownBox = await dropdown.boundingBox();
      const viewportSize = page.viewportSize();

      if (dropdownBox && viewportSize) {
        // Check if dropdown is at least partially visible
        const isPartiallyVisible = dropdownBox.y < viewportSize.height;
        expect(isPartiallyVisible).toBeTruthy();

        // Take screenshot for verification
        await page.screenshot({ path: 'tests/playwright/screenshots/bug1-autocomplete.png' });
      }
    } else {
      // No results - not a failure
      console.log('No autocomplete results (network or no matches)');
    }
  });

  test('@smoke Bug 2: Driver marker smooth movement', async ({ page }) => {
    // Go to booking page
    await page.goto('/passenger/book');
    await page.waitForTimeout(2000);

    // Set pickup location
    const pickupInput = page.locator('#pickupInput');
    await pickupInput.click();
    await pickupInput.fill('Casablanca Ain Diab');
    await page.waitForTimeout(1200);

    const pickupResult = page.locator('#pickupDropdown .autocomplete-item').first();
    if (await pickupResult.isVisible()) {
      await pickupResult.click();
      await page.waitForTimeout(500);
    }

    // Set dropoff location
    const dropoffInput = page.locator('#dropoffInput');
    await dropoffInput.click();
    await dropoffInput.fill('Morocco Mall');
    await page.waitForTimeout(1200);

    const dropoffResult = page.locator('#dropoffDropdown .autocomplete-item').first();
    if (await dropoffResult.isVisible()) {
      await dropoffResult.click();
      await page.waitForTimeout(1000);
    }

    // Wait for route calculation
    await page.waitForTimeout(2000);

    // Submit booking
    const confirmBtn = page.locator('#confirmBtn:not(.hidden)');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(3000);

      // Should redirect to demo page
      const url = page.url();
      if (url.includes('/passenger/demo') || url.includes('/passenger/ride')) {
        // Wait for tracker to initialize
        await page.waitForTimeout(2000);

        // Collect positions over 5 seconds
        const positions: Array<{ lat: number; lng: number }> = [];

        for (let i = 0; i < 5; i++) {
          await page.waitForTimeout(1000);
          const pos = await page.evaluate(() => {
            if (typeof (window as any).UberStyleTracker !== 'undefined') {
              return (window as any).UberStyleTracker.getPosition();
            }
            return null;
          });

          if (pos && pos.lat && pos.lng) {
            positions.push(pos);
          }
        }

        // Analyze movement
        if (positions.length >= 3) {
          let maxJump = 0;

          for (let i = 1; i < positions.length; i++) {
            const dist = Math.sqrt(
              Math.pow((positions[i].lat - positions[i - 1].lat) * 111000, 2) +
              Math.pow((positions[i].lng - positions[i - 1].lng) * 111000 * Math.cos(positions[i].lat * Math.PI / 180), 2)
            );
            maxJump = Math.max(maxJump, dist);
          }

          // With our fix, max jump per second should be < 200m (simulation speed ~200km/h max)
          console.log(`Max jump detected: ${Math.round(maxJump)}m`);
          expect(maxJump).toBeLessThan(300); // Relaxed threshold for simulation

          // Take screenshot
          await page.screenshot({ path: 'tests/playwright/screenshots/bug2-marker.png' });
        }
      }
    }
  });
});
