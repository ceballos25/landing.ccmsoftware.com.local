<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Repository;

use Ccm\Cinematic\Service\Database;
use PDO;

final class EventRepository
{
    /**
     * @param array<string, mixed> $payload
     */
    public function store(array $payload): bool
    {
        $pdo = Database::connection();
        if (!$pdo instanceof PDO) {
            return false;
        }

        $sql = 'INSERT INTO experience_events
            (event_id, session_id, event_name, scene, elapsed_ms, utm_source, utm_medium, utm_campaign, device, interaction, payload_json, created_at)
            VALUES
            (:event_id, :session_id, :event_name, :scene, :elapsed_ms, :utm_source, :utm_medium, :utm_campaign, :device, :interaction, :payload_json, NOW())';

        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            ':event_id' => (string) ($payload['event_id'] ?? ''),
            ':session_id' => (string) ($payload['session_id'] ?? ''),
            ':event_name' => (string) ($payload['event_name'] ?? ''),
            ':scene' => (string) ($payload['scene'] ?? ''),
            ':elapsed_ms' => (int) ($payload['elapsed_ms'] ?? 0),
            ':utm_source' => (string) ($payload['utm']['source'] ?? ''),
            ':utm_medium' => (string) ($payload['utm']['medium'] ?? ''),
            ':utm_campaign' => (string) ($payload['utm']['campaign'] ?? ''),
            ':device' => (string) ($payload['device'] ?? ''),
            ':interaction' => (string) ($payload['interaction'] ?? ''),
            ':payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE) ?: '{}',
        ]);
    }
}
