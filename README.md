# TripSalama

Application de VTC (Voiture de Transport avec Chauffeur) pour femmes au Maroc, offrant des trajets sécurisés avec des conductrices vérifiées.

## Table des matières

- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Structure du projet](#structure-du-projet)
- [API Endpoints](#api-endpoints)
- [Sécurité](#sécurité)
- [Tests](#tests)
- [Déploiement](#déploiement)
- [Contribution](#contribution)

## Architecture

### Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Backend | PHP | 8.2+ |
| Base de données | MySQL | 8.0+ |
| Mobile | Capacitor | 8.1.0 |
| Frontend | HTML5 / CSS3 / JavaScript ES6+ |
| Tests E2E | Puppeteer / Playwright | Latest |
| CI/CD | GitHub Actions | - |
| Serveur | Nginx + PHP-FPM | - |

### Architecture MVC

```
TripSalama/
├── backend/php/
│   ├── Controllers/    # Logique de routage
│   ├── Models/         # Accès base de données
│   ├── Services/       # Logique métier
│   ├── Traits/         # Fonctionnalités réutilisables
│   ├── Helpers/        # Fonctions utilitaires
│   └── lang/           # Traductions (fr, en, ar)
├── public/
│   ├── api/            # Endpoints REST
│   ├── assets/         # CSS, JS, images
│   └── uploads/        # Fichiers uploadés
├── database/
│   ├── migrations/     # Scripts SQL
│   └── seeds/          # Données de test
└── tests/
    ├── puppeteer/      # Tests E2E Puppeteer
    └── playwright/     # Tests E2E Playwright
```

## Installation

### Prérequis

- PHP 8.2 ou supérieur avec extensions : pdo_mysql, mbstring, json, curl
- MySQL 8.0 ou supérieur
- Composer
- Node.js 20+ (pour les tests et le build mobile)
- Docker (optionnel)

### Installation locale

```bash
# Cloner le repository
git clone https://github.com/stabilis-it/tripsalama.git
cd tripsalama

# Installer les dépendances PHP
composer install

# Copier le fichier d'environnement
cp .env.example .env

# Configurer la base de données dans .env
# Puis exécuter les migrations
mysql -u root -p tripsalama < database/migrations/001_create_users_table.sql
mysql -u root -p tripsalama < database/migrations/002_create_vehicles_table.sql
mysql -u root -p tripsalama < database/migrations/003_create_rides_table.sql
# ... continuer avec les autres migrations

# Lancer le serveur de développement
php -S 127.0.0.1:8080 -t public
```

### Installation avec Docker

```bash
docker-compose up -d
```

## Configuration

### Variables d'environnement (.env)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `APP_ENV` | Environnement (local/production) | `production` |
| `APP_DEBUG` | Mode debug | `false` |
| `DB_HOST` | Hôte MySQL | `localhost` |
| `DB_DATABASE` | Nom de la BDD | `tripsalama` |
| `DB_USERNAME` | Utilisateur MySQL | `tripsalama` |
| `DB_PASSWORD` | Mot de passe MySQL | (secret) |
| `STRIPE_SECRET_KEY` | Clé API Stripe | `sk_live_xxx` |
| `TWILIO_ACCOUNT_SID` | Compte Twilio | `ACxxx` |
| `TWILIO_AUTH_TOKEN` | Token Twilio | (secret) |

Voir `.env.example` pour la liste complète.

## Structure du projet

### Services principaux

| Service | Description |
|---------|-------------|
| `AuthService` | Authentification, sessions, 2FA |
| `PaymentService` | Paiements Stripe, wallet, cash |
| `ReferralService` | Système de parrainage |
| `SOSService` | Alertes d'urgence |
| `IdentityVerificationService` | Vérification d'identité |
| `PrayerTimeService` | Horaires de prière |
| `SMSService` | Envoi de SMS via Twilio |

### Modèles de données

| Modèle | Table | Description |
|--------|-------|-------------|
| `User` | users | Passagères et conductrices |
| `Vehicle` | vehicles | Véhicules des conductrices |
| `Ride` | rides | Courses |
| `Rating` | ratings | Notes et commentaires |
| `Transaction` | transactions | Transactions financières |
| `Wallet` | wallets | Portefeuilles électroniques |

## API Endpoints

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth.php?action=login` | Connexion |
| POST | `/api/auth.php?action=register` | Inscription |
| POST | `/api/auth.php?action=logout` | Déconnexion |
| POST | `/api/auth.php?action=refresh` | Rafraîchir le token |

### Courses

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/rides.php?action=create` | Créer une course |
| GET | `/api/rides.php?action=get&ride_id=X` | Détails d'une course |
| PUT | `/api/rides.php?action=accept` | Accepter une course |
| PUT | `/api/rides.php?action=start` | Démarrer une course |
| PUT | `/api/rides.php?action=complete` | Terminer une course |
| PUT | `/api/rides.php?action=cancel` | Annuler une course |

### Administration

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin.php?action=dashboard` | Dashboard admin |
| GET | `/api/admin.php?action=drivers` | Liste des conductrices |
| POST | `/api/admin.php?action=verify-driver` | Vérifier une conductrice |
| GET | `/api/admin.php?action=export&type=rides` | Exporter les données |

## Sécurité

### Mesures implémentées

- **CSRF Protection** : Token CSRF requis pour toutes les requêtes POST/PUT/DELETE
- **Rate Limiting** : Protection contre les attaques par force brute
- **Password Hashing** : bcrypt avec coût adaptatif
- **Input Validation** : Validation stricte de tous les paramètres
- **SQL Injection Prevention** : Requêtes préparées (PDO)
- **XSS Prevention** : Échappement des sorties HTML
- **2FA** : Authentification à deux facteurs optionnelle

### Vérification d'identité

Les conductrices doivent soumettre une photo d'identité qui est :
1. Analysée par un algorithme de détection de genre
2. Vérifiée manuellement par un administrateur si nécessaire
3. Stockée de manière sécurisée dans `/uploads/verifications/`

### GitHub Secrets requis

Voir `.github/SECRETS.md` pour la liste complète des secrets à configurer.

## Tests

### Tests E2E (Puppeteer)

```bash
cd tests/puppeteer
npm install
npm run test:smoke
```

### Tests E2E (Playwright)

```bash
cd tests/playwright
npx playwright test --headed
```

### Analyse statique

```bash
vendor/bin/phpstan analyse --configuration=phpstan.neon
```

## Déploiement

### Déploiement automatique (GitHub Actions)

Le déploiement est automatisé via GitHub Actions :

1. Push sur `main` déclenche le workflow `deploy-vps.yml`
2. Validation PHP syntax
3. Déploiement via rsync sur le VPS
4. Vérification HTTP post-déploiement

### Déploiement manuel

```bash
# Sur le serveur
cd /var/www/tripsalama
git pull origin main
composer install --no-dev --optimize-autoloader
php scripts/clear-cache.php
```

### Backups

Les backups quotidiens sont automatisés via GitHub Actions :

```bash
# Lancer un backup manuel
./scripts/backup.sh --full

# Backup base de données uniquement
./scripts/backup.sh --db-only
```

## Contribution

### Workflow Git

1. Créer une branche depuis `develop`
2. Développer la fonctionnalité
3. Écrire les tests
4. Créer une Pull Request vers `develop`
5. Code review et merge

### Standards de code

- PSR-12 pour le code PHP
- PHPStan niveau 6
- Pas de texte hardcodé (utiliser `__('key')`)
- Pas de SQL dans les Controllers
- Transactions obligatoires pour les opérations critiques

### Traductions

Les fichiers de traduction sont dans `backend/php/lang/` :
- `fr.php` - Français (principal)
- `en.php` - Anglais
- `ar.php` - Arabe

## License

Copyright 2024-2025 Stabilis IT. Tous droits réservés.

## Contact

- Email : support@tripsalama.com
- Site : https://tripsalama.stabilis-it.ch
