<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Service;

/**
 * Cola en disco + worker CLI en background (mod_php / prefork safe).
 */
final class JobQueue
{
    private string $dir;
    private string $file;

    public function __construct(?string $root = null)
    {
        $root ??= dirname(__DIR__, 2);
        $this->dir = $root . '/storage/queue';
        $this->file = $this->dir . '/jobs.jsonl';
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function push(string $type, array $payload): bool
    {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0775, true);
        }

        $row = json_encode([
            'id' => bin2hex(random_bytes(8)),
            'type' => $type,
            'payload' => $payload,
            'created_at' => date('c'),
        ], JSON_UNESCAPED_UNICODE);

        if (!is_string($row)) {
            return false;
        }

        // No chmod 0640: Apache (www-data) debe poder seguir escribiendo la cola
        $ok = (bool) @file_put_contents($this->file, $row . PHP_EOL, FILE_APPEND | LOCK_EX);
        if ($ok) {
            $this->spawnWorker();
        }
        return $ok;
    }

    public function spawnWorker(): void
    {
        $root = dirname($this->dir, 2);
        $php = PHP_BINARY ?: 'php';
        $script = $root . '/bin/worker.php';
        $log = $root . '/storage/logs/worker.log';
        if (!is_readable($script)) {
            return;
        }
        $cmd = escapeshellarg($php) . ' ' . escapeshellarg($script)
            . ' >> ' . escapeshellarg($log) . ' 2>&1 &';
        @exec($cmd);
    }
}
