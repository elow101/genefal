#!/bin/bash
# Nettoyage Phase D - SQL uniquement
# Usage: bash scripts/cleanup-phase-d.sh

echo "=== Nettoyage Phase D ==="
echo ""

# Scripts temporaires de migration (obsolètes)
TEMP_SCRIPTS=(
    "scripts/init-safe-deployment.php"
    "scripts/phase-b-interactive.php"
    "scripts/phase-b-setup.php"
    "scripts/migrate-phase-c.php"
    "scripts/migrate_upcoming_json_to_sql.php"
    "scripts/backup_genealogy_sql_to_json.php"
)

echo "[1] Suppression scripts temporaires..."
for file in "${TEMP_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✓ Supprimé: $file"
    else
        echo "  - Déjà absent: $file"
    fi
done

# Logs debug (si présents)
echo ""
echo "[2] Suppression logs debug..."
LOG_FILES=(
    "data/sql-error.log"
    "data/sql-write-debug.log"
)
for file in "${LOG_FILES[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✓ Supprimé: $file"
    else
        echo "  - Déjà absent: $file"
    fi
done

# API temporaires (si présentes sur le serveur)
echo ""
echo "[3] Suppression API temporaires..."
TEMP_API=(
    "api/test-write.php"
    "api/test-insert.php"
    "api/test-migration-debug.php"
    "api/view-debug-log.php"
    "api/init-schema-full.php"
    "api/run-migration.php"
)
for file in "${TEMP_API[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo "  ✓ Supprimé: $file"
    else
        echo "  - Déjà absent: $file"
    fi
done

echo ""
echo "=== Nettoyage terminé ==="
echo ""
echo "Fichiers conservés (intentionnellement):"
echo "  - api/backup-genealogy-json.php (backup manuel)"
echo "  - api/migrate-genealogy-json-to-sql.php (resync SQL)"
echo "  - data/genealogy.json (backup fallback)"
echo "  - data/backups/*.json (backups historiques)"
