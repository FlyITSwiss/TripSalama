# TripSalama - Tests APK avec Appium

Tests automatisés de l'APK Android RÉEL sur émulateur.

---

## 🎯 Objectif

Tester l'APK **finale** (celle qui sera uploadée sur le Play Store) pour garantir que TOUTES les features fonctionnent avant soumission.

---

## 📋 Prérequis

| Outil | Version | Installation |
|-------|---------|--------------|
| **Node.js** | >= 18 | https://nodejs.org |
| **Android Studio** | Dernière | https://developer.android.com/studio |
| **Android SDK** | API 33+ | Via Android Studio |
| **Émulateur Android** | 1 AVD configuré | Via Android Studio AVD Manager |
| **Java JDK** | >= 11 | https://adoptium.net |

---

## ⚙️ Installation Automatique

```bash
# Installation complète en 1 commande
npm run setup:appium
```

Ce script vérifie et configure:
- Node.js et npm
- Appium 2.x + UiAutomator2 driver
- Android SDK (ANDROID_HOME)
- Émulateur Android (AVDs disponibles)
- Java JDK

---

## 🚀 Lancer les Tests

### 1. Démarrer le serveur Appium

Dans un terminal séparé:

```bash
npm run appium:start
```

Doit afficher:
```
🚀 Démarrage serveur Appium...
📍 http://127.0.0.1:4723
```

### 2. Démarrer l'émulateur Android

Via Android Studio AVD Manager ou en ligne de commande:

```bash
emulator -avd Pixel_5_API_33
```

Vérifier que l'émulateur est prêt:

```bash
adb devices
```

Doit afficher:
```
List of devices attached
emulator-5554   device
```

### 3. Builder l'APK

```bash
npm run build:apk
```

Génère: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Lancer les tests

| Test | Durée | Commande |
|------|-------|----------|
| **Smoke** (app démarre) | ~30s | `npm run test:apk:smoke` |
| **Login** (passagère + conductrice) | ~2 min | `npm run test:apk:login` |
| **Complet** (toutes features) | ~5 min | `npm run test:apk` |

---

## 📸 Screenshots

Les tests génèrent automatiquement des screenshots dans `tests/appium/screenshots/`:

- `01-splash.png` - Écran de démarrage
- `02-login-screen.png` - Écran de login
- `03-login-filled.png` - Formulaire rempli
- `04-after-login.png` - Dashboard
- `05-after-logout.png` - Retour au login
- `06-driver-dashboard.png` - Dashboard conductrice
- `07-landscape.png` - Mode paysage

---

## 🧪 Tests Inclus

### Test Smoke (`test-apk-smoke.js`)

- ✅ APK démarre sans crash
- ✅ Écran de login s'affiche

### Test Login (`test-apk-login.js`)

- ✅ APK démarre
- ✅ Login passagère
- ✅ Logout
- ✅ Login conductrice

### Test Complet (`test-apk-complete.js`)

- ✅ APK démarre sans crash
- ✅ Écran de login s'affiche
- ✅ Logo TripSalama visible
- ✅ Login passagère réussit
- ✅ Dashboard passagère s'affiche
- ✅ Map (WebView) se charge
- ✅ Logout fonctionne
- ✅ Login conductrice réussit
- ✅ Dashboard conductrice s'affiche
- ✅ Rotation écran supportée (portrait/paysage)
- ✅ Back button fonctionne
- ✅ App redémarre sans crash

---

## 🔧 Dépannage

### Problème: "APK non trouvé"

```bash
# Solution
npm run build:apk
```

### Problème: "Aucun appareil Android connecté"

```bash
# Démarrer émulateur
emulator -avd Pixel_5_API_33

# Vérifier
adb devices
```

### Problème: "Connection refused 127.0.0.1:4723"

```bash
# Démarrer Appium dans un terminal séparé
npm run appium:start
```

### Problème: "ANDROID_HOME non défini"

Définir la variable d'environnement:

**Windows:**
```powershell
setx ANDROID_HOME "C:\Users\VotreNom\AppData\Local\Android\Sdk"
```

**macOS/Linux:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
```

### Problème: "Java non trouvé"

Installer JDK 11 ou supérieur: https://adoptium.net

---

## 📊 Identifiants de Test

Les tests utilisent des comptes de test prédéfinis:

| Type | Email | Password |
|------|-------|----------|
| **Passagère** | `passenger@tripsalama.ch` | `TripSalama2025!` |
| **Conductrice** | `driver@tripsalama.ch` | `TripSalama2025!` |

Ces comptes doivent exister dans la base de données de test.

---

## 🚦 Intégration CI/CD

Les tests Appium sont intégrés dans GitHub Actions (`.github/workflows/apk-tests.yml`).

Le workflow:
1. Configure l'émulateur Android
2. Démarre Appium
3. Build l'APK
4. Lance les tests
5. Upload les screenshots en artifacts

---

## 📖 Documentation Appium

- Site officiel: https://appium.io
- WebdriverIO: https://webdriver.io
- Android UiAutomator2: https://github.com/appium/appium-uiautomator2-driver

---

## 🎯 Critères de Succès

Pour que l'APK soit prêt pour le Play Store:

- ✅ **Smoke test** passe (0 échec)
- ✅ **Login test** passe (0 échec)
- ✅ **Test complet** passe (0 échec)
- ✅ Taille APK < 150 MB
- ✅ Pas de crash au démarrage
- ✅ Pas de crash pendant navigation
- ✅ Toutes les features critiques fonctionnent

---

## 📞 Support

En cas de problème:
1. Vérifier les prérequis: `npm run setup:appium`
2. Consulter ce README
3. Vérifier les logs Appium
4. Analyser les screenshots générés
