<?php
declare(strict_types=1);

require __DIR__ . '/../site-auth.php';
require __DIR__ . '/helpers.php';
if (!defined('FALUCHE_GENEALOGY_LIBRARY_ONLY')) {
    require_site_auth();
}

require __DIR__ . '/config.php';

const PUBLIC_EDITABLE_PEOPLE_SESSION_KEY = 'faluche_public_editable_people';
const MAX_JSON_BODY_BYTES = 8388608;
const MAX_GENEALOGIES = 300;
const MAX_PEOPLE_PER_GENEALOGY = 5000;
const MAX_UPCOMING_EVENTS = 1000;
const MAX_IMAGE_DATA_BYTES = 2097152;
const CURRENT_GENEALOGY_SCHEMA_VERSION = 1;

if (!defined('FALUCHE_GENEALOGY_LIBRARY_ONLY')) {
    site_security_headers();
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!is_file(GENEALOGY_DATA_FILE)) {
            api_respond(empty_genealogy_payload());
        }

        $raw = read_genealogy_file();
        $data = json_decode($raw ?: '[]', true);
        if (!is_array($data) && trim($raw) !== '') {
            api_respond(['error' => 'Donnees temporairement indisponibles.'], 503);
        }
        $payload = migrate_genealogy_payload(is_array($data) ? $data : []);
        if ($payload !== $data) {
            write_genealogy_payload($payload);
        }
        api_respond($payload + ['people' => []]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        require_csrf_token();
        $body = api_read_json_body(MAX_JSON_BODY_BYTES);
        if (!is_array($body)) {
            api_respond(['error' => 'Requete invalide.'], 400);
        }

        $hasGenealogies = isset($body['genealogies']) && is_array($body['genealogies']);
        $hasPeople = isset($body['people']) && is_array($body['people']);
        if (!$hasGenealogies && !$hasPeople) {
            api_respond(['error' => 'Genealogie invalide.'], 400);
        }

        $directory = dirname(GENEALOGY_DATA_FILE);
        if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
            api_respond(['error' => 'Impossible de creer le dossier de donnees.'], 500);
        }
        auth_protect_data_directory($directory);

        $currentBeforeWrite = current_genealogy_payload();
        $adminSession = admin_auth_session();
        if (admin_auth_requires_password_change($adminSession)) {
            api_respond(['error' => 'Change le mot de passe administrateur regional avant de modifier les donnees.'], 403);
        }
        $payload = $hasGenealogies
            ? genealogy_payload_for_write($body, $adminSession)
            : people_payload_for_write($body['people'], $adminSession);

        if (!write_genealogy_payload($payload)) {
            api_respond(['error' => 'Impossible de sauvegarder la genealogie.'], 500);
        }

        genealogy_record_audit_event($currentBeforeWrite, $payload, $body, $adminSession);

        api_respond(['ok' => true, 'count' => $hasGenealogies ? count($body['genealogies']) : count($body['people']), 'state' => is_array($payload) && isset($payload['genealogies']) ? $payload : null]);
    }

    api_respond(['error' => 'Methode non autorisee.'], 405);
}


function write_genealogy_payload($payload): bool
{
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return false;
    }

    $directory = dirname(GENEALOGY_DATA_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
        return false;
    }
    auth_protect_data_directory($directory);

    return api_atomic_json_write(GENEALOGY_DATA_FILE, $json);
}


function read_genealogy_file(): string
{
    if (!is_file(GENEALOGY_DATA_FILE)) {
        return '';
    }

    $handle = fopen(GENEALOGY_DATA_FILE, 'rb');
    if ($handle === false) {
        return '';
    }

    try {
        if (!flock($handle, LOCK_SH)) {
            return '';
        }
        $contents = stream_get_contents($handle);
        flock($handle, LOCK_UN);
        return $contents === false ? '' : $contents;
    } finally {
        fclose($handle);
    }
}

function role_reset_version_from($data): ?int
{
    if (!is_array($data) || !array_key_exists('roleResetVersion', $data)) {
        return null;
    }

    $value = $data['roleResetVersion'];
    if (is_int($value)) {
        return $value;
    }
    if (is_string($value) && ctype_digit($value)) {
        return (int) $value;
    }

    return null;
}

function schema_version_from($data): int
{
    if (!is_array($data)) {
        return 0;
    }
    $value = $data['schemaVersion'] ?? 0;
    return is_int($value) ? $value : (is_string($value) && ctype_digit($value) ? (int) $value : 0);
}

function empty_genealogy_payload(): array
{
    return [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => null,
        'activeGenealogyId' => '',
        'genealogies' => [],
        'upcomingBaptisms' => [],
    ];
}

function migrate_genealogy_payload($data): array
{
    if (!is_array($data)) {
        return empty_genealogy_payload();
    }

    $genealogies = isset($data['genealogies']) && is_array($data['genealogies'])
        ? public_genealogies($data['genealogies'])
        : legacy_people_to_genealogies(is_array($data) ? $data : []);
    $activeGenealogyId = api_safe_id($data['activeGenealogyId'] ?? '', 100);
    if ($activeGenealogyId === '' && count($genealogies) > 0) {
        $activeGenealogyId = (string) ($genealogies[0]['id'] ?? '');
    }

    return [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => role_reset_version_from($data),
        'activeGenealogyId' => $activeGenealogyId,
        'genealogies' => $genealogies,
        'upcomingBaptisms' => public_upcoming_baptisms(is_array($data['upcomingBaptisms'] ?? null) ? $data['upcomingBaptisms'] : []),
    ];
}

function legacy_people_to_genealogies(array $people): array
{
    if (isset($people['genealogies'])) {
        return [];
    }
    $normalisedPeople = strip_person_photos($people);
    if (count($normalisedPeople) === 0) {
        return [];
    }
    return [[
        'id' => 'faluche-nationale',
        'name' => 'Faluche Nationale',
        'type' => 'national',
        'parentId' => '',
        'photoData' => '',
        'people' => $normalisedPeople,
        'customRoles' => [],
        'cooptageRoleId' => '',
    ]];
}

function public_genealogies(array $genealogies): array
{
    $normalised = [];
    $seen = [];
    foreach (array_slice($genealogies, 0, MAX_GENEALOGIES) as $index => $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $hasIdentity = api_safe_id($genealogy['id'] ?? '', 100) !== '' || api_safe_text($genealogy['name'] ?? '', 140) !== '';
        if (!$hasIdentity) {
            continue;
        }
        $item = normalise_genealogy_for_storage($genealogy, $index + 1);
        if ($item['id'] === '' || isset($seen[$item['id']])) {
            continue;
        }
        $seen[$item['id']] = true;
        $normalised[] = $item;
    }
    return $normalised;
}

function strip_person_photos(array $people): array
{
    return normalise_people_for_storage($people);
}

function normalise_genealogy_for_storage($genealogy, int $fallbackIndex = 1): array
{
    $genealogy = is_array($genealogy) ? $genealogy : [];
    $rawName = api_safe_text($genealogy['name'] ?? '', 140);
    $name = $rawName !== '' ? $rawName : 'Genealogie ' . $fallbackIndex;
    $id = api_safe_id($genealogy['id'] ?? $name, 100);
    $type = normalise_genealogy_type($genealogy['type'] ?? ($genealogy['level'] ?? ($genealogy['scope'] ?? '')));

    return [
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'parentId' => $type === 'national' ? '' : api_safe_id($genealogy['parentId'] ?? ($genealogy['regionId'] ?? ''), 100),
        'photoData' => normalise_image_data($genealogy['photoData'] ?? ''),
        'people' => normalise_people_for_storage(is_array($genealogy['people'] ?? null) ? $genealogy['people'] : []),
        'customRoles' => normalise_role_options($genealogy['customRoles'] ?? ($genealogy['roleOptions'] ?? [])),
        'cooptageRoleId' => $type === 'region' ? normalise_role_id($genealogy['cooptageRoleId'] ?? 'tva') : '',
    ];
}

function normalise_people_for_storage(array $people): array
{
    $normalised = [];
    $seen = [];
    foreach (array_slice($people, 0, MAX_PEOPLE_PER_GENEALOGY) as $person) {
        $item = normalise_person_for_storage($person);
        if ($item['id'] === '' || $item['name'] === '' || isset($seen[$item['id']])) {
            continue;
        }
        $seen[$item['id']] = true;
        $normalised[] = $item;
    }
    return $normalised;
}

function normalise_person_for_storage($person): array
{
    $person = is_array($person) ? $person : [];
    $nicknames = normalise_text_list($person['nicknames'] ?? ($person['nickname'] ?? []), 120, 3);
    $ceremonyType = normalise_text($person['ceremonyType'] ?? '');
    if (!in_array($ceremonyType, ['bapteme', 'adoption', 'confirmation'], true)) {
        $ceremonyType = 'bapteme';
    }
    $baptismStatus = ($person['baptismStatus'] ?? '') === 'unbaptized' ? 'unbaptized' : 'unknown';

    return [
        'id' => api_safe_id($person['id'] ?? '', 100),
        'name' => api_safe_text($person['name'] ?? '', 140),
        'nickname' => $nicknames[0] ?? '',
        'nicknames' => array_slice($nicknames, 0, 3),
        'roles' => role_id_array($person['roles'] ?? []),
        'ceremonyType' => $ceremonyType,
        'baptismDate' => normalise_date($person['baptismDate'] ?? ''),
        'baptismCity' => api_safe_text($person['baptismCity'] ?? ($person['ceremonyCity'] ?? ''), 120),
        'baptismStatus' => $baptismStatus,
        'ceremonyEvents' => normalise_ceremony_events($person['ceremonyEvents'] ?? []),
        'song' => api_safe_text($person['song'] ?? '', 500),
        'filiere' => normalise_filiere_id($person['filiere'] ?? ''),
        'createdAt' => normalise_created_at($person['createdAt'] ?? ($person['addedAt'] ?? '')),
        'sponsorIds' => id_array($person['sponsorIds'] ?? []),
        'heartSponsorIds' => id_array($person['heartSponsorIds'] ?? []),
        'crossGroupId' => api_safe_id($person['crossGroupId'] ?? '', 100),
        'crossGroupSize' => normalise_cross_group_size($person['crossGroupSize'] ?? 0),
    ];
}

function normalise_text_list($value, int $maxLength, int $limit): array
{
    $source = is_array($value) ? $value : (is_scalar($value) ? preg_split('/[\n,;]+/', (string) $value) : []);
    $items = [];
    $seen = [];
    foreach ($source ?: [] as $item) {
        $text = api_safe_text($item, $maxLength);
        $key = normalise_text($text);
        if ($text === '' || isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $items[] = $text;
        if (count($items) >= $limit) {
            break;
        }
    }
    return $items;
}

function normalise_role_options($roles): array
{
    if (!is_array($roles)) {
        return [];
    }
    $normalised = [];
    $seen = [];
    foreach (array_slice($roles, 0, 300) as $role) {
        if (!is_array($role)) {
            continue;
        }
        $id = normalise_role_id($role['id'] ?? '');
        $label = api_safe_text($role['label'] ?? '', 100);
        if ($id === '' || $label === '' || isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $aliases = role_id_array($role['aliases'] ?? []);
        $item = ['id' => $id, 'label' => $label];
        if (count($aliases) > 1) {
            $item['aliases'] = array_slice($aliases, 0, 20);
        }
        $normalised[] = $item;
    }
    return $normalised;
}

function normalise_ceremony_events($events): array
{
    if (!is_array($events)) {
        return [];
    }
    $normalised = [];
    foreach (array_slice($events, 0, 20) as $event) {
        if (!is_array($event)) {
            continue;
        }
        $type = normalise_text($event['type'] ?? '');
        if (!in_array($type, ['adoption', 'confirmation'], true)) {
            continue;
        }
        $city = api_safe_text($event['city'] ?? '', 120);
        if ($city === '') {
            continue;
        }
        $normalised[] = [
            'id' => api_safe_id($event['id'] ?? ($type . '-' . bin2hex(random_bytes(4))), 100),
            'type' => $type,
            'city' => $city,
            'nickname' => api_safe_text($event['nickname'] ?? ($event['adoptionNickname'] ?? ($event['confirmationNickname'] ?? '')), 90),
            'sponsorIds' => id_array($event['sponsorIds'] ?? []),
        ];
    }
    return $normalised;
}

function normalise_genealogy_type($value): string
{
    $type = normalise_text($value);
    if (in_array($type, ['national', 'nation'], true)) {
        return 'national';
    }
    if (in_array($type, ['region', 'regional', 'regionale', 'ville', 'city'], true)) {
        return 'region';
    }
    return 'family';
}



function normalise_date($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $date = trim((string) $value);
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : '';
}

function normalise_created_at($value): string
{
    if (!is_scalar($value)) {
        return gmdate('c');
    }
    $createdAt = trim((string) $value);
    return $createdAt !== '' && strtotime($createdAt) !== false ? substr($createdAt, 0, 80) : gmdate('c');
}

function normalise_cross_group_size($value): int
{
    if (!is_scalar($value)) {
        return 0;
    }
    $size = is_int($value) ? $value : (int) $value;
    return $size >= 2 && $size <= 10 ? $size : 0;
}

function normalise_filiere_id($value): string
{
    $id = api_safe_id($value ?? '', 100);
    $aliases = [
        'dentaire' => 'chirurgie-dentaire',
        'carab' => 'medecine',
        'pharma' => 'pharmacie-preparateur-pharmacie',
        'aes' => 'administration-economique-sociale',
        'arts-spectacle-cinema-audiovisuel' => 'architecture-arts',
        'arts-visuels' => 'architecture-arts',
        'bts' => 'but-dut-bts-bachelor',
        'cpge-hypokhagne-khagne' => 'classes-preparatoires',
        'cpge-scientifique' => 'classes-preparatoires',
    ];
    $allowed = [
        'chirurgie-dentaire',
        'etudes-courtes-sante',
        'medecine',
        'osteopathie',
        'paramedical',
        'pharmacie-preparateur-pharmacie',
        'prepas-sante',
        'sage-femme',
        'veterinaire',
        'du',
        'administration-economique-sociale',
        'architecture-arts',
        'classes-preparatoires',
        'communication',
        'droit',
        'ecoles-commerce-gestion-communication-journalisme',
        'ecoles-ingenieurs',
        'ecoles-nationales',
        'meef-1er-degre',
        'meef-2nd-degre',
        'filieres-sportives',
        'but-dut-bts-bachelor',
        'iufp',
        'lettres-langues-sciences-humaines-sociales',
        'musique-musicologie',
        'oenologie',
        'sciences',
        'sciences-economiques-gestion-iae',
        'sciences-politiques',
    ];
    $id = $aliases[$id] ?? $id;
    return in_array($id, $allowed, true) ? $id : '';
}

function normalise_image_data($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $imageData = trim((string) $value);
    if ($imageData === '') {
        return '';
    }
    if (!preg_match('/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+\/=\r\n]+)$/', $imageData, $matches)) {
        return '';
    }
    $binary = base64_decode($matches[2], true);
    if ($binary === false || strlen($binary) > MAX_IMAGE_DATA_BYTES) {
        return '';
    }
    return 'data:image/' . $matches[1] . ';base64,' . base64_encode($binary);
}

function public_upcoming_baptisms(array $events): array
{
    $seen = [];
    $normalised = [];
    foreach (array_slice($events, 0, MAX_UPCOMING_EVENTS) as $event) {
        if (!is_array($event)) {
            continue;
        }
        $id = api_safe_id($event['id'] ?? '', 100);
        $regionId = api_safe_id($event['regionId'] ?? '', 100);
        $dateTime = normalise_datetime_local($event['dateTime'] ?? ($event['date'] ?? ''));
        $eventType = normalise_upcoming_event_type($event['eventType'] ?? ($event['type'] ?? ''));
        $sponsorIds = id_array($event['sponsorIds'] ?? (isset($event['sponsorId']) ? [$event['sponsorId']] : []));
        $fillotIds = id_array($event['fillotIds'] ?? (isset($event['fillotId']) ? [$event['fillotId']] : []));
        $baptizedNames = name_array($event['baptizedNames'] ?? ($event['baptisedNames'] ?? ($event['fillotNames'] ?? [])));
        if ($id === '' || $regionId === '' || $dateTime === '' || !$sponsorIds || (!$fillotIds && !$baptizedNames) || isset($seen[$id])) {
            continue;
        }
        if (upcoming_baptism_expired($dateTime)) {
            continue;
        }
        $seen[$id] = true;
        $normalised[] = [
            'id' => $id,
            'regionId' => $regionId,
            'eventType' => $eventType,
            'sponsorIds' => $sponsorIds,
            'fillotIds' => $fillotIds,
            'baptizedNames' => $baptizedNames,
            'dateTime' => $dateTime,
            'place' => api_safe_text($event['place'] ?? '', 160),
            'message' => api_safe_text($event['message'] ?? '', 600),
            'createdAt' => normalise_created_at($event['createdAt'] ?? gmdate('c')),
            'requests' => public_upcoming_requests(is_array($event['requests'] ?? null) ? $event['requests'] : (is_array($event['responses'] ?? null) ? $event['responses'] : [])),
        ];
    }
    usort($normalised, static function (array $a, array $b): int {
        return strcmp($a['dateTime'], $b['dateTime']) ?: strcmp($a['createdAt'], $b['createdAt']) ?: strcmp($a['id'], $b['id']);
    });
    return $normalised;
}

function public_upcoming_requests(array $requests): array
{
    $byName = [];
    foreach (array_slice($requests, 0, 200) as $request) {
        if (!is_array($request)) {
            continue;
        }
        $name = api_safe_text($request['name'] ?? '', 90);
        $nickname = api_safe_text($request['nickname'] ?? '', 90);
        if ($name === '') {
            continue;
        }
        $key = normalise_text($name . ' ' . $nickname);
        $byName[$key] = [
            'id' => api_safe_id($request['id'] ?? ('demande-' . bin2hex(random_bytes(4))), 100),
            'name' => $name,
            'nickname' => $nickname,
            'createdAt' => normalise_created_at($request['createdAt'] ?? gmdate('c')),
        ];
    }
    $values = array_values($byName);
    usort($values, static function (array $a, array $b): int {
        return strcmp($a['name'], $b['name']);
    });
    return $values;
}

function merge_upcoming_baptisms(array $currentEvents, array $incomingEvents, bool $isAdmin): array
{
    if ($isAdmin) {
        return public_upcoming_baptisms($incomingEvents);
    }

    $byId = [];
    foreach (public_upcoming_baptisms($currentEvents) as $event) {
        $byId[$event['id']] = $event;
    }

    foreach (public_upcoming_baptisms($incomingEvents) as $incoming) {
        if (!isset($byId[$incoming['id']])) {
            $byId[$incoming['id']] = $incoming;
            continue;
        }
        $byId[$incoming['id']]['requests'] = public_upcoming_requests(array_merge(
            $byId[$incoming['id']]['requests'],
            $incoming['requests']
        ));
    }

    return public_upcoming_baptisms(array_values($byId));
}

function id_array($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $ids = [];
    foreach ($value as $item) {
        $id = api_safe_id($item, 100);
        if ($id !== '' && !in_array($id, $ids, true)) {
            $ids[] = $id;
        }
    }
    return $ids;
}

function role_id_array($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $ids = [];
    foreach ($value as $item) {
        $id = normalise_role_id($item);
        if ($id !== '' && !in_array($id, $ids, true)) {
            $ids[] = $id;
        }
    }
    return $ids;
}

function normalise_role_id($value): string
{
    $id = strtolower(api_safe_id($value, 100));
    $id = preg_replace('/[^a-z0-9]+/', '-', $id);
    return trim((string) $id, '-');
}

function name_array($value): array
{
    $source = is_array($value) ? $value : (is_scalar($value) ? preg_split('/[\n,;]+/', (string) $value) : []);
    $byName = [];
    foreach ($source ?: [] as $item) {
        $name = api_safe_text($item, 120);
        if ($name === '') {
            continue;
        }
        $byName[normalise_text($name)] = $name;
    }
    $values = array_values($byName);
    usort($values, static function (string $a, string $b): int {
        return strcmp($a, $b);
    });
    return $values;
}

function normalise_datetime_local($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $raw = trim((string) $value);
    if ($raw === '') {
        return '';
    }
    if (preg_match('/^(\d{4}-\d{2}-\d{2})(?:T|\s)(\d{2}:\d{2})/', $raw, $matches)) {
        return $matches[1] . 'T' . $matches[2];
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
        return $raw . 'T00:00';
    }
    return '';
}

function normalise_upcoming_event_type($value): string
{
    $type = normalise_text($value);
    if ($type === 'cooptage') {
        return 'cooptage';
    }
    if ($type === 'adoption') {
        return 'adoption';
    }
    if ($type === 'confirmation') {
        return 'confirmation';
    }
    return 'bapteme';
}

function upcoming_baptism_expired(string $dateTime): bool
{
    $timestamp = strtotime($dateTime);
    if ($timestamp === false) {
        return false;
    }
    $expiresAt = strtotime(date('Y-m-d 00:00:00', $timestamp) . ' +2 days');
    return $expiresAt !== false && time() >= $expiresAt;
}

function normalise_text($value): string
{
    if (!is_scalar($value)) {
        return '';
    }
    $value = (string) $value;
    $value = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value);
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value);
    return trim((string) preg_replace('/\s+/', ' ', $value));
}

function genealogy_payload_for_write(array $body, ?array $adminSession): array
{
    $current = current_genealogy_payload();
    $incoming = [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => role_reset_version_from($body),
        'activeGenealogyId' => api_safe_id($body['activeGenealogyId'] ?? '', 100),
        'genealogies' => public_genealogies($body['genealogies']),
        'upcomingBaptisms' => public_upcoming_baptisms(is_array($body['upcomingBaptisms'] ?? null) ? $body['upcomingBaptisms'] : []),
    ];

    if (($adminSession['level'] ?? '') === 'general') {
        return $incoming;
    }
    if (($adminSession['level'] ?? '') === 'region') {
        return merge_regional_admin_genealogy_payload($incoming, $current, (string) $adminSession['regionId']);
    }

    $merged = merge_public_genealogy_additions($incoming, $current);
    $merged['upcomingBaptisms'] = merge_upcoming_baptisms(
        public_upcoming_baptisms(is_array($current['upcomingBaptisms'] ?? null) ? $current['upcomingBaptisms'] : []),
        $incoming['upcomingBaptisms'],
        false
    );
    return $merged;
}

function merge_regional_admin_genealogy_payload(array $incoming, array $current, string $regionId): array
{
    $regionId = api_safe_id($regionId, 100);
    if ($regionId === '') {
        return merge_public_genealogy_additions($incoming, $current);
    }

    $currentGenealogies = public_genealogies(is_array($current['genealogies'] ?? null) ? $current['genealogies'] : []);
    $incomingGenealogies = public_genealogies(is_array($incoming['genealogies'] ?? null) ? $incoming['genealogies'] : []);
    $incomingById = [];
    foreach ($incomingGenealogies as $genealogy) {
        if (regional_admin_can_manage_genealogy($genealogy, $regionId)) {
            $incomingById[$genealogy['id']] = $genealogy;
        }
    }

    $mergedGenealogies = [];
    $seen = [];
    foreach ($currentGenealogies as $genealogy) {
        $id = (string) ($genealogy['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $merged = regional_admin_can_manage_genealogy($genealogy, $regionId) && isset($incomingById[$id])
            ? $incomingById[$id]
            : $genealogy;
        $mergedGenealogies[] = $merged;
        $seen[$id] = true;
    }

    foreach ($incomingById as $id => $genealogy) {
        if (!isset($seen[$id])) {
            $mergedGenealogies[] = $genealogy;
            $seen[$id] = true;
        }
    }

    $activeGenealogyId = api_safe_id($current['activeGenealogyId'] ?? '', 100);
    if ($activeGenealogyId === '' || !isset($seen[$activeGenealogyId])) {
        $incomingActiveId = api_safe_id($incoming['activeGenealogyId'] ?? '', 100);
        $activeGenealogyId = isset($seen[$incomingActiveId]) ? $incomingActiveId : ($mergedGenealogies[0]['id'] ?? '');
    }

    return [
        'schemaVersion' => CURRENT_GENEALOGY_SCHEMA_VERSION,
        'roleResetVersion' => role_reset_version_from($current) ?? role_reset_version_from($incoming),
        'activeGenealogyId' => $activeGenealogyId,
        'genealogies' => $mergedGenealogies,
        'upcomingBaptisms' => merge_regional_admin_upcoming_baptisms(
            public_upcoming_baptisms(is_array($current['upcomingBaptisms'] ?? null) ? $current['upcomingBaptisms'] : []),
            public_upcoming_baptisms(is_array($incoming['upcomingBaptisms'] ?? null) ? $incoming['upcomingBaptisms'] : []),
            $regionId
        ),
    ];
}

function regional_admin_can_manage_genealogy(array $genealogy, string $regionId): bool
{
    $id = api_safe_id($genealogy['id'] ?? '', 100);
    $parentId = api_safe_id($genealogy['parentId'] ?? ($genealogy['regionId'] ?? ''), 100);
    return $id === $regionId || $parentId === $regionId;
}

function merge_regional_admin_upcoming_baptisms(array $currentEvents, array $incomingEvents, string $regionId): array
{
    $merged = array_values(array_filter($currentEvents, static function (array $event) use ($regionId): bool {
        return api_safe_id($event['regionId'] ?? '', 100) !== $regionId;
    }));
    foreach ($incomingEvents as $event) {
        if (api_safe_id($event['regionId'] ?? '', 100) === $regionId) {
            $merged[] = $event;
        }
    }
    return public_upcoming_baptisms($merged);
}

function people_payload_for_write(array $people, ?array $adminSession)
{
    $people = strip_person_photos($people);
    if (($adminSession['level'] ?? '') === 'general') {
        return $people;
    }

    $current = current_genealogy_payload();
    if (isset($current['genealogies']) && is_array($current['genealogies']) && count($current['genealogies']) > 0) {
        $incoming = [
            'roleResetVersion' => null,
            'activeGenealogyId' => api_safe_id($current['activeGenealogyId'] ?? '', 100),
            'genealogies' => [
                [
                    'id' => 'faluche-nationale',
                    'people' => $people,
                ],
            ],
        ];
        return merge_public_genealogy_additions($incoming, $current);
    }

    return merge_public_people_for_session('legacy', is_array($current) ? $current : [], $people);
}

function current_genealogy_payload()
{
    if (!is_file(GENEALOGY_DATA_FILE)) {
        return empty_genealogy_payload();
    }

    $raw = read_genealogy_file();
    $data = json_decode($raw ?: '[]', true);
    return migrate_genealogy_payload(is_array($data) ? $data : []);
}

function genealogy_record_audit_event($before, $after, array $body, ?array $adminSession): void
{
    if (!is_array($before) || !is_array($after)) {
        return;
    }
    if (genealogy_audit_hash($before) === genealogy_audit_hash($after)) {
        return;
    }

    $scopeRegionIds = genealogy_audit_scope_region_ids($before, $after, $body, $adminSession);
    $summary = genealogy_audit_summary($before, $after, $scopeRegionIds);
    auth_record_admin_audit_event([
        'summary' => $summary,
        'actorLabel' => genealogy_audit_actor_label($adminSession),
        'scopeRegionIds' => $scopeRegionIds,
    ]);
}

function genealogy_audit_actor_label(?array $adminSession): string
{
    if (($adminSession['level'] ?? '') === 'general') {
        return 'Admin general';
    }
    if (($adminSession['level'] ?? '') === 'region') {
        return 'Admin regional';
    }
    return 'Modification publique';
}

function genealogy_audit_scope_region_ids(array $before, array $after, array $body, ?array $adminSession): array
{
    if (($adminSession['level'] ?? '') === 'region') {
        $regionId = api_safe_id($adminSession['regionId'] ?? '', 100);
        return $regionId !== '' ? [$regionId] : [];
    }

    $changedRegionIds = genealogy_audit_changed_region_ids($before, $after);
    if ($changedRegionIds) {
        return $changedRegionIds;
    }

    $activeGenealogyId = api_safe_id($body['activeGenealogyId'] ?? '', 100);
    $fallbackRegionId = genealogy_audit_region_id_for_genealogy($after, $activeGenealogyId)
        ?? genealogy_audit_region_id_for_genealogy($before, $activeGenealogyId);
    return $fallbackRegionId ? [$fallbackRegionId] : [];
}

function genealogy_audit_changed_region_ids(array $before, array $after): array
{
    $regionIds = array_values(array_unique(array_merge(
        genealogy_audit_region_ids($before),
        genealogy_audit_region_ids($after)
    )));
    return array_values(array_filter($regionIds, static function (string $regionId) use ($before, $after): bool {
        return genealogy_audit_region_hash($before, $regionId) !== genealogy_audit_region_hash($after, $regionId);
    }));
}

function genealogy_audit_region_ids(array $payload): array
{
    return array_values(array_filter(array_map(static function (array $genealogy): string {
        return ($genealogy['type'] ?? '') === 'region' ? (string) ($genealogy['id'] ?? '') : '';
    }, genealogy_audit_genealogies($payload))));
}

function genealogy_audit_region_id_for_genealogy(array $payload, string $genealogyId): ?string
{
    if ($genealogyId === '') {
        return null;
    }
    foreach (genealogy_audit_genealogies($payload) as $genealogy) {
        if (($genealogy['id'] ?? '') !== $genealogyId) {
            continue;
        }
        if (($genealogy['type'] ?? '') === 'region') {
            return (string) $genealogy['id'];
        }
        $parentId = api_safe_id($genealogy['parentId'] ?? '', 100);
        return $parentId !== '' ? $parentId : null;
    }
    return null;
}

function genealogy_audit_genealogies(array $payload): array
{
    return isset($payload['genealogies']) && is_array($payload['genealogies'])
        ? public_genealogies($payload['genealogies'])
        : [];
}

function genealogy_audit_region_hash(array $payload, string $regionId): string
{
    $genealogies = array_values(array_filter(genealogy_audit_genealogies($payload), static function (array $genealogy) use ($regionId): bool {
        return ($genealogy['id'] ?? '') === $regionId || ($genealogy['parentId'] ?? '') === $regionId;
    }));
    $events = array_values(array_filter(
        public_upcoming_baptisms(is_array($payload['upcomingBaptisms'] ?? null) ? $payload['upcomingBaptisms'] : []),
        static fn(array $event): bool => api_safe_id($event['regionId'] ?? '', 100) === $regionId
    ));
    return hash('sha256', json_encode(['genealogies' => $genealogies, 'upcomingBaptisms' => $events], JSON_UNESCAPED_UNICODE) ?: '');
}

function genealogy_audit_hash(array $payload): string
{
    return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE) ?: '');
}

function genealogy_audit_summary(array $before, array $after, array $scopeRegionIds): string
{
    $beforeStats = genealogy_audit_stats($before, $scopeRegionIds);
    $afterStats = genealogy_audit_stats($after, $scopeRegionIds);
    $parts = [];
    $personDelta = $afterStats['people'] - $beforeStats['people'];
    $treeDelta = $afterStats['genealogies'] - $beforeStats['genealogies'];
    $eventDelta = $afterStats['events'] - $beforeStats['events'];
    if ($personDelta !== 0) {
        $parts[] = ($personDelta > 0 ? '+' : '') . $personDelta . ' fiche(s)';
    }
    if ($treeDelta !== 0) {
        $parts[] = ($treeDelta > 0 ? '+' : '') . $treeDelta . ' arbre(s)';
    }
    if ($eventDelta !== 0) {
        $parts[] = ($eventDelta > 0 ? '+' : '') . $eventDelta . ' annonce(s)';
    }
    if (!$parts) {
        $parts[] = 'contenu mis a jour';
    }
    $scopeText = count($scopeRegionIds) > 1 ? count($scopeRegionIds) . ' regions' : (count($scopeRegionIds) === 1 ? '1 region' : 'arbre national');
    return 'Mise a jour ' . $scopeText . ' : ' . implode(', ', $parts);
}

function genealogy_audit_stats(array $payload, array $scopeRegionIds): array
{
    $genealogies = genealogy_audit_genealogies($payload);
    if ($scopeRegionIds) {
        $scope = array_flip($scopeRegionIds);
        $genealogies = array_values(array_filter($genealogies, static function (array $genealogy) use ($scope): bool {
            return isset($scope[(string) ($genealogy['id'] ?? '')]) || isset($scope[(string) ($genealogy['parentId'] ?? '')]);
        }));
    }
    $events = public_upcoming_baptisms(is_array($payload['upcomingBaptisms'] ?? null) ? $payload['upcomingBaptisms'] : []);
    if ($scopeRegionIds) {
        $scope = array_flip($scopeRegionIds);
        $events = array_values(array_filter($events, static fn(array $event): bool => isset($scope[api_safe_id($event['regionId'] ?? '', 100)])));
    }
    return [
        'genealogies' => count($genealogies),
        'people' => array_sum(array_map(static fn(array $genealogy): int => count($genealogy['people'] ?? []), $genealogies)),
        'events' => count($events),
    ];
}

function merge_public_genealogy_additions(array $incoming, ?array $current = null): array
{
    $current = $current ?? current_genealogy_payload();
    if (!isset($current['genealogies']) || !is_array($current['genealogies']) || count($current['genealogies']) === 0) {
        mark_public_payload_people_editable($incoming);
        return $incoming;
    }
    $current['genealogies'] = public_genealogies($current['genealogies']);

    $incomingById = [];
    foreach ($incoming['genealogies'] as $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $id = is_string($genealogy['id'] ?? null) ? $genealogy['id'] : '';
        if ($id !== '') {
            $incomingById[$id] = $genealogy;
        }
    }

    $merged = array_map(static function ($genealogy) use ($incomingById): array {
        $genealogy = is_array($genealogy) ? $genealogy : [];
        unset($genealogy['adminPassword']);
        $id = is_string($genealogy['id'] ?? null) ? $genealogy['id'] : '';
        if ($id === '' || !isset($incomingById[$id]) || !is_array($incomingById[$id]['people'] ?? null)) {
            return $genealogy;
        }
        $genealogy['people'] = merge_public_people_for_session(
            $id,
            is_array($genealogy['people'] ?? null) ? $genealogy['people'] : [],
            $incomingById[$id]['people']
        );
        return $genealogy;
    }, $current['genealogies']);

    return [
        'roleResetVersion' => role_reset_version_from($current) ?? role_reset_version_from($incoming),
        'activeGenealogyId' => api_safe_id($current['activeGenealogyId'] ?? '', 100),
        'genealogies' => $merged,
        'upcomingBaptisms' => public_upcoming_baptisms(is_array($current['upcomingBaptisms'] ?? null) ? $current['upcomingBaptisms'] : []),
    ];
}

function merge_public_people_for_session(string $genealogyId, array $currentPeople, array $incomingPeople): array
{
    $existingIndexes = [];
    $incomingIds = [];
    foreach ($currentPeople as $index => $person) {
        if (is_array($person) && is_string($person['id'] ?? null) && $person['id'] !== '') {
            $existingIndexes[$person['id']] = $index;
        }
    }

    foreach ($incomingPeople as $person) {
        if (!is_array($person)) {
            continue;
        }
        $id = is_string($person['id'] ?? null) ? $person['id'] : '';
        if ($id === '') {
            continue;
        }
        $incomingIds[$id] = true;
        if (!array_key_exists($id, $existingIndexes)) {
            $currentPeople[] = $person;
            $existingIndexes[$id] = count($currentPeople) - 1;
            mark_public_person_editable($genealogyId, $id);
            continue;
        }
        if (public_person_is_editable($genealogyId, $id)) {
            $currentPeople[$existingIndexes[$id]] = $person;
            continue;
        }
        $currentPeople[$existingIndexes[$id]] = public_person_with_allowed_updates(
            is_array($currentPeople[$existingIndexes[$id]]) ? $currentPeople[$existingIndexes[$id]] : [],
            $person
        );
    }

    $deletedEditableIds = [];
    foreach ($existingIndexes as $personId => $_index) {
        if (!isset($incomingIds[$personId]) && public_person_is_editable($genealogyId, $personId)) {
            $deletedEditableIds[$personId] = true;
        }
    }

    if ($deletedEditableIds === []) {
        return $currentPeople;
    }

    return array_values(array_map(
        static function (array $person) use ($deletedEditableIds): array {
            $person['sponsorIds'] = array_values(array_filter(
                is_array($person['sponsorIds'] ?? null) ? $person['sponsorIds'] : [],
                static fn($id): bool => is_string($id) && !isset($deletedEditableIds[$id])
            ));
            $person['heartSponsorIds'] = array_values(array_filter(
                is_array($person['heartSponsorIds'] ?? null) ? $person['heartSponsorIds'] : [],
                static fn($id): bool => is_string($id) && !isset($deletedEditableIds[$id])
            ));
            return $person;
        },
        array_filter(
            $currentPeople,
            static function ($person) use ($deletedEditableIds): bool {
                return !is_array($person)
                    || !is_string($person['id'] ?? null)
                    || !isset($deletedEditableIds[$person['id']]);
            }
        )
    ));
}

function public_person_with_allowed_updates(array $currentPerson, array $incomingPerson): array
{
    $currentEvents = normalise_ceremony_events($currentPerson['ceremonyEvents'] ?? []);
    $incomingEvents = normalise_ceremony_events($incomingPerson['ceremonyEvents'] ?? []);
    $seen = [];
    $seenIds = [];
    foreach ($currentEvents as $event) {
        $seen[ceremony_event_key($event)] = true;
        $eventId = api_safe_id($event['id'] ?? '', 100);
        if ($eventId !== '') {
            $seenIds[$eventId] = true;
        }
    }

    $added = [];
    foreach ($incomingEvents as $event) {
        $key = ceremony_event_key($event);
        $eventId = api_safe_id($event['id'] ?? '', 100);
        if (isset($seen[$key]) || ($eventId !== '' && isset($seenIds[$eventId]))) {
            continue;
        }
        $seen[$key] = true;
        if ($eventId !== '') {
            $seenIds[$eventId] = true;
        }
        $added[] = $event;
    }

    $currentSponsorIds = id_array($currentPerson['sponsorIds'] ?? []);
    $currentHeartSponsorIds = id_array($currentPerson['heartSponsorIds'] ?? []);
    $incomingSponsorIds = id_array($incomingPerson['sponsorIds'] ?? $currentSponsorIds);
    $incomingHeartSponsorIds = id_array($incomingPerson['heartSponsorIds'] ?? []);
    if ($incomingHeartSponsorIds === []) {
        $incomingHeartSponsorIds = $currentHeartSponsorIds;
    }
    $nextSponsorIds = id_array(array_merge($incomingSponsorIds, $incomingHeartSponsorIds));
    $nextHeartSponsorIds = array_values(array_filter(
        $incomingHeartSponsorIds,
        static fn($id): bool => is_string($id) && in_array($id, $nextSponsorIds, true)
    ));

    if (!$added && $nextSponsorIds === $currentSponsorIds && $nextHeartSponsorIds === $currentHeartSponsorIds) {
        return $currentPerson;
    }

    return [
        ...$currentPerson,
        'sponsorIds' => $nextSponsorIds,
        'heartSponsorIds' => $nextHeartSponsorIds,
        'ceremonyEvents' => array_merge($currentEvents, $added),
    ];
}

function public_person_with_appended_ceremonies(array $currentPerson, array $incomingPerson): array
{
    return public_person_with_allowed_updates($currentPerson, $incomingPerson);
}

function ceremony_event_key(array $event): string
{
    $sponsorIds = id_array($event['sponsorIds'] ?? []);
    sort($sponsorIds);
    return json_encode([
        'id' => api_safe_id($event['id'] ?? '', 100),
        'type' => normalise_text($event['type'] ?? ''),
        'city' => api_safe_text($event['city'] ?? '', 120),
        'nickname' => api_safe_text($event['nickname'] ?? '', 90),
        'sponsorIds' => $sponsorIds,
    ], JSON_UNESCAPED_UNICODE) ?: '';
}

function mark_public_payload_people_editable(array $payload): void
{
    if (!is_array($payload['genealogies'] ?? null)) {
        return;
    }
    foreach ($payload['genealogies'] as $genealogy) {
        if (!is_array($genealogy)) {
            continue;
        }
        $genealogyId = is_string($genealogy['id'] ?? null) ? $genealogy['id'] : '';
        if ($genealogyId === '' || !is_array($genealogy['people'] ?? null)) {
            continue;
        }
        foreach ($genealogy['people'] as $person) {
            $personId = is_array($person) && is_string($person['id'] ?? null) ? $person['id'] : '';
            if ($personId !== '') {
                mark_public_person_editable($genealogyId, $personId);
            }
        }
    }
}

function public_person_is_editable(string $genealogyId, string $personId): bool
{
    site_auth_start();
    $editable = is_array($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY] ?? null)
        ? $_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY]
        : [];
    return isset($editable[public_editable_person_key($genealogyId, $personId)]);
}

function mark_public_person_editable(string $genealogyId, string $personId): void
{
    site_auth_start();
    if (!isset($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY]) || !is_array($_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY])) {
        $_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY] = [];
    }
    $_SESSION[PUBLIC_EDITABLE_PEOPLE_SESSION_KEY][public_editable_person_key($genealogyId, $personId)] = time();
}

function public_editable_person_key(string $genealogyId, string $personId): string
{
    return hash('sha256', $genealogyId . ':' . $personId);
}
