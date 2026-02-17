#!/bin/bash
# TripSalama - Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENV=${1:-staging}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 TripSalama Deployment"
echo "========================"
echo "Environment: $ENV"
echo "Timestamp: $TIMESTAMP"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration based on environment
case "$ENV" in
    staging)
        DEPLOY_HOST="staging.tripsalama.com"
        DEPLOY_USER="deploy"
        DEPLOY_PATH="/var/www/staging.tripsalama.com"
        ;;
    production)
        DEPLOY_HOST="tripsalama.com"
        DEPLOY_USER="deploy"
        DEPLOY_PATH="/var/www/tripsalama.com"
        ;;
    infomaniak)
        # Infomaniak specific
        DEPLOY_HOST="ftp.infomaniak.com"
        DEPLOY_USER="tripsalama"
        DEPLOY_PATH="/web"
        ;;
    *)
        echo -e "${RED}Unknown environment: $ENV${NC}"
        echo "Usage: ./scripts/deploy.sh [staging|production|infomaniak]"
        exit 1
        ;;
esac

# 1. Run tests first
echo "1. Running tests..."
cd tests/puppeteer
if npm test; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed - aborting deployment${NC}"
    exit 1
fi
cd ../..

# 2. Create deployment package
echo ""
echo "2. Creating deployment package..."
DEPLOY_DIR="deploy_$TIMESTAMP"
mkdir -p "$DEPLOY_DIR"

# Copy files (excluding development files)
rsync -av --exclude='.git' \
          --exclude='node_modules' \
          --exclude='vendor' \
          --exclude='.env' \
          --exclude='.env.local' \
          --exclude='tests' \
          --exclude='docker' \
          --exclude='data' \
          --exclude='storage/logs/*' \
          --exclude='storage/cache/*' \
          --exclude='public/uploads/*' \
          --exclude='*.log' \
          --exclude='.DS_Store' \
          --exclude='Thumbs.db' \
          . "$DEPLOY_DIR/"

echo -e "${GREEN}✓ Package created${NC}"

# 3. Create tarball
echo ""
echo "3. Creating tarball..."
tar -czf "tripsalama_$TIMESTAMP.tar.gz" "$DEPLOY_DIR"
echo -e "${GREEN}✓ Tarball created: tripsalama_$TIMESTAMP.tar.gz${NC}"

# 4. Upload (if not dry run)
if [ "$2" != "--dry-run" ]; then
    echo ""
    echo "4. Uploading to $ENV..."

    if [ "$ENV" = "infomaniak" ]; then
        # FTP upload for Infomaniak
        echo "Using FTP for Infomaniak..."
        # Note: In production, use lftp or ncftp for better reliability
        echo -e "${YELLOW}⚠ Manual upload required to Infomaniak${NC}"
        echo "Upload tripsalama_$TIMESTAMP.tar.gz via FileZilla"
    else
        # SSH/SCP for VPS
        scp "tripsalama_$TIMESTAMP.tar.gz" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/"

        ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
            cd $DEPLOY_PATH
            tar -xzf /tmp/tripsalama_$TIMESTAMP.tar.gz
            mv $DEPLOY_DIR/* .
            rm -rf $DEPLOY_DIR
            rm /tmp/tripsalama_$TIMESTAMP.tar.gz

            # Set permissions
            chmod -R 755 public/uploads
            chmod -R 755 storage

            # Clear cache
            rm -rf storage/cache/*

            echo "Deployment complete!"
EOF
        echo -e "${GREEN}✓ Deployed to $ENV${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}⚠ Dry run - no upload performed${NC}"
fi

# 5. Cleanup
echo ""
echo "5. Cleaning up..."
rm -rf "$DEPLOY_DIR"
echo -e "${GREEN}✓ Cleanup complete${NC}"

echo ""
echo "========================"
echo -e "${GREEN}✅ Deployment finished!${NC}"
echo "Package: tripsalama_$TIMESTAMP.tar.gz"
