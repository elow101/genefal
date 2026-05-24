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

function database_diagnostic(): array
{
    $pdo = database_pdo();
    $tables = [];
    if ($pdo) {
        foreach (['events', 'event_participation_requests', 'event_region_subscriptions', 'event_creator_secrets'] as $table) {
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
        'configured' => database_configured(),
        'connected' => $pdo instanceof PDO,
        'host_set' => database_env('DB_HOST') !== '',
        'database_set' => database_env('DB_NAME') !== '',
        'user_set' => database_env('DB_USER') !== '',
        'tables' => $tables,
    ];
}
