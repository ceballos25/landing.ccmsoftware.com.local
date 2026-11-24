<?php

declare(strict_types=1);

/**
 * Procesa jobs de mail/CAPI fuera del request Apache (prefork-safe).
 * Uso: php bin/worker.php
 */

$root = dirname(__DIR__);
$lockPath = $root . '/storage/queue/worker.lock';
$queueFile = $root . '/storage/queue/jobs.jsonl';

if (!is_dir(dirname($lockPath))) {
    @mkdir(dirname($lockPath), 0750, true);
}

$lock = @fopen($lockPath, 'c+');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    // Otro worker ya corre
    exit(0);
}

require_once $root . '/app/Config/bootstrap.php';

use Ccm\Cinematic\Service\MetaCapiService;
use Ccm\Cinematic\Service\WelcomeEmailService;

$max = 40;
$processed = 0;

while ($processed < $max) {
    if (!is_readable($queueFile) || filesize($queueFile) === 0) {
        break;
    }

    $fh = fopen($queueFile, 'c+');
    if ($fh === false) {
        break;
    }
    if (!flock($fh, LOCK_EX)) {
        fclose($fh);
        break;
    }

    $raw = stream_get_contents($fh);
    $lines = preg_split("/\r\n|\n|\r/", trim((string) $raw)) ?: [];
    $jobLine = array_shift($lines);
    $rest = $lines ? implode(PHP_EOL, $lines) . PHP_EOL : '';
    ftruncate($fh, 0);
    rewind($fh);
    if ($rest !== '') {
        fwrite($fh, $rest);
    }
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);

    if (!is_string($jobLine) || $jobLine === '') {
        break;
    }

    $job = json_decode($jobLine, true);
    if (!is_array($job) || empty($job['type'])) {
        continue;
    }

    try {
        if ($job['type'] === 'lead_email') {
            $lead = $job['payload']['lead'] ?? null;
            if (is_array($lead)) {
                (new WelcomeEmailService())->sendForLead([
                    'name' => (string) ($lead['name'] ?? ''),
                    'email' => (string) ($lead['email'] ?? ''),
                    'phone' => (string) ($lead['phone'] ?? ''),
                ]);
            }
        } elseif ($job['type'] === 'meta_capi') {
            $payload = $job['payload']['event'] ?? null;
            $consent = !empty($job['payload']['consent']);
            if (is_array($payload)) {
                (new MetaCapiService())->send($payload, $consent);
            }
        }
    } catch (Throwable $e) {
        error_log('[worker] ' . $e->getMessage());
    }

    $processed++;
}

flock($lock, LOCK_UN);
fclose($lock);
exit(0);
