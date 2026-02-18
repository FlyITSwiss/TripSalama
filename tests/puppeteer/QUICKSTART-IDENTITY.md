# Quick Start - Tests Vérification d'Identité

Guide rapide pour exécuter les tests E2E de vérification d'identité par caméra.

## Installation (une seule fois)

```bash
cd tests/puppeteer
npm install
```

## Vérifier le Setup

```bash
npm run check:identity
```

**Attendu** : Tous les checks verts ✓

## Exécuter les Tests

### Option 1 : npm (recommandée)

```bash
npm run test:identity
```

### Option 2 : Node direct

```bash
node test-identity-verification.js
```

## Ce qui est Testé

1. **Page de vérification** - Affichage correct
2. **Tips d'aide** - Conseils visibles
3. **Consentement obligatoire** - Checkbox + bouton
4. **Activation caméra** - Flux caméra + guide visage
5. **Capture photo** - Bouton capture + preview
6. **Reprendre photo** - Retour caméra
7. **Soumission et analyse** - Envoi + états résultats
8. **Traductions** - Pas de clés i18n brutes
9. **Erreurs console** - Détection erreurs JS
10. **Responsive 320px** - Affichage mobile

## Résultats Attendus

```
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

✓ TOUS LES TESTS SONT PASSÉS !
```

## Screenshots

Sauvegardés automatiquement dans :

```
tests/puppeteer/screenshots/identity-verification/
```

## Dépannage Rapide

### Puppeteer non installé

```bash
npm install puppeteer
```

### Erreur "localhost"

Vérifier `config.js` :

```javascript
baseUrl: 'http://127.0.0.1:8080'  // PAS localhost !
```

### Caméra non détectée

Les tests utilisent une caméra simulée (flags Chrome automatiques).

### Timeout

Augmenter dans le fichier de test :

```javascript
timeout: {
  navigation: 30000,  // 30 secondes
  camera: 5000,
  analysis: 10000
}
```

## Sélecteurs CSS Attendus

Si l'implémentation utilise des sélecteurs différents, les adapter dans :

```javascript
const SELECTORS = {
    container: '.identity-verification-container',
    consentCheckbox: '#identity-consent-checkbox',
    continueButton: '.identity-btn-continue',
    cameraView: '.identity-camera-view',
    videoElement: 'video#identityVideo',
    captureButton: '.identity-btn-capture',
    // ... etc
};
```

## Configuration Caméra Simulée

Flags Chrome automatiques :

- `--use-fake-ui-for-media-stream` : Auto-accepte permission
- `--use-fake-device-for-media-stream` : Caméra virtuelle

**Pas besoin de caméra physique !**

## Mode Visuel vs Headless

### Développement (par défaut)

```javascript
headless: false  // Voir le navigateur
slowMo: 50       // Ralentir les actions
```

### CI/CD

```bash
HEADLESS=true npm run test:identity
```

## Documentation Complète

Voir `README-IDENTITY-VERIFICATION.md` pour :

- Liste complète des scénarios
- Détails techniques
- Intégration CI/CD
- Maintenance et ajout de tests

## Commandes Utiles

| Commande | Description |
|----------|-------------|
| `npm run check:identity` | Vérifier le setup |
| `npm run test:identity` | Exécuter les tests |
| `npm run test` | Tous les tests E2E |
| `npm run test:smoke` | Tests rapides |

## Support

Questions ? Consulter :

1. `README-IDENTITY-VERIFICATION.md` (documentation complète)
2. `test-identity-verification.js` (code source commenté)
3. `helpers.js` (fonctions utilitaires)
4. `config.js` (configuration)

---

**Note** : Ces tests sont prêts à être exécutés même si la fonctionnalité n'est pas encore implémentée. Ils serviront de spécification pour le développement.
