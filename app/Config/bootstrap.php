<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2); // project root (app/Config → ../..)

spl_autoload_register(static function (string $class) use ($root): void {
    $prefix = 'Ccm\\Cinematic\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = $root . '/app/' . $relative . '.php';
    if (is_readable($file)) {
        require_once $file;
    }
});

if (is_readable($root . '/vendor/autoload.php')) {
    require_once $root . '/vendor/autoload.php';
}

use Ccm\Cinematic\Config\Config;

// Secrets FUERA del repo (mismo patrón que bingo .env-bi):
//   ~/websites/.env-ra
$envCandidates = [
    dirname($root) . '/.env-ra',
    $root . '/.env-ra',
    // fallback legacy (no recomendado)
    $root . '/.env',
];
$envPath = null;
foreach ($envCandidates as $candidate) {
    if (is_file($candidate) && is_readable($candidate)) {
        $envPath = $candidate;
        break;
    }
}
if ($envPath === null) {
    throw new RuntimeException(
        'No se encontró ~/websites/.env-ra. Crea ese archivo fuera del proyecto (no uses .env dentro del repo).'
    );
}
Config::getInstance($envPath);

header_remove('X-Powered-By');
