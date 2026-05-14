<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    exit(1);
}

$password = $argv[1] ?? '';
if (!is_string($password) || $password === '') {
    fwrite(STDERR, "Usage: php scripts/hash-password.php \"your password\"\n");
    exit(1);
}

echo password_hash($password, PASSWORD_DEFAULT) . PHP_EOL;
