<?php

declare(strict_types=1);

/**
 * Smoke tests sin navegador: PHP bootstrap, config pública, archivos críticos.
 */

$root = dirname(__DIR__);
$failed = 0;

function assert_true(bool $cond, string $msg): void
{
    global $failed;
    if ($cond) {
        echo "[OK] {$msg}\n";
    } else {
        echo "[FAIL] {$msg}\n";
        $failed++;
    }
}

require_once $root . '/app/Config/bootstrap.php';

use Ccm\Cinematic\Config\Config;
use Ccm\Cinematic\Service\MetaCapiService;

$config = Config::getInstance($root . '/.env');
$public = $config->publicConfig();

assert_true(isset($public['brandName']), 'publicConfig has brandName');
assert_true(isset($public['priceCop']), 'publicConfig has priceCop');
assert_true(array_key_exists('whatsappConfigured', $public), 'whatsappConfigured present');
assert_true(!isset($public['metaCapiToken']), 'CAPI token not in public config');

$capi = new MetaCapiService();
assert_true($capi->isAllowed('ExperienceStarted'), 'custom event allowed');
assert_true($capi->isAllowed('Contact'), 'standard event allowed');
assert_true(!$capi->isAllowed('FakeEvent'), 'invalid event rejected');

$critical = [
    'public/index.php',
    'public/assets/js/app.js',
    'public/assets/js/core/SceneManager.js',
    'public/assets/js/core/AudioManager.js',
    'public/assets/css/base.css',
    'public/assets/audio/sfx/ringtone-snap.mp3',
    'public/assets/audio/voices/cliente-llamada.mp3',
    'public/api/track.php',
    'public/api/config.php',
    'GUIA_GRABACION_VOCES.md',
];

foreach ($critical as $rel) {
    assert_true(is_readable($root . '/' . $rel), "readable: {$rel}");
}

// Simulate track validation path without network
$_SERVER['REQUEST_METHOD'] = 'GET';
ob_start();
require $root . '/public/api/config.php';
$out = ob_get_clean();
$data = json_decode($out, true);
assert_true(is_array($data) && ($data['ok'] ?? false) === true, 'api/config.php returns ok');

echo $failed === 0 ? "\nAll smoke checks passed.\n" : "\n{$failed} check(s) failed.\n";
exit($failed === 0 ? 0 : 1);
