#!/bin/bash
# TripSalama - Database Migrations Runner
# Usage: ./scripts/migrate.sh [--seed] [--fresh]

set -e

echo "🗄️  TripSalama Migrations"
echo "========================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Default values
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}
DB_DATABASE=${DB_DATABASE:-tripsalama}
DB_USERNAME=${DB_USERNAME:-root}
DB_PASSWORD=${DB_PASSWORD:-root}

MIGRATIONS_DIR="database/migrations"
SEEDS_DIR="database/seeds"

# Check if running in Docker
if [ -f /.dockerenv ]; then
    MYSQL_CMD="mysql"
else
    # Try Docker first, then local
    if docker ps | grep -q tripsalama-db; then
        MYSQL_CMD="docker exec -i tripsalama-db mysql"
        echo "Using Docker MySQL container..."
    else
        MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT"
        echo "Using local MySQL connection..."
    fi
fi

# MySQL connection string
MYSQL="$MYSQL_CMD -u$DB_USERNAME -p$DB_PASSWORD $DB_DATABASE"

# Fresh migration (drop all tables)
if [[ "$1" == "--fresh" || "$2" == "--fresh" ]]; then
    echo ""
    echo -e "${YELLOW}⚠ Dropping all tables...${NC}"

    $MYSQL -e "SET FOREIGN_KEY_CHECKS = 0;"

    TABLES=$($MYSQL -N -e "SHOW TABLES")
    for table in $TABLES; do
        echo "  Dropping $table..."
        $MYSQL -e "DROP TABLE IF EXISTS $table;"
    done

    $MYSQL -e "SET FOREIGN_KEY_CHECKS = 1;"
    echo -e "${GREEN}✓ All tables dropped${NC}"
fi

# Run migrations
echo ""
echo "Running migrations..."

for migration in $(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | sort); do
    filename=$(basename "$migration")
    echo -n "  $filename... "

    if $MYSQL < "$migration" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        # Check if error is "table already exists"
        if $MYSQL < "$migration" 2>&1 | grep -q "already exists"; then
            echo -e "${YELLOW}⚠ Already exists${NC}"
        else
            echo -e "${RED}✗${NC}"
            $MYSQL < "$migration"
        fi
    fi
done

# Run seeds if requested
if [[ "$1" == "--seed" || "$2" == "--seed" ]]; then
    echo ""
    echo "Running seeds..."

    for seed in $(ls -1 $SEEDS_DIR/*.sql 2>/dev/null | sort); do
        filename=$(basename "$seed")
        echo -n "  $filename... "

        if $MYSQL < "$seed" 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠ Skipped (may already exist)${NC}"
        fi
    done
fi

echo ""
echo "========================"
echo -e "${GREEN}✅ Migrations complete!${NC}"

# Show table count
TABLE_COUNT=$($MYSQL -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_DATABASE'")
echo "Tables in database: $TABLE_COUNT"
