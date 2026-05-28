<?php
declare(strict_types=1);

define('FALUCHE_GENEALOGY_LIBRARY_ONLY', true);
require __DIR__ . '/genealogy.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/upcoming_sql.php';

const MAX_UPCOMING_BODY_BYTES = 1048576;

require_site_auth();
site_security_headers();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_respond(['error' => 'Methode non autorisee.'], 405);
}

require_csrf_token();
$body = api_read_json_body(MAX_UPCOMING_BODY_BYTES);
if (!is_array($body)) {
    api_respond(['error' => 'Requete invalide.'], 400);
}

$action = api_safe_id($body['action'] ?? '', 60);
if ($action === 'create_event') {
    upcoming_create_event($body);
}
if ($action === 'request_participation') {
    upcoming_request_participation($body);
}
if ($action === 'manage_request') {
    upcoming_manage_request($body);
}
if ($action === 'update_event') {
    upcoming_update_event($body);
}
if ($action === 'delete_event') {
    upcoming_delete_event($body);
}
if ($action === 'creator_access') {
    upcoming_creator_access($body);
}
if ($action === 'subscribe_region') {
    upcoming_subscribe_region($body);
}
if ($action === 'unsubscribe_region') {
    upcoming_unsubscribe_region($body);
}

api_respond(['error' => 'Action inconnue.'], 400);

function upcoming_create_event(array $body): void
{
    $state = current_genealogy_payload();
    $scope = upcoming_normalise_scope($body['scope'] ?? 'region');
    $regionId = api_safe_id($body['regionId'] ?? '', 100);
    $familyId = api_safe_id($body['familyId'] ?? '', 100);

    if ($scope === 'national') {
        $regionId = '';
        $familyId = '';
    } elseif ($scope === 'region') {
        if ($regionId === '' || !upcoming_region_exists($state, $regionId)) {
            api_respond(['error' => 'Region invalide.'], 400);
        }
        $familyId = '';
    } elseif ($scope === 'family') {
        if ($familyId === '' || !upcoming_family_exists($state, $familyId)) {
            api_respond(['error' => 'Famille invalide.'], 400);
        }
        $regionId = upcoming_region_id_for_family($state, $familyId);
    }

    $eventType = normalise_upcoming_event_type($body['eventType'] ?? 'autre');
    $title = api_safe_text($body['title'] ?? '', 140);
    $dateTime = normalise_datetime_local($body['dateTime'] ?? '');
    if ($title === '' || $dateTime === '') {
        api_respond(['error' => 'Titre et date sont obligatoires.'], 400);
    }

    $eventUrl = upcoming_safe_url($body['eventUrl'] ?? '');
    if (($body['eventUrl'] ?? '') !== '' && $eventUrl === '') {
        api_respond(['error' => 'URL invalide.'], 400);
    }

    $creatorEmail = upcoming_safe_email($body['creatorEmail'] ?? '');
    $password = upcoming_temporary_password();
    $event = [
        'id' => api_safe_id(($eventType ?: 'event') . '-' . bin2hex(random_bytes(6)), 100),
        'regionId' => $regionId,
        'title' => $title,
        'eventType' => $eventType,
        'allowParticipation' => upcoming_normalise_allow_participation($eventType, $body['allowParticipation'] ?? false),
        'sponsorIds' => id_array($body['sponsorIds'] ?? []),
        'fillotIds' => id_array($body['fillotIds'] ?? []),
        'baptizedNames' => name_array($body['baptizedNames'] ?? []),
        'dateTime' => $dateTime,
        'place' => api_safe_text($body['place'] ?? '', 160),
        'message' => api_safe_text($body['message'] ?? '', 1200),
        'creatorName' => api_safe_text($body['creatorName'] ?? '', 120),
        'visibility' => upcoming_normalise_visibility($body['visibility'] ?? 'public'),
        'scope' => $scope,
        'eventUrl' => $eventUrl,
        'familyId' => $familyId,
        'recurrence' => upcoming_normalise_recurrence($body['recurrence'] ?? 'none'),
        'createdAt' => gmdate('c'),
        'requests' => [],
    ];

    $events = public_upcoming_baptisms([...(is_array($state['upcomingBaptisms'] ?? null) ? $state['upcomingBaptisms'] : []), $event]);
    if (!array_filter($events, static fn(array $candidate): bool => $candidate['id'] === $event['id'])) {
        api_respond(['error' => 'Evenement invalide.'], 400);
    }
    $state['upcomingBaptisms'] = $events;
    upcoming_write_state($state);

    $secrets = upcoming_read_json(UPCOMING_SECRETS_FILE);
    $secrets['events'][$event['id']] = [
        'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
        'creatorEmail' => $creatorEmail,
        'requestEmails' => [],
        'createdAt' => gmdate('c'),
    ];
    upcoming_write_json(UPCOMING_SECRETS_FILE, $secrets);
    upcoming_sql_mirror(static function () use ($event, $secrets): void {
        upcoming_sql_upsert_event($event);
        upcoming_sql_upsert_creator_secret((string) $event['id'], $secrets['events'][(string) $event['id']]);
    });

    if ($creatorEmail !== '') {
        upcoming_send_mail(
            $creatorEmail,
            'Gestion de votre evenement GeneFaluche',
            "Mot de passe temporaire pour gerer \"{$title}\" : {$password}"
        );
    }
    upcoming_notify_region_subscribers($state, $regionId, $event);

    api_respond(['ok' => true, 'event' => $event, 'state' => $state, 'temporaryPassword' => $password]);
}

function upcoming_request_participation(array $body): void
{
    $eventId = api_safe_id($body['eventId'] ?? '', 100);
    $name = api_safe_text($body['name'] ?? '', 90);
    $email = upcoming_safe_email($body['email'] ?? '');
    if ($eventId === '' || $name === '' || $email === '') {
        api_respond(['error' => 'Nom et email sont obligatoires.'], 400);
    }

    $state = current_genealogy_payload();
    $eventIndex = upcoming_event_index($state, $eventId);
    if ($eventIndex < 0) {
        api_respond(['error' => 'Evenement introuvable.'], 404);
    }
    $event = $state['upcomingBaptisms'][$eventIndex];
    if (!upcoming_can_request_participation($event)) {
        api_respond(['error' => 'Cet evenement ne gere pas les demandes de participation.'], 400);
    }

    $secrets = upcoming_read_json(UPCOMING_SECRETS_FILE);
    $emailKey = hash('sha256', strtolower($email));
    if (
        upcoming_email_already_requested_event($secrets, $eventId, $emailKey)
        || upcoming_sql_email_already_requested_event($eventId, $emailKey)
    ) {
        api_respond(['error' => 'Une demande existe deja pour cet email.'], 409);
    }

    $requestId = api_safe_id('demande-' . bin2hex(random_bytes(6)), 100);
    $request = [
        'id' => $requestId,
        'name' => $name,
        'nickname' => api_safe_text($body['nickname'] ?? '', 90),
        'message' => api_safe_text($body['message'] ?? '', 600),
        'status' => 'pending',
        'createdAt' => gmdate('c'),
    ];
    $state['upcomingBaptisms'][$eventIndex]['requests'][] = $request;
    $state['upcomingBaptisms'] = public_upcoming_baptisms($state['upcomingBaptisms']);
    upcoming_write_state($state);

    $secrets['events'][$eventId]['requestEmails'][] = [
        'requestId' => $requestId,
        'email' => $email,
        'emailHash' => $emailKey,
        'createdAt' => gmdate('c'),
    ];
    upcoming_write_json(UPCOMING_SECRETS_FILE, $secrets);
    upcoming_sql_mirror(static function () use ($eventId, $request, $email): void {
        upcoming_sql_insert_request($eventId, $request, $email);
    });

    api_respond(['ok' => true, 'state' => $state]);
}

function upcoming_manage_request(array $body): void
{
    $eventId = api_safe_id($body['eventId'] ?? '', 100);
    $requestId = api_safe_id($body['requestId'] ?? '', 100);
    $status = normalise_request_status($body['status'] ?? '');
    if ($status === 'pending') {
        api_respond(['error' => 'Statut invalide.'], 400);
    }
    upcoming_require_creator_password($eventId, (string) ($body['password'] ?? ''));

    $state = current_genealogy_payload();
    $eventIndex = upcoming_event_index($state, $eventId);
    if ($eventIndex < 0) {
        api_respond(['error' => 'Evenement introuvable.'], 404);
    }

    $updatedRequest = null;
    foreach ($state['upcomingBaptisms'][$eventIndex]['requests'] as &$request) {
        if (api_safe_id($request['id'] ?? '', 100) === $requestId) {
            $request['status'] = $status;
            $updatedRequest = $request;
            break;
        }
    }
    unset($request);
    if (!$updatedRequest) {
        api_respond(['error' => 'Demande introuvable.'], 404);
    }

    $state['upcomingBaptisms'] = public_upcoming_baptisms($state['upcomingBaptisms']);
    upcoming_write_state($state);
    upcoming_sql_mirror(static function () use ($requestId, $status): void {
        upcoming_sql_update_request_status($requestId, $status);
    });

    $email = upcoming_request_email($eventId, $requestId);
    if ($email !== '') {
        $label = $status === 'accepted' ? 'acceptee' : 'refusee';
        upcoming_send_mail($email, 'Statut de votre demande GeneFaluche', "Votre demande pour l'evenement a ete {$label}.");
    }

    api_respond(['ok' => true, 'state' => $state]);
}

function upcoming_update_event(array $body): void
{
    $eventId = api_safe_id($body['eventId'] ?? '', 100);
    upcoming_require_creator_password($eventId, (string) ($body['password'] ?? ''));

    $state = current_genealogy_payload();
    $eventIndex = upcoming_event_index($state, $eventId);
    if ($eventIndex < 0) {
        api_respond(['error' => 'Evenement introuvable.'], 404);
    }

    $eventType = normalise_upcoming_event_type($state['upcomingBaptisms'][$eventIndex]['eventType'] ?? 'autre');
    $scope = upcoming_normalise_scope($body['scope'] ?? ($state['upcomingBaptisms'][$eventIndex]['scope'] ?? 'region'));
    $regionId = api_safe_id($body['regionId'] ?? ($state['upcomingBaptisms'][$eventIndex]['regionId'] ?? ''), 100);
    $familyId = api_safe_id($body['familyId'] ?? ($state['upcomingBaptisms'][$eventIndex]['familyId'] ?? ''), 100);

    if ($scope === 'national') {
        $regionId = '';
        $familyId = '';
    } elseif ($scope === 'region') {
        if ($regionId === '' || !upcoming_region_exists($state, $regionId)) {
            api_respond(['error' => 'Region invalide.'], 400);
        }
        $familyId = '';
    } elseif ($scope === 'family') {
        if ($familyId === '' || !upcoming_family_exists($state, $familyId)) {
            api_respond(['error' => 'Famille invalide.'], 400);
        }
        $regionId = upcoming_region_id_for_family($state, $familyId);
    }

    $state['upcomingBaptisms'][$eventIndex]['scope'] = $scope;
    $state['upcomingBaptisms'][$eventIndex]['regionId'] = $regionId;
    $state['upcomingBaptisms'][$eventIndex]['familyId'] = $familyId;
    $state['upcomingBaptisms'][$eventIndex]['allowParticipation'] = upcoming_normalise_allow_participation(
        $eventType,
        $body['allowParticipation'] ?? false
    );
    $state['upcomingBaptisms'][$eventIndex]['visibility'] = upcoming_normalise_visibility(
        $body['visibility'] ?? ($state['upcomingBaptisms'][$eventIndex]['visibility'] ?? 'public')
    );
    $eventUrl = upcoming_safe_url($body['eventUrl'] ?? ($state['upcomingBaptisms'][$eventIndex]['eventUrl'] ?? ''));
    if (($body['eventUrl'] ?? '') !== '' && $eventUrl === '') {
        api_respond(['error' => 'URL invalide.'], 400);
    }
    $state['upcomingBaptisms'][$eventIndex]['eventUrl'] = $eventUrl;
    $state['upcomingBaptisms'][$eventIndex]['recurrence'] = upcoming_normalise_recurrence($body['recurrence'] ?? ($state['upcomingBaptisms'][$eventIndex]['recurrence'] ?? 'none'));
    $state['upcomingBaptisms'] = public_upcoming_baptisms($state['upcomingBaptisms']);
    $updatedEvent = $state['upcomingBaptisms'][upcoming_event_index($state, $eventId)] ?? null;
    upcoming_write_state($state);
    if (is_array($updatedEvent)) {
        upcoming_sql_mirror(static function () use ($updatedEvent): void {
            upcoming_sql_upsert_event($updatedEvent);
        });
    }

    api_respond(['ok' => true, 'event' => $updatedEvent, 'state' => $state]);
}

function upcoming_delete_event(array $body): void
{
    $eventId = api_safe_id($body['eventId'] ?? '', 100);
    upcoming_require_creator_password($eventId, (string) ($body['password'] ?? ''));

    $state = current_genealogy_payload();
    $eventIndex = upcoming_event_index($state, $eventId);
    if ($eventIndex < 0) {
        api_respond(['error' => 'Evenement introuvable.'], 404);
    }

    array_splice($state['upcomingBaptisms'], $eventIndex, 1);
    $state['upcomingBaptisms'] = public_upcoming_baptisms($state['upcomingBaptisms']);
    upcoming_write_state($state);

    $secrets = upcoming_read_json(UPCOMING_SECRETS_FILE);
    unset($secrets['events'][$eventId]);
    upcoming_write_json(UPCOMING_SECRETS_FILE, $secrets);
    upcoming_sql_mirror(static function () use ($eventId): void {
        upcoming_sql_delete_event($eventId);
    });

    api_respond(['ok' => true, 'state' => $state]);
}

function upcoming_creator_access(array $body): void
{
    $eventId = api_safe_id($body['eventId'] ?? '', 100);
    upcoming_require_creator_password($eventId, (string) ($body['password'] ?? ''));
    $state = current_genealogy_payload();
    $eventIndex = upcoming_event_index($state, $eventId);
    if ($eventIndex < 0) {
        api_respond(['error' => 'Evenement introuvable.'], 404);
    }
    api_respond(['ok' => true, 'event' => $state['upcomingBaptisms'][$eventIndex]]);
}

function upcoming_subscribe_region(array $body): void
{
    $state = current_genealogy_payload();
    $regionId = api_safe_id($body['regionId'] ?? '', 100);
    $email = upcoming_safe_email($body['email'] ?? '');
    if ($regionId === '' || $email === '' || !upcoming_region_exists($state, $regionId)) {
        api_respond(['error' => 'Email ou region invalide.'], 400);
    }
    $subscriptions = upcoming_read_json(UPCOMING_SUBSCRIPTIONS_FILE);
    $key = hash('sha256', strtolower($email) . '|' . $regionId);
    $subscription = [
        'email' => $email,
        'emailHash' => hash('sha256', strtolower($email)),
        'regionId' => $regionId,
        'createdAt' => $subscriptions['subscriptions'][$key]['createdAt'] ?? gmdate('c'),
    ];
    $subscriptions['subscriptions'][$key] = $subscription;
    upcoming_write_json(UPCOMING_SUBSCRIPTIONS_FILE, $subscriptions);
    upcoming_sql_mirror(static function () use ($subscription): void {
        upcoming_sql_upsert_subscription($subscription);
    });
    upcoming_send_mail($email, 'Abonnement aux evenements GeneFaluche', 'Votre abonnement aux evenements de region est actif.');
    api_respond(['ok' => true]);
}

function upcoming_unsubscribe_region(array $body): void
{
    $regionId = api_safe_id($body['regionId'] ?? '', 100);
    $email = upcoming_safe_email($body['email'] ?? '');
    if ($regionId === '' || $email === '') {
        api_respond(['error' => 'Email ou region invalide.'], 400);
    }
    $subscriptions = upcoming_read_json(UPCOMING_SUBSCRIPTIONS_FILE);
    $key = hash('sha256', strtolower($email) . '|' . $regionId);
    unset($subscriptions['subscriptions'][$key]);
    upcoming_write_json(UPCOMING_SUBSCRIPTIONS_FILE, $subscriptions);
    upcoming_sql_mirror(static function () use ($regionId, $email): void {
        upcoming_sql_delete_subscription($regionId, hash('sha256', strtolower($email)));
    });
    upcoming_send_mail($email, 'Desabonnement GeneFaluche', 'Votre desabonnement aux evenements de region est pris en compte.');
    api_respond(['ok' => true]);
}

function upcoming_require_creator_password(string $eventId, string $password): void
{
    $secrets = upcoming_read_json(UPCOMING_SECRETS_FILE);
    $hash = $secrets['events'][$eventId]['passwordHash'] ?? '';
    if (($eventId === '' || $hash === '') && upcoming_sql_available()) {
        $sqlSecret = upcoming_sql_creator_secret($eventId);
        $hash = $sqlSecret['passwordHash'] ?? '';
    }
    if ($eventId === '' || $hash === '' || !password_verify($password, $hash)) {
        api_respond(['error' => 'Acces createur refuse.'], 403);
    }
}

function upcoming_email_already_requested_event(array $secrets, string $eventId, string $emailKey): bool
{
    $eventRequests = $secrets['events'][$eventId]['requestEmails'] ?? [];
    foreach ($eventRequests as $request) {
        if ((string) ($request['emailHash'] ?? '') === $emailKey) {
            return true;
        }
    }
    return false;
}

function upcoming_write_state(array $state): void
{
    if (!write_genealogy_payload($state)) {
        api_respond(['error' => 'Impossible de sauvegarder les evenements.'], 500);
    }
}

function upcoming_event_index(array $state, string $eventId): int
{
    foreach ($state['upcomingBaptisms'] ?? [] as $index => $event) {
        if (api_safe_id($event['id'] ?? '', 100) === $eventId) {
            return (int) $index;
        }
    }
    return -1;
}

function upcoming_region_exists(array $state, string $regionId): bool
{
    foreach ($state['genealogies'] ?? [] as $genealogy) {
        if (api_safe_id($genealogy['id'] ?? '', 100) === $regionId && ($genealogy['type'] ?? '') === 'region') {
            return true;
        }
    }
    return false;
}

function upcoming_requires_participation(string $eventType): bool
{
    return in_array(normalise_upcoming_event_type($eventType), ['bapteme', 'adoption', 'confirmation'], true);
}

function upcoming_can_request_participation(array $event): bool
{
    $eventType = normalise_upcoming_event_type($event['eventType'] ?? '');
    return upcoming_requires_participation($eventType)
        || ($eventType === 'autre' && ($event['allowParticipation'] ?? false) === true);
}

function upcoming_normalise_allow_participation(string $eventType, $allowParticipation): bool
{
    return normalise_upcoming_event_type($eventType) === 'autre' && $allowParticipation === true;
}

function upcoming_normalise_visibility($visibility): string
{
    $value = api_safe_id($visibility ?? 'public', 40);
    return in_array($value, ['public', 'private', 'family'], true) ? $value : 'public';
}

function upcoming_safe_email($value): string
{
    $email = filter_var(trim((string) $value), FILTER_VALIDATE_EMAIL);
    return is_string($email) ? strtolower($email) : '';
}

function upcoming_temporary_password(): string
{
    return rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
}

function upcoming_request_email(string $eventId, string $requestId): string
{
    $sqlEmail = upcoming_sql_request_email($eventId, $requestId);
    if ($sqlEmail !== '') {
        return upcoming_safe_email($sqlEmail);
    }

    $secrets = upcoming_read_json(UPCOMING_SECRETS_FILE);
    foreach ($secrets['events'][$eventId]['requestEmails'] ?? [] as $request) {
        if (api_safe_id($request['requestId'] ?? '', 100) === $requestId) {
            return upcoming_safe_email($request['email'] ?? '');
        }
    }
    return '';
}

function upcoming_notify_region_subscribers(array $state, string $regionId, array $event): void
{
    $scope = upcoming_normalise_scope($event['scope'] ?? 'region');
    $regionName = upcoming_region_name($state, $regionId);
    $message = upcoming_event_mail_body($event, $regionName);
    if ($scope === 'national') {
        $seen = [];
        foreach ($state['genealogies'] ?? [] as $genealogy) {
            $gid = api_safe_id($genealogy['id'] ?? '', 100);
            if ($gid === '' || ($genealogy['type'] ?? '') !== 'region') {
                continue;
            }
            foreach (upcoming_region_subscribers($gid) as $subscription) {
                $email = upcoming_safe_email($subscription['email'] ?? '');
                if ($email !== '' && !isset($seen[$email])) {
                    $seen[$email] = true;
                    upcoming_send_mail($email, 'Nouvel evenement GeneFaluche : ' . ($event['title'] ?? 'Evenement'), $message);
                }
            }
        }
        return;
    }
    foreach (upcoming_region_subscribers($regionId) as $subscription) {
        $email = upcoming_safe_email($subscription['email'] ?? '');
        if ($email !== '') {
            upcoming_send_mail($email, 'Nouvel evenement GeneFaluche : ' . ($event['title'] ?? 'Evenement'), $message);
        }
    }
}

function upcoming_region_subscribers(string $regionId): array
{
    $subscriptions = upcoming_read_json(UPCOMING_SUBSCRIPTIONS_FILE);
    $byHash = [];
    foreach ($subscriptions['subscriptions'] ?? [] as $subscription) {
        if (api_safe_id($subscription['regionId'] ?? '', 100) !== $regionId) {
            continue;
        }
        $hash = (string) ($subscription['emailHash'] ?? hash('sha256', strtolower((string) ($subscription['email'] ?? ''))));
        $byHash[$hash] = $subscription;
    }

    if (upcoming_sql_available()) {
        foreach (upcoming_sql_subscribers($regionId) as $subscription) {
            $hash = (string) ($subscription['emailHash'] ?? hash('sha256', strtolower((string) ($subscription['email'] ?? ''))));
            $byHash[$hash] = $subscription;
        }
    }

    return array_values($byHash);
}

function upcoming_event_mail_body(array $event, string $regionName): string
{
    $dateParts = upcoming_format_event_datetime((string) ($event['dateTime'] ?? ''));
    $lines = [
        'Nouvel evenement GeneFaluche',
        '',
        'Titre : ' . ($event['title'] ?? 'Evenement'),
        'Type : ' . upcoming_event_type_label((string) ($event['eventType'] ?? 'autre')),
        'Region : ' . ($regionName ?: api_safe_text($event['regionId'] ?? '', 120)),
        'Date : ' . $dateParts['date'],
    ];
    if ($dateParts['time'] !== '') {
        $lines[] = 'Heure : ' . $dateParts['time'];
    }
    if (($event['place'] ?? '') !== '') {
        $lines[] = 'Lieu : ' . $event['place'];
    }
    if (($event['creatorName'] ?? '') !== '') {
        $lines[] = 'Createur : ' . $event['creatorName'];
    }
    if (($event['message'] ?? '') !== '') {
        $lines[] = '';
        $lines[] = 'Description :';
        $lines[] = (string) $event['message'];
    }
    $lines[] = '';
    $lines[] = 'Voir les evenements : ' . upcoming_event_url((string) ($event['id'] ?? ''));
    return implode("\n", $lines);
}

function upcoming_event_url(string $eventId): string
{
    $base = getenv('SITE_URL') ?: '';
    if ($base === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $base = $host !== '' ? $scheme . '://' . $host : '';
    }
    $base = rtrim($base, '/');
    $suffix = '/?view=upcoming&eventId=' . rawurlencode($eventId) . '#event-' . rawurlencode($eventId);
    return $base !== '' ? $base . $suffix : $suffix;
}

function upcoming_format_event_datetime(string $dateTime): array
{
    $timestamp = strtotime($dateTime);
    if ($timestamp === false) {
        return ['date' => $dateTime ?: 'Date a definir', 'time' => ''];
    }
    return [
        'date' => date('d/m/Y', $timestamp),
        'time' => date('H:i', $timestamp),
    ];
}

function upcoming_event_type_label(string $type): string
{
    return match (normalise_upcoming_event_type($type)) {
        'bapteme' => 'Bapteme',
        'adoption' => 'Adoption',
        'confirmation' => 'Confirmation',
        'cooptage' => 'Cooptage',
        default => 'Autre',
    };
}

function upcoming_family_exists(array $state, string $familyId): bool
{
    foreach ($state['genealogies'] ?? [] as $genealogy) {
        if (api_safe_id($genealogy['id'] ?? '', 100) === $familyId && ($genealogy['type'] ?? '') === 'family') {
            return true;
        }
    }
    return false;
}

function upcoming_region_id_for_family(array $state, string $familyId): string
{
    foreach ($state['genealogies'] ?? [] as $genealogy) {
        if (api_safe_id($genealogy['id'] ?? '', 100) === $familyId && ($genealogy['type'] ?? '') === 'family') {
            return api_safe_id($genealogy['parentId'] ?? '', 100);
        }
    }
    return '';
}

function upcoming_region_name(array $state, string $regionId): string
{
    foreach ($state['genealogies'] ?? [] as $genealogy) {
        if (api_safe_id($genealogy['id'] ?? '', 100) === $regionId) {
            return api_safe_text($genealogy['name'] ?? '', 120);
        }
    }
    return '';
}

function upcoming_send_mail(string $to, string $subject, string $message): bool
{
    return site_send_mail($to, $subject, $message);
}
