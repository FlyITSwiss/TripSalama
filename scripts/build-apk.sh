#!/bin/bash
###############################################################################
# TripSalama - Build APK Automatisé
# Usage: npm run build:apk
#
# Ce script fait TOUT automatiquement (RÈGLE UN : zéro manuel)
###############################################################################

set -e  # Exit on error

echo "🚀 TripSalama - Build APK Automatisé"
echo "======================================"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Vérifier que nous sommes dans le bon répertoire
echo -e "${BLUE}📂 Vérification du répertoire...${NC}"
if [ ! -f "capacitor.config.json" ]; then
    echo -e "${RED}❌ Erreur: capacitor.config.json non trouvé${NC}"
    echo "   Exécutez ce script depuis la racine du projet TripSalama"
    exit 1
fi
echo -e "${GREEN}✅ Répertoire correct${NC}"
echo ""

# 2. Build du frontend
echo -e "${BLUE}🔨 Build du frontend...${NC}"
if [ -f "package.json" ]; then
    npm run build || {
        echo -e "${RED}❌ Build frontend échoué${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Build frontend réussi${NC}"
else
    echo -e "${YELLOW}⚠️  package.json non trouvé, skip build frontend${NC}"
fi
echo ""

# 3. Synchronisation Capacitor
echo -e "${BLUE}🔄 Synchronisation des assets vers Android...${NC}"
npx cap sync android || {
    echo -e "${RED}❌ Sync Capacitor échoué${NC}"
    exit 1
}
echo -e "${GREEN}✅ Assets synchronisés${NC}"
echo ""

# 4. Vérifier que le SDK Android est configuré
echo -e "${BLUE}🔍 Vérification du SDK Android...${NC}"
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Dossier android/ non trouvé${NC}"
    exit 1
fi

# 5. Build de l'APK Release
echo -e "${BLUE}📦 Build de l'APK Release...${NC}"
cd android

# Déterminer l'OS pour utiliser gradlew ou gradlew.bat
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    GRADLE_CMD="gradlew.bat"
else
    GRADLE_CMD="./gradlew"
fi

# Build
$GRADLE_CMD assembleRelease || {
    echo -e "${RED}❌ Build APK échoué${NC}"
    cd ..
    exit 1
}

cd ..
echo -e "${GREEN}✅ APK construit avec succès${NC}"
echo ""

# 6. Localiser l'APK
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ APK créé avec succès !${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "📱 Fichier : ${BLUE}$APK_PATH${NC}"
    echo -e "📊 Taille  : ${BLUE}$APK_SIZE${NC}"
    echo ""

    # Afficher les corrections incluses
    echo -e "${YELLOW}🔧 Corrections incluses dans cet APK :${NC}"
    echo "   ✅ Login fonctionnel (data.data au lieu de data.data.user)"
    echo "   ✅ Logo TripSalama professionnel (spirale de Fibonacci)"
    echo "   ✅ Contraste du mail corrigé"
    echo ""

    # Instructions d'installation
    echo -e "${YELLOW}📲 Pour installer sur téléphone Android :${NC}"
    echo "   1. Transférez $APK_PATH sur votre téléphone"
    echo "   2. Activez 'Sources inconnues' dans Paramètres > Sécurité"
    echo "   3. Ouvrez le fichier APK et installez"
    echo ""

    # Instructions de test
    echo -e "${YELLOW}🧪 Pour tester avant installation :${NC}"
    echo "   npm run test:mobile"
    echo ""

else
    echo -e "${RED}❌ APK non trouvé à l'emplacement attendu${NC}"
    echo "   Cherché dans: $APK_PATH"
    exit 1
fi

echo -e "${GREEN}✅ Build terminé avec succès !${NC}"
