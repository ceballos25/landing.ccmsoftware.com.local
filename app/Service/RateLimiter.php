<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Service;

use Ccm\Cinematic\Config\Config;

final class RateLimiter
{
    public function allow(string $bucket, ?int $limit = null, int $windowSec = 60): bool
    {
        $limit ??= Config::getInstance()->getInt('API_RATE_LIMIT', 60);
        $dir = dirname(__DIR__, 2) . '/storage/sessions';
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }

        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $bucket) ?: 'unknown';
        $file = $dir . '/rate_' . $safe . '.json';
        $now = time();
        $window = max(1, $windowSec);

        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return false;
        }

        try {
            if (!flock($fh, LOCK_EX)) {
                return false;
            }

            rewind($fh);
            $raw = stream_get_contents($fh);
            $data = ['start' => $now, 'count' => 0];
            if (is_string($raw) && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded) && isset($decoded['start'], $decoded['count'])) {
                    $data = $decoded;
                }
            }

            if (($now - (int) $data['start']) >= $window) {
                $data = ['start' => $now, 'count' => 0];
            }

            $data['count'] = (int) $data['count'] + 1;
            $payload = json_encode($data);
            if (!is_string($payload)) {
                return false;
            }

            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, $payload);
            fflush($fh);
            @chmod($file, 0640);

            return $data['count'] <= $limit;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
