<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';

function upcoming_sql_pdo(): ?PDO
{
    return database_pdo();
}

function upcoming_sql_available(): bool
{
    return upcoming_sql_pdo() instanceof PDO;
}

function upcoming_sql_events(): array
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return [];
    }

    $events = [];
    $eventRows = $pdo->query('SELECT * FROM events ORDER BY date_time ASC, created_at ASC')->fetchAll();
    $requestRows = $pdo->query('SELECT * FROM event_participation_requests ORDER BY created_at ASC')->fetchAll();
    $requestsByEvent = [];
    foreach ($requestRows as $request) {
        $requestsByEvent[(string) $request['event_id']][] = [
            'id' => (string) $request['id'],
            'name' => (string) $request['name'],
            'nickname' => (string) ($request['nickname'] ?? ''),
            'message' => (string) ($request['message'] ?? ''),
            'status' => (string) $request['status'],
            'createdAt' => (string) $request['created_at'],
        ];
    }

    foreach ($eventRows as $event) {
        $eventId = (string) $event['id'];
        $events[] = [
            'id' => $eventId,
            'regionId' => (string) ($event['region_id'] ?? ''),
            'title' => (string) $event['title'],
            'eventType' => (string) $event['event_type'],
            'sponsorIds' => upcoming_sql_json_array($event['sponsor_ids'] ?? null),
            'fillotIds' => upcoming_sql_json_array($event['fillot_ids'] ?? null),
            'baptizedNames' => upcoming_sql_json_array($event['baptized_names'] ?? null),
            'dateTime' => str_replace(' ', 'T', (string) $event['date_time']),
            'place' => (string) ($event['place'] ?? ''),
            'message' => (string) ($event['message'] ?? ''),
            'creatorName' => (string) ($event['creator_name'] ?? ''),
            'visibility' => (string) ($event['visibility'] ?? 'public'),
            'scope' => (string) ($event['scope'] ?? 'region'),
            'eventUrl' => (string) ($event['event_url'] ?? ''),
            'familyId' => (string) ($event['family_id'] ?? ''),
            'recurrence' => (string) ($event['recurrence'] ?? 'none'),
            'createdAt' => (string) $event['created_at'],
            'requests' => $requestsByEvent[$eventId] ?? [],
        ];
    }

    return function_exists('public_upcoming_baptisms') ? public_upcoming_baptisms($events) : $events;
}

function upcoming_sql_upsert_event(array $event): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }

    $statement = $pdo->prepare(
        'INSERT INTO events
            (id, region_id, title, event_type, date_time, place, message, creator_name, visibility, sponsor_ids, fillot_ids, baptized_names, scope, event_url, family_id, recurrence, created_at, updated_at)
         VALUES
            (:id, :region_id, :title, :event_type, :date_time, :place, :message, :creator_name, :visibility, :sponsor_ids, :fillot_ids, :baptized_names, :scope, :event_url, :family_id, :recurrence, :created_at, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            region_id = VALUES(region_id),
            title = VALUES(title),
            event_type = VALUES(event_type),
            date_time = VALUES(date_time),
            place = VALUES(place),
            message = VALUES(message),
            creator_name = VALUES(creator_name),
            visibility = VALUES(visibility),
            sponsor_ids = VALUES(sponsor_ids),
            fillot_ids = VALUES(fillot_ids),
            baptized_names = VALUES(baptized_names),
            scope = VALUES(scope),
            event_url = VALUES(event_url),
            family_id = VALUES(family_id),
            recurrence = VALUES(recurrence),
            updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        ':id' => (string) ($event['id'] ?? ''),
        ':region_id' => (string) ($event['regionId'] ?? ''),
        ':title' => (string) ($event['title'] ?? ''),
        ':event_type' => (string) ($event['eventType'] ?? 'autre'),
        ':date_time' => upcoming_sql_datetime((string) ($event['dateTime'] ?? '')),
        ':place' => (string) ($event['place'] ?? ''),
        ':message' => (string) ($event['message'] ?? ''),
        ':creator_name' => (string) ($event['creatorName'] ?? ''),
        ':visibility' => (string) ($event['visibility'] ?? 'public'),
        ':sponsor_ids' => upcoming_sql_encode($event['sponsorIds'] ?? []),
        ':fillot_ids' => upcoming_sql_encode($event['fillotIds'] ?? []),
        ':baptized_names' => upcoming_sql_encode($event['baptizedNames'] ?? []),
        ':scope' => (string) ($event['scope'] ?? 'region'),
        ':event_url' => (string) ($event['eventUrl'] ?? ''),
        ':family_id' => (string) ($event['familyId'] ?? ''),
        ':recurrence' => (string) ($event['recurrence'] ?? 'none'),
        ':created_at' => upcoming_sql_datetime((string) ($event['createdAt'] ?? gmdate('c'))),
    ]);
}

function upcoming_sql_upsert_creator_secret(string $eventId, array $secret): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }

    $statement = $pdo->prepare(
        'INSERT INTO event_creator_secrets (event_id, password_hash, creator_email, created_at, updated_at)
         VALUES (:event_id, :password_hash, :creator_email, :created_at, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            password_hash = VALUES(password_hash),
            creator_email = VALUES(creator_email),
            updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        ':event_id' => $eventId,
        ':password_hash' => (string) ($secret['passwordHash'] ?? ''),
        ':creator_email' => (string) ($secret['creatorEmail'] ?? ''),
        ':created_at' => upcoming_sql_datetime((string) ($secret['createdAt'] ?? gmdate('c'))),
    ]);
}

function upcoming_sql_creator_secret(string $eventId): array
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return [];
    }

    $statement = $pdo->prepare('SELECT password_hash, creator_email, created_at FROM event_creator_secrets WHERE event_id = :event_id LIMIT 1');
    $statement->execute([':event_id' => $eventId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        return [];
    }
    return [
        'passwordHash' => (string) ($row['password_hash'] ?? ''),
        'creatorEmail' => (string) ($row['creator_email'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
    ];
}

function upcoming_sql_insert_request(string $eventId, array $request, string $email): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }

    $statement = $pdo->prepare(
        'INSERT INTO event_participation_requests
            (id, event_id, name, nickname, message, status, email_hash, email_encrypted, created_at, updated_at)
         VALUES
            (:id, :event_id, :name, :nickname, :message, :status, :email_hash, :email_encrypted, :created_at, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            nickname = VALUES(nickname),
            message = VALUES(message),
            status = VALUES(status),
            email_encrypted = VALUES(email_encrypted),
            updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        ':id' => (string) ($request['id'] ?? ''),
        ':event_id' => $eventId,
        ':name' => (string) ($request['name'] ?? ''),
        ':nickname' => (string) ($request['nickname'] ?? ''),
        ':message' => (string) ($request['message'] ?? ''),
        ':status' => (string) ($request['status'] ?? 'pending'),
        ':email_hash' => hash('sha256', strtolower($email)),
        ':email_encrypted' => $email,
        ':created_at' => upcoming_sql_datetime((string) ($request['createdAt'] ?? gmdate('c'))),
    ]);
}

function upcoming_sql_update_request_status(string $requestId, string $status): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare('UPDATE event_participation_requests SET status = :status, updated_at = UTC_TIMESTAMP() WHERE id = :id');
    $statement->execute([':status' => $status, ':id' => $requestId]);
}

function upcoming_sql_request_email(string $eventId, string $requestId): string
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return '';
    }
    $statement = $pdo->prepare('SELECT email_encrypted FROM event_participation_requests WHERE event_id = :event_id AND id = :id LIMIT 1');
    $statement->execute([':event_id' => $eventId, ':id' => $requestId]);
    $email = $statement->fetchColumn();
    return is_string($email) ? $email : '';
}

function upcoming_sql_email_already_requested_event(string $eventId, string $emailKey): bool
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return false;
    }
    $statement = $pdo->prepare('SELECT COUNT(*) FROM event_participation_requests WHERE event_id = :event_id AND email_hash = :email_hash');
    $statement->execute([':event_id' => $eventId, ':email_hash' => $emailKey]);
    return (int) $statement->fetchColumn() > 0;
}

function upcoming_sql_upsert_subscription(array $subscription): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare(
        'INSERT INTO event_region_subscriptions (region_id, email_hash, email, created_at, updated_at)
         VALUES (:region_id, :email_hash, :email, :created_at, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE email = VALUES(email), updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        ':region_id' => (string) ($subscription['regionId'] ?? ''),
        ':email_hash' => (string) ($subscription['emailHash'] ?? ''),
        ':email' => (string) ($subscription['email'] ?? ''),
        ':created_at' => upcoming_sql_datetime((string) ($subscription['createdAt'] ?? gmdate('c'))),
    ]);
}

function upcoming_sql_delete_subscription(string $regionId, string $emailHash): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare('DELETE FROM event_region_subscriptions WHERE region_id = :region_id AND email_hash = :email_hash');
    $statement->execute([':region_id' => $regionId, ':email_hash' => $emailHash]);
}

function upcoming_sql_subscribers(string $regionId): array
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return [];
    }
    $statement = $pdo->prepare('SELECT email, email_hash, region_id, created_at FROM event_region_subscriptions WHERE region_id = :region_id');
    $statement->execute([':region_id' => $regionId]);
    return array_map(static function (array $subscription): array {
        return [
            'email' => (string) ($subscription['email'] ?? ''),
            'emailHash' => (string) ($subscription['email_hash'] ?? ''),
            'regionId' => (string) ($subscription['region_id'] ?? ''),
            'createdAt' => (string) ($subscription['created_at'] ?? ''),
        ];
    }, $statement->fetchAll());
}

function upcoming_sql_delete_event(string $eventId): void
{
    $pdo = upcoming_sql_pdo();
    if (!$pdo) {
        return;
    }
    $statement = $pdo->prepare('DELETE FROM events WHERE id = :id');
    $statement->execute([':id' => $eventId]);
}

function upcoming_sql_mirror(callable $callback): void
{
    if (!upcoming_sql_available()) {
        return;
    }
    try {
        $callback();
    } catch (Throwable $exception) {
        error_log('Upcoming SQL mirror error: ' . $exception->getMessage());
    }
}

function upcoming_sql_json_array($value): array
{
    if (!is_string($value) || $value === '') {
        return [];
    }
    $decoded = json_decode($value, true);
    return is_array($decoded) ? array_values($decoded) : [];
}

function upcoming_sql_encode($value): string
{
    $encoded = json_encode(is_array($value) ? array_values($value) : [], JSON_UNESCAPED_UNICODE);
    return is_string($encoded) ? $encoded : '[]';
}

function upcoming_sql_datetime(string $value): string
{
    $timestamp = strtotime($value);
    return $timestamp === false ? gmdate('Y-m-d H:i:s') : gmdate('Y-m-d H:i:s', $timestamp);
}
