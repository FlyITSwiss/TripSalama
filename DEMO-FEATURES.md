# TripSalama - Inventaire Complet des Fonctionnalités
## Présentation Démo

**Date :** Mars 2026
**Version :** 1.0 Production-Ready
**Design :** Uber Premium

---

## 1. AUTHENTIFICATION & ONBOARDING

### 1.1 Page de Choix d'Inscription
- **URL :** `/register`
- **Fonctionnalité :** Choix entre s'inscrire comme Passagère ou Conductrice
- **Design :** Cards élégantes avec icônes, animation hover, flèche de navigation
- **Points Impressionnants :**
  - Design mobile-first
  - Logo TripSalama avec accent vert
  - Transitions fluides

### 1.2 Inscription Passagère
- **URL :** `/register/passenger`
- **Champs :** Nom, Prénom, Email, Téléphone, Mot de passe
- **Sécurité :** Validation côté client + serveur, CSRF protection

### 1.3 Inscription Conductrice
- **URL :** `/register/driver`
- **Champs :** Idem + documents véhicule, permis, assurance
- **Processus :** Vérification d'identité avant activation

### 1.4 Connexion
- **URL :** `/login`
- **Points Impressionnants :**
  - Design Uber premium (fond blanc, inputs arrondis)
  - Logo animé
  - Masquer/afficher mot de passe
  - Lien "Mot de passe oublié"
  - Option "Se souvenir de moi"

### 1.5 Récupération Mot de Passe
- **URL :** `/forgot-password`
- **Flow :** Email → Lien de réinitialisation → Nouveau mot de passe

### 1.6 Authentification 2FA (Optionnel)
- Code OTP par SMS
- Sécurité renforcée pour les comptes sensibles

---

## 2. ESPACE PASSAGÈRE

### 2.1 Dashboard Passagère
- **URL :** `/passenger/dashboard`
- **Points Impressionnants :**
  - Accueil personnalisé avec prénom
  - Card "Où allez-vous ?" (CTA principale)
  - Statistiques : Courses totales + Ce mois
  - Course active en cours (si applicable)
  - Actions rapides : Réserver, Historique, Profil
  - Design Uber avec animations fadeInUp

### 2.2 Réservation de Course
- **URL :** `/passenger/book`
- **Points Impressionnants :**
  - **Carte Leaflet plein écran** avec contrôles Uber-style
  - **Bottom Sheet** avec adresses départ/arrivée
  - Géolocalisation automatique (bouton GPS)
  - Estimation du prix en temps réel
  - Choix du type de véhicule
  - Animation fluide de la carte

### 2.3 Suivi de Course en Temps Réel
- **URL :** `/passenger/ride/{id}`
- **Points Impressionnants :**
  - Carte avec position du véhicule en direct
  - Informations conductrice (photo, nom, note)
  - ETA dynamique
  - Adresses de départ et d'arrivée
  - Bouton d'appel/chat avec la conductrice

### 2.4 Historique des Courses
- **URL :** `/passenger/history`
- **Points Impressionnants :**
  - Liste chronologique avec badges de date
  - Statistiques : Total courses, Ce mois, Dépensé
  - Détails par course : Prix, Distance, Durée
  - Statut visuel (Terminée, Annulée, etc.)

### 2.5 Profil Utilisateur
- **URL :** `/profile`
- **Fonctionnalités :**
  - Photo de profil
  - Informations personnelles
  - Numéro de téléphone vérifié
  - Changement de mot de passe
  - Préférences de langue (FR/EN/AR)
  - Déconnexion

### 2.6 Bouton SOS d'Urgence
- **Emplacement :** Flottant en bas à droite (FAB)
- **Points Impressionnants :**
  - **Bouton rouge visible sur toutes les pages**
  - Modal de confirmation avec icône d'alerte
  - Géolocalisation automatique envoyée
  - Notification aux contacts d'urgence
  - Animation pulsante pendant l'activation
  - Accessible au clavier (WCAG AA)

---

## 3. ESPACE CONDUCTRICE

### 3.1 Dashboard Conductrice
- **URL :** `/driver/dashboard`
- **Points Impressionnants :**
  - **Toggle Disponibilité** (Online/Offline)
  - Icône d'état avec couleur (vert=online, gris=offline)
  - Animation du switch toggle
  - Statistiques : Aujourd'hui, Cette semaine, Gains
  - Liste des demandes de courses en attente

### 3.2 Demandes de Courses
- **Affichage :** Cards avec route visuelle (points + ligne)
- **Informations :**
  - Prix estimé (en MAD ou devise locale)
  - Distance en km
  - Adresse de prise en charge
  - Adresse de destination
- **Actions :**
  - Bouton "Accepter" (noir)
  - Bouton "Refuser" (gris)
  - Feedback haptique sur mobile

### 3.3 Navigation vers Destination
- **URL :** `/driver/navigation`
- **Fonctionnalités :**
  - Carte avec itinéraire optimisé
  - Instructions turn-by-turn
  - Boutons : Arrivé au point de prise en charge, Course terminée

### 3.4 Statistiques & Gains
- Historique des courses effectuées
- Gains par jour/semaine/mois
- Note moyenne des passagères

---

## 4. ESPACE ADMIN

### 4.1 Dashboard Admin
- **URL :** `/admin/dashboard`
- **Points Impressionnants :**
  - **4 Cards de statistiques** avec icônes colorées :
    - Passagères (bleu)
    - Conductrices (vert)
    - Courses aujourd'hui (jaune)
    - Alertes SOS actives (rouge)
  - Animation hover sur les cards
  - Section "Actions rapides"
  - Activité récente avec icônes contextuelles

### 4.2 Paramètres Système
- **URL :** `/admin/settings`
- **Sections :**
  - **SMS :** Configuration Twilio/OVH
  - **SOS :** Numéros d'urgence, délai d'alerte
  - **PIN :** Longueur du code, expiration
  - **Stockage :** Limite uploads, formats autorisés
- **Design :** Accordéons avec formulaires inline

### 4.3 Gestion des Pays
- **URL :** `/admin/countries`
- **Points Impressionnants :**
  - **Grid de cartes par pays** (Suisse, Maroc, etc.)
  - Toggle activation/désactivation
  - Configuration par pays :
    - Devise (CHF, MAD, EUR)
    - Tarification (prix/km, prix/min)
    - Fonctionnalités régionales
  - Statistiques : Pays par défaut, Pays actifs, Total

---

## 5. FONCTIONNALITÉS TRANSVERSALES

### 5.1 Design System Uber Premium
- Variables CSS cohérentes
- Couleurs : Noir (#000), Vert (#05944F), Gris (#6B6B6B)
- Spacing système harmonieux
- Radius arrondis modernes
- Shadows subtiles
- Animations fadeInUp

### 5.2 Responsive Mobile-First
- **Breakpoints :** 320px, 640px, 1024px
- Navigation mobile en bas de page
- Touch targets >= 44px (WCAG AA)
- Pas de scroll horizontal

### 5.3 Accessibilité WCAG AA
- Skip links pour navigation clavier
- Focus visible sur tous les éléments interactifs
- Aria-labels sur les boutons sans texte
- Contrastes conformes (4.5:1 minimum)

### 5.4 Sécurité
- CSRF Protection sur tous les formulaires
- 2FA optionnel
- Validation serveur stricte
- Pas d'exposition de données sensibles dans les APIs

### 5.5 Internationalisation
- **Langues :** Français, English, العربية
- Détection automatique par pays
- Changement de langue dans le profil

### 5.6 Performance
- CSS/JS minifiés en production
- Cache Redis/APCu
- Indexes MySQL optimisés
- Temps de chargement < 3s

---

## 6. PARCOURS DE DÉMONSTRATION SUGGÉRÉS

### Parcours 1 : Nouvelle Passagère (5 min)
1. `/login` → Montrer le design premium
2. `/register` → Expliquer le choix de rôle
3. `/register/passenger` → Montrer le formulaire
4. `/passenger/dashboard` → Accueil personnalisé
5. `/passenger/book` → Carte + réservation
6. Clic SOS → Modal de sécurité

### Parcours 2 : Conductrice Active (5 min)
1. `/login` (conductrice)
2. `/driver/dashboard` → Toggle Online
3. Montrer une demande de course
4. Accepter → Navigation
5. Statistiques & gains

### Parcours 3 : Administration (3 min)
1. `/admin/dashboard` → Vue d'ensemble
2. `/admin/settings` → Configuration système
3. `/admin/countries` → Gestion multi-pays (Suisse/Maroc)

---

## 7. POINTS FORTS À METTRE EN AVANT

1. **Design Uber Premium** - Interface professionnelle et moderne
2. **Sécurité Femmes** - Bouton SOS toujours accessible
3. **Multi-pays** - Suisse et Maroc avec devises locales
4. **Mobile-First** - Optimisé pour smartphone
5. **Temps réel** - Suivi GPS en direct
6. **Accessibilité** - Conforme WCAG AA
7. **Performance** - < 3s de chargement

---

## 8. IDENTIFIANTS DE TEST

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Passagère | passenger@tripsalama.ch | TripSalama2025! |
| Conductrice | driver@tripsalama.ch | TripSalama2025! |
| Admin | admin@tripsalama.ch | TripSalama2025! |

**URL PROD :** https://stabilis-it.ch/internal/tripsalama
**URL LOCAL :** http://127.0.0.1:8080

---

*Document généré automatiquement - Mars 2026*
