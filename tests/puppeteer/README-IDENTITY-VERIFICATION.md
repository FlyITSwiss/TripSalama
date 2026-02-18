# Tests E2E - Vérification d'Identité par Caméra

## Description

Tests Puppeteer complets pour la fonctionnalité de vérification d'identité par caméra lors de l'inscription des utilisatrices (passagères et conductrices).

## Fichier

```
tests/puppeteer/test-identity-verification.js
```

## Installation

```bash
cd tests/puppeteer
npm install
```

## Exécution

### Commande npm (recommandée)

```bash
npm run test:identity
```

### Commande directe

```bash
node test-identity-verification.js
```

## Configuration Technique

### Particularités Caméra

Le test utilise des flags Chrome spéciaux pour simuler une caméra sans matériel réel :

- `--use-fake-ui-for-media-stream` : Auto-accepte les permissions caméra
- `--use-fake-device-for-media-stream` : Simule une caméra virtuelle

### URL de Base

```javascript
baseUrl: 'http://127.0.0.1:8080'  // JAMAIS localhost !
```

### Mode Visuel Obligatoire

```javascript
headless: false  // Toujours en mode visuel pour observer les tests
slowMo: 50       // Ralentissement pour meilleure observation
```

## Scénarios de Tests

### Tests Principaux (10 tests)

| # | Test | Description | Priorité |
|---|------|-------------|----------|
| 1 | **Page de vérification** | Accès direct et affichage des éléments | HAUTE |
| 2 | **Tips d'aide** | Vérification des conseils affichés | MOYENNE |
| 3 | **Consentement obligatoire** | Checkbox + activation bouton continuer | HAUTE |
| 4 | **Activation caméra** | Flux caméra + guide visage | HAUTE |
| 5 | **Capture photo** | Bouton capture + affichage preview | HAUTE |
| 6 | **Reprendre photo** | Retour à la caméra après capture | MOYENNE |
| 7 | **Soumission et analyse** | Envoi + états (success/pending/error) | HAUTE |
| 8 | **Traductions** | Pas de clés i18n brutes visibles | HAUTE |
| 9 | **Erreurs console** | Détection erreurs JavaScript | HAUTE |
| 10 | **Responsive 320px** | Affichage mobile | MOYENNE |

### Test Bonus

**Parcours complet inscription + vérification** : Teste la redirection automatique depuis l'inscription vers la vérification d'identité.

## Sélecteurs CSS Testés

### Page Principale

```css
.identity-verification-container
.identity-camera-container
#identityVerification
```

### Consentement

```css
#identity-consent-checkbox
.identity-btn-continue
```

### Caméra

```css
.identity-camera-view
video#identityVideo
.face-guide
.identity-btn-capture
```

### Preview

```css
.identity-preview
.preview-image
.btn-retake
.btn-validate
```

### Résultats

```css
.verification-result
.success-message
.pending-message
.error-message
```

## Screenshots

Tous les screenshots sont sauvegardés dans :

```
tests/puppeteer/screenshots/identity-verification/
```

### Screenshots Générés

| Fichier | Description |
|---------|-------------|
| `01-verification-page-*.png` | Page initiale de vérification |
| `03-consent-checked-*.png` | Consentement coché |
| `04-camera-view-*.png` | Vue caméra activée |
| `05-photo-captured-*.png` | Photo capturée en preview |
| `06-photo-retake-*.png` | Retour caméra après reprendre |
| `07-analysis-started-*.png` | Analyse en cours |
| `07-analysis-result-*.png` | Résultat de l'analyse |
| `10-responsive-mobile-320-*.png` | Vue mobile 320px |
| `*-FAILURE-*.png` | Screenshots en cas d'échec |

## Données de Test

### Passagère Test

```javascript
{
  email: 'passenger.test.{timestamp}@tripsalama.com',
  password: 'Test1234!',
  firstName: 'Fatima',
  lastName: 'Testing',
  phone: '+33612345678',
  role: 'passenger'
}
```

### Conductrice Test

```javascript
{
  email: 'driver.test.{timestamp}@tripsalama.com',
  password: 'Test1234!',
  firstName: 'Khadija',
  lastName: 'Testing',
  phone: '+33687654321',
  role: 'driver',
  vehicleBrand: 'Renault',
  vehicleModel: 'Clio',
  vehiclePlate: 'AB-123-CD',
  vehicleColor: 'Rouge'
}
```

## Assertions Importantes

### 1. Traductions

**INTERDICTION** : Aucune clé i18n brute ne doit apparaître.

```
✗ INTERDIT : "verification.title", "identity.consent", "{{camera.guide}}"
✓ OBLIGATOIRE : "Vérification d'identité", "J'accepte", "Centrez votre visage"
```

### 2. Erreurs Console

Le test détecte les erreurs JavaScript critiques mais filtre :

- Erreurs favicon (non bloquantes)
- Erreurs CORS (attendues en dev)
- Erreurs réseau `net::ERR_` (non critiques)

### 3. Responsive

La page DOIT être utilisable en **320px** (iPhone SE).

### 4. Caméra Simulée

Puppeteer génère une image de test avec un pattern coloré, pas une vraie caméra.

## Résultats

### Format Console

```
========================================
TESTS E2E - VÉRIFICATION D'IDENTITÉ
========================================

[PASS] Test 1: Page de vérification accessible
[PASS] Test 2: Tips affichés
[PASS] Test 3: Consentement fonctionnel
[PASS] Test 4: Caméra activée
[PASS] Test 5: Capture photo réussie
[PASS] Test 6: Reprendre photo fonctionnel
[PASS] Test 7: Analyse complète avec résultat
[PASS] Test 8: Traductions OK
[PASS] Test 9: Pas d'erreurs console
[PASS] Test 10: Responsive 320px OK

============================================================
RÉSULTATS - TESTS VÉRIFICATION D'IDENTITÉ
============================================================
✓ Test 1: Page de vérification accessible
✓ Test 2: Tips affichés
✓ Test 3: Consentement fonctionnel
✓ Test 4: Caméra activée
✓ Test 5: Capture photo réussie
✓ Test 6: Reprendre photo fonctionnel
✓ Test 7: Analyse complète avec résultat
✓ Test 8: Traductions OK
✓ Test 9: Pas d'erreurs console
✓ Test 10: Responsive 320px OK
============================================================
PASSÉS: 10
ÉCHOUÉS: 0
TOTAL: 10 tests
============================================================

[PASS] ✓ TOUS LES TESTS SONT PASSÉS !

Screenshots sauvegardés dans: tests/puppeteer/screenshots/identity-verification
```

### Exit Code

- **0** : Tous les tests passent
- **1** : Au moins un test échoue

## Intégration CI/CD

### GitHub Actions (exemple)

```yaml
- name: Test Identity Verification
  run: |
    cd tests/puppeteer
    npm install
    npm run test:identity
  env:
    HEADLESS: true  # Mode headless pour CI
```

### Pre-commit Hook

```bash
#!/bin/bash
cd tests/puppeteer
npm run test:identity
if [ $? -ne 0 ]; then
  echo "❌ Tests de vérification d'identité échoués"
  exit 1
fi
```

## Dépannage

### Erreur : "Sélecteur non trouvé"

Vérifier que les sélecteurs CSS correspondent au HTML implémenté.

### Erreur : Caméra non activée

Vérifier les flags Chrome dans `IDENTITY_CONFIG.puppeteer.args`.

### Screenshots manquants

Créer le dossier manuellement :

```bash
mkdir -p tests/puppeteer/screenshots/identity-verification
```

### Timeout Navigation

Augmenter le timeout :

```javascript
timeout: {
  navigation: 30000,  // 30 secondes
  camera: 5000,
  analysis: 10000
}
```

## Maintenance

### Ajouter un Nouveau Test

```javascript
// ========================================
// TEST 11: Nom du test
// ========================================
log('info', 'Test 11: Description...');
try {
    // Code du test
    log('pass', 'Test réussi');
    passed++;
    results.push({ test: 11, status: 'pass', name: 'Nom court' });
} catch (error) {
    log('fail', `Test 11 échoué: ${error.message}`);
    failed++;
    results.push({ test: 11, status: 'fail', name: 'Erreur description' });
}
```

### Mettre à Jour les Sélecteurs

Modifier l'objet `SELECTORS` en haut du fichier :

```javascript
const SELECTORS = {
    // Nouveaux sélecteurs ici
    nouveauElement: '.nouveau-selecteur, #fallback-id'
};
```

## Checklist Avant Livraison

- [ ] **URL** : `http://127.0.0.1:8080` (pas localhost)
- [ ] **Mode visuel** : `headless: false`
- [ ] **Flags caméra** : Flags `--use-fake-*` présents
- [ ] **Screenshots** : Dossier `identity-verification/` créé
- [ ] **Exit code** : `process.exit(1)` si échec
- [ ] **Traductions** : Test vérifie absence clés i18n
- [ ] **Responsive** : Test 320px inclus
- [ ] **Documentation** : Ce README à jour

## Support

Pour toute question sur ces tests, consulter :

- `tests/puppeteer/helpers.js` : Fonctions utilitaires
- `tests/puppeteer/config.js` : Configuration globale
- `tests/puppeteer/test-auth.js` : Exemple test similaire

## Licence

MIT - TripSalama 2024
