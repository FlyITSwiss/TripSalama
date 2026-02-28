#!/bin/bash
###############################################################################
# TripSalama - Test Mobile Automatisé
# Usage: npm run test:mobile
#
# RÈGLE UN : Tests automatisés avec screenshots
###############################################################################

set -e

echo "🧪 TripSalama - Test Mobile Automatisé"
echo "======================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Vérifier que Puppeteer est installé
echo -e "${BLUE}📦 Vérification des dépendances...${NC}"
cd tests/puppeteer
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚙️  Installation de Puppeteer...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dépendances OK${NC}"
echo ""

# 2. Nettoyer les anciens screenshots
echo -e "${BLUE}🧹 Nettoyage des anciens screenshots...${NC}"
if [ -d "screenshots" ]; then
    rm -f screenshots/mobile-*.png
    echo -e "${GREEN}✅ Screenshots nettoyés${NC}"
else
    mkdir -p screenshots
    echo -e "${GREEN}✅ Dossier screenshots créé${NC}"
fi
echo ""

# 3. Lancer le test mobile complet
echo -e "${BLUE}🚀 Lancement du test mobile...${NC}"
echo ""
node test-mobile-app.js

# 4. Afficher les résultats
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Tests terminés !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📸 Screenshots disponibles :${NC}"
ls -lh screenshots/mobile-*.png 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
echo ""
echo -e "${YELLOW}📋 Pour diagnostiquer un problème :${NC}"
echo "   npm run diagnose:mobile"
echo ""

cd ../..
