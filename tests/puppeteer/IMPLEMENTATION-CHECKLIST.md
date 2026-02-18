# Checklist d'Implémentation - Vérification d'Identité

Cette checklist guide l'implémentation de la fonctionnalité de vérification d'identité par caméra pour qu'elle passe tous les tests E2E.

## Vue d'Ensemble

La fonctionnalité doit permettre à une nouvelle utilisatrice (passagère ou conductrice) de vérifier son identité en prenant une photo de son visage avec la caméra après l'inscription.

## Architecture Technique

### Routes

- [ ] **GET** `/identity-verification` - Page principale de vérification
- [ ] **POST** `/api/identity-verification/submit` - Soumission de la photo
- [ ] **GET** `/api/identity-verification/status/:userId` - Statut de la vérification

### Flux Utilisateur

```
Inscription → Redirection automatique → Page Vérification → Dashboard
                                        ↓
                               Étape 1: Consentement
                                        ↓
                               Étape 2: Caméra
                                        ↓
                               Étape 3: Capture
                                        ↓
                               Étape 4: Preview
                                        ↓
                               Étape 5: Validation
                                        ↓
                               Étape 6: Analyse
                                        ↓
                          Résultat: Success/Pending/Error
```

## Checklist Frontend

### Page HTML (`/identity-verification`)

- [ ] **Container principal**
  - Classe : `.identity-verification-container` ou `.identity-camera-container`
  - ID alternatif : `#identityVerification`

- [ ] **Titre de page**
  - Élément : `<h2>` avec classe `.identity-title` ou `.verification-title`
  - Texte traduit : `__('verification.title')` ou équivalent
  - **INTERDIT** : Clés i18n brutes visibles

### Étape 1 : Consentement et Tips

- [ ] **Tips d'aide**
  - Container : `.identity-tips` ou `.verification-tips`
  - Items : `.tip-item` ou `.tip`
  - Au moins 2-3 conseils (ex: "Assurez-vous d'avoir une bonne lumière", "Retirez lunettes/chapeau")

- [ ] **Checkbox de consentement**
  - ID : `#identity-consent-checkbox`
  - Attribut `name="identity-consent"`
  - Label associé avec `for="identity-consent-checkbox"`
  - Texte : "J'accepte que ma photo soit utilisée pour la vérification d'identité"

- [ ] **Bouton Continuer**
  - Classe : `.identity-btn-continue` ou `.btn-continue`
  - Attribut : `data-action="continue"`
  - **État initial** : Désactivé (`disabled`)
  - **Activation** : Checkbox cochée → retrait de `disabled`

### Étape 2 : Vue Caméra

- [ ] **Container caméra**
  - Classe : `.identity-camera-view` ou `.camera-view`
  - ID alternatif : `#cameraView`
  - **Affiché après** : Clic sur "Continuer"

- [ ] **Élément vidéo**
  - ID : `#identityVideo` ou classe `.identity-video`
  - Tag : `<video>` avec attributs :
    ```html
    <video id="identityVideo" autoplay playsinline></video>
    ```

- [ ] **Guide de positionnement du visage**
  - Classe : `.face-guide` ou `.identity-guide` ou `.camera-guide`
  - Forme : Ovale ou cercle en SVG/CSS
  - Position : Centré sur la vidéo
  - Objectif : Aider l'utilisatrice à positionner son visage

- [ ] **Bouton Capture**
  - Classe : `.identity-btn-capture` ou `.btn-capture`
  - Attribut : `data-action="capture"`
  - Icône : Appareil photo ou cercle
  - Position : En bas de la vue caméra

### Étape 3 : Preview de la Photo

- [ ] **Container preview**
  - Classe : `.identity-preview` ou `.photo-preview`
  - **Affiché après** : Capture réussie
  - **Cache** : Vue caméra

- [ ] **Image capturée**
  - Classe : `.preview-image`
  - ID alternatif : `#previewImage`
  - Tag : `<img>` avec `src` en base64 ou blob URL

- [ ] **Bouton Reprendre**
  - Classe : `.btn-retake`
  - Attribut : `data-action="retake"`
  - Texte : "Reprendre" ou icône refresh
  - **Action** : Retour à la vue caméra

- [ ] **Bouton Valider**
  - Classe : `.btn-validate`
  - Attribut : `data-action="validate"`
  - Texte : "Valider" ou "Envoyer"
  - **Action** : Soumettre la photo au backend

### Étape 4 : Analyse et Résultat

- [ ] **Container résultat**
  - Classe : `.verification-result` ou `.identity-result`
  - **Affiché après** : Soumission

- [ ] **Message de chargement**
  - Classe : `.loading-message` ou `.analyzing`
  - Texte : "Analyse en cours..."
  - Animation : Spinner ou progress

- [ ] **Message de succès**
  - Classe : `.success-message` ou `.verification-success`
  - Texte : "Vérification réussie !"
  - Icône : Checkmark vert
  - Bouton : "Continuer vers le tableau de bord"

- [ ] **Message en attente**
  - Classe : `.pending-message` ou `.verification-pending`
  - Texte : "Votre identité sera vérifiée sous 24-48h"
  - Icône : Horloge ou info
  - Bouton : "Continuer" (accès limité au dashboard)

- [ ] **Message d'erreur**
  - Classe : `.error-message` ou `.verification-error`
  - Texte : "La vérification a échoué. Veuillez réessayer."
  - Icône : Croix rouge
  - Bouton : "Réessayer"

## Checklist Backend

### API Endpoints

- [ ] **POST** `/api/identity-verification/submit`
  - **Input** :
    ```json
    {
      "userId": 123,
      "photo": "data:image/jpeg;base64,...",
      "timestamp": "2024-02-18T10:30:00Z"
    }
    ```
  - **Output** :
    ```json
    {
      "success": true,
      "status": "pending|success|failed",
      "message": "Votre identité sera vérifiée sous 24-48h"
    }
    ```

- [ ] **GET** `/api/identity-verification/status/:userId`
  - **Output** :
    ```json
    {
      "verified": false,
      "status": "pending|success|failed",
      "submittedAt": "2024-02-18T10:30:00Z",
      "verifiedAt": null
    }
    ```

### Stockage des Photos

- [ ] Dossier : `public/uploads/identity/` ou `storage/identity/`
- [ ] Nommage : `{userId}_{timestamp}.jpg`
- [ ] Sécurité : Permissions 644, accès restreint
- [ ] Taille max : 5 MB
- [ ] Format accepté : JPEG, PNG
- [ ] Validation : Vérifier que c'est une image valide

### Base de Données

Table `identity_verifications` :

```sql
CREATE TABLE identity_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    verified_by INT NULL,
    rejection_reason TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

- [ ] Migration créée
- [ ] Model `IdentityVerification.php` créé
- [ ] Relations définies (User → IdentityVerification)

## Checklist JavaScript

### Gestion de la Caméra

```javascript
// Demander permission caméra
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    videoElement.srcObject = stream;
  })
  .catch(error => {
    // Afficher message d'erreur
  });
```

- [ ] Demande de permission caméra
- [ ] Gestion du refus (message d'erreur clair)
- [ ] Stream vidéo vers élément `<video>`
- [ ] Arrêt du stream après capture
- [ ] Nettoyage des ressources (memory leaks)

### Capture de Photo

```javascript
const canvas = document.createElement('canvas');
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
const ctx = canvas.getContext('2d');
ctx.drawImage(video, 0, 0);
const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
```

- [ ] Canvas pour capture
- [ ] Conversion en base64
- [ ] Qualité JPEG : 0.8 - 0.95
- [ ] Affichage preview
- [ ] Compression si > 5 MB

### Soumission au Backend

```javascript
fetch('/api/identity-verification/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUserId,
    photo: photoDataUrl,
    timestamp: new Date().toISOString()
  })
})
```

- [ ] Requête POST avec photo
- [ ] Gestion des erreurs réseau
- [ ] Timeout approprié (10-15s)
- [ ] Indicateur de chargement
- [ ] Gestion réponse serveur

## Checklist Traductions (i18n)

### Fichier `fr.php` ou `fr.json`

```php
// backend/php/lang/fr.php
'verification' => [
    'title' => 'Vérification d\'identité',
    'consent' => 'J\'accepte que ma photo soit utilisée pour vérifier mon identité',
    'tips_title' => 'Conseils pour une bonne photo',
    'tip_light' => 'Assurez-vous d\'avoir une bonne lumière',
    'tip_face' => 'Retirez lunettes, chapeau et masque',
    'tip_center' => 'Centrez votre visage dans le guide',
    'btn_continue' => 'Continuer',
    'btn_capture' => 'Prendre la photo',
    'btn_retake' => 'Reprendre',
    'btn_validate' => 'Valider',
    'analyzing' => 'Analyse en cours...',
    'success' => 'Vérification réussie !',
    'pending' => 'Votre identité sera vérifiée sous 24-48h',
    'error' => 'La vérification a échoué. Veuillez réessayer.',
    'error_camera' => 'Impossible d\'accéder à la caméra. Vérifiez les permissions.',
]
```

- [ ] **Clés FR créées** dans `backend/php/lang/fr.php`
- [ ] **Clés EN créées** dans `backend/php/lang/en.php` (traductions équivalentes)
- [ ] **Aucun texte hardcodé** dans le HTML/JS
- [ ] **Utilisation de** `__('verification.xxx')` partout
- [ ] **Accents français corrects** : "Vérification", "créé", "réussi"

### Exemple Utilisation

```php
<!-- HTML -->
<h2><?= __('verification.title') ?></h2>
<label>
    <input type="checkbox" id="identity-consent-checkbox">
    <?= __('verification.consent') ?>
</label>

<!-- JavaScript -->
<script>
const messages = {
    success: <?= json_encode(__('verification.success')) ?>,
    error: <?= json_encode(__('verification.error')) ?>
};
</script>
```

## Checklist Design System

### CSS Variables Fibonacci

```css
/* Spacing Fibonacci : 1, 2, 4, 8, 13, 21, 34, 55, 89, 144 */
.identity-camera-view {
    padding: var(--spacing-21);  /* 21px */
    margin-bottom: var(--spacing-34);  /* 34px */
}

.face-guide {
    width: 233px;  /* Fibonacci φ */
    height: 377px;  /* Fibonacci φ */
    border-radius: 50%;
}
```

- [ ] **Aucun px hardcodé** (sauf breakpoints)
- [ ] **Utilisation variables** `--spacing-*`, `--text-*`, `--color-*`
- [ ] **Breakpoints φ** : 320px, 518px, 838px, 1355px
- [ ] **Contraste** : Texte lisible sur fond (ratio ≥ 4.5:1)

### Responsive

- [ ] **320px** (iPhone SE) : Layout vertical, boutons accessibles
- [ ] **518px** (Petite tablette) : Layout adapté
- [ ] **838px** (Tablette) : Layout optimisé
- [ ] **1355px+** (Desktop) : Utilisation espace latéral

## Checklist Tests E2E

### Avant de Commiter

```bash
npm run check:identity  # Vérifier le setup
npm run test:identity   # Exécuter les tests
```

- [ ] **10/10 tests passent**
- [ ] **Screenshots générés** sans erreurs visuelles
- [ ] **Aucune clé i18n brute** visible dans les screenshots
- [ ] **Aucune erreur console** critique (Check test 9)
- [ ] **Responsive 320px** fonctionnel (Check test 10)

### Tests Manuels Complémentaires

- [ ] Test avec **vraie caméra** (pas simulée)
- [ ] Test sur **mobile réel** (Android + iOS)
- [ ] Test **refus permission caméra** → Message d'erreur clair
- [ ] Test **photo floue** → Validation backend rejette
- [ ] Test **photo trop grande** → Compression automatique
- [ ] Test **déconnexion réseau** → Gestion erreur appropriée

## Checklist Sécurité

- [ ] **Validation serveur** : Vérifier format, taille, type MIME
- [ ] **Sanitisation** : Pas d'injection via nom de fichier
- [ ] **Permissions** : Seul le backend peut accéder aux photos d'identité
- [ ] **HTTPS** : Obligatoire en production (getUserMedia requiert HTTPS)
- [ ] **Logs** : Enregistrer les tentatives de vérification (audit)

## Checklist UX

- [ ] **Consentement explicite** : Utilisatrice comprend l'usage de sa photo
- [ ] **Feedback immédiat** : État du bouton change (disabled → enabled)
- [ ] **Instructions claires** : Tips visibles et utiles
- [ ] **Guide visuel** : Ovale/cercle aide au positionnement
- [ ] **Preview avant envoi** : Utilisatrice peut voir la photo
- [ ] **Possibilité de reprendre** : Bouton "Reprendre" visible
- [ ] **Messages d'état** : Loading, success, error bien distincts
- [ ] **Pas de blocage** : Possibilité de skip (accès limité)

## Checklist Accessibilité

- [ ] **Labels explicites** : Tous les boutons ont un label/title
- [ ] **Focus visible** : Outline sur focus clavier
- [ ] **Aria labels** : `aria-label` sur boutons icône
- [ ] **Contraste** : Texte/fond respecte WCAG AA
- [ ] **Navigation clavier** : Tab fonctionne correctement

## Ordre d'Implémentation Recommandé

1. **Backend** : Créer API endpoints + table BDD
2. **HTML statique** : Créer la structure HTML avec bons sélecteurs
3. **Traductions** : Ajouter toutes les clés i18n FR/EN
4. **CSS** : Styler avec variables design system
5. **JS - Caméra** : Implémenter gestion caméra + capture
6. **JS - Soumission** : Connecter frontend → backend
7. **Tests E2E** : Exécuter et corriger les erreurs
8. **Tests manuels** : Tester cas edge et responsive
9. **Sécurité** : Validation finale sécurité + permissions
10. **Documentation** : Mettre à jour README si nécessaire

## Documentation à Créer

- [ ] `README-identity-verification.md` : Guide utilisateur
- [ ] `IMPLEMENTATION.md` : Détails techniques implémentation
- [ ] Commentaires code : JSDoc pour fonctions complexes
- [ ] Swagger/OpenAPI : Documenter les endpoints API

## Validation Finale

Avant de merger la feature :

- [ ] ✓ Tous les tests E2E passent
- [ ] ✓ Code review approuvé
- [ ] ✓ Tests manuels sur mobile réel
- [ ] ✓ Aucune régression sur autres features
- [ ] ✓ Documentation à jour
- [ ] ✓ Traductions FR/EN complètes
- [ ] ✓ Sécurité validée (pas de fuite de données)
- [ ] ✓ Performance acceptable (< 3s pour capture + upload)

---

**Note** : Cette checklist garantit que l'implémentation passe tous les tests E2E automatisés. Cocher chaque item au fur et à mesure de l'implémentation.
