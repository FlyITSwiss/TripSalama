# TripSalama Mobile App Tests

Tests Puppeteer pour l'application mobile TripSalama (simulation APK).

## 🎯 Tests disponibles

### 1. Test complet de l'app mobile
```bash
node tests/puppeteer/test-mobile-app.js
```

**Ce test vérifie :**
- ✅ Chargement de l'app mobile
- ✅ Écran de login
- ✅ Login passagère
- ✅ Dashboard passagère
- ✅ Logout
- ✅ Login conductrice
- ✅ Dashboard conductrice
- ✅ Toggle statut en ligne

**Résultat :** Screenshots dans `tests/puppeteer/screenshots/`

---

### 2. Diagnostic de login
```bash
node tests/puppeteer/diagnose-mobile-login.js
```

**Ce test diagnostique :**
- 🔍 Configuration API (API_BASE)
- 🔍 Endpoint CSRF
- 🔍 Requêtes réseau (logs complets)
- 🔍 Cookies de session
- 🔍 Erreurs console
- 🔍 Problèmes CORS

**Utiliser ce test si le login ne fonctionne pas dans l'APK.**

---

## 🚀 Installation

```bash
cd tests/puppeteer
npm install
```

---

## 📱 Différence Web vs APK

| Aspect | Web (navigateur) | APK (Capacitor) |
|--------|------------------|-----------------|
| **URL** | `https://stabilis-it.ch/internal/tripsalama/mobile` | `capacitor://localhost` |
| **Cookies** | ✅ Stockés normalement | ⚠️ Peut nécessiter config |
| **CORS** | ✅ Pas de problème | ⚠️ Peut bloquer si mal configuré |
| **Session** | ✅ PHP session | ⚠️ Vérifie `credentials: 'include'` |

---

## 🔧 Résolution des problèmes

### Problème : Login fonctionne en web mais pas dans l'APK

**Diagnostic :**
1. Lancer `diagnose-mobile-login.js`
2. Vérifier les cookies stockés
3. Vérifier les réponses API

**Causes possibles :**
- ❌ Cookies de session non stockés
- ❌ CORS bloquant les requêtes
- ❌ `credentials: 'include'` manquant dans fetch
- ❌ API_BASE incorrect dans l'APK

**Solution :**
```javascript
// Dans public/mobile/index.html, ligne 575-600
const response = await fetch(url, {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    credentials: 'include', // ← CRITIQUE pour les cookies
    body: JSON.stringify(data)
});
```

---

### Problème : CSRF token invalide

**Vérifier :**
1. L'endpoint `/api/auth?action=csrf` retourne un token
2. Le token est bien envoyé dans le body du POST login

**Dans `diagnose-mobile-login.js`, vérifier :**
```
🔑 Testing CSRF token endpoint...
   ✅ CSRF endpoint working (status 200)
   Token: [Received]
```

Si `[Missing]`, l'API ne retourne pas le token correctement.

---

### Problème : Session ne persiste pas

**Symptôme :** L'utilisateur doit se reconnecter à chaque lancement de l'app.

**Cause :** Les cookies de session ne sont pas stockés dans l'APK.

**Solution :** Utiliser `localStorage` pour stocker l'état de session :
```javascript
// Déjà implémenté dans public/mobile/index.html lignes 535-543
localStorage.setItem('tripsalama_user', JSON.stringify(currentUser));
```

---

## 📸 Screenshots

Les screenshots sont automatiquement sauvegardés dans :
```
tests/puppeteer/screenshots/
├── mobile-01-splash.png
├── mobile-02-login.png
├── mobile-03-login-filled.png
├── mobile-04-after-login.png
├── mobile-05-passenger-dashboard.png
├── mobile-06-after-logout.png
├── mobile-07-driver-dashboard.png
└── mobile-08-driver-online.png
```

---

## 🔐 Identifiants de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| **Passagère** | `passenger@tripsalama.ch` | `TripSalama2025!` |
| **Conductrice** | `driver@tripsalama.ch` | `TripSalama2025!` |

---

## 📋 Checklist avant build APK

- [ ] Tester en local : `node tests/puppeteer/test-mobile-app.js`
- [ ] Vérifier que le login fonctionne (screenshots)
- [ ] Vérifier que les cookies sont stockés
- [ ] Tester sur production : modifier `BASE_URL` en `PROD`
- [ ] Build APK : `npm run build:android`
- [ ] Installer APK sur téléphone
- [ ] Tester login réel sur téléphone
- [ ] Si problème : lancer `diagnose-mobile-login.js`

---

## 🆘 Support

Si les tests échouent :
1. Lire les logs console complets
2. Vérifier les screenshots dans `screenshots/`
3. Lancer le diagnostic : `node tests/puppeteer/diagnose-mobile-login.js`
4. Vérifier les network logs dans le diagnostic
