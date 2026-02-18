# Identity Camera Component - TripSalama

Composant de vérification d'identité avec détection de visage locale via face-api.js.

## Caractéristiques

- ✅ Détection de visage locale (pas d'envoi vers serveur tiers)
- ✅ Analyse du genre et de l'âge via face-api.js
- ✅ Interface utilisateur étape par étape
- ✅ Design System φ (Golden Ratio)
- ✅ Responsive mobile-first
- ✅ i18n (FR/EN)
- ✅ Accessible (WCAG AA)
- ✅ 0% dépendance externe (hormis face-api.js chargé depuis CDN)

## Installation

### 1. Fichiers requis

```
public/assets/
├── vendor/face-api/
│   └── face-api-loader.js
├── js/
│   ├── core/
│   │   ├── app-config.js
│   │   ├── i18n.js
│   │   └── api-service.js
│   └── modules/
│       └── identity-camera.js
├── css/
│   └── components/
│       └── identity-camera.css
└── lang/
    ├── fr.json (avec clés verification.*)
    └── en.json (avec clés verification.*)
```

### 2. Inclusion dans une page

```html
<!-- CSS -->
<link rel="stylesheet" href="/assets/css/tripsalama-design-system.css">
<link rel="stylesheet" href="/assets/css/components/identity-camera.css">

<!-- JavaScript (dans l'ordre) -->
<script src="/assets/js/core/app-config.js"></script>
<script src="/assets/js/core/i18n.js"></script>
<script src="/assets/js/core/api-service.js"></script>
<script src="/assets/vendor/face-api/face-api-loader.js"></script>
<script src="/assets/js/modules/identity-camera.js"></script>
```

## Utilisation

### Initialisation simple

```html
<!-- Container -->
<div id="verification-container"></div>

<script>
// Initialiser le composant
IdentityCamera.init('#verification-container');
</script>
```

### Initialisation avec callback

```html
<div id="verification-container"></div>

<script>
// Initialiser avec options
IdentityCamera.init('#verification-container', {
    onComplete: 'handleVerificationDone'
});

// Fonction callback
function handleVerificationDone(result) {
    console.log('Vérification terminée:', result);
    // result = { detected: true, gender: 'female', confidence: 0.95, age: 28 }

    // Rediriger vers la prochaine étape
    window.location.href = '/dashboard';
}
</script>
```

### Récupération du résultat

```javascript
// Obtenir le résultat de l'analyse
const result = IdentityCamera.getResult();

if (result) {
    console.log(`Genre détecté: ${result.gender}`);
    console.log(`Confiance: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Âge estimé: ${result.age} ans`);
}
```

### Nettoyage

```javascript
// Libérer les ressources (caméra, DOM, etc.)
IdentityCamera.destroy();
```

## API Endpoint Requis

Le composant appelle l'endpoint suivant pour soumettre la vérification :

```
POST /api/verification?action=submit
```

**Payload (FormData) :**

- `photo` : Image base64 de la photo capturée
- `gender` : Genre détecté ('male' | 'female')
- `gender_confidence` : Niveau de confiance (0-1)
- `age` : Âge estimé (nombre)
- `_csrf_token` : Token CSRF (automatique via ApiService)

**Réponse attendue (JSON) :**

```json
{
    "success": true,
    "message": "Vérification réussie",
    "data": {
        "verified": true,
        "verification_id": "uuid-123",
        "timestamp": "2025-01-15T10:30:00Z"
    }
}
```

**États possibles :**
- `verified` : Vérification immédiate réussie
- `pending` : En attente de revue manuelle (< 24h)
- `rejected` : Vérification échouée

## Étapes du workflow

1. **Intro** : Affichage des conseils + consentement utilisateur
2. **Camera** : Activation caméra + détection temps réel + capture photo
3. **Preview** : Prévisualisation + choix reprendre/valider
4. **Analyzing** : Analyse locale avec face-api.js + envoi serveur
5. **Result** : Affichage du résultat (verified/pending/rejected)

## Gestion d'erreurs

Le composant gère automatiquement :

- ❌ Caméra refusée → Message + lien paramètres navigateur
- ❌ Pas de caméra détectée → Message + option vérification manuelle
- ❌ Aucun visage détecté → Permettre de réessayer (max 3 fois)
- ❌ Plusieurs visages → Message d'erreur explicite
- ❌ Échec réseau → Toast notification + réessayer

## Variables CSS personnalisables

Toutes les variables du Design System φ sont utilisées :

```css
/* Couleurs */
--color-primary: #2D5A4A (émeraude)
--color-accent: #C9A962 (or)
--color-surface: #FFFFFF

/* Spacing (Fibonacci) */
--space-1 à --space-9

/* Typography */
--text-xs à --text-hero

/* Transitions */
--duration-normal, --ease-out-expo
```

## Accessibilité

- ✅ Focus visible sur tous les éléments interactifs
- ✅ Labels ARIA pour le lecteur d'écran
- ✅ Contraste WCAG AA respecté
- ✅ Navigation clavier possible
- ✅ Skip link disponible
- ✅ Support `prefers-reduced-motion`

## Responsive Breakpoints (φ)

- Mobile : < 518px
- Tablet : 518px - 838px
- Desktop : ≥ 838px

Le composant est 100% fonctionnel sur mobile avec caméra frontale.

## Compatibilité

**Navigateurs supportés :**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Chrome Android 90+
- Safari iOS 14+

**Prérequis :**
- `navigator.mediaDevices.getUserMedia` disponible
- Connexion HTTPS (requis pour getUserMedia)
- Connexion internet (chargement face-api.js depuis CDN)

## Sécurité

- ✅ Traitement local du visage (pas d'envoi tiers)
- ✅ CSRF automatique via ApiService
- ✅ Consentement explicite requis
- ✅ Stream caméra libéré proprement
- ✅ Données sensibles non stockées en localStorage

## Performance

- Modèles face-api.js : ~2.5 MB (chargés depuis CDN)
- Temps de chargement initial : ~3-5s (cache navigateur ensuite)
- Détection temps réel : ~30 FPS
- Analyse photo : ~500ms

## Démo

Ouvrir dans le navigateur :

```
http://127.0.0.1:8080/demo-identity-camera.html
```

## Support

Pour toute question ou bug, contacter l'équipe TripSalama.
