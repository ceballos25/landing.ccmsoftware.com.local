<?php

declare(strict_types=1);

// HTML nunca cacheado: iPhone Safari no debe quedarse con JS viejo
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once dirname(__DIR__) . '/app/Config/bootstrap.php';

use Ccm\Cinematic\Config\Config;

$config = Config::getInstance();
$public = $config->publicConfig();
$brand = htmlspecialchars((string) $public['brandName'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$pixelId = htmlspecialchars((string) ($public['metaPixelId'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$metaEnabled = !empty($public['metaTrackingEnabled']);
$bootJson = json_encode($public, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);

/**
 * Versión automática: max mtime de JS/CSS/SFX. Cambia solo al editar archivos.
 * El cliente descarga módulos nuevos sin borrar caché.
 */
function ccm_asset_version(string $publicDir): string
{
    $max = filemtime(__FILE__) ?: time();
    $roots = [
        $publicDir . '/assets/js',
        $publicDir . '/assets/css',
        $publicDir . '/assets/audio/sfx',
        $publicDir . '/assets/audio/voices',
    ];
    foreach ($roots as $root) {
        if (!is_dir($root)) {
            continue;
        }
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            if ($file->isFile()) {
                $max = max($max, (int) $file->getMTime());
            }
        }
    }

    return base_convert((string) $max, 10, 36);
}

/**
 * Import map: cada /assets/js/*.js → misma URL con ?v=auto
 * Así los import absolutos sin query siempre apuntan a la build actual.
 */
function ccm_js_import_map(string $publicDir, string $v): array
{
    $imports = [];
    $jsRoot = $publicDir . '/assets/js';
    if (!is_dir($jsRoot)) {
        return $imports;
    }
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($jsRoot, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($it as $file) {
        if (!$file->isFile() || strtolower($file->getExtension()) !== 'js') {
            continue;
        }
        $rel = str_replace('\\', '/', substr($file->getPathname(), strlen($jsRoot) + 1));
        $path = '/assets/js/' . $rel;
        $imports[$path] = $path . '?v=' . rawurlencode($v);
    }

    return $imports;
}

$assetV = ccm_asset_version(__DIR__);
$importMap = ccm_js_import_map(__DIR__, $assetV);
$importMapJson = json_encode(
    ['imports' => $importMap],
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);
$assetVAttr = htmlspecialchars($assetV, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

?><!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0891B2">
  <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate">
  <meta name="description" content="Experiencia interactiva de CCM SOFTWARE_ — Deja de administrar tu negocio desde el caos.">
  <meta property="og:title" content="Acabas de perder un cliente · <?= $brand ?>">
  <meta property="og:description" content="Una experiencia cinematográfica sobre lo que ocurre cuando tu negocio depende solo de ti.">
  <meta property="og:type" content="website">
  <title>Acabas de perder un cliente · <?= $brand ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/base.css?v=<?= $assetVAttr ?>">
  <link rel="stylesheet" href="/assets/css/animations.css?v=<?= $assetVAttr ?>">
  <link rel="stylesheet" href="/assets/css/scenes.css?v=<?= $assetVAttr ?>">
  <link rel="preload" href="/assets/js/app.js?v=<?= $assetVAttr ?>" as="script" crossorigin>
  <?php if ($metaEnabled && $pixelId !== ''): ?>
  <script>
    window.__CCM_META_READY__ = false;
    window.__CCM_CONSENT__ = false;
  </script>
  <?php endif; ?>
  <script>
    window.__CCM_BOOT__ = <?= $bootJson ?: '{}' ?>;
    window.__CCM_ASSET_V__ = <?= json_encode($assetV, JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script type="importmap">
  <?= $importMapJson ?: '{"imports":{}}' ?>
  </script>
</head>
<body>
  <div id="film-root" class="film-root" aria-live="polite">
    <div class="film-vignette" aria-hidden="true"></div>
    <div class="film-noise" aria-hidden="true"></div>
    <div id="scene-stage" class="scene-stage"></div>

    <div id="subtitle-bar" class="subtitle-bar" hidden>
      <p id="subtitle-text"></p>
    </div>

    <?php if ($metaEnabled && $pixelId !== ''): ?>
    <div id="consent-banner" class="consent-banner" hidden>
      <p>Usamos analítica y Meta Pixel solo con tu consentimiento para medir el rendimiento de la campaña.</p>
      <div class="consent-actions">
        <button type="button" id="consent-accept" class="consent-btn consent-btn--yes">Aceptar</button>
        <button type="button" id="consent-reject" class="consent-btn">Rechazar</button>
      </div>
    </div>
    <?php endif; ?>

  </div>

  <script type="module" src="/assets/js/app.js?v=<?= $assetVAttr ?>"></script>
</body>
</html>
