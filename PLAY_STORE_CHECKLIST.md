# TripSalama - Checklist Play Store

Cette checklist garantit que l'APK est **100% prêt** pour le Google Play Store.

---

## 🎯 Validation Technique (BLOQUANT)

| # | Critère | Status | Automatisé | Validateur |
|---|---------|--------|------------|------------|
| 1 | **APK signe avec keystore release** | ⏳ | ✅ | GitHub Actions |
| 2 | **Version code et version name corrects** | ⏳ | ✅ | `validate-play-store.js` |
| 3 | **Taille APK < 150 MB** | ⏳ | ✅ | GitHub Actions |
| 4 | **SDK Target >= 33 (Android 13)** | ⏳ | ✅ | `build.gradle` |
| 5 | **Permissions justifiées dans manifest** | ⏳ | ✅ | `validate-play-store.js` |
| 6 | **Icône adaptative (adaptive-icon)** | ⏳ | ✅ | GitHub Actions |
| 7 | **Pas de code obfusqué non déclaré** | ⏳ | ✅ | ProGuard config |
| 8 | **Support 64-bit (arm64-v8a, x86_64)** | ⏳ | ✅ | `build.gradle` |

---

## 🔒 Sécurité & Confidentialité (BLOQUANT)

| # | Critère | Status | Test |
|---|---------|--------|------|
| 9 | **Politique de confidentialité URL valide** | ⏳ | Manuel |
| 10 | **HTTPS uniquement (pas de HTTP)** | ⏳ | `validate-play-store.js` |
| 11 | **Pas de permissions dangereuses non utilisées** | ⏳ | `validate-play-store.js` |
| 12 | **Données sensibles stockées de manière sécurisée** | ⏳ | Code review |
| 13 | **WebView sécurisé (pas de `setAllowFileAccess`)** | ⏳ | `validate-play-store.js` |

---

## 🎨 Assets & Contenu (BLOQUANT)

| # | Critère | Status | Requis |
|---|---------|--------|--------|
| 14 | **Icône 512x512 PNG (Play Store listing)** | ⏳ | Oui |
| 15 | **Feature graphic 1024x500** | ⏳ | Oui |
| 16 | **Screenshots min 2 par langue (phone)** | ⏳ | Oui |
| 17 | **Screenshots min 1 par langue (tablet 7")** | ⏳ | Non (optionnel) |
| 18 | **Description courte (< 80 chars)** | ⏳ | Oui |
| 19 | **Description complète (< 4000 chars)** | ⏳ | Oui |
| 20 | **Vidéo promo YouTube** | ⏳ | Non (optionnel) |

---

## 🧪 Tests Fonctionnels (BLOQUANT)

| # | Feature | Test Appium | Status |
|---|---------|-------------|--------|
| 21 | **Login passagère fonctionne** | ✅ | ⏳ |
| 22 | **Login conductrice fonctionne** | ✅ | ⏳ |
| 23 | **Logout fonctionne** | ✅ | ⏳ |
| 24 | **Dashboard passagère s'affiche** | ✅ | ⏳ |
| 25 | **Dashboard conductrice s'affiche** | ✅ | ⏳ |
| 26 | **Map se charge correctement** | ✅ | ⏳ |
| 27 | **Permissions géolocalisation demandées** | ✅ | ⏳ |
| 28 | **Permissions caméra demandées (si besoin)** | ✅ | ⏳ |
| 29 | **Pas de crash au lancement** | ✅ | ⏳ |
| 30 | **Pas de crash lors de la navigation** | ✅ | ⏳ |
| 31 | **Rotation écran supportée** | ✅ | ⏳ |
| 32 | **Retour arrière (back button) fonctionne** | ✅ | ⏳ |
| 33 | **Deep links fonctionnent** | ✅ | ⏳ |
| 34 | **Notifications push fonctionnent** | ✅ | ⏳ |

---

## 📱 Compatibilité Appareils

| # | Critère | Status | Test |
|---|---------|--------|------|
| 35 | **Fonctionne sur Android 8.0+ (API 26+)** | ⏳ | Émulateur |
| 36 | **Fonctionne sur petits écrans (320dp)** | ⏳ | Émulateur |
| 37 | **Fonctionne sur grands écrans (tablet)** | ⏳ | Émulateur |
| 38 | **Support multi-langues (FR/EN/AR)** | ⏳ | Manuel |

---

## ⚡ Performance

| # | Critère | Seuil | Status |
|---|---------|-------|--------|
| 39 | **Temps de démarrage à froid < 3s** | ⏳ | Appium |
| 40 | **Temps de démarrage à chaud < 1s** | ⏳ | Appium |
| 41 | **Pas de ANR (Application Not Responding)** | ⏳ | Appium |
| 42 | **Utilisation mémoire < 150 MB** | ⏳ | Appium |
| 43 | **Batterie : pas de drain excessif** | ⏳ | Manuel |

---

## 📋 Conformité Play Store

| # | Critère | Status |
|---|---------|--------|
| 44 | **Pas de contenu pour adultes** | ✅ |
| 45 | **Pas de jeux d'argent** | ✅ |
| 46 | **Pas de contenu trompeur** | ✅ |
| 47 | **Respecte les règles famille (si applicable)** | ✅ |
| 48 | **Déclaration données collectées** | ⏳ |

---

## 🚀 Déploiement

| # | Action | Status |
|---|--------|--------|
| 49 | **Créer compte Google Play Console** | ⏳ |
| 50 | **Payer frais d'inscription (25 USD one-time)** | ⏳ |
| 51 | **Configurer fiche Play Store** | ⏳ |
| 52 | **Upload APK/AAB en internal testing** | ⏳ |
| 53 | **Tester avec utilisateurs internes** | ⏳ |
| 54 | **Passer en closed testing (beta)** | ⏳ |
| 55 | **Corriger bugs remontés** | ⏳ |
| 56 | **Soumettre pour review production** | ⏳ |

---

## 🎯 Commandes de validation

```bash
# Valider que l'APK est prêt pour le Play Store
npm run validate:playstore

# Tester l'APK sur émulateur
npm run test:apk

# Générer le rapport complet
npm run playstore:report
```

---

## ✅ Critères de passage

**Pour soumettre au Play Store, TOUS les items BLOQUANTS doivent être ✅**

| Catégorie | Items BLOQUANTS | Items OPTIONNELS |
|-----------|-----------------|------------------|
| Technique | 8 items | 0 |
| Sécurité | 5 items | 0 |
| Assets | 5 items | 3 |
| Tests | 14 items | 0 |
| Performance | 4 items | 1 |

**Total : 36 items BLOQUANTS obligatoires**

---

## 📞 Support

Si un item échoue, voir :
- `tests/appium/README.md` - Guide des tests mobiles
- `docs/PLAY_STORE.md` - Guide complet Play Store
- GitHub Issues - Problèmes connus
