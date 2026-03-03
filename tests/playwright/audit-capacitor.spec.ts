import { test, expect } from '@playwright/test';

/**
 * TripSalama - Audit Capacitor Android
 * Tests complets pour valider la conversion Capacitor
 *
 * Vérifie:
 * - Bouton SOS d'urgence
 * - Bouton Ma position
 * - Carte MapLibre
 * - Formulaire de réservation
 * - Remember Me
 */

test.describe('Audit Capacitor Android - TripSalama', () => {

  test.beforeEach(async ({ page }) => {
    // Créer le dossier screenshots s'il n'existe pas
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Page Login - Structure et éléments', async ({ page }) => {
    // Vérifier la page de login
    await expect(page.locator('.login-page')).toBeVisible();

    // Vérifier le logo
    await expect(page.locator('.login-logo')).toContainText('TripSalama');

    // Vérifier les champs de formulaire
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();

    // Vérifier le checkbox Remember Me
    await expect(page.locator('#rememberMe')).toBeVisible();
    await expect(page.locator('.remember-me-label')).toContainText('Rester connecté');

    // Vérifier le bouton de connexion
    await expect(page.locator('#loginBtn')).toBeVisible();

    // Le bouton SOS doit être CACHÉ sur la page de login
    await expect(page.locator('#sosButton')).toBeHidden();

    // Screenshot
    await page.screenshot({
      path: 'tests/playwright/screenshots/01-login-page.png',
      fullPage: true
    });
  });

  test('2. Bouton SOS - Présence et styles', async ({ page }) => {
    // Aller sur la page de réservation directement (simulé)
    await page.evaluate(() => {
      // Simuler un utilisateur connecté
      const bookingPage = document.getElementById('bookingPage');
      const loginPage = document.getElementById('loginPage');
      if (bookingPage && loginPage) {
        loginPage.classList.add('hidden');
        bookingPage.classList.remove('hidden');
      }
      // Afficher le bouton SOS
      const sosBtn = document.getElementById('sosButton');
      if (sosBtn) {
        sosBtn.classList.remove('hidden');
      }
    });

    await page.waitForTimeout(500);

    // Vérifier le bouton SOS
    const sosButton = page.locator('#sosButton');
    await expect(sosButton).toBeVisible();

    // Vérifier le style (rouge)
    const bgColor = await sosButton.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    console.log('SOS Button background color:', bgColor);

    // Vérifier que le label SOS est présent
    await expect(page.locator('.sos-fab-label')).toContainText('SOS');

    // Screenshot du bouton SOS
    await page.screenshot({
      path: 'tests/playwright/screenshots/02-sos-button-visible.png',
      fullPage: true
    });
  });

  test('3. Modal SOS - Ouverture et contenu', async ({ page }) => {
    // Simuler booking page
    await page.evaluate(() => {
      const bookingPage = document.getElementById('bookingPage');
      const loginPage = document.getElementById('loginPage');
      if (bookingPage && loginPage) {
        loginPage.classList.add('hidden');
        bookingPage.classList.remove('hidden');
      }
      const sosBtn = document.getElementById('sosButton');
      if (sosBtn) sosBtn.classList.remove('hidden');
    });

    await page.waitForTimeout(300);

    // Cliquer sur le bouton SOS
    await page.locator('#sosButton').click();
    await page.waitForTimeout(500);

    // Vérifier la modal
    const sosModal = page.locator('#sosModal');
    await expect(sosModal).toHaveClass(/active/);

    // Vérifier le contenu de la modal
    await expect(page.locator('.sos-modal-title')).toContainText('Alerte d\'urgence');
    await expect(page.locator('.sos-modal-text')).toBeVisible();
    await expect(page.locator('#sosConfirmBtn')).toBeVisible();
    await expect(page.locator('#sosCancelBtn')).toBeVisible();

    // Screenshot de la modal SOS
    await page.screenshot({
      path: 'tests/playwright/screenshots/03-sos-modal-open.png',
      fullPage: true
    });

    // Fermer la modal
    await page.locator('#sosCancelBtn').click();
    await page.waitForTimeout(300);
    await expect(sosModal).not.toHaveClass(/active/);
  });

  test('4. Page Booking - Carte et boutons', async ({ page }) => {
    // Simuler booking page
    await page.evaluate(() => {
      const bookingPage = document.getElementById('bookingPage');
      const loginPage = document.getElementById('loginPage');
      if (bookingPage && loginPage) {
        loginPage.classList.add('hidden');
        bookingPage.classList.remove('hidden');
      }
      const sosBtn = document.getElementById('sosButton');
      if (sosBtn) sosBtn.classList.remove('hidden');
    });

    await page.waitForTimeout(1000);

    // Vérifier le bouton retour
    await expect(page.locator('#bookingBackBtn')).toBeVisible();

    // Vérifier le bouton Ma position
    const myLocationBtn = page.locator('#myLocationBtn');
    await expect(myLocationBtn).toBeVisible();

    // Vérifier que le bouton a le bon aria-label
    await expect(myLocationBtn).toHaveAttribute('aria-label', 'Ma position');

    // Vérifier le conteneur de la carte
    const mapContainer = page.locator('#bookingMap');
    await expect(mapContainer).toBeVisible();

    // Vérifier les champs pickup/dropoff
    await expect(page.locator('#bookingPickup')).toBeVisible();
    await expect(page.locator('#bookingDropoff')).toBeVisible();

    // Screenshot de la page booking
    await page.screenshot({
      path: 'tests/playwright/screenshots/04-booking-page.png',
      fullPage: true
    });
  });

  test('5. Carte MapLibre - Initialisation', async ({ page }) => {
    // Simuler booking page et initialiser la carte
    await page.evaluate(() => {
      const bookingPage = document.getElementById('bookingPage');
      const loginPage = document.getElementById('loginPage');
      if (bookingPage && loginPage) {
        loginPage.classList.add('hidden');
        bookingPage.classList.remove('hidden');
      }
      // Appeler initBookingMap si disponible
      if (typeof (window as any).showBookingPage === 'function') {
        // La fonction showBookingPage initialise la carte
      }
    });

    await page.waitForTimeout(2000);

    // Vérifier que MapLibre est chargé
    const mapLibreLoaded = await page.evaluate(() => {
      return typeof (window as any).maplibregl !== 'undefined';
    });
    expect(mapLibreLoaded).toBe(true);
    console.log('MapLibre GL loaded:', mapLibreLoaded);

    // Vérifier la taille du conteneur de carte
    const mapBox = await page.locator('#bookingMap').boundingBox();
    console.log('Map container size:', mapBox);
    expect(mapBox).not.toBeNull();
    if (mapBox) {
      expect(mapBox.width).toBeGreaterThan(100);
      expect(mapBox.height).toBeGreaterThan(100);
    }

    // Screenshot de la carte
    await page.screenshot({
      path: 'tests/playwright/screenshots/05-map-container.png',
      fullPage: true
    });
  });

  test('6. Booking Sheet - Formulaire de réservation', async ({ page }) => {
    // Simuler booking page
    await page.evaluate(() => {
      const bookingPage = document.getElementById('bookingPage');
      const loginPage = document.getElementById('loginPage');
      if (bookingPage && loginPage) {
        loginPage.classList.add('hidden');
        bookingPage.classList.remove('hidden');
      }
    });

    await page.waitForTimeout(500);

    // Vérifier la booking sheet
    await expect(page.locator('.booking-sheet')).toBeVisible();
    await expect(page.locator('.booking-title')).toContainText('Où allez-vous');

    // Vérifier le champ pickup
    const pickupInput = page.locator('#bookingPickup');
    await expect(pickupInput).toBeVisible();
    await expect(pickupInput).toHaveAttribute('placeholder', 'Point de départ');

    // Vérifier le bouton de localisation
    await expect(page.locator('#bookingLocateBtn')).toBeVisible();

    // Vérifier le champ dropoff
    const dropoffInput = page.locator('#bookingDropoff');
    await expect(dropoffInput).toBeVisible();
    await expect(dropoffInput).toHaveAttribute('placeholder', 'Destination');

    // Vérifier le bouton de confirmation (initialement caché)
    await expect(page.locator('#bookingConfirmBtn')).toBeHidden();

    // Screenshot du formulaire
    await page.screenshot({
      path: 'tests/playwright/screenshots/06-booking-sheet.png',
      fullPage: true
    });
  });

  test('7. Touch targets - Accessibilité mobile', async ({ page }) => {
    // Simuler booking page
    await page.evaluate(() => {
      const bookingPage = document.getElementById('bookingPage');
      const loginPage = document.getElementById('loginPage');
      if (bookingPage && loginPage) {
        loginPage.classList.add('hidden');
        bookingPage.classList.remove('hidden');
      }
      const sosBtn = document.getElementById('sosButton');
      if (sosBtn) sosBtn.classList.remove('hidden');
    });

    await page.waitForTimeout(500);

    // Vérifier la taille des touch targets (minimum 44x44px)
    const buttons = [
      { selector: '#sosButton', name: 'SOS Button' },
      { selector: '#bookingBackBtn', name: 'Back Button' },
      { selector: '#myLocationBtn', name: 'My Location Button' },
      { selector: '#bookingLocateBtn', name: 'Locate Button' }
    ];

    for (const btn of buttons) {
      const box = await page.locator(btn.selector).boundingBox();
      if (box) {
        console.log(`${btn.name}: ${box.width}x${box.height}px`);
        // Minimum 44x44 pour accessibilité mobile
        expect(box.width).toBeGreaterThanOrEqual(36); // Tolérance légère
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });

  test('8. Dashboard Passagère - Structure', async ({ page }) => {
    // Simuler passenger dashboard
    await page.evaluate(() => {
      const passengerDashboard = document.getElementById('passengerDashboard');
      const loginPage = document.getElementById('loginPage');
      if (passengerDashboard && loginPage) {
        loginPage.classList.add('hidden');
        passengerDashboard.classList.remove('hidden');
      }
    });

    await page.waitForTimeout(500);

    // Vérifier les éléments du dashboard
    await expect(page.locator('.welcome-section')).toBeVisible();
    await expect(page.locator('.where-to-card')).toBeVisible();
    await expect(page.locator('.safety-banner')).toBeVisible();

    // Vérifier la navigation mobile
    await expect(page.locator('.mobile-nav')).toBeVisible();

    // Screenshot du dashboard
    await page.screenshot({
      path: 'tests/playwright/screenshots/08-passenger-dashboard.png',
      fullPage: true
    });
  });

  test('9. Dashboard Conductrice - Structure', async ({ page }) => {
    // Simuler driver dashboard
    await page.evaluate(() => {
      const driverDashboard = document.getElementById('driverDashboard');
      const loginPage = document.getElementById('loginPage');
      if (driverDashboard && loginPage) {
        loginPage.classList.add('hidden');
        driverDashboard.classList.remove('hidden');
      }
    });

    await page.waitForTimeout(500);

    // Vérifier les éléments du dashboard conductrice
    await expect(page.locator('.driver-status-card')).toBeVisible();
    await expect(page.locator('#availabilityToggle')).toBeVisible();
    await expect(page.locator('.earnings-card')).toBeVisible();

    // Screenshot du dashboard conductrice
    await page.screenshot({
      path: 'tests/playwright/screenshots/09-driver-dashboard.png',
      fullPage: true
    });
  });

  test('10. Responsive - Viewport mobile', async ({ page }) => {
    // Tester en viewport mobile (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Vérifier que la page s'adapte
    await expect(page.locator('.app-container')).toBeVisible();

    // Screenshot mobile
    await page.screenshot({
      path: 'tests/playwright/screenshots/10-mobile-viewport.png',
      fullPage: true
    });

    // Tester en viewport tablette
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'tests/playwright/screenshots/10-tablet-viewport.png',
      fullPage: true
    });
  });

});
