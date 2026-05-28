# Migration Progressive JSON → SQL

Guide de migration sécurisée et réversible pour GeneFaluche.

## Principes de sécurité

1. **Ne jamais supprimer** `data/genealogy.json` pendant la migration
2. **Ne jamais désactiver** `JSON_WRITE_GENEALOGY` tant que SQL n'est pas connecté et rempli
3. **Ne jamais activer** `SQL_READ_GENEALOGY` tant que les tables SQL ne contiennent pas les données attendues
4. **Backup obligatoire** avant toute migration massive via `api/backup-genealogy-json.php`
5. **Réversibilité** : on peut revenir en arrière en remettant `SQL_READ_GENEALOGY=0` et `JSON_WRITE_GENEALOGY=1`

---

## Phase A — État actuel : JSON uniquement

Configuration `.env` :

```env
SQL_ENABLED=0
DB_HOST=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_PORT=3306
DB_CHARSET=utf8mb4
SQL_READ_GENEALOGY=0
SQL_WRITE_GENEALOGY=0
SQL_READ_UPCOMING=0
JSON_WRITE_GENEALOGY=1
```

**État** :
- Le site fonctionne entièrement en JSON
- Aucune connexion SQL
- Les données sont dans `data/genealogy.json`

---

## Phase B — SQL connecté, backup JSON actif

### Étape B1 : Créer le fichier `.env`

```env
SQL_ENABLED=1
DB_HOST=your_host
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_PORT=3306
DB_CHARSET=utf8mb4
SQL_READ_GENEALOGY=0
SQL_WRITE_GENEALOGY=1
SQL_READ_UPCOMING=0
JSON_WRITE_GENEALOGY=1
```

### Étape B2 : Vérifier la connexion

Accédez à `api/diagnostic.php` en tant qu'admin général. Vérifiez :
- `env.file_found` → `true`
- `env.sql_enabled` → `true`
- `sql.configured` → `true`
- `sql.connected` → `true`
- `safe_next_step` → `"enable_sql_write"` ou `"trigger_json_to_sql_sync"`

### Étape B3 : Initialiser le schéma SQL

```bash
php scripts/init_sql_schema.php
```

### Étape B4 : Créer un backup JSON

En tant qu'admin général, faites un POST vers `api/backup-genealogy-json.php` avec le CSRF token.

Ou utilisez l'interface admin si disponible.

### Étape B5 : Migrer les données JSON → SQL

**Mode simulation (recommandé avant la vraie migration)** :
```bash
curl -H "X-CSRF-TOKEN: <token>" "https://votresite.com/api/migrate-genealogy-json-to-sql.php?dryRun=true"
```

**Migration réelle** :
```bash
curl -X POST -H "X-CSRF-TOKEN: <token>" -H "Content-Type: application/json" \
  -d '{"dryRun":false}' \
  "https://votresite.com/api/migrate-genealogy-json-to-sql.php"
```

Vérifiez la réponse :
- `ok` → `true`
- `genealogies_count` → nombre attendu
- `people_count` → nombre attendu
- `tables_after` → compteurs SQL cohérents

---

## Phase C — SQL source principale avec backup JSON

**Prérequis** : Les tables SQL contiennent les données correctes (vérifiées en Phase B).

Configuration `.env` :

```env
SQL_ENABLED=1
DB_HOST=your_host
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_PORT=3306
DB_CHARSET=utf8mb4
SQL_READ_GENEALOGY=1
SQL_WRITE_GENEALOGY=1
SQL_READ_UPCOMING=1
JSON_WRITE_GENEALOGY=1
```

**Effet** :
- Lecture prioritaire depuis SQL
- Si SQL indisponible → fallback JSON automatique
- Écriture simultanée SQL + JSON (backup)
- Pas de perte de données possible

### Vérification après activation

1. Accédez au site normalement
2. Vérifiez que les données s'affichent correctement
3. Consultez `api/diagnostic.php` : `safe_next_step` doit indiquer `"disable_json_write_optional"`
4. Testez une modification (ajout d'une fiche) et vérifiez qu'elle persiste

---

## Phase D — SQL principal sans écriture JSON (optionnel)

**⚠️ ATTENTION** : À n'activer qu'après plusieurs jours de vérification complète en Phase C.

Configuration `.env` :

```env
SQL_ENABLED=1
DB_HOST=your_host
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_PORT=3306
DB_CHARSET=utf8mb4
SQL_READ_GENEALOGY=1
SQL_WRITE_GENEALOGY=1
SQL_READ_UPCOMING=1
JSON_WRITE_GENEALOGY=0
```

**Effet** :
- Lecture uniquement depuis SQL (plus de fallback JSON automatique en lecture)
- Écriture uniquement en SQL
- `data/genealogy.json` devient un backup statique

### Pour créer un backup JSON manuel en Phase D

```bash
curl -X POST -H "X-CSRF-TOKEN: <token>" \
  "https://votresite.com/api/backup-genealogy-json.php"
```

---

## Checklist avant activation SQL_READ_GENEALOGY

- [ ] `api/diagnostic.php` retourne `sql.connected: true`
- [ ] `api/diagnostic.php` retourne des compteurs de tables cohérents
- [ ] La migration `api/migrate-genealogy-json-to-sql.php` a retourné `ok: true`
- [ ] Un backup JSON horodaté existe dans `data/backups/`
- [ ] Les données affichées sur le site sont complètes après test
- [ ] Une modification test persiste correctement

## Checklist avant JSON_WRITE_GENEALOGY=0 (Phase D)

- [ ] Le site fonctionne en Phase C depuis au moins 3-7 jours sans incident
- [ ] Toutes les modifications récentes sont bien enregistrées
- [ ] `api/diagnostic.php` retourne `safe_next_step: "disable_json_write_optional"`
- [ ] Un backup JSON récent existe
- [ ] Vous savez comment réactiver `JSON_WRITE_GENEALOGY=1` en cas de problème

## Procédure de retour en arrière (rollback)

Si vous rencontrez des problèmes après avoir activé `SQL_READ_GENEALOGY=1` :

1. Modifiez `.env` :
   ```env
   SQL_READ_GENEALOGY=0
   JSON_WRITE_GENEALOGY=1
   ```

2. Le site revient immédiatement à la lecture JSON

3. Les données sont celles du dernier `data/genealogy.json` (potentiellement légèrement différentes des dernières écritures SQL si la sync n'était pas complète)

4. Restaurez un backup JSON si nécessaire :
   ```bash
   cp data/backups/genealogy-YYYY-MM-DD-HH-mm-ss.json data/genealogy.json
   ```

---

## Récapitulatif des endpoints de migration

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `api/diagnostic.php` | GET/POST | État complet du système, recommandation `safe_next_step` |
| `api/backup-genealogy-json.php` | POST | Crée un backup horodaté dans `data/backups/` |
| `api/migrate-genealogy-json-to-sql.php` | GET/POST | Migration JSON→SQL, supporte `dryRun=true` |

## Variables d'environnement

| Variable | Valeurs | Description |
|----------|---------|-------------|
| `SQL_ENABLED` | `0`/`1` | Active la connexion SQL |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | string | Identifiants base de données |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_CHARSET` | `utf8mb4` | Encodage |
| `SQL_READ_GENEALOGY` | `0`/`1` | Lit la généalogie depuis SQL (prioritaire) |
| `SQL_WRITE_GENEALOGY` | `0`/`1` | Écrit la généalogie en SQL |
| `SQL_READ_UPCOMING` | `0`/`1` | Lit les événements depuis SQL |
| `JSON_WRITE_GENEALOGY` | `0`/`1` | Écrit le backup JSON (défaut: `1`) |

---

## Nettoyage post-migration (Phase D)

Après stabilisation en Phase D, exécutez le script de nettoyage :

```bash
bash scripts/cleanup-phase-d.sh
```

### Fichiers supprimés

**Scripts temporaires (devenus inutiles)** :
- `scripts/init-safe-deployment.php`
- `scripts/phase-b-interactive.php`
- `scripts/phase-b-setup.php`
- `scripts/migrate-phase-c.php`
- `scripts/migrate_upcoming_json_to_sql.php`
- `scripts/backup_genealogy_sql_to_json.php`

**Logs debug** :
- `data/sql-error.log`
- `data/sql-write-debug.log`

**API temporaires** (créées pendant la migration) :
- `api/test-*.php`
- `api/view-debug-log.php`
- `api/init-schema-full.php`
- `api/run-migration.php`

### Fichiers conservés intentionnellement

| Fichier | Raison |
|---------|--------|
| `api/backup-genealogy-json.php` | Backup manuel depuis JSON (si resync nécessaire) |
| `api/migrate-genealogy-json-to-sql.php` | Resync SQL si corruption ou réimport |
| `data/genealogy.json` | Backup readonly de secours |
| `data/backups/*.json` | Historique des backups |
| `scripts/init_sql_schema.php` | Réutilisable pour réinstallation |
| `scripts/migrate_genealogy_json_to_sql.php` | Utilitaire CLI de migration |

### État après nettoyage

- **Généalogie** : SQL-first, fallback JSON en lecture seule
- **Événements** : JSON (non migrés en SQL)
- **Backup** : `data/genealogy.json` figé + backups historiques
- **Écriture** : SQL uniquement (`JSON_WRITE_GENEALOGY=0`)
