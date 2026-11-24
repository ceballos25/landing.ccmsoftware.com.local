<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Controller;

use Ccm\Cinematic\Repository\EventRepository;
use Ccm\Cinematic\Service\JobQueue;
use Ccm\Cinematic\Service\MetaCapiService;

final class TrackController
{
    public function handle(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
            return;
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        if (!(new \Ccm\Cinematic\Service\RateLimiter())->allow('track_' . $ip)) {
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => 'rate_limited']);
            return;
        }

        $raw = file_get_contents('php://input');
        if (!is_string($raw) || strlen($raw) > 16384) {
            http_response_code(413);
            echo json_encode(['ok' => false, 'error' => 'payload_too_large']);
            return;
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_json']);
            return;
        }

        $eventName = trim((string) ($data['event_name'] ?? ''));
        $eventId = trim((string) ($data['event_id'] ?? ''));
        $sessionId = trim((string) ($data['session_id'] ?? ''));

        $capi = new MetaCapiService();
        if ($eventName === '' || !$capi->isAllowed($eventName)) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'invalid_event']);
            return;
        }

        // PageView es Pixel-only: no encolar CAPI
        if ($eventName === 'PageView') {
            echo json_encode(['ok' => true, 'capi' => ['skipped' => true, 'reason' => 'pixel_only']]);
            return;
        }

        if ($eventId === '' || $sessionId === '' || strlen($eventId) > 80 || strlen($sessionId) > 80) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'invalid_ids']);
            return;
        }

        $hasConsent = !empty($data['consent']);
        $payload = [
            'event_id' => $eventId,
            'session_id' => $sessionId,
            'event_name' => $eventName,
            'scene' => substr((string) ($data['scene'] ?? ''), 0, 64),
            'elapsed_ms' => max(0, (int) ($data['elapsed_ms'] ?? 0)),
            'utm' => [
                'source' => substr((string) (($data['utm']['source'] ?? '')), 0, 120),
                'medium' => substr((string) (($data['utm']['medium'] ?? '')), 0, 120),
                'campaign' => substr((string) (($data['utm']['campaign'] ?? '')), 0, 120),
            ],
            'device' => substr((string) ($data['device'] ?? ''), 0, 64),
            'interaction' => substr((string) ($data['interaction'] ?? ''), 0, 120),
            'page_url' => substr((string) ($data['page_url'] ?? ''), 0, 500),
            'external_id' => $sessionId,
            'content_name' => substr((string) ($data['content_name'] ?? ''), 0, 120),
            'fbp' => substr((string) ($data['fbp'] ?? ''), 0, 128),
            'fbc' => substr((string) ($data['fbc'] ?? ''), 0, 256),
            'fbclid' => substr((string) ($data['fbclid'] ?? ''), 0, 256),
            'email' => substr((string) ($data['email'] ?? ''), 0, 120),
            'phone' => substr(preg_replace('/\D+/', '', (string) ($data['phone'] ?? '')) ?? '', 0, 20),
            'name' => substr((string) ($data['name'] ?? ''), 0, 80),
            'value' => isset($data['value']) ? (float) $data['value'] : null,
            'event_time' => time(),
        ];

        $stored = (new EventRepository())->store($payload);

        // Lead / Contact con PII: enviar CAPI en el request (mejor EMQ, sin depender del worker)
        $syncEvents = ['Lead', 'WhatsAppClicked', 'Contact', 'CallAccepted'];
        $capiResult = ['ok' => true, 'queued' => false, 'sync' => false];
        if (in_array($eventName, $syncEvents, true)) {
            $capiResult = $capi->send($payload, $hasConsent);
            $capiResult['sync'] = true;
        } else {
            $queued = (new JobQueue())->push('meta_capi', [
                'event' => $payload,
                'consent' => $hasConsent,
            ]);
            // Fallback sync si la cola no escribe
            if (!$queued) {
                $capiResult = $capi->send($payload, $hasConsent);
                $capiResult['sync'] = true;
            } else {
                $capiResult['queued'] = true;
            }
        }

        echo json_encode([
            'ok' => true,
            'stored' => $stored,
            'capi' => $capiResult,
        ]);
    }
}
