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
        'pickup_placeholder' => 'Rechercher une adresse...',
        'dropoff_placeholder' => 'Où allez-vous ?',
        'estimate' => 'Estimer le trajet',
        'confirm_ride' => 'Confirmer la course',
        'price' => 'Prix estimé',
        'duration' => 'Durée estimée',
        'distance' => 'Distance',
        'my_location' => 'Ma position actuelle',
        'no_results' => 'Aucun résultat trouvé',
        'detecting_location' => 'Détection de votre position...',
        'location_found' => 'Position détectée',
        'change_location' => 'Modifier le point de départ',
        'use_current_location' => 'Utiliser ma position actuelle',
        'position_accuracy' => 'Précision : :meters m',
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
        'subtitle' => 'Retrouvez toutes vos courses passées',
        'no_rides' => 'Aucune course pour le moment',
        'no_rides_subtitle' => 'Vos courses apparaîtront ici après votre premier trajet',
        'view_details' => 'Voir les détails',
        'total_rides' => 'Total des courses',
        'completed_rides' => 'Courses terminées',
        'this_month' => 'Ce mois',
        'start_booking' => 'Réserver ma première course',
        'pickup_label' => 'Départ',
        'dropoff_label' => 'Arrivée',
        'driver_label' => 'Conductrice',
        'duration_label' => 'Durée',
        'distance_label' => 'Distance',
        'at_time' => 'à',
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
        'ride_booked' => 'Course réservée avec succès !',
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
        'geolocation_permission' => 'Veuillez autoriser l\'accès à votre position',
        'geolocation_unavailable' => 'Service de localisation indisponible',
        'geolocation_timeout' => 'Délai de localisation dépassé',
        'geolocation_unsupported' => 'Votre navigateur ne supporte pas la géolocalisation',
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

    // Tracking
    'tracking' => [
        'center_vehicle' => 'Centrer sur le véhicule',
        'minutes' => 'minutes',
        'remaining' => 'restants',
        'call' => 'Appeler',
        'arrived' => 'Vous êtes arrivée !',
        'finish' => 'Terminer',
        'trip_complete' => 'Trajet terminé en {duration} minutes',
    ],

    // Géolocalisation
    'geolocation' => [
        'unsupported' => 'Géolocalisation non supportée',
        'permission_denied' => 'Accès à la position refusé',
        'unavailable' => 'Position indisponible',
        'timeout' => 'Délai de localisation dépassé',
        'error' => 'Erreur de géolocalisation',
        'detecting' => 'Détection de votre position...',
        'detected' => 'Position détectée',
        'accuracy' => 'Précision : {meters} m',
        'use_current' => 'Utiliser ma position actuelle',
    ],

    // Mode démo
    'demo' => [
        'title' => 'Démo de suivi en temps réel',
        'loading_map' => 'Chargement de la carte...',
        'arrival' => 'Arrivée',
        'distance' => 'Distance',
        'speed' => 'Vitesse',
        'start_demo' => 'Démarrer la démo',
        'hint' => 'Cliquez pour voir un véhicule se déplacer vers vous',
        'pause' => 'Pause',
        'resume' => 'Reprendre',
        'stop' => 'Arrêter',
        'center_map' => 'Centrer la carte',
        'call_driver' => 'Appeler la conductrice',
        'driver_arrived' => 'Votre conductrice est arrivée !',
        'driver_waiting' => 'Elle vous attend dehors.',
        'restart' => 'Relancer la démo',
        'locating' => 'Localisation...',
        'locating_you' => 'Détection de votre position...',
        'position_found' => 'Position détectée !',
        'is_coming' => 'arrive vers vous',
        'paused' => 'Simulation en pause',
        'arrived_notification' => 'Votre conductrice est arrivée !',
        'call_demo_only' => 'Appel non disponible en mode démo',
        'error_occurred' => 'Une erreur est survenue',
        'your_position' => 'Vous êtes ici',
        'geo_unsupported' => 'Géolocalisation non supportée',
        'initializing' => 'Initialisation...',
        'ride_confirmed' => 'Course confirmée',
        'driver_approaching' => 'Conductrice en approche',
        'boarding' => 'Embarquement...',
        'boarding_message' => 'Votre conductrice vous attend dehors. Montez à bord !',
        'seconds' => 'secondes',
        'trip_in_progress' => 'Trajet en cours',
        'arriving_destination' => 'Arrivée imminente',
        'trip_completed' => 'Course terminée !',
        'trip_summary' => 'Trajet effectué en :duration minutes',
        'rate_driver' => 'Noter votre conductrice',
        'rate_subtitle' => 'Comment s\'est passé votre trajet ?',
        'tap_to_rate' => 'Appuyez pour noter',
        'rating_1' => 'Très mauvais',
        'rating_2' => 'Mauvais',
        'rating_3' => 'Correct',
        'rating_4' => 'Bon',
        'rating_5' => 'Excellent !',
        'add_tip' => 'Ajouter un pourboire',
        'no_tip' => 'Non merci',
        'thank_you' => 'Merci !',
        'thank_you_message' => 'Votre note a été enregistrée. À bientôt sur TripSalama !',
        'back_home' => 'Retour à l\'accueil',
    ],

    // Vérification d'identité
    'verification' => [
        'title' => 'Vérification d\'identité',
        'subtitle' => 'Pour votre sécurité, nous vérifions que vous êtes bien une femme',
        'camera_permission' => 'Autoriser l\'accès à la caméra',
        'camera_denied' => 'Accès à la caméra refusé',
        'camera_not_found' => 'Aucune caméra détectée',
        'take_photo' => 'Prendre une photo',
        'retake' => 'Reprendre',
        'submit' => 'Valider ma photo',
        'processing' => 'Analyse en cours...',
        'success' => 'Vérification réussie !',
        'success_message' => 'Bienvenue dans la communauté TripSalama',
        'failed' => 'Vérification échouée',
        'failed_message' => 'Nous n\'avons pas pu vérifier votre identité automatiquement',
        'pending_review' => 'En attente de vérification',
        'pending_message' => 'Notre équipe examine votre demande sous 24h',
        'tips_title' => 'Conseils pour une bonne photo',
        'tip_face_visible' => 'Visage bien visible et centré',
        'tip_good_lighting' => 'Bon éclairage, évitez le contre-jour',
        'tip_no_sunglasses' => 'Retirez lunettes de soleil et chapeau',
        'tip_neutral_expression' => 'Expression neutre ou souriante',
        'privacy_notice' => 'Votre photo est analysée localement et n\'est pas envoyée à des serveurs tiers.',
        'consent_text' => 'J\'accepte que ma photo soit utilisée pour vérifier mon identité',
        'consent_required' => 'Vous devez accepter pour continuer',
        'manual_review_info' => 'Notre équipe examine votre demande sous 24h',
        'skip_for_now' => 'Passer pour l\'instant',
        'continue' => 'Continuer',
    ],

    // Footer
    'footer' => [
        'copyright' => '© 2025 TripSalama. Tous droits réservés.',
        'privacy' => 'Confidentialité',
        'terms' => 'Conditions d\'utilisation',
        'contact' => 'Contact',
    ],
];
