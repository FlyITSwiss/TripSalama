<?php

declare(strict_types=1);

/**
 * TripSalama - Traductions Françaises
 * ACCENTS OBLIGATOIRES : é è ê ë à â ù û ü ô î ï ç
 */

return [
    // Application
    'app' => [
        'name' => 'TripSalama',
        'tagline' => 'Voyagez en toute sérénité',
        'loading' => 'Chargement...',
    ],

    // Navigation
    'nav' => [
        'skip_to_content' => 'Aller au contenu',
        'home' => 'Accueil',
        'book' => 'Réserver',
        'history' => 'Historique',
        'profile' => 'Profil',
        'logout' => 'Déconnexion',
        'dashboard' => 'Tableau de bord',
    ],

    // Authentification
    'auth' => [
        'login' => 'Connexion',
        'register' => 'Inscription',
        'logout' => 'Déconnexion',
        'email' => 'Adresse email',
        'password' => 'Mot de passe',
        'password_confirm' => 'Confirmer le mot de passe',
        'remember_me' => 'Se souvenir de moi',
        'forgot_password' => 'Mot de passe oublié ?',
        'login_button' => 'Se connecter',
        'register_button' => 'Créer mon compte',
        'no_account' => 'Pas encore de compte ?',
        'have_account' => 'Déjà un compte ?',
        'register_as' => 'S\'inscrire en tant que',
        'passenger' => 'Passagère',
        'driver' => 'Conductrice',
        'register_passenger' => 'Je suis passagère',
        'register_driver' => 'Je suis conductrice',
        'welcome_back' => 'Bienvenue !',
        'create_account' => 'Créer votre compte',
    ],

    // Formulaires
    'form' => [
        'first_name' => 'Prénom',
        'last_name' => 'Nom',
        'phone' => 'Téléphone',
        'save' => 'Enregistrer',
        'cancel' => 'Annuler',
        'submit' => 'Valider',
        'back' => 'Retour',
        'next' => 'Suivant',
        'required' => 'Ce champ est obligatoire',
    ],

    // Véhicule
    'vehicle' => [
        'title' => 'Mon véhicule',
        'brand' => 'Marque',
        'model' => 'Modèle',
        'color' => 'Couleur',
        'license_plate' => 'Plaque d\'immatriculation',
        'year' => 'Année',
    ],

    // Réservation
    'booking' => [
        'title' => 'Réserver une course',
        'pickup' => 'Point de départ',
        'dropoff' => 'Destination',
        'pickup_placeholder' => 'Où souhaitez-vous partir ?',
        'dropoff_placeholder' => 'Où allez-vous ?',
        'estimate' => 'Estimer le trajet',
        'confirm_ride' => 'Confirmer la course',
        'price' => 'Prix estimé',
        'duration' => 'Durée estimée',
        'distance' => 'Distance',
        'my_location' => 'Ma position actuelle',
        'no_results' => 'Aucun résultat trouvé',
    ],

    // Course
    'ride' => [
        'title' => 'Ma course',
        'status' => 'Statut',
        'pending' => 'En attente',
        'searching' => 'Recherche d\'une conductrice...',
        'accepted' => 'Acceptée',
        'driver_arriving' => 'Conductrice en route',
        'in_progress' => 'Course en cours',
        'completed' => 'Terminée',
        'cancelled' => 'Annulée',
        'eta' => 'Arrivée estimée',
        'cancel' => 'Annuler la course',
        'cancel_confirm' => 'Êtes-vous sûre de vouloir annuler cette course ?',
        'rate' => 'Noter la course',
        'rate_driver' => 'Noter votre conductrice',
        'rate_passenger' => 'Noter votre passagère',
        'comment' => 'Commentaire (optionnel)',
        'submit_rating' => 'Envoyer la note',
    ],

    // Conductrice
    'driver' => [
        'title' => 'Tableau de bord conductrice',
        'available' => 'Disponible',
        'unavailable' => 'Indisponible',
        'toggle_status' => 'Changer mon statut',
        'pending_rides' => 'Courses en attente',
        'no_pending' => 'Aucune course en attente',
        'accept' => 'Accepter',
        'reject' => 'Refuser',
        'start_ride' => 'Démarrer la course',
        'complete_ride' => 'Terminer la course',
        'go_to_passenger' => 'Aller chercher la passagère',
        'go_to_destination' => 'Aller à destination',
        'arrived_pickup' => 'Je suis arrivée',
    ],

    // Historique
    'history' => [
        'title' => 'Historique des courses',
        'no_rides' => 'Aucune course pour le moment',
        'view_details' => 'Voir les détails',
        'total_rides' => 'Total des courses',
        'this_month' => 'Ce mois',
    ],

    // Profil
    'profile' => [
        'title' => 'Mon profil',
        'edit' => 'Modifier mon profil',
        'edit_description' => 'Mettez à jour vos informations personnelles',
        'personal_info' => 'Informations personnelles',
        'email_readonly' => 'L\'adresse email ne peut pas être modifiée',
        'avatar' => 'Photo de profil',
        'change_avatar' => 'Changer ma photo',
        'member_since' => 'Membre depuis',
        'verified' => 'Vérifiée',
        'not_verified' => 'En attente de vérification',
        'total_rides' => 'Courses effectuées',
        'rating' => 'Note moyenne',
    ],

    // Messages
    'msg' => [
        'success' => 'Succès',
        'error' => 'Erreur',
        'warning' => 'Attention',
        'info' => 'Information',
        'saved' => 'Enregistré avec succès',
        'deleted' => 'Supprimé avec succès',
        'updated' => 'Mis à jour avec succès',
        'login_success' => 'Connexion réussie',
        'login_failed' => 'Email ou mot de passe incorrect',
        'logout_success' => 'Déconnexion réussie',
        'register_success' => 'Compte créé avec succès',
        'ride_created' => 'Demande de course envoyée',
        'ride_accepted' => 'Course acceptée par une conductrice',
        'ride_cancelled' => 'Course annulée',
        'ride_completed' => 'Course terminée',
        'rating_submitted' => 'Merci pour votre note',
        'position_updated' => 'Position mise à jour',
        'status_changed' => 'Statut mis à jour',
    ],

    // Erreurs
    'error' => [
        'generic' => 'Une erreur est survenue',
        'not_found' => 'Page non trouvée',
        'unauthorized' => 'Accès non autorisé',
        'forbidden' => 'Accès interdit',
        'validation' => 'Erreur de validation',
        'csrf' => 'Session expirée, veuillez recharger la page',
        'network' => 'Erreur réseau, veuillez réessayer',
        'geolocation' => 'Impossible d\'obtenir votre position',
        'no_driver' => 'Aucune conductrice disponible pour le moment',
    ],

    // Validation
    'validation' => [
        'email_invalid' => 'Adresse email invalide',
        'email_taken' => 'Cette adresse email est déjà utilisée',
        'password_min_length' => 'Le mot de passe doit contenir au moins 8 caractères',
        'password_uppercase' => 'Le mot de passe doit contenir au moins une majuscule',
        'password_number' => 'Le mot de passe doit contenir au moins un chiffre',
        'password_mismatch' => 'Les mots de passe ne correspondent pas',
        'phone_invalid' => 'Numéro de téléphone invalide',
        'required_field' => 'Ce champ est obligatoire',
        'invalid_file_type' => 'Type de fichier non autorisé',
        'file_too_large' => 'Fichier trop volumineux',
    ],

    // Carte
    'map' => [
        'my_position' => 'Ma position',
        'driver_position' => 'Position de la conductrice',
        'pickup_point' => 'Point de prise en charge',
        'dropoff_point' => 'Point de dépose',
        'loading_map' => 'Chargement de la carte...',
    ],

    // Simulation
    'simulation' => [
        'demo_mode' => 'Mode démonstration',
        'speed' => 'Vitesse',
        'normal' => 'Normale',
        'fast' => 'Rapide',
        'very_fast' => 'Très rapide',
    ],

    // Footer
    'footer' => [
        'copyright' => '© 2025 TripSalama. Tous droits réservés.',
        'privacy' => 'Confidentialité',
        'terms' => 'Conditions d\'utilisation',
        'contact' => 'Contact',
    ],
];
