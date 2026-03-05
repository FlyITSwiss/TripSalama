#!/bin/bash
#
# TripSalama - Daily Backup Script
# Saves database and uploads to /var/backups/tripsalama
#
# Usage: ./backup.sh [--full|--db-only|--files-only]
#
# Required environment variables:
#   DB_DATABASE, DB_USERNAME, DB_PASSWORD (optional, uses root if not set)
#

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/tripsalama"
APP_DIR="/var/www/tripsalama"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
BACKUP_TYPE="${1:-full}"

# Load environment if exists
if [ -f "$APP_DIR/.env" ]; then
    source "$APP_DIR/.env" 2>/dev/null || true
fi

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:-tripsalama}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Create backup directory
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log_info "Starting TripSalama backup ($BACKUP_TYPE) - $DATE"

# Function to backup database
backup_database() {
    log_info "Backing up database: $DB_DATABASE"

    DUMP_FILE="$BACKUP_DIR/db_${DB_DATABASE}_${DATE}.sql.gz"

    if [ -n "$DB_PASSWORD" ]; then
        mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" \
            --single-transaction \
            --routines \
            --triggers \
            --add-drop-table \
            "$DB_DATABASE" | gzip > "$DUMP_FILE"
    else
        # Try with sudo for root without password
        sudo mysqldump --single-transaction --routines --triggers --add-drop-table \
            "$DB_DATABASE" | gzip > "$DUMP_FILE"
    fi

    if [ -f "$DUMP_FILE" ]; then
        SIZE=$(du -h "$DUMP_FILE" | cut -f1)
        log_info "Database backup created: $DUMP_FILE ($SIZE)"
    else
        log_error "Database backup failed!"
        return 1
    fi
}

# Function to backup uploads
backup_files() {
    log_info "Backing up uploads directory"

    UPLOADS_DIR="$APP_DIR/public/uploads"
    TAR_FILE="$BACKUP_DIR/uploads_${DATE}.tar.gz"

    if [ -d "$UPLOADS_DIR" ]; then
        tar -czf "$TAR_FILE" -C "$APP_DIR/public" uploads 2>/dev/null || true

        if [ -f "$TAR_FILE" ]; then
            SIZE=$(du -h "$TAR_FILE" | cut -f1)
            log_info "Uploads backup created: $TAR_FILE ($SIZE)"
        else
            log_warn "Uploads backup may have failed or directory is empty"
        fi
    else
        log_warn "Uploads directory not found: $UPLOADS_DIR"
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days"

    find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

    # Keep at least 3 backups regardless of age
    ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | tail -n +4 | head -n -3 | xargs rm -f 2>/dev/null || true

    REMAINING=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)
    log_info "Remaining backup files: $REMAINING"
}

# Function to verify backup
verify_backup() {
    log_info "Verifying backup integrity"

    # Check database backup
    LATEST_DB=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_DB" ]; then
        if gzip -t "$LATEST_DB" 2>/dev/null; then
            log_info "Database backup integrity: OK"
        else
            log_error "Database backup integrity: FAILED"
            return 1
        fi
    fi

    # Check uploads backup
    LATEST_UPLOADS=$(ls -t "$BACKUP_DIR"/uploads_*.tar.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_UPLOADS" ]; then
        if gzip -t "$LATEST_UPLOADS" 2>/dev/null; then
            log_info "Uploads backup integrity: OK"
        else
            log_error "Uploads backup integrity: FAILED"
            return 1
        fi
    fi
}

# Function to generate backup report
generate_report() {
    REPORT_FILE="$BACKUP_DIR/backup_report_${DATE}.txt"

    {
        echo "TripSalama Backup Report"
        echo "========================"
        echo "Date: $(date)"
        echo "Type: $BACKUP_TYPE"
        echo ""
        echo "Backup Files:"
        ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5
        echo ""
        echo "Disk Usage:"
        du -sh "$BACKUP_DIR"
        echo ""
        echo "Database Size:"
        if [ -n "$DB_PASSWORD" ]; then
            mysql -h "$DB_HOST" -u "$DB_USERNAME" -p"$DB_PASSWORD" -e \
                "SELECT table_schema AS 'Database',
                 ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
                 FROM information_schema.tables
                 WHERE table_schema = '$DB_DATABASE'
                 GROUP BY table_schema;" 2>/dev/null || echo "Could not get database size"
        else
            sudo mysql -e \
                "SELECT table_schema AS 'Database',
                 ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
                 FROM information_schema.tables
                 WHERE table_schema = '$DB_DATABASE'
                 GROUP BY table_schema;" 2>/dev/null || echo "Could not get database size"
        fi
    } > "$REPORT_FILE"

    log_info "Backup report saved: $REPORT_FILE"
}

# Main execution
case "$BACKUP_TYPE" in
    --full|full)
        backup_database
        backup_files
        ;;
    --db-only|db-only)
        backup_database
        ;;
    --files-only|files-only)
        backup_files
        ;;
    *)
        log_error "Unknown backup type: $BACKUP_TYPE"
        echo "Usage: $0 [--full|--db-only|--files-only]"
        exit 1
        ;;
esac

cleanup_old_backups
verify_backup
generate_report

log_info "Backup completed successfully!"
echo ""
echo "Backup location: $BACKUP_DIR"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -3
