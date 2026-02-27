# TripSalama - Guide de Build Mobile

## Corrections Appliquées (27 Feb 2026)

### Changements effectués :

| Fichier | Avant | Après |
|---------|-------|-------|
| `gradle-wrapper.properties` | Gradle 8.14.3 | Gradle 8.7 |
| `android/build.gradle` | AGP 8.13.0 | AGP 8.4.2 |
| `android/variables.gradle` | SDK 36 | SDK 34 |
| `android/app/build.gradle` | Pas de signingConfigs | signingConfigs ajouté |
| `public/index.html` | CSP permissif (*) | CSP strict |
| `.gitignore` | Incomplet | Ajout keystore/secrets |

### Fichiers supprimés :
- `android/app/src/main/res/nul` (fichier parasite)
- `android/app/src/main/res/mipmap-hdpi/nul` (fichier parasite)

---

## Prérequis pour Build Local

### 1. Installer Java JDK 17+

**Windows:**
```powershell
# Via Chocolatey
choco install temurin17

# Ou télécharger depuis:
# https://adoptium.net/temurin/releases/?version=17
```

Après installation, ajouter au PATH:
```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot
Path=%JAVA_HOME%\bin
```

### 2. Installer Android SDK

**Option A - Android Studio (recommandé):**
1. Télécharger: https://developer.android.com/studio
2. Installer avec les composants par défaut
3. Ouvrir SDK Manager et installer:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0
   - Android SDK Command-line Tools

**Option B - Command line tools only:**
```powershell
# Télécharger command line tools
# https://developer.android.com/studio#command-tools

# Définir ANDROID_HOME
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# Installer SDK via sdkmanager
sdkmanager "platforms;android-34" "build-tools;34.0.0"
```

### 3. Générer le Keystore

```powershell
# Dans le dossier TripSalama
cd android\app

keytool -genkey -v `
  -keystore release.keystore `
  -alias tripsalama `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass tripsalama2026 `
  -keypass tripsalama2026 `
  -dname "CN=TripSalama, OU=Mobile, O=Stabilis IT, L=Geneva, ST=Geneva, C=CH"
```

**Ou utiliser le script fourni:**
```powershell
scripts\generate-keystore.bat
```

---

## Build Local

### Debug APK (pour tests)
```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```

APK générée: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK (signée)
```bash
npm run cap:sync
cd android
./gradlew assembleRelease
```

APK générée: `android/app/build/outputs/apk/release/app-release.apk`

---

## Build via Codemagic (Recommandé)

### Configuration requise sur Codemagic:

1. **Créer un compte**: https://codemagic.io
2. **Connecter le repo GitHub**: FlyITSwiss/TripSalama
3. **Configurer les variables d'environnement:**

**Groupe `android_signing`:**
```
CM_KEYSTORE: (base64 du fichier release.keystore)
CM_KEYSTORE_PASSWORD: tripsalama2026
CM_KEY_ALIAS: tripsalama
CM_KEY_PASSWORD: tripsalama2026
```

**Groupe `ios_signing` (pour iOS):**
- Configurer via App Store Connect integration

4. **Lancer un build:**
   - Push sur `main` ou `develop` → Build automatique
   - Créer tag `v1.0.0` → Release Play Store/TestFlight

---

## Push Notifications (Firebase)

### Étapes:

1. Créer projet Firebase: https://console.firebase.google.com
2. Ajouter app Android: `com.tripsalama.app`
3. Télécharger `google-services.json`
4. Placer dans `android/app/google-services.json`

**Pour iOS:**
1. Ajouter app iOS dans Firebase
2. Télécharger `GoogleService-Info.plist`
3. Placer dans `ios/App/App/GoogleService-Info.plist`

---

## Dépannage

### "JAVA_HOME is not set"
→ Installer JDK 17 et définir la variable d'environnement

### "SDK location not found"
→ Créer `android/local.properties`:
```properties
sdk.dir=C\:\\Users\\USERNAME\\AppData\\Local\\Android\\Sdk
```

### "Execution failed for task ':app:signReleaseBundle'"
→ Vérifier que `release.keystore` existe et que les mots de passe sont corrects

### Build réussi mais APK ne s'installe pas
→ Vérifier que l'appareil autorise "Sources inconnues" dans les paramètres

---

## Fichiers de Configuration

| Fichier | Description |
|---------|-------------|
| `capacitor.config.json` | Config Capacitor (plugins, server) |
| `android/keystore.properties` | Credentials de signature (ne pas commiter!) |
| `android/app/build.gradle` | Config build Android |
| `android/variables.gradle` | Versions SDK/dependencies |
| `codemagic.yaml` | Pipeline CI/CD |

---

## Checklist Avant Release

- [ ] Keystore généré et sauvegardé en lieu sûr
- [ ] google-services.json configuré (Firebase)
- [ ] Version incrémentée dans `android/app/build.gradle`
- [ ] Capacitor synchronisé (`npx cap sync`)
- [ ] Build release testé localement
- [ ] Variables Codemagic configurées
- [ ] Tag git créé (ex: `v1.0.0`)
