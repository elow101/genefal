<?php
declare(strict_types=1);

function database_load_dotenv(): void
{
    if (function_exists('load_dotenv_if_present')) {
        load_dotenv_if_present();
        return;
    }

    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $envPath = __DIR__ . '/../.env';
    if (!is_file($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        error_log('Database env error: unable to read .env file.');
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        $line = preg_replace('/^\xEF\xBB\xBF/', '', $line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$name, $value] = array_pad(explode('=', $line, 2), 2, '');
        $name = trim($name);
        if (!preg_match('/^[A-Z0-9_]+$/', $name)) {
            continue;
        }
        $value = trim($value, " \t\n\r\0\x0B\"'");
        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

function database_env(string $key, string $default = ''): string
{
    database_load_dotenv();
    $value = getenv($key);
    if (is_string($value) && trim($value) !== '') {
        return trim($value);
    }
    foreach ([$_ENV[$key] ?? null, $_SERVER[$key] ?? null] as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }
    return $default;
}

function database_enabled(): bool
{
    return in_array(strtolower(database_env('SQL_ENABLED', '0')), ['1', 'true', 'yes', 'on'], true);
}

function database_read_enabled(): bool
{
    return in_array(strtolower(database_env('SQL_READ_UPCOMING', '0')), ['1', 'true', 'yes', 'on'], true);
}

function database_genealogy_write_enabled(): bool
{
    return in_array(strtolower(database_env('SQL_WRITE_GENEALOGY', '0')), ['1', 'true', 'yes', 'on'], true);
}

function database_genealogy_json_write_enabled(): bool
{
    return in_array(strtolower(database_env('JSON_WRITE_GENEALOGY', '1')), ['1', 'true', 'yes', 'on'], true);
}

function database_genealogy_read_enabled(): bool
{
    return in_array(strtolower(database_env('SQL_READ_GENEALOGY', '0')), ['1', 'true', 'yes', 'on'], true);
}

function database_configured(): bool
{
    return database_env('DB_HOST') !== ''
        && database_env('DB_NAME') !== ''
        && database_env('DB_USER') !== '';
}

function database_pdo(): ?PDO
{
    static $pdo = null;
    static $attempted = false;
    if ($attempted) {
        return $pdo;
    }
    $attempted = true;

    if (!database_enabled()) {
        return null;
    }

    $host = database_env('DB_HOST');
    $name = database_env('DB_NAME');
    $user = database_env('DB_USER');
    $password = database_env('DB_PASSWORD');
    $port = database_env('DB_PORT', '3306');
    $charset = database_env('DB_CHARSET', 'utf8mb4');
    if ($host === '' || $name === '' || $user === '') {
        error_log('Database disabled: DB_HOST, DB_NAME or DB_USER is missing.');
        return null;
    }

    try {
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (Throwable $exception) {
        error_log('Database connection error: ' . $exception->getMessage());
        return null;
    }
}

function database_execute_file(PDO $pdo, string $path): void
{
    $sql = file_get_contents($path);
    if (!is_string($sql) || trim($sql) === '') {
        throw new RuntimeException('Schema SQL introuvable ou vide.');
    }
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    foreach ($statements as $statement) {
        $pdo->exec($statement);
    }
}

function database_column_exists(PDO $pdo, string $table, string $column): bool
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $statement->execute([':table_name' => $table, ':column_name' => $column]);
    return (int) $statement->fetchColumn() > 0;
}

function database_add_column_if_missing(PDO $pdo, string $table, string $column, string $definition): void
{
    if (database_column_exists($pdo, $table, $column)) {
        return;
    }
    $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
}

function database_index_exists(PDO $pdo, string $table, string $index): bool
{
    $statement = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
    );
    $statement->execute([':table_name' => $table, ':index_name' => $index]);
    return (int) $statement->fetchColumn() > 0;
}

function database_add_index_if_missing(PDO $pdo, string $table, string $index, string $definition): void
{
    if (database_index_exists($pdo, $table, $index)) {
        return;
    }
    $pdo->exec("ALTER TABLE {$table} ADD INDEX {$index} {$definition}");
}

function database_ensure_genealogy_sql_schema(PDO $pdo): void
{
    database_add_column_if_missing($pdo, 'genealogies', 'genealogy_json', 'JSON NULL');
    database_add_column_if_missing($pdo, 'people', 'baptism_city', 'VARCHAR(160) NULL');
    database_add_column_if_missing($pdo, 'people', 'baptism_status', 'VARCHAR(40) NULL');
    database_add_column_if_missing($pdo, 'people', 'filiere_custom', 'VARCHAR(160) NULL');
    database_add_column_if_missing($pdo, 'people', 'filiere2', 'VARCHAR(120) NULL');
    database_add_column_if_missing($pdo, 'people', 'filiere2_custom', 'VARCHAR(160) NULL');
    database_add_column_if_missing($pdo, 'people', 'song', 'TEXT NULL');
    database_add_column_if_missing($pdo, 'people', 'person_json', 'JSON NULL');
    database_add_column_if_missing($pdo, 'genealogy_people', 'filiere', 'VARCHAR(120) NULL');
    database_add_column_if_missing($pdo, 'genealogy_people', 'filiere_custom', 'VARCHAR(160) NULL');
    database_add_column_if_missing($pdo, 'genealogy_people', 'filiere2', 'VARCHAR(120) NULL');
    database_add_column_if_missing($pdo, 'genealogy_people', 'filiere2_custom', 'VARCHAR(160) NULL');
    database_add_column_if_missing($pdo, 'events', 'scope', "VARCHAR(40) NOT NULL DEFAULT 'region'");
    database_add_column_if_missing($pdo, 'events', 'event_url', 'VARCHAR(600) NULL');
    database_add_column_if_missing($pdo, 'events', 'family_id', 'VARCHAR(120) NULL');
    database_add_column_if_missing($pdo, 'events', 'recurrence', "VARCHAR(40) NOT NULL DEFAULT 'none'");

    database_add_index_if_missing($pdo, 'genealogies', 'idx_genealogies_parent_type', '(parent_id, type)');
    database_add_index_if_missing($pdo, 'people', 'idx_people_genealogy_filiere', '(genealogy_id, filiere)');
    database_add_index_if_missing($pdo, 'people', 'idx_people_baptism_date', '(baptism_date)');
    database_add_index_if_missing($pdo, 'genealogy_people', 'idx_genealogy_people_filiere', '(genealogy_id, filiere)');
    database_add_index_if_missing($pdo, 'genealogy_people', 'idx_genealogy_people_filiere2', '(genealogy_id, filiere2)');
    database_add_index_if_missing($pdo, 'person_relations', 'idx_relation_genealogy_source', '(genealogy_id, source_person_id)');
    database_add_index_if_missing($pdo, 'person_relations', 'idx_relation_genealogy_target', '(genealogy_id, target_person_id)');
    database_add_index_if_missing($pdo, 'events', 'idx_events_date', '(date_time)');
    database_add_index_if_missing($pdo, 'events', 'idx_events_family_date', '(family_id, date_time)');
    database_add_index_if_missing($pdo, 'events', 'idx_events_scope_date', '(scope, date_time)');
}

function database_diagnostic(): array
{
    $pdo = database_pdo();
    $tables = [];
    if ($pdo) {
        foreach (['genealogies', 'people', 'genealogy_people', 'app_settings', 'events', 'event_participation_requests', 'event_region_subscriptions', 'event_creator_secrets'] as $table) {
            try {
                $tables[$table] = (int) $pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
            } catch (Throwable) {
                $tables[$table] = null;
            }
        }
    }

    return [
        'enabled' => database_enabled(),
        'read_upcoming_enabled' => database_read_enabled(),
        'write_genealogy_enabled' => database_genealogy_write_enabled(),
        'write_genealogy_json_enabled' => database_genealogy_json_write_enabled(),
        'read_genealogy_enabled' => database_genealogy_read_enabled(),
        'configured' => database_configured(),
        'connected' => $pdo instanceof PDO,
        'host_set' => database_env('DB_HOST') !== '',
        'database_set' => database_env('DB_NAME') !== '',
        'user_set' => database_env('DB_USER') !== '',
        'tables' => $tables,
    ];
}
