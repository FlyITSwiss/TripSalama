# TripSalama - Référence Absolue Claude Code

> **IMPORTANT**: Ce fichier est la source de vérité pour toute intervention sur le projet.
> Claude Code doit le lire EN PREMIER à chaque session.

---

## 1. STACK & VERSIONS PINÉES

**Ne JAMAIS changer ces versions sans accord explicite de l'utilisateur.**

| Composant | Version | Notes |
|-----------|---------|-------|
| **Node.js** | 20.x LTS | Utiliser nvm pour garantir la version |
| **npm** | 10.x+ | Livré avec Node 20 |
| **Capacitor Core** | 8.1.0 | Dernière stable |
| **Capacitor CLI** | 8.1.0 | Doit matcher Core |
| **Capacitor Android** | 8.1.0 | Doit matcher Core |
| **Capacitor iOS** | 8.1.0 | Doit matcher Core |
| **JDK** | 21 (LTS) | Requis pour Capacitor 8.x + SDK 35 |
| **Gradle** | 8.11.1 | Compatible JDK 21 |
| **Android SDK** | API 35 (compileSdk/targetSdk) | Android 15 |
| **Android minSdk** | API 24 | Android 7.0 (Nougat) |
| **Android Build Tools** | 35.0.0 | Matcher compileSdk |
| **WebView minimum** | Chrome 89+ | Support ES2020, CSS env() |

### Vérification des versions
```bash
node -v          # v20.x.x
npm -v           # 10.x.x
java -version    # openjdk 21.x.x
./android/gradlew --version  # Gradle 8.11.1
```

---

## 2. RÈGLES DE BUILD

### Avant chaque `npx cap sync`
1. Build front complet (pas de fichiers stale)
2. Vérifier que `public/` contient les derniers assets
3. Supprimer le cache si doute : `rm -rf android/app/build`

### Ordre de test obligatoire
1. **Chrome DevTools** (mode mobile, F12 → Toggle device)
2. **Live Reload WiFi** (`npm run dev` → tester sur téléphone réel)
3. **APK Debug** (installer sur téléphone)
4. **APK Release** (uniquement pour production)

### Fichiers critiques - NE PAS MODIFIER sans documenter ici
- `android/app/build.gradle`
- `android/variables.gradle`
- `capacitor.config.json`
- Tout fichier `AndroidManifest.xml`
- Tout plugin Capacitor

### Configuration capacitor.config.json obligatoire
```json
{
  "appId": "com.tripsalama.app",
  "appName": "TripSalama",
  "webDir": "public",
  "server": {
    "androidScheme": "https",
    "iosScheme": "https"
  },
  "plugins": {
    "Keyboard": {
      "resize": "none"
    },
    "StatusBar": {
      "style": "dark",
      "backgroundColor": "#2D5A4A",
      "overlaysWebView": true
    },
    "SplashScreen": {
      "launchShowDuration": 2000,
      "launchAutoHide": true,
      "backgroundColor": "#2D5A4A"
    }
  }
}
```

### Live Reload (dev uniquement)
Pour activer le Live Reload, ajouter temporairement dans `capacitor.config.json` :
```json
{
  "server": {
    "url": "http://192.168.1.X:3000",
    "cleartext": true
  }
}
```
**⚠️ TOUJOURS supprimer avant commit/build production**

---

## 3. CHECKLIST ANTI-DIVERGENCE NAVIGATEUR ↔ APK

**Vérifier CHAQUE point avant de valider une modification front :**

### HTML/Meta
- [ ] `<meta name="viewport">` inclut `viewport-fit=cover`
- [ ] `<meta name="theme-color">` défini
- [ ] `<meta name="apple-mobile-web-app-capable">` présent

### CSS
- [ ] `body` utilise `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`
- [ ] Containers principaux respectent les safe areas
- [ ] Pas de CSS Grid/Flexbox features non supportées par WebView Android 89+
- [ ] Vérifier sur [caniuse.com](https://caniuse.com) pour features douteuses

### Assets
- [ ] Fonts embarquées localement dans `public/assets/fonts/`
- [ ] **PAS de Google Fonts CDN** (peut timeout sur mobile)
- [ ] Images/icons en local, pas d'URLs externes
- [ ] SVG inline ou local (pas de fetch externe)

### JavaScript
- [ ] Appels API utilisent URLs absolues (`https://stabilis-it.ch/...`)
- [ ] Pas de `localhost` ou `127.0.0.1` dans le code (sauf dev)
- [ ] Pas de `eval()` ou `new Function()` (CSP WebView)
- [ ] Pas de features ES2021+ non supportées (optional chaining OK, top-level await NON)

### Service Worker
- [ ] Service Worker **désactivé** pour build Capacitor
- [ ] Capacitor gère son propre cache WebView

### Permissions natives
- [ ] GPS : `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- [ ] Caméra : `CAMERA`
- [ ] Micro : `RECORD_AUDIO`
- [ ] Notifications : configuré via plugin Push Notifications
- [ ] Toutes déclarées dans `android/app/src/main/AndroidManifest.xml`

### Synchronisation
- [ ] `AndroidManifest.xml` synchronisé avec plugins installés
- [ ] Permissions iOS dans `ios/App/App/Info.plist` (si iOS)

---

## 4. WORKFLOW GITHUB ACTIONS

Fichier : `.github/workflows/build-android.yml`

### Secrets GitHub requis
| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Keystore encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias de la clé |
| `KEY_PASSWORD` | Mot de passe de la clé |

### Variables d'environnement
| Variable | Valeur |
|----------|--------|
| `NODE_VERSION` | 20 |
| `JAVA_VERSION` | 21 |

---

## 5. RÈGLES POUR CLAUDE CODE

### À chaque session
1. **LIRE ce fichier en premier**
2. Vérifier que les versions correspondent
3. Ne jamais supposer - demander si doute

### Modifications de dépendances
1. **NE JAMAIS** mettre à jour sans accord utilisateur
2. Si mise à jour nécessaire, documenter dans ce fichier :
   - Ancienne version
   - Nouvelle version
   - Raison du changement
   - Date

### Modifications CSS/Front
1. Vérifier la checklist anti-divergence (section 3)
2. Tester en Chrome DevTools mobile
3. Confirmer le test Live Reload si possible

### Ajout de plugin Capacitor
1. Documenter dans la section 6 de ce fichier
2. Ajouter les permissions requises
3. Mettre à jour AndroidManifest.xml si nécessaire
4. Tester sur appareil réel

### Avant de dire "c'est terminé"
- [ ] Checklist section 3 vérifiée
- [ ] Aucune version modifiée sans accord
- [ ] Aucun fichier critique modifié sans documentation
- [ ] Tests recommandés effectués ou mentionnés

### En cas de doute
**DEMANDER** plutôt que deviner, surtout pour :
- Compatibilité WebView
- Versions de dépendances
- Permissions natives
- Comportement iOS vs Android

---

## 6. PLUGINS CAPACITOR DU PROJET

| Plugin | Version | Rôle | Permissions Android |
|--------|---------|------|---------------------|
| `@capacitor/core` | 8.1.0 | Core Capacitor | - |
| `@capacitor/app` | 8.0.1 | Lifecycle app, deep links | - |
| `@capacitor/geolocation` | 8.1.0 | GPS premier plan | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` |
| `@capacitor-community/background-geolocation` | 1.2.26 | GPS arrière-plan (courses) | `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` |
| `@capacitor/push-notifications` | 8.0.1 | Notifications push FCM | `POST_NOTIFICATIONS` (API 33+) |
| `@capacitor/splash-screen` | 8.0.1 | Splash screen natif | - |
| `@capacitor/status-bar` | 8.0.1 | Contrôle barre de statut | - |
| `@capacitor/keyboard` | 8.0.0 | Gestion clavier virtuel | - |
| `@capacitor/camera` | 8.0.1 | Accès caméra (photo profil) | `CAMERA`, `READ_EXTERNAL_STORAGE` |
| `@capacitor/haptics` | 8.0.0 | Retour haptique | `VIBRATE` |
| `@capacitor/network` | 8.0.1 | Détection connectivité | `ACCESS_NETWORK_STATE` |
| `@capacitor/preferences` | 8.0.1 | Stockage local clé-valeur | - |
| `@capacitor/share` | 8.0.1 | Partage natif | - |

### Plugins à ajouter pour WebRTC / Appels audio
| Plugin | Version | Rôle | Permissions |
|--------|---------|------|-------------|
| `@capacitor/microphone` | À installer | Accès micro pour appels | `RECORD_AUDIO` |
| Plugin WebRTC | À évaluer | Appels audio/vidéo | `RECORD_AUDIO`, `CAMERA` |

---

## 7. HISTORIQUE DES MODIFICATIONS CRITIQUES

| Date | Modification | Raison | Par |
|------|--------------|--------|-----|
| 2024-03-01 | Création CLAUDE.md | Standardisation projet | Claude Code |
| 2024-03-01 | Suppression tests/appium | Migration vers Live Reload | Claude Code |

---

## 8. COMMANDES RAPIDES

```bash
# Développement
npm run dev                    # Live Reload (navigateur + WiFi)

# Build
npm run cap:sync               # Sync assets vers Android/iOS
npm run android:debug          # Build APK debug
npm run android:release        # Build APK release

# Ouvrir IDE natif
npm run cap:open:android       # Android Studio
npm run cap:open:ios           # Xcode

# Vérification
npm run validate:playstore     # Validation Play Store
```

---

**Dernière mise à jour** : 2024-03-01
