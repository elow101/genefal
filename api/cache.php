<?php
declare(strict_types=1);

/**
 * Cache simple avec APCu ou fallback array
 */

function genealogy_cache_key(string $type): string {
    return 'genefaluche_' . $type . '_' . md5(GENEALOGY_DATA_FILE);
}

function genealogy_cache_get(string $key): ?array {
    $fullKey = genealogy_cache_key($key);
    
    // Tentative APCu
    if (function_exists('apcu_fetch')) {
        $value = apcu_fetch($fullKey, $success);
        return $success ? $value : null;
    }
    
    // Fallback: cache statique en mémoire (durée de la requête)
    static $memoryCache = [];
    return $memoryCache[$fullKey] ?? null;
}

function genealogy_cache_set(string $key, array $value, int $ttl = 60): void {
    $fullKey = genealogy_cache_key($key);
    
    if (function_exists('apcu_store')) {
        apcu_store($fullKey, $value, $ttl);
        return;
    }
    
    // Fallback mémoire
    static $memoryCache = [];
    $memoryCache[$fullKey] = $value;
}

function genealogy_cache_clear(): void {
    if (function_exists('apcu_clear_cache')) {
        // Clear only our keys
        $prefix = 'genefaluche_';
        foreach (new APCuIterator('/^' . preg_quote($prefix, '/') . '/') as $entry) {
            apcu_delete($entry['key']);
        }
    }
}
