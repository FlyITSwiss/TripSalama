#!/bin/bash
# TripSalama - Setup Script
# Usage: ./scripts/setup.sh

set -e

echo "🚀 TripSalama Setup"
echo "==================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    MINGW*|CYGWIN*|MSYS*) MACHINE=Windows;;
    *)          MACHINE="UNKNOWN:$OS"
esac

echo "Detected OS: $MACHINE"
echo ""

# 1. Install Git hooks
echo -n "1. Installing Git hooks... "
if [ -d ".git" ]; then
    cp scripts/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit 2>/dev/null || true
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ Not a git repository${NC}"
fi

# 2. Create .env if not exists
echo -n "2. Setting up environment... "
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env from .env.example${NC}"
else
    echo -e "${YELLOW}⚠ .env already exists${NC}"
fi

# 3. Create upload directories
echo -n "3. Creating upload directories... "
mkdir -p public/uploads/avatars
mkdir -p public/uploads/documents
touch public/uploads/.gitkeep
touch public/uploads/avatars/.gitkeep
touch public/uploads/documents/.gitkeep
echo -e "${GREEN}✓${NC}"

# 4. Create storage directories
echo -n "4. Creating storage directories... "
mkdir -p storage/logs
mkdir -p storage/cache
touch storage/logs/.gitkeep
touch storage/cache/.gitkeep
echo -e "${GREEN}✓${NC}"

# 5. Install npm dependencies for tests
echo -n "5. Installing test dependencies... "
if command -v npm &> /dev/null; then
    cd tests/puppeteer
    npm install --silent
    cd ../..
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ npm not found, skipping${NC}"
fi

# 6. Set permissions (Linux/Mac only)
if [ "$MACHINE" != "Windows" ]; then
    echo -n "6. Setting permissions... "
    chmod -R 755 public/uploads 2>/dev/null || true
    chmod -R 755 storage 2>/dev/null || true
    echo -e "${GREEN}✓${NC}"
fi

echo ""
echo "==================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your database credentials"
echo "  2. Run: docker-compose -f docker/docker-compose.yml up -d"
echo "  3. Run migrations: docker exec tripsalama-db mysql -uroot -proot tripsalama < database/migrations/001_create_users_table.sql"
echo "  4. Run tests: cd tests/puppeteer && npm test"
