# TripSalama - Instructions pour Claude

---

## 🚨 RÈGLE ABSOLUE - ISOLATION DES PROJETS

**TripSalama est un projet 100% INDÉPENDANT. Il ne doit JAMAIS interférer avec les autres projets du VPS stabilis-it.ch.**

### Projets sur le VPS (complètement isolés)

| Projet | URL | Responsabilité |
|--------|-----|----------------|
| **Site principal** | stabilis-it.ch | Géré par Helios - **NE JAMAIS TOUCHER** |
| **Helios Landing** | stabilis-it.ch/helios | Géré par Helios - **NE JAMAIS TOUCHER** |
| **Helios App** | stabilis-it.ch/internal/helios | Géré par Helios - **NE JAMAIS TOUCHER** |
| **TripSalama** | stabilis-it.ch/internal/tripsalama | **SEUL PROJET GÉRÉ ICI** |

### INTERDICTIONS ABSOLUES

| ❌ STRICTEMENT INTERDIT | Raison |
|-------------------------|--------|
| Modifier `/etc/nginx/sites-enabled/helios` | Config nginx principale = Helios uniquement |
| Modifier `/etc/nginx/conf.d/*` | Configs partagées = Helios uniquement |
| Toucher à `/var/www/helios` ou `/var/www/stabilis-it` | Autres projets |
| Ajouter des headers CSP globaux dans nginx | Affecterait tous les projets |
| Scripts qui modifient des fichiers hors de `/var/www/tripsalama` | Risque d'interférence |

### CE QUE TRIPSALAMA PEUT MODIFIER

| ✅ AUTORISÉ | Chemin |
|-------------|--------|
| Code PHP TripSalama | `/var/www/tripsalama/backend/php/*` |
| Assets TripSalama | `/var/www/tripsalama/public/assets/*` |
| Snippet nginx TripSalama | `/etc/nginx/snippets/tripsalama.conf` |
| Base de données TripSalama | MySQL `tripsalama.*` |

**Si un changement risque d'affecter d'autres projets → STOP, demander à l'utilisateur.**

---

## 🛑 STOP - AVANT D'ÉCRIRE LA MOINDRE LIGNE DE CODE

**JE LIS CETTE SECTION EN ENTIER AVANT CHAQUE MODIFICATION. C'est une obligation, pas une suggestion.**

---

### 1️⃣ i18n - ZÉRO TEXTE HARDCODÉ

```
❌ INTERDIT :                              ✅ OBLIGATOIRE :
'Erreur lors de...'                        __('error.xxx')
'Veuillez...'                              __('validation.xxx')
'Succès' / 'Chargement...' / 'Aucun...'    __('msg.xxx') / __('ui.xxx')
Tout texte FR visible                      __('module.clé')
```

**Syntaxe selon contexte :**
| Contexte | Syntaxe |
|----------|---------|
| PHP | `__('clé')` |
| JS dans PHTML | `<?= json_encode(__('clé')) ?>` |
| JS pur (.js) | `__('clé')` via i18n.js |
| HTML attr | `title="<?= __('clé') ?>"` |

**AVANT d'écrire : la clé existe dans fr.php ET en.php ? Non → l'ajouter D'ABORD.**

---

### 2️⃣ ACCENTS FRANÇAIS - OBLIGATOIRES

```
❌ INTERDIT :        ✅ CORRECT :
mise a jour          mise à jour
cree / creee         créé / créée
succes               succès
resultat             résultat
termine              terminé
selectionnez         sélectionnez
Fevrier / Aout       Février / Août
supprime             supprimé
echoue               échoué
passagere            passagère
conductrice          conductrice ✓
reservee             réservée
```

---

### 3️⃣ PATHS & URLs - JAMAIS HARDCODÉ

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
'/var/www/tripsalama/...'        PathHelper::getRootPath()
'/uploads/...'                   PathHelper::getUploadsPath()
href="/page"                     href="<?= base_url('page') ?>"
fetch('/api/...')                ApiService.get('endpoint')
window.location = '/...'         AppConfig.navigateTo('...')
```

---

### 4️⃣ CSS - DESIGN SYSTEM φ UNIQUEMENT

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
margin: 15px                     margin: var(--space-13) /* Fibonacci */
color: #2D5A4A                   color: var(--primary)
font-size: 16px                  font-size: var(--text-base)
padding: 10px 20px               padding: var(--space-8) var(--space-21)
```

**Spacing Fibonacci :** 1, 2, 4, 8, 13, 21, 34, 55, 89, 144 px
**Breakpoints φ :** 320, 518, 838, 1355 px
**Palette :** Émeraude (#2D5A4A) = `--primary`, Or (#C9A962) = `--accent`

---

### 5️⃣ MVC - SÉPARATION STRICTE

| Couche | SQL | Logique métier | HTML | $_GET/$_POST |
|--------|-----|----------------|------|--------------|
| **Model** | ✅ | ❌ | ❌ | ❌ |
| **Controller** | ❌ | Délègue → Service | ❌ | ✅ |
| **View** | ❌ | ❌ | ✅ | ❌ |
| **Service** | ❌ | ✅ | ❌ | ❌ |

---

### 6️⃣ SERVICES CENTRALISÉS - OBLIGATOIRES

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
fetch() avec POST/PUT/DELETE     ApiService.post() / .put() / .delete()
console.log pour debug prod      AppConfig.debug()
new WebSocket()                  (pas de WebSocket dans MVP)
Requête SQL dans Controller      Model uniquement
```

---

### 7️⃣ SÉCURITÉ

```
❌ INTERDIT :                    ✅ OBLIGATOIRE :
$_POST['id'] direct              (int)$_POST['id']
fetch() sans CSRF                ApiService (CSRF auto)
echo $_GET['x']                  htmlspecialchars($_GET['x'])
require_once AVANT try/catch     require_once DANS try/catch
```

---

### 8️⃣ API ENDPOINTS

**Structure obligatoire :**
```php
require '_bootstrap.php';
$action = getAction();
$method = $_SERVER['REQUEST_METHOD'];

try {
    require_once BACKEND_PATH . '/Models/Xxx.php';
    $db = getDbConnection();

    switch ($action) {
        case 'action-name':
            if ($method !== 'POST') errorResponse('Method not allowed', 405);
            requireAuth();
            requireCsrf();
            // ...
            break;
    }
} catch (Exception $e) { /* ... */ }
```

---

### 9️⃣ AVANT CHAQUE FEATURE, JE VÉRIFIE :

| # | Question | Si non |
|---|----------|--------|
| 1 | Texte visible → `__('clé')` utilisé ? | STOP, corriger |
| 2 | Accents français présents ? | STOP, corriger |
| 3 | Clés i18n existent dans fr.php ET en.php ? | STOP, les ajouter |
| 4 | Paths via helpers (PathHelper, base_url) ? | STOP, corriger |
| 5 | CSS via variables φ ? | STOP, corriger |
| 6 | SQL dans Model uniquement ? | STOP, corriger |
| 7 | ApiService pour POST/PUT/DELETE ? | STOP, corriger |
| 8 | (int) cast sur $_POST/$_GET ? | STOP, corriger |

---

## RÈGLES FONDAMENTALES

### RÈGLE ZÉRO : JAMAIS de bypass
Toujours corriger le code, jamais les validateurs/tests.

### RÈGLE UN : Zéro manuel
Tout doit être automatisé (deploy, tests, migrations).

**Commandes automatisées disponibles :**

| Tâche | Commande | Résultat |
|-------|----------|----------|
| **Test APK one-click** | `npm run test:apk:auto` | Test complet émulateur (OBLIGATOIRE avant envoi) |
| **Test APK login** | `npm run test:apk:auto:login` | Test authentification émulateur |
| **Test APK complet** | `npm run test:apk:auto:full` | Tous les tests émulateur |
| **Diagnostic émulateur** | `npm run diagnose:emulator` | Vérifie SDK, ADB, Appium |
| **Tester l'app mobile** | `npm run test:mobile` | Screenshots + logs complets |
| **Diagnostiquer login** | `npm run diagnose:mobile` | Rapport détaillé des problèmes |
| **Builder l'APK** | `npm run build:apk` | APK release prêt à installer |
| **Tests E2E visuels** | `npx playwright test --headed` | Tous les tests Playwright |

**INTERDIT de donner des commandes manuelles comme :**
- ❌ `cd android && ./gradlew assembleRelease`
- ❌ `npx cap sync android`
- ❌ `node tests/puppeteer/test-xxx.js` (utiliser Playwright)

**TOUJOURS utiliser les scripts npm qui font TOUT automatiquement.**

### RÈGLE QUALITÉ : Playwright = source de vérité
Tests E2E visuels obligatoires avant merge. Utiliser `npx playwright test --headed` pour les tests visuels.

### RÈGLE URL TESTS : `http://127.0.0.1:8080/...`
Jamais `localhost` dans les tests.

---

## ARCHITECTURE DES DOSSIERS

```
TripSalama/
├── backend/php/
│   ├── Controllers/       # AuthController, PassengerController, DriverController
│   ├── Models/            # User, Ride, Vehicle
│   ├── Services/          # AuthService
│   ├── Helpers/           # PathHelper, UrlHelper, ValidationHelper, functions.php
│   ├── Views/
│   │   ├── layouts/       # main.phtml
│   │   ├── auth/          # login, register-*
│   │   ├── passenger/     # dashboard, book-ride, tracking, history
│   │   ├── driver/        # dashboard, navigation
│   │   └── errors/        # 403, 404, 500
│   ├── lang/              # fr.php, en.php
│   └── config/            # app.php, database.php, routes.php
├── public/
│   ├── index.php          # Front controller / Router
│   ├── api/               # _bootstrap.php, auth.php, rides.php, drivers.php
│   ├── assets/
│   │   ├── css/           # tripsalama-core, components, map, responsive
│   │   ├── js/
│   │   │   ├── core/      # api-service, event-bus, state-manager, i18n, app-config
│   │   │   ├── components/ # toast-notification, modal
│   │   │   └── modules/   # map-controller, booking, vehicle-simulator,
│   │   │                  # ride-tracker, driver-dashboard, driver-navigation
│   │   └── lang/          # fr.json, en.json
│   └── uploads/           # Fichiers uploadés (bind mount Docker)
├── database/
│   ├── migrations/        # 001_users, 002_vehicles, 003_rides, etc.
│   └── seeds/             # demo_data.sql
├── docker/                # docker-compose.yml, Dockerfile, nginx.conf
├── tests/playwright/      # auth.spec.ts, booking.spec.ts, etc. (Playwright)
├── tests/puppeteer/       # Anciens tests (conservés pour référence)
├── scripts/               # deploy.sh, setup.sh
└── .github/workflows/     # CI/CD
```

**Dossiers JAMAIS créer :** `src/`, `frontend/`, `archive/`

---

## DESIGN SYSTEM - NOMBRE D'OR φ = 1.618

### Palette de couleurs

| Variable | Hex | Usage |
|----------|-----|-------|
| `--primary` | #2D5A4A | Émeraude - Couleur principale |
| `--primary-light` | #3D7A6A | Hover, focus |
| `--primary-dark` | #1D4A3A | Active, pressed |
| `--accent` | #C9A962 | Or - Accents, CTAs |
| `--accent-light` | #D9B972 | Hover accent |
| `--surface` | #FFFFFF | Fond cartes |
| `--background` | #F8F6F3 | Fond page (crème) |
| `--text` | #1A1A1A | Texte principal |
| `--text-muted` | #6B7280 | Texte secondaire |
| `--success` | #10B981 | Confirmations |
| `--error` | #EF4444 | Erreurs |
| `--warning` | #F59E0B | Alertes |

### Spacing Fibonacci

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--space-1` | 1px | Bordures fines |
| `--space-2` | 2px | Micro-espaces |
| `--space-4` | 4px | Padding inputs |
| `--space-8` | 8px | Gaps petits |
| `--space-13` | 13px | Padding standard |
| `--space-21` | 21px | Margins sections |
| `--space-34` | 34px | Espaces moyens |
| `--space-55` | 55px | Grandes sections |
| `--space-89` | 89px | Header/Footer |
| `--space-144` | 144px | Hero sections |

### Breakpoints φ

| Variable | Valeur | Device |
|----------|--------|--------|
| `--bp-mobile` | 320px | Petit mobile |
| `--bp-tablet` | 518px | Tablet portrait |
| `--bp-desktop` | 838px | Desktop small |
| `--bp-wide` | 1355px | Desktop large |

---

## TESTS PLAYWRIGHT (Migration de Puppeteer)

> **NOTE (Mars 2025)** : Migration de Puppeteer vers Playwright pour une meilleure stabilité,
> des assertions plus robustes, et le support natif des tests mobile.
> Les anciens tests Puppeteer dans `tests/puppeteer/` sont conservés pour référence
> mais les NOUVEAUX tests doivent être écrits avec Playwright dans `tests/playwright/`.

### Configuration Playwright

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  retries: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }  // Simulation APK
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
```

### Utilisateurs de test

| Rôle | Email | Password |
|------|-------|----------|
| Passagère | fatima@example.com | Test1234! |
| Conductrice | khadija@example.com | Test1234! |

### Commandes Playwright

```bash
# Installer Playwright et navigateurs
npx playwright install

# Tous les tests (headless)
npx playwright test

# Tests visuels (headed)
npx playwright test --headed

# Interface UI interactive
npx playwright test --ui

# Tests mobile uniquement
npx playwright test --project="Mobile Chrome"

# Debug mode
npx playwright test --debug

# Afficher le rapport
npx playwright show-report
```

### Structure des tests Playwright

```
tests/
├── playwright/              # NOUVEAUX TESTS (Playwright)
│   ├── auth.spec.ts         # Login, register, logout
│   ├── booking.spec.ts      # Réservation course
│   ├── tracking.spec.ts     # Suivi véhicule
│   ├── driver.spec.ts       # Dashboard conductrice
│   └── fixtures/            # Test fixtures et helpers
└── puppeteer/               # ANCIENS TESTS (conservés pour référence)
```

### Avantages de Playwright vs Puppeteer

| Feature | Puppeteer | Playwright |
|---------|-----------|------------|
| Assertions built-in | ❌ | ✅ `expect()` auto-retry |
| Multi-navigateur | Chrome only | Chrome, Firefox, Safari |
| Tests mobile natifs | ❌ | ✅ Device emulation |
| Auto-wait | Basique | ✅ Intelligent |
| Parallel tests | Manuel | ✅ Built-in |
| Trace viewer | ❌ | ✅ Debugging visuel |
| CI/CD GitHub Actions | Complexe | ✅ Intégré |

---

## DÉPLOIEMENT - RÈGLES STRICTES (BLOQUANTES)

### Environnements

| Env | URL | Branch |
|-----|-----|--------|
| Local | http://127.0.0.1:8080 | feature/* |
| **Production** | https://stabilis-it.ch/internal/tripsalama | main |

### Infrastructure Production

| Composant | Configuration |
|-----------|---------------|
| **VPS** | 83.228.205.222 (OVH) |
| **PHP** | 8.4-FPM (direct, pas Docker) |
| **Nginx** | Certbot SSL, config dans `/etc/nginx/sites-enabled/helios` |
| **MySQL** | Local, DB `tripsalama`, user `tripsalama` |
| **Déploiement** | GitHub Actions → rsync vers `/var/www/tripsalama` |

### Workflow de déploiement (AUTOMATIQUE)

```
Push main → GitHub Actions → Validation PHP → Rsync VPS → Config nginx → Vérification HTTP
```

**Le workflow `deploy-vps.yml` fait TOUT automatiquement :**
1. Validation syntaxe PHP
2. Déploiement backend via rsync
3. Déploiement public via rsync
4. Configuration MySQL (user + DB)
5. Configuration nginx (snippet `/etc/nginx/snippets/tripsalama.conf`)
6. Vérification HTTP 200/301/302

### Checklist BLOQUANTE - AVANT chaque push sur main

| # | Vérification | Commande |
|---|--------------|----------|
| 1 | **Tests locaux passent** | `npx playwright test --project="Mobile Chrome"` |
| 2 | **Pre-commit hook OK** | Automatique au commit |
| 3 | **Pas de credentials hardcodés** | Grep `.env`, `password`, `secret` |
| 4 | **YAML workflow valide** | `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/deploy-vps.yml'))"` |

### Checklist BLOQUANTE - APRÈS un deploy

| # | Action | Commande |
|---|--------|----------|
| 1 | **Attendre GitHub Actions** | `gh run list --limit 3` |
| 2 | **Vérifier status success** | `gh run view <run_id>` |
| 3 | **Vérifier HTTP 200** | `curl -sI https://stabilis-it.ch/internal/tripsalama/login` |
| 4 | **Vérifier APK accessible** | `npm run verify:apk:latest` |
| 5 | **Test Playwright PROD** | `npx playwright test --project="Mobile Chrome" --grep @smoke` |

### Configuration Nginx (pour référence)

Le fichier `/etc/nginx/snippets/tripsalama.conf` est déployé automatiquement et inclus dans le site principal via :
```nginx
include /etc/nginx/snippets/tripsalama.conf;
```

**JAMAIS modifier manuellement nginx sur le VPS.** Tout passe par le workflow GitHub Actions.

### En cas d'échec de déploiement

1. Consulter les logs : `gh run view <run_id> --log`
2. Identifier l'étape en échec
3. Corriger le code ou workflow
4. Pusher le fix
5. **NE JAMAIS bypasser le workflow pour déployer manuellement**

### Secrets GitHub requis

| Secret | Usage |
|--------|-------|
| `SSH_PRIVATE_KEY` | Accès SSH au VPS (debian@83.228.205.222) |
| `SMTP_USERNAME` | Email Office 365 (information-contact@stabilis-it.ch) |
| `SMTP_PASSWORD` | Mot de passe SMTP Office 365 |

---

## 🚨 RÈGLE CRITIQUE APK - VÉRIFICATIONS OBLIGATOIRES

**PROBLÈME RÉCURRENT :** APK retourne 404/403 après build → Email envoyé mais lien cassé

### Pourquoi ça arrive

| Cause | Symptôme | Solution |
|-------|----------|----------|
| **Location nginx imbriquée** | 404 ou 403 sur `/downloads/*.apk` | Location APK doit être AVANT location principale |
| **Permissions fichier** | 403 Forbidden | `sudo chmod 644 downloads/*.apk` |
| **Permissions dossier** | 403 Forbidden | `sudo chmod 755 downloads/` |
| **Propriétaire incorrect** | 403 Forbidden | `sudo chown www-data:www-data downloads/*.apk` |
| **Fichier non uploadé** | 404 Not Found | Vérifier logs GitHub Actions |

### Architecture nginx CRITIQUE

```nginx
# ❌ FAUX - Location imbriquée (ne fonctionne JAMAIS)
location ^~ /internal/tripsalama {
    location ~* /downloads/.*\.apk$ {  # ← JAMAIS évalué !
        # ...
    }
}

# ✅ CORRECT - Location APK AVANT location principale
location ^~ /internal/tripsalama/downloads/ {
    alias /var/www/tripsalama/public/downloads/;
    # ...
}

location ^~ /internal/tripsalama {
    alias /var/www/tripsalama/public;
    # ...
}
```

**RÈGLE :** La location APK (prefix `^~`) doit être **AVANT** la location principale pour avoir priorité.

### Vérifications AUTOMATIQUES (OBLIGATOIRES)

| # | Quand | Commande | Attendu |
|---|-------|----------|---------|
| 1 | **Après chaque build** | GitHub Actions step "Verify APK HTTP Access" | HTTP 200 automatique |
| 2 | **Manuellement** | `npm run verify:apk:latest` | ✅ APK accessible |
| 3 | **Diagnostic serveur** | `curl https://stabilis-it.ch/internal/tripsalama/api/check-downloads.php` | JSON avec liste fichiers |

### Script de vérification automatique

`scripts/verify-apk-deployment.js` vérifie :
- ✅ HTTP 200 (accessible)
- ✅ MIME type = `application/vnd.android.package-archive`
- ✅ Content-Disposition = `attachment`
- ✅ Taille APK < 150 MB (limite Play Store)
- ✅ Fichier existe sur serveur
- ✅ Permissions correctes (644)

**Workflow GitHub Actions inclut cette vérification automatiquement.**

### Si APK inaccessible (404/403)

```bash
# 1. Vérifier que le fichier existe
curl https://stabilis-it.ch/internal/tripsalama/api/check-downloads.php

# 2. Tester l'accès direct
curl -I https://stabilis-it.ch/internal/tripsalama/downloads/TripSalama-latest.apk

# 3. Si 404 ou 403, pusher le fix nginx
# (Les corrections sont DÉJÀ dans docker/nginx-tripsalama.conf)
git add docker/nginx-tripsalama.conf
git commit -m "fix(nginx): APK downloads location priority"
git push

# 4. Le deploy automatique corrigera nginx sur le VPS

# 5. Re-vérifier
npm run verify:apk:latest
```

### Checklist post-build (BLOQUANTE)

| # | Vérification | OBLIGATOIRE |
|---|--------------|-------------|
| 1 | GitHub Actions "Verify APK HTTP Access" passe | ✅ |
| 2 | Email reçu avec lien téléchargement | ✅ |
| 3 | Clic sur lien depuis téléphone → téléchargement démarre | ✅ |
| 4 | APK s'installe sans erreur sur Android | ✅ |

**Si UNE SEULE étape échoue → BLOQUER et corriger immédiatement.**

---

## BUILD MOBILE - Android & iOS

### Workflow automatique

Chaque push sur `main` (ou workflow_dispatch manuel) déclenche :
1. **Build Android APK** (Debug + Release signée)
2. **Upload APK sur VPS** pour téléchargement direct
3. **Email de notification** à tarik.gilani@stabilis-it.ch avec lien de téléchargement

### Email de build OBLIGATOIRE avec lien de téléchargement APK

**À chaque build RÉUSSI, un email est envoyé automatiquement avec :**
- ✅ ou ❌ selon le résultat
- **GROS BOUTON VERT "TÉLÉCHARGER L'APK"** (lien direct, cliquable depuis téléphone)
- Numéro de version (#run_number)
- Lien vers l'app web : https://stabilis-it.ch/internal/tripsalama
- Lien vers les logs GitHub Actions
- Détails du commit (auteur, branche)

**Template :** Style TripSalama (émeraude #2D5A4A) avec section verte pour le téléchargement

### URLs de téléchargement APK

| URL | Description |
|-----|-------------|
| `https://stabilis-it.ch/internal/tripsalama/downloads/TripSalama-v{N}.apk` | Version spécifique |
| `https://stabilis-it.ch/internal/tripsalama/downloads/TripSalama-latest.apk` | Dernière version |

### Configuration Capacitor

| Paramètre | Valeur |
|-----------|--------|
| App ID | `com.tripsalama.app` |
| Java | 21 |
| Gradle | 8.11.1 |
| AGP | 8.7.3 |
| SDK (compile/target) | 35 |
| Capacitor | 8.1.0 |

### Keystore Android

- **Généré automatiquement** par GitHub Actions à chaque build
- **Mot de passe :** `tripsalama2026`
- **Alias :** `tripsalama`
- **Pour Play Store :** Sauvegarder le keystore du premier build réussi

### Environnement de développement local (OBLIGATOIRE)

**Ces paths sont configurés sur la machine de dev - NE JAMAIS demander à l'utilisateur :**

| Variable | Chemin |
|----------|--------|
| **JAVA_HOME** | `C:\Users\Tarik Gilani\java\jdk-21.0.5+11` |
| **ANDROID_SDK** | `C:\Users\Tarik Gilani\Android` |
| **ADB** | `C:\Users\Tarik Gilani\Android\platform-tools\adb.exe` |
| **Émulateur** | `emulator-5554` (déjà configuré) |

### Commandes de build (avec JAVA_HOME configuré automatiquement)

```bash
# ✅ TOUJOURS utiliser ces commandes avec JAVA_HOME
export JAVA_HOME="/c/Users/Tarik Gilani/java/jdk-21.0.5+11"
export PATH="$JAVA_HOME/bin:$PATH"

# Sync Capacitor
npx cap sync android

# Build Debug APK
cd android && ./gradlew.bat assembleDebug

# Build Release APK (signée)
cd android && ./gradlew.bat assembleRelease

# Installer sur émulateur
"/c/Users/Tarik Gilani/Android/platform-tools/adb.exe" -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk

# Lancer l'app
"/c/Users/Tarik Gilani/Android/platform-tools/adb.exe" -s emulator-5554 shell am start -n com.tripsalama.app/com.tripsalama.app.MainActivity
```

### Script de build complet (à utiliser directement)

```bash
# Build + Install + Launch en une commande
export JAVA_HOME="/c/Users/Tarik Gilani/java/jdk-21.0.5+11" && \
export PATH="$JAVA_HOME/bin:$PATH" && \
cd "/c/Users/Tarik Gilani/Desktop/TripSalama" && \
npx cap sync android && \
cd android && ./gradlew.bat assembleDebug && \
"/c/Users/Tarik Gilani/Android/platform-tools/adb.exe" -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk && \
"/c/Users/Tarik Gilani/Android/platform-tools/adb.exe" -s emulator-5554 shell am start -n com.tripsalama.app/com.tripsalama.app.MainActivity
```

### Commandes ADB utiles

```bash
ADB="/c/Users/Tarik Gilani/Android/platform-tools/adb.exe"

# Liste des devices
$ADB devices

# Screenshot
$ADB -s emulator-5554 exec-out screencap -p > screenshot.png

# Simuler tap (x, y)
$ADB -s emulator-5554 shell input tap 350 2200

# Logs Capacitor
$ADB -s emulator-5554 logcat -d | grep -i "capacitor\|tripsalama"

# Redémarrer l'app
$ADB -s emulator-5554 shell am force-stop com.tripsalama.app
$ADB -s emulator-5554 shell am start -n com.tripsalama.app/com.tripsalama.app.MainActivity
```

### RÈGLE CRITIQUE : Tests APK OBLIGATOIRES avant envoi par mail

**AVANT d'envoyer un APK ou de demander à l'utilisateur de tester, Claude DOIT :**

```bash
# Test automatique one-click (OBLIGATOIRE)
npm run test:apk:auto
```

| Étape | Commande | Ce qu'elle fait |
|-------|----------|-----------------|
| **Diagnostic** | `npm run diagnose:emulator` | Vérifie SDK, ADB, Appium, émulateur |
| **Test rapide** | `npm run test:apk:auto` | Smoke test 30s (démarre l'app) |
| **Test login** | `npm run test:apk:auto:login` | Test authentification 2min |
| **Test complet** | `npm run test:apk:auto:full` | Tous les tests 5min |

**Le script one-click fait TOUT automatiquement :**
1. ✅ Vérifie l'environnement (SDK, ADB, Appium)
2. ✅ Démarre l'émulateur si nécessaire
3. ✅ Lance Appium si nécessaire
4. ✅ Installe l'APK sur l'émulateur
5. ✅ Exécute les tests
6. ✅ Génère un rapport

**❌ INTERDIT : Envoyer un APK par mail SANS avoir exécuté `npm run test:apk:auto` avec succès.**

### RÈGLE : Email avec lien de téléchargement direct

**CHAQUE build Android DOIT :**
1. Passer les tests APK (`npm run test:apk:auto`)
2. Uploader l'APK sur le VPS dans `/var/www/tripsalama/public/downloads/`
3. Envoyer un email à tarik.gilani@stabilis-it.ch
4. L'email DOIT contenir un **bouton de téléchargement direct** (pas juste un lien GitHub)

**L'utilisateur doit pouvoir :**
- Ouvrir l'email sur son téléphone Android
- Cliquer sur le bouton "TÉLÉCHARGER L'APK"
- Installer l'APK directement

**Si l'email n'est pas envoyé ou le lien ne fonctionne pas :**
1. Vérifier le secret `SSH_PRIVATE_KEY` (pour upload VPS)
2. Vérifier que le webhook `/api/build-notification.php` est déployé
3. Vérifier les logs du workflow GitHub Actions

### INTERDICTIONS ABSOLUES

| ❌ INTERDIT | ✅ OBLIGATOIRE |
|-------------|----------------|
| `ssh debian@vps` pour déployer manuellement | Push sur main → GitHub Actions |
| Modifier nginx sur le VPS directement | Modifier `docker/nginx-tripsalama.conf` + push |
| Bypasser les tests avant push | `npm run test:smoke` localement |
| Push avec pre-commit en échec | Corriger les erreurs signalées |
| `docker-compose down -v` sur VPS | Préserver les uploads |
| Location nginx sans `^~` | Toujours `location ^~ /internal/tripsalama` |
| Inline location dans config nginx principale | Snippet via include uniquement |

### ARCHITECTURE MULTI-PROJETS (CRITIQUE)

Le VPS stabilis-it.ch héberge plusieurs projets :

| URL | Projet | Routage |
|-----|--------|---------|
| `/` | Site principal | Géré par Helios |
| `/helios` | Landing page | Géré par Helios |
| `/internal/helios` | App Helios | Géré par Helios (Docker) |
| `/internal/tripsalama` | App TripSalama | Géré par TripSalama (snippet) |

### RÈGLES DE NON-INTERFÉRENCE (BLOQUANTES)

| ❌ INTERDIT | ✅ OBLIGATOIRE |
|-------------|----------------|
| TripSalama modifie `/etc/nginx/sites-enabled/helios` | Modifier UNIQUEMENT `/etc/nginx/snippets/tripsalama.conf` |
| TripSalama ajoute/supprime des locations | Le snippet contient UNE seule location : `/internal/tripsalama` |
| TripSalama touche aux routes de Helios | Chaque projet gère UNIQUEMENT ses propres routes |
| Scripts AWK qui modifient la config principale | AUCUNE modification de la config principale |

### Workflow de déploiement TripSalama

```
TripSalama déploie UNIQUEMENT:
├── /etc/nginx/snippets/tripsalama.conf (snippet)
└── /var/www/tripsalama (app PHP)

TripSalama NE touche JAMAIS:
├── /etc/nginx/sites-enabled/helios (géré par Helios)
├── /var/www/stabilis-it (géré par Helios)
└── /var/www/helios (géré par Helios)
```

### Troubleshooting Nginx

**Symptôme : URL redirige vers stabilis-it.ch au lieu de TripSalama**

Causes possibles :
1. **Snippet non inclus** - La config principale Helios doit avoir `include /etc/nginx/snippets/tripsalama.conf`
2. **Location sans priorité** - Le `^~` est manquant dans le snippet

**Vérifications :**
```bash
# Vérifier que le snippet existe
cat /etc/nginx/snippets/tripsalama.conf

# Vérifier que la config principale l'inclut
grep -n "tripsalama" /etc/nginx/sites-enabled/helios

# Test externe
curl -sI https://stabilis-it.ch/internal/tripsalama/login
```

**Solution :** Si le snippet n'est pas inclus, déployer Helios d'abord. TripSalama ne modifie JAMAIS la config principale.

---

## CHECKLIST AVANT COMMIT

| # | Vérification |
|---|--------------|
| 1 | **ACCENTS** - Tous les textes FR ont é è ê ë à â ù û ü ô î ï ç ? |
| 2 | **i18n** - Aucun texte hardcodé ? `__('clé')` partout ? |
| 3 | **PATHS** - Aucun chemin absolu ? PathHelper utilisé ? |
| 4 | **CSS** - Variables uniquement ? Pas de px hardcodé ? |
| 5 | **MVC** - Pas de SQL dans Controller ? |
| 6 | **CSRF** - ApiService pour mutations ? |
| 7 | **CAST** - `(int)` sur tous les IDs de $_POST/$_GET ? |
| 8 | **TESTS** - Playwright passe en visuel ? (`npx playwright test --headed`) |

---

## APIs - ENDPOINTS

### Auth (`/api/auth.php`)

| Action | Method | Auth | CSRF |
|--------|--------|------|------|
| login | POST | ❌ | ❌ |
| register | POST | ❌ | ❌ |
| logout | POST | ✅ | ✅ |
| me | GET | ✅ | ❌ |

### Rides (`/api/rides.php`)

| Action | Method | Auth | CSRF | Role |
|--------|--------|------|------|------|
| create | POST | ✅ | ✅ | passenger |
| get | GET | ✅ | ❌ | any |
| cancel | PUT | ✅ | ✅ | any |
| accept | PUT | ✅ | ✅ | driver |
| start | PUT | ✅ | ✅ | driver |
| complete | PUT | ✅ | ✅ | driver |
| rate | POST | ✅ | ✅ | any |
| history | GET | ✅ | ❌ | any |
| position | POST | ✅ | ✅ | any |

### Drivers (`/api/drivers.php`)

| Action | Method | Auth | CSRF |
|--------|--------|------|------|
| toggle-status | PUT | ✅ | ✅ |
| update-position | PUT | ✅ | ✅ |
| pending-rides | GET | ✅ | ❌ |
| status | GET | ✅ | ❌ |

---

## CARTOGRAPHIE - Leaflet + OSM

### Services externes

| Service | Usage | Rate Limit |
|---------|-------|------------|
| Nominatim | Geocoding/Autocomplete | 1 req/s |
| OSRM | Routing/Directions | 5 req/s |
| OSM Tiles | Fond de carte | Illimité |

### Marqueurs SVG

```javascript
// Pickup - Cercle vert
MapController.addPickupMarker(map, lat, lng);

// Dropoff - Pin rouge
MapController.addDropoffMarker(map, lat, lng);

// Véhicule - Voiture animée
MapController.addVehicleMarker(map, lat, lng);
```

---

## SIMULATION VÉHICULE

Le véhicule se déplace le long du polyline OSRM avec :
- Vitesse configurable (défaut: 40 km/h)
- Animation fluide via `requestAnimationFrame`
- Callbacks `onPositionUpdate` et `onArrival`

```javascript
const simulator = VehicleSimulator.create({
    marker: vehicleMarker,
    destination: { lat, lng },
    speed: 40,
    onPositionUpdate: (pos, stats) => { /* ETA, distance */ },
    onArrival: () => { /* Notification */ }
});
simulator.start();
```

---

## HOOKS PRE-COMMIT

Le hook `.git/hooks/pre-commit` vérifie :
1. Pas de `console.log` en production
2. Pas de texte FR hardcodé sans `__(`
3. Pas de chemins absolus
4. Syntaxe PHP valide
5. i18n sync (fr.php = en.php keys)

---

## PLAY STORE - PRÉPARATION COMPLÈTE

### 🎯 Objectif : APK 100% prêt pour le Google Play Store

TripSalama utilise un système de validation complet, automatisé et gratuit pour garantir que l'APK est conforme aux exigences du Play Store.

---

### RÈGLE PLAY STORE : Automatisation complète

| ❌ INTERDIT | ✅ OBLIGATOIRE |
|-------------|----------------|
| Tests manuels sur émulateur | `npm run test:apk` (Appium automatisé) |
| Vérifications manuelles des critères | `npm run validate:playstore` (validation automatique) |
| Upload APK sans tests | CI/CD avec émulateur Android (GitHub Actions) |
| Checklist papier | `PLAY_STORE_CHECKLIST.md` (56 items automatisés) |

---

### Architecture du système de validation

```
TripSalama/
├── PLAY_STORE_CHECKLIST.md          # 56 critères obligatoires
├── scripts/validate-play-store.js   # Validation automatique (technique + sécurité)
├── tests/appium/
│   ├── setup-appium.js               # Configuration automatique
│   ├── test-apk-complete.js          # 10 tests E2E sur APK réel
│   ├── test-apk-login.js             # Tests login rapides
│   ├── test-apk-smoke.js             # Test démarrage (30s)
│   ├── package.json                  # Appium + WebdriverIO
│   └── README.md                     # Guide complet
└── .github/workflows/apk-tests.yml   # CI/CD avec émulateur Android
```

---

### Workflow complet de validation

```
1. Build APK          → npm run build:apk
2. Validation tech    → npm run validate:playstore
3. Tests Appium       → npm run test:apk
4. CI/CD GitHub       → Push sur main (automatique)
5. Rapport complet    → npm run playstore:report
```

---

### Commandes disponibles

| Commande | Durée | Description |
|----------|-------|-------------|
| **`npm run test:apk:auto`** | **30s** | **ONE-CLICK : Démarre tout + teste (RECOMMANDÉ)** |
| `npm run test:apk:auto:login` | 2 min | ONE-CLICK : Test authentification |
| `npm run test:apk:auto:full` | 5 min | ONE-CLICK : Tous les tests |
| `npm run diagnose:emulator` | 10s | Diagnostic environnement émulateur |
| `npm run setup:appium` | 2 min | Installation complète Appium (une fois) |
| `npm run appium:start` | - | Démarre serveur Appium (terminal séparé) |
| `npm run validate:playstore` | 10s | Validation technique automatique |
| `npm run test:apk:smoke` | 30s | Test que l'APK démarre sans crash |
| `npm run test:apk:login` | 2 min | Tests login passagère + conductrice |
| `npm run test:apk` | 5 min | Tests complets (10 features) |
| `npm run playstore:report` | 6 min | Validation + tests complets |

---

### Checklist Play Store (56 items)

| Catégorie | Items BLOQUANTS | Items OPTIONNELS |
|-----------|-----------------|------------------|
| **Technique** | 8 items | 0 |
| **Sécurité** | 5 items | 0 |
| **Assets** | 5 items | 3 |
| **Tests fonctionnels** | 14 items | 0 |
| **Performance** | 4 items | 1 |
| **TOTAL** | **36 items OBLIGATOIRES** | 20 optionnels |

**Voir `PLAY_STORE_CHECKLIST.md` pour la liste complète.**

---

### Prérequis Appium (pour tests APK réels)

| Outil | Version | Installation |
|-------|---------|--------------|
| **Node.js** | >= 18 | https://nodejs.org |
| **Android Studio** | Dernière | https://developer.android.com/studio |
| **Android SDK** | API 33+ | Via Android Studio |
| **Émulateur Android** | 1 AVD configuré | Via Android Studio AVD Manager |
| **Java JDK** | >= 11 | https://adoptium.net |

**Installation automatique :**
```bash
npm run setup:appium
```

---

### Tests Appium - 10 features critiques

Les tests Appium vérifient l'APK RÉEL sur émulateur Android :

| # | Feature | Test |
|---|---------|------|
| 1 | APK démarre sans crash | ✅ |
| 2 | Écran de login s'affiche | ✅ |
| 3 | Logo TripSalama visible | ✅ |
| 4 | Login passagère fonctionne | ✅ |
| 5 | Dashboard passagère s'affiche | ✅ |
| 6 | Map (WebView) se charge | ✅ |
| 7 | Logout fonctionne | ✅ |
| 8 | Login conductrice fonctionne | ✅ |
| 9 | Rotation écran supportée | ✅ |
| 10 | Back button fonctionne | ✅ |

**Les tests génèrent automatiquement des screenshots dans `tests/appium/screenshots/`.**

---

### Validation automatique (validate-play-store.js)

Le script vérifie automatiquement :

**Technique :**
- ✅ Target SDK >= 33
- ✅ Version code et version name définis
- ✅ Taille APK < 150 MB
- ✅ APK signé correctement
- ✅ Icône adaptative présente
- ✅ Support 64-bit activé

**Sécurité :**
- ✅ Cleartext traffic désactivé (HTTPS uniquement)
- ✅ Pas de permissions dangereuses non justifiées

**Assets :**
- ✅ Icône 512x512 présente
- ⚠️ Feature graphic 1024x500
- ⚠️ Screenshots (minimum 2)

**Résultat :**
```
━━━ Rapport Final ━━━

✅ Passés  : 18
❌ Échoués : 0
⚠️  Warnings: 3
📈 Taux de réussite: 100.0%

✅ L'APK est prêt pour le Play Store !

📋 Prochaines étapes :
   1. Tester l'APK: npm run test:apk
   2. Créer compte Play Console: https://play.google.com/console
   3. Uploader en Internal Testing
   4. Tester avec utilisateurs réels
   5. Soumettre pour production
```

---

### GitHub Actions - CI/CD avec émulateur Android

Le workflow `.github/workflows/apk-tests.yml` lance automatiquement :

**Jobs :**
1. **apk-smoke-test** (30s) - Vérifie que l'APK démarre
2. **apk-full-test** (5 min) - Tests complets sur émulateur
3. **validate-play-store** (10s) - Validation technique

**Avantages :**
- ✅ Émulateur Android en cache (rapide)
- ✅ Tests sur chaque push/PR
- ✅ Screenshots uploadés en artifacts
- ✅ APK uploadé en artifacts (si success)

---

### Identifiants de test

| Type | Email | Password |
|------|-------|----------|
| **Passagère** | `passenger@tripsalama.ch` | `TripSalama2025!` |
| **Conductrice** | `driver@tripsalama.ch` | `TripSalama2025!` |

Ces comptes doivent exister dans la base de données.

---

### Workflow de soumission Play Store

```
1. Validation locale
   ├── npm run validate:playstore
   └── npm run test:apk

2. Push sur main
   └── GitHub Actions lance les tests automatiquement

3. Télécharger l'APK
   └── Artifacts GitHub Actions ou https://stabilis-it.ch/internal/tripsalama/downloads/

4. Créer compte Play Console
   └── https://play.google.com/console (25 USD one-time)

5. Upload en Internal Testing
   └── Tester avec utilisateurs réels

6. Closed Testing (Beta)
   └── Corriger bugs remontés

7. Soumission Production
   └── Review Google (1-7 jours)
```

---

### Assets requis pour le listing Play Store

| Asset | Taille | Requis | Localisation |
|-------|--------|--------|--------------|
| Icône app | 512x512 PNG | ✅ | `public/assets/images/icons/icon-512x512.png` |
| Feature graphic | 1024x500 PNG | ✅ | `resources/feature-graphic.png` |
| Screenshots phone | Min 2 | ✅ | `resources/screenshots/` |
| Screenshots tablet | Min 1 | ⚠️ Optionnel | `resources/screenshots/tablet/` |
| Vidéo promo | YouTube | ⚠️ Optionnel | - |

**Générer les assets :**
```bash
# À créer manuellement via Figma/Canva
# - Feature graphic : Image promotionnelle 1024x500
# - Screenshots : Captures d'écran de l'app (min 2)
```

---

### Troubleshooting

**Problème : Tests Appium échouent**
```bash
# Vérifier que le serveur Appium tourne
npm run appium:start

# Vérifier que l'émulateur est démarré
adb devices

# Relancer les tests
npm run test:apk
```

**Problème : APK non trouvé**
```bash
# Builder l'APK d'abord
npm run build:apk
```

**Problème : ANDROID_HOME non défini**
```powershell
# Windows
setx ANDROID_HOME "C:\Users\VotreNom\AppData\Local\Android\Sdk"
```

---

### Documentation complète

- **Checklist Play Store** : `PLAY_STORE_CHECKLIST.md`
- **Guide tests Appium** : `tests/appium/README.md`
- **Script validation** : `scripts/validate-play-store.js`
- **Workflow CI/CD** : `.github/workflows/apk-tests.yml`

---

## 🎓 LEÇONS APPRISES - TESTS ÉMULATEUR ANDROID

### Problèmes rencontrés et solutions (Mars 2026)

#### 1. VPN bloque le réseau de l'émulateur

| Symptôme | Cause | Solution |
|----------|-------|----------|
| 100% packet loss depuis l'émulateur | NordVPN (ou autre VPN) intercepte le trafic réseau | **Désinstaller le VPN** avant de tester sur émulateur |
| `ping 8.8.8.8` timeout | Adaptateur VPN (NordLynx) bloque les routes | Vérifier avec `route print` que 10.0.2.0/24 route vers le bon adaptateur |

**Commande de diagnostic :**
```bash
# Depuis l'émulateur
adb shell ping -c 3 10.0.2.2   # Host = doit répondre
adb shell ping -c 3 8.8.8.8    # Internet = peut échouer si VPN actif
```

#### 2. CORS avec Credentials (CRITIQUE)

| ❌ ERREUR | ✅ SOLUTION |
|-----------|-------------|
| `Access-Control-Allow-Origin: *` | Retourner l'origin exact : `Access-Control-Allow-Origin: https://localhost` |
| Pas de header credentials | Ajouter `Access-Control-Allow-Credentials: true` |
| Requête OPTIONS répond mais GET/POST échoue | Vérifier que les headers CORS sont identiques pour preflight ET réponse |

**Code proxy corrigé :**
```javascript
// proxy-server.js
const allowedOrigin = req.headers.origin || '*';
res.writeHead(200, {
    'Access-Control-Allow-Origin': allowedOrigin,  // PAS '*' si credentials
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token'
});
```

#### 3. Proxy HTTP pour émulateur sans internet

Quand l'émulateur ne peut pas atteindre internet directement mais peut ping le host (10.0.2.2) :

**Solution : Proxy local sur le host**
```javascript
// proxy-server.js - Port 8888, forward vers production HTTPS
const PROXY_PORT = 8888;
const TARGET_HOST = 'stabilis-it.ch';

// L'émulateur appelle http://10.0.2.2:8888/internal/tripsalama/api
// Le proxy forward vers https://stabilis-it.ch/internal/tripsalama/api
```

**Configuration app (index.html) :**
```javascript
// Pour émulateur via proxy
const API_BASE = 'http://10.0.2.2:8888/internal/tripsalama/api';

// Pour production (remettre après tests)
const API_BASE = 'https://stabilis-it.ch/internal/tripsalama/api';
```

#### 4. Network Security Config Android

Android 9+ bloque HTTP cleartext par défaut. Pour autoriser 10.0.2.2 :

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

#### 5. Adresses réseau émulateur

| Adresse | Signification |
|---------|---------------|
| `10.0.2.2` | **Host machine** (utiliser pour API locale) |
| `10.0.2.3` | Serveur DNS premier |
| `10.0.2.15` | IP propre de l'émulateur |
| `127.0.0.1` | Loopback (pointe vers l'émulateur, pas le host!) |

#### 6. ADB input text ne fonctionne pas bien avec WebView

| Méthode | Fiabilité | Usage |
|---------|-----------|-------|
| `adb shell input text "texte"` | ❌ Peu fiable | Champs natifs uniquement |
| `adb shell input tap X Y` | ⚠️ Moyen | OK pour navigation |
| **Appium** | ✅ Fiable | Recommandé pour formulaires WebView |

**Recommandation :** Utiliser Appium pour les tests E2E complets sur APK.

#### 7. Bypass CSRF pour émulateur (côté serveur)

```php
// public/api/_bootstrap.php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (
    strpos($origin, 'https://localhost') === 0 ||   // Capacitor scheme
    strpos($origin, 'capacitor://') === 0 ||
    strpos($origin, 'http://10.0.2.2') === 0 ||     // Emulator proxy
    strpos($origin, 'http://localhost') === 0
) {
    return; // Bypass CSRF check
}
```

### Checklist avant test émulateur

| # | Vérification | Commande |
|---|--------------|----------|
| 1 | **VPN désactivé** | Vérifier qu'aucun adaptateur VPN n'est actif |
| 2 | **Proxy démarré** | `node proxy-server.js` (port 8888) |
| 3 | **API_BASE configuré** | `http://10.0.2.2:8888/internal/tripsalama/api` |
| 4 | **APK rebuilé** | `npx cap sync android && ./gradlew assembleDebug` |
| 5 | **Émulateur ping host** | `adb shell ping -c 1 10.0.2.2` = réponse |
| 6 | **Logs proxy** | Voir les requêtes OPTIONS et GET/POST passer |

---

## COMMANDES UTILES

```bash
# Docker
docker-compose -f docker/docker-compose.yml up -d
docker-compose -f docker/docker-compose.yml logs -f

# Tests Playwright
npx playwright test --headed

# Play Store
npm run validate:playstore
npm run test:apk
npm run playstore:report

# Appium
npm run setup:appium
npm run appium:start

# Migrations
docker exec tripsalama-db mysql -u root -proot tripsalama < database/migrations/001_create_users_table.sql

# Logs
docker exec tripsalama-app tail -f /var/log/php/error.log
```
