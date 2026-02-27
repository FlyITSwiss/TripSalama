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

### RÈGLE QUALITÉ : Puppeteer = source de vérité
Tests E2E visuels obligatoires avant merge.

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
├── tests/puppeteer/       # smoke-tests, test-auth, test-booking, etc.
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

## TESTS PUPPETEER

### Configuration

```javascript
// tests/puppeteer/config.js
const config = {
    baseUrl: 'http://127.0.0.1:8080',
    puppeteer: {
        headless: false,  // TOUJOURS visuel
        slowMo: 50,
        defaultViewport: { width: 1280, height: 800 }
    }
};
```

### Utilisateurs de test

| Rôle | Email | Password |
|------|-------|----------|
| Passagère | fatima@example.com | Test1234! |
| Conductrice | khadija@example.com | Test1234! |

### Commandes

```bash
# Tous les tests
npm test

# Par suite
npm run test:smoke
npm run test:auth
npm run test:booking
npm run test:driver
npm run test:tracking
```

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
| 1 | **Tests locaux passent** | `cd tests/puppeteer && npm run test:smoke` |
| 2 | **Pre-commit hook OK** | Automatique au commit |
| 3 | **Pas de credentials hardcodés** | Grep `.env`, `password`, `secret` |
| 4 | **YAML workflow valide** | `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/deploy-vps.yml'))"` |

### Checklist BLOQUANTE - APRÈS un deploy

| # | Action | Commande |
|---|--------|----------|
| 1 | **Attendre GitHub Actions** | `gh run list --limit 3` |
| 2 | **Vérifier status success** | `gh run view <run_id>` |
| 3 | **Vérifier HTTP 200** | `curl -sI https://stabilis-it.ch/internal/tripsalama/login` |
| 4 | **Test Puppeteer PROD** | `node tests/puppeteer/smoke-tests.js --env=production` |

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

## BUILD MOBILE - Android & iOS

### Workflow automatique

Chaque push sur `main` déclenche :
1. **Build Android APK** (Debug + Release signée)
2. **Email de notification** à tarik.gilani@stabilis-it.ch
3. **Upload artifacts** sur GitHub Actions

### Email de build OBLIGATOIRE

**À chaque build, un email est envoyé automatiquement avec :**
- Status (succès/échec)
- Lien vers l'app : https://stabilis-it.ch/internal/tripsalama
- Lien vers le build GitHub Actions (téléchargement APK)
- Détails du commit (auteur, message, branche)

**Template :** Style Helios 2FA avec branding TripSalama (émeraude #2D5A4A)

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

### Commandes locales (si Java 21 installé)

```bash
# Sync Capacitor
npm run cap:sync

# Build Debug APK
cd android && ./gradlew assembleDebug

# Build Release APK (signée)
cd android && ./gradlew assembleRelease
```

### RÈGLE : Email systématique

**CHAQUE build Android doit envoyer un email à tarik.gilani@stabilis-it.ch** contenant :
- ✅ ou ❌ selon le résultat
- URL de TripSalama : https://stabilis-it.ch/internal/tripsalama
- URL du build GitHub Actions avec lien de téléchargement APK

Si l'email n'est pas envoyé → vérifier les secrets `SMTP_USERNAME` et `SMTP_PASSWORD`

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
| 8 | **TESTS** - Puppeteer passe en visuel ? |

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

## COMMANDES UTILES

```bash
# Docker
docker-compose -f docker/docker-compose.yml up -d
docker-compose -f docker/docker-compose.yml logs -f

# Tests
cd tests/puppeteer && npm test

# Migrations
docker exec tripsalama-db mysql -u root -proot tripsalama < database/migrations/001_create_users_table.sql

# Logs
docker exec tripsalama-app tail -f /var/log/php/error.log
```
