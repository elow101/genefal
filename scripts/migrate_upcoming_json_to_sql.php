<?php
declare(strict_types=1);

define('FALUCHE_GENEALOGY_LIBRARY_ONLY', true);

require __DIR__ . '/../api/genealogy.php';
require_once __DIR__ . '/../api/upcoming_sql.php';

$pdo = database_pdo();
if (!$pdo) {
    fwrite(STDERR, "Base SQL indisponible. Renseigne SQL_ENABLED=1, DB_HOST, DB_NAME, DB_USER et DB_PASSWORD.\n");
    exit(1);
}

$schemaPath = __DIR__ . '/../database/schema.sql';
database_execute_file($pdo, $schemaPath);

$state = current_genealogy_payload();
$events = public_upcoming_baptisms(is_array($state['upcomingBaptisms'] ?? null) ? $state['upcomingBaptisms'] : []);
$secrets = upcoming_read_migration_json(UPCOMING_SECRETS_FILE);
$subscriptions = upcoming_read_migration_json(UPCOMING_SUBSCRIPTIONS_FILE);

$summary = [
    'events' => 0,
    'creatorSecrets' => 0,
    'requests' => 0,
    'requestsSkippedMissingEmail' => 0,
    'subscriptions' => 0,
];

$pdo->beginTransaction();
try {
    foreach ($events as $event) {
        upcoming_sql_upsert_event($event);
        $summary['events']++;

        $eventId = (string) ($event['id'] ?? '');
        $secret = is_array($secrets['events'][$eventId] ?? null) ? $secrets['events'][$eventId] : [];
        if (($secret['passwordHash'] ?? '') !== '') {
            upcoming_sql_upsert_creator_secret($eventId, $secret);
            $summary['creatorSecrets']++;
        }

        $emailsByRequestId = [];
        foreach ($secret['requestEmails'] ?? [] as $requestEmail) {
            if (!is_array($requestEmail)) {
                continue;
            }
            $requestId = api_safe_id($requestEmail['requestId'] ?? '', 100);
            $email = upcoming_migration_safe_email($requestEmail['email'] ?? '');
            if ($requestId !== '' && $email !== '') {
                $emailsByRequestId[$requestId] = $email;
            }
        }

        foreach ($event['requests'] ?? [] as $request) {
            if (!is_array($request)) {
                continue;
            }
            $requestId = api_safe_id($request['id'] ?? '', 100);
            $email = $emailsByRequestId[$requestId] ?? '';
            if ($email === '') {
                $summary['requestsSkippedMissingEmail']++;
                continue;
            }
            upcoming_sql_insert_request($eventId, $request, $email);
            $summary['requests']++;
        }
    }

    foreach ($subscriptions['subscriptions'] ?? [] as $subscription) {
        if (!is_array($subscription)) {
            continue;
        }
        upcoming_sql_upsert_subscription($subscription);
        $summary['subscriptions']++;
    }

    $pdo->commit();
} catch (Throwable $exception) {
    $pdo->rollBack();
    fwrite(STDERR, "Migration annulee : {$exception->getMessage()}\n");
    exit(1);
}

echo "Migration evenements JSON -> SQL terminee.\n";
foreach ($summary as $key => $value) {
    echo "- {$key}: {$value}\n";
}
echo "Les fichiers JSON restent en place comme sauvegarde.\n";

function upcoming_read_migration_json(string $path): array
{
    if (!is_file($path)) {
        return ['events' => [], 'subscriptions' => []];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data + ['events' => [], 'subscriptions' => []] : ['events' => [], 'subscriptions' => []];
}

function upcoming_migration_safe_email($value): string
{
    $email = filter_var(trim((string) $value), FILTER_VALIDATE_EMAIL);
    return is_string($email) ? strtolower($email) : '';
}
