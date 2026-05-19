<?php
declare(strict_types=1);

define('FALUCHE_GENEALOGY_LIBRARY_ONLY', true);
require __DIR__ . '/../api/genealogy.php';

function assert_same($expected, $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $label . PHP_EOL);
        fwrite(STDERR, 'Expected: ' . var_export($expected, true) . PHP_EOL);
        fwrite(STDERR, 'Actual:   ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

function genealogy_by_id(array $payload, string $id): array
{
    foreach ($payload['genealogies'] as $genealogy) {
        if (($genealogy['id'] ?? '') === $id) {
            return $genealogy;
        }
    }
    return [];
}

function event_by_id(array $payload, string $id): array
{
    foreach ($payload['upcomingBaptisms'] as $event) {
        if (($event['id'] ?? '') === $id) {
            return $event;
        }
    }
    return [];
}

$legacyMigrated = migrate_genealogy_payload([
    ['id' => 'legacy-a', 'name' => 'Legacy A'],
]);
assert_same(CURRENT_GENEALOGY_SCHEMA_VERSION, $legacyMigrated['schemaVersion'], 'legacy payload is migrated to current schema');
assert_same('faluche-nationale', $legacyMigrated['activeGenealogyId'], 'legacy payload gets a national active genealogy');
assert_same('legacy-a', $legacyMigrated['genealogies'][0]['people'][0]['id'], 'legacy people are preserved during migration');

$legacyTreesMigrated = migrate_genealogy_payload([
    'activeGenealogyId' => 'kfetteria',
    'genealogies' => [
        [
            'id' => 'kfetteria',
            'name' => "Descendance de la K'fetteria",
            'people' => [['id' => 'regional-person', 'name' => 'Regional Person', 'filiere' => 'carab']],
        ],
        [
            'id' => 'family-a',
            'name' => 'Famille A',
            'people' => [['id' => 'family-person', 'name' => 'Family Person', 'filiere' => 'dentaire']],
        ],
    ],
]);
assert_same(['national', 'region', 'family'], array_map(static function (array $genealogy): string {
    return (string) ($genealogy['type'] ?? '');
}, $legacyTreesMigrated['genealogies']), 'legacy multi-tree payload gets national, region and family levels');
assert_same('regional-person', $legacyTreesMigrated['genealogies'][1]['people'][0]['id'], 'legacy regional people are preserved');
assert_same('family-person', $legacyTreesMigrated['genealogies'][2]['people'][0]['id'], 'legacy family people are preserved');
assert_same('medecine', $legacyTreesMigrated['genealogies'][1]['people'][0]['filiere'], 'legacy filiere aliases are mapped during migration');
assert_same('chirurgie-dentaire', $legacyTreesMigrated['genealogies'][2]['people'][0]['filiere'], 'legacy dentaire alias is mapped during migration');

$public = public_genealogies([
    [
        'id' => 'region-a',
        'name' => 'Region A',
        'type' => 'region',
        'adminPassword' => 'secret',
        'cooptageRoleId' => 'tva',
        'people' => [
            [
                'id' => 'person-a',
                'name' => 'Alice',
                'nickname' => "Ali\nAli;A",
                'roles' => ['TVA', 'TVA'],
                'photoData' => 'data:image/png;base64,AAAA',
                'baptismDate' => '2026-05-13',
                'crossGroupSize' => 20,
                'ceremonyEvents' => [
                    ['id' => 'adoption-a', 'type' => 'adoption', 'city' => 'Amiens', 'nickname' => 'Adoptee'],
                ],
            ],
        ],
    ],
    ['id' => 'region-a', 'name' => 'Duplicate', 'type' => 'region'],
    ['id' => '', 'name' => '', 'people' => []],
]);

assert_same(1, count($public), 'public_genealogies deduplicates and removes empty rows');
assert_same(false, array_key_exists('adminPassword', $public[0]), 'public_genealogies strips admin password');
assert_same('tva', $public[0]['cooptageRoleId'], 'public_genealogies keeps regional cooptage role');
assert_same(false, array_key_exists('photoData', $public[0]['people'][0]), 'public_genealogies strips person photos');
assert_same(['tva'], $public[0]['people'][0]['roles'], 'public_genealogies normalises duplicate roles');
assert_same(0, $public[0]['people'][0]['crossGroupSize'], 'public_genealogies rejects invalid cross-group size');
assert_same('Adoptee', $public[0]['people'][0]['ceremonyEvents'][0]['nickname'], 'public_genealogies keeps adoption nickname');

$current = [
    'roleResetVersion' => 1,
    'activeGenealogyId' => 'region-b',
    'genealogies' => [
        ['id' => 'faluche-nationale', 'name' => 'National', 'type' => 'national', 'people' => []],
        ['id' => 'region-a', 'name' => 'Region A', 'type' => 'region', 'people' => [['id' => 'a1', 'name' => 'A1']]],
        ['id' => 'family-a', 'name' => 'Famille A', 'type' => 'family', 'parentId' => 'region-a', 'people' => [['id' => 'fa1', 'name' => 'FA1']]],
        ['id' => 'region-b', 'name' => 'Region B', 'type' => 'region', 'people' => [['id' => 'b1', 'name' => 'B1']]],
    ],
    'upcomingBaptisms' => [
        [
            'id' => 'event-a',
            'regionId' => 'region-a',
            'eventType' => 'bapteme',
            'sponsorIds' => ['a1'],
            'baptizedNames' => ['Avant'],
            'dateTime' => '2099-01-01T18:30',
        ],
        [
            'id' => 'event-b',
            'regionId' => 'region-b',
            'eventType' => 'bapteme',
            'sponsorIds' => ['b1'],
            'baptizedNames' => ['B'],
            'dateTime' => '2099-01-02T18:30',
        ],
    ],
];

$incoming = [
    'roleResetVersion' => 2,
    'activeGenealogyId' => 'region-a',
    'genealogies' => [
        ['id' => 'region-a', 'name' => 'Region A modifiee', 'type' => 'region', 'people' => [['id' => 'a2', 'name' => 'A2']]],
        ['id' => 'family-a', 'name' => 'Famille A modifiee', 'type' => 'family', 'parentId' => 'region-a', 'people' => [['id' => 'fa2', 'name' => 'FA2']]],
        ['id' => 'region-b', 'name' => 'Region B piratee', 'type' => 'region', 'people' => [['id' => 'b2', 'name' => 'B2']]],
    ],
    'upcomingBaptisms' => [
        [
            'id' => 'event-a',
            'regionId' => 'region-a',
            'eventType' => 'cooptage',
            'sponsorIds' => ['a2'],
            'baptizedNames' => ['Apres'],
            'dateTime' => '2099-01-03T18:30',
        ],
        [
            'id' => 'event-b',
            'regionId' => 'region-b',
            'eventType' => 'cooptage',
            'sponsorIds' => ['b2'],
            'baptizedNames' => ['B pirate'],
            'dateTime' => '2099-01-04T18:30',
        ],
    ],
];

$merged = merge_regional_admin_genealogy_payload($incoming, $current, 'region-a');

assert_same(CURRENT_GENEALOGY_SCHEMA_VERSION, $merged['schemaVersion'], 'regional merge emits current schema version');
assert_same('Region A modifiee', genealogy_by_id($merged, 'region-a')['name'], 'regional admin can update own region');
assert_same('Famille A modifiee', genealogy_by_id($merged, 'family-a')['name'], 'regional admin can update family under own region');
assert_same('Region B', genealogy_by_id($merged, 'region-b')['name'], 'regional admin cannot update another region');
assert_same('cooptage', event_by_id($merged, 'event-a')['eventType'], 'regional admin can replace own event list');
assert_same('bapteme', event_by_id($merged, 'event-b')['eventType'], 'regional admin cannot replace another region event');
assert_same(1, $merged['roleResetVersion'], 'regional merge keeps current role reset version');

$publicAppend = public_person_with_allowed_updates(
    [
        'id' => 'person-a',
        'name' => 'Alice',
        'roles' => ['tva'],
        'sponsorIds' => ['old-sponsor'],
        'heartSponsorIds' => ['heart-sponsor'],
        'ceremonyEvents' => [
            ['id' => 'adoption-1', 'type' => 'adoption', 'city' => 'Amiens', 'nickname' => 'Adoptee', 'sponsorIds' => ['sponsor-a']],
        ],
    ],
    [
        'id' => 'person-a',
        'name' => 'Alice modifiee',
        'roles' => ['admin'],
        'sponsorIds' => ['new-sponsor'],
        'heartSponsorIds' => [],
        'ceremonyEvents' => [
            ['id' => 'adoption-1', 'type' => 'adoption', 'city' => 'Amiens', 'nickname' => 'Adoptee modifiee', 'sponsorIds' => ['sponsor-a']],
            ['id' => 'confirmation-1', 'type' => 'confirmation', 'city' => 'Tours', 'nickname' => 'Confirmee', 'sponsorIds' => ['sponsor-b'], 'heartSponsorIds' => ['heart-b']],
        ],
    ]
);

assert_same('Alice', $publicAppend['name'], 'public append keeps existing person fields');
assert_same(['tva'], $publicAppend['roles'], 'public append does not replace existing roles');
assert_same(['old-sponsor', 'new-sponsor', 'heart-sponsor'], $publicAppend['sponsorIds'], 'public append only adds classic sponsors and preserves existing sponsors');
assert_same(['heart-sponsor'], $publicAppend['heartSponsorIds'], 'public append preserves heart sponsors');
assert_same(2, count($publicAppend['ceremonyEvents']), 'public append adds only new ceremony events');
assert_same('Adoptee', $publicAppend['ceremonyEvents'][0]['nickname'], 'public append does not modify existing ceremony nickname');
assert_same('confirmation', $publicAppend['ceremonyEvents'][1]['type'], 'public append preserves new ceremony type');
assert_same('Confirmee', $publicAppend['ceremonyEvents'][1]['nickname'], 'public append preserves adoption or confirmation nickname');
assert_same(['heart-b'], $publicAppend['ceremonyEvents'][1]['heartSponsorIds'], 'public append preserves ceremony heart sponsors');

echo "genealogy-server: ok\n";
