<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Service;

use Ccm\Cinematic\Config\Config;

/**
 * Meta Conversions API (server).
 * Pixel browser = solo PageView; conversiones van por aquí.
 *
 * @see https://developers.facebook.com/docs/marketing-api/conversions-api/
 */
final class MetaCapiService
{
    /**
     * Eventos internos → estándar Meta + content_name para optimizar campañas.
     * PageView NO se envía por CAPI (va solo en Pixel).
     *
     * @var array<string, array{name:string, content:string, value?:float}>
     */
    private const EVENT_MAP = [
        'ViewContent' => ['name' => 'ViewContent', 'content' => 'filter_yes'],
        'DecisionSelected' => ['name' => 'ViewContent', 'content' => 'filter_yes'],
        'ExperienceStarted' => ['name' => 'InitiateCheckout', 'content' => 'experience_started'],
        'InitiateCheckout' => ['name' => 'InitiateCheckout', 'content' => 'experience_started'],
        'CallAccepted' => ['name' => 'Contact', 'content' => 'call_accepted'],
        'CallRejected' => ['name' => 'Contact', 'content' => 'call_rejected'],
        'CallCompleted' => ['name' => 'Contact', 'content' => 'call_completed'],
        'ChatCompleted' => ['name' => 'ViewContent', 'content' => 'chat_completed'],
        'ChaosCompleted' => ['name' => 'ViewContent', 'content' => 'chaos_completed'],
        'TransformationViewed' => ['name' => 'ViewContent', 'content' => 'demo_viewed'],
        'OfferViewed' => ['name' => 'ViewContent', 'content' => 'offer_viewed'],
        'ExperienceCompleted' => ['name' => 'ViewContent', 'content' => 'experience_completed'],
        'Lead' => ['name' => 'Lead', 'content' => 'hire_form', 'value' => 600000.0],
        'Contact' => ['name' => 'Contact', 'content' => 'contact'],
        'WhatsAppClicked' => ['name' => 'Contact', 'content' => 'whatsapp_click'],
        // Analytics only (custom) — no optimizar ads con estos
        'ExperienceSkipped' => ['name' => 'ExperienceSkipped', 'content' => 'not_seller'],
    ];

    /** No enviar por CAPI (Pixel-only). */
    private const PIXEL_ONLY = ['PageView'];

    /**
     * @param array<string, mixed> $payload
     * @return array{ok: bool, skipped?: bool, reason?: string, http?: int}
     */
    public function send(array $payload, bool $hasConsent): array
    {
        $config = Config::getInstance();
        if (!$config->getBool('META_TRACKING_ENABLED', false)) {
            return ['ok' => true, 'skipped' => true, 'reason' => 'tracking_disabled'];
        }

        // Solo bloquear si REQUIRE_CONSENT=true Y el visitante rechazó
        if ($config->getBool('REQUIRE_CONSENT', false) && !$hasConsent) {
            return ['ok' => true, 'skipped' => true, 'reason' => 'no_consent'];
        }

        $pixelId = trim((string) $config->get('META_PIXEL_ID', ''));
        $token = trim((string) (
            $config->get('META_CAPI_TOKEN', '')
            ?: $config->get('META_CAPI_ACCESS_TOKEN', '')
        ));
        if ($pixelId === '' || $token === '') {
            return ['ok' => true, 'skipped' => true, 'reason' => 'missing_credentials'];
        }

        $rawName = (string) ($payload['event_name'] ?? '');
        if ($rawName === '' || in_array($rawName, self::PIXEL_ONLY, true)) {
            return ['ok' => true, 'skipped' => true, 'reason' => 'pixel_only_event'];
        }
        if (!$this->isAllowed($rawName)) {
            return ['ok' => false, 'reason' => 'invalid_event'];
        }

        $mapped = self::EVENT_MAP[$rawName];
        $metaName = $mapped['name'];
        $contentName = (string) ($payload['content_name'] ?? $mapped['content']);

        $eventId = (string) ($payload['event_id'] ?? '');
        if ($eventId === '') {
            $eventId = bin2hex(random_bytes(16));
        }

        $eventTime = (int) ($payload['event_time'] ?? time());
        if ($eventTime < 1) {
            $eventTime = time();
        }

        $sourceUrl = (string) ($payload['page_url'] ?? '');
        if ($sourceUrl === '') {
            $sourceUrl = (string) $config->get('APP_URL', '');
        }

        $customData = [
            'content_name' => $contentName,
            'content_category' => (string) ($payload['scene'] ?? 'experience'),
            'currency' => 'COP',
        ];
        if (isset($mapped['value'])) {
            $customData['value'] = (float) ($payload['value'] ?? $mapped['value']);
        }
        if (!empty($payload['interaction'])) {
            $customData['status'] = (string) $payload['interaction'];
        }

        $event = [
            'event_name' => $metaName,
            'event_time' => $eventTime,
            'event_id' => $eventId,
            'action_source' => 'website',
            'event_source_url' => $sourceUrl,
            'user_data' => $this->buildUserData($payload),
            'custom_data' => $customData,
        ];

        $body = [
            'data' => [$event],
        ];
        $testCode = trim((string) $config->get('META_CAPI_TEST_CODE', ''));
        if ($testCode !== '') {
            $body['test_event_code'] = $testCode;
        }

        $version = trim((string) $config->get('META_GRAPH_API_VERSION', 'v25.0')) ?: 'v25.0';
        if (!str_starts_with($version, 'v')) {
            $version = 'v' . $version;
        }

        // access_token en query (patrón oficial); no loguear URL completa
        $url = sprintf(
            'https://graph.facebook.com/%s/%s/events?access_token=%s',
            rawurlencode($version),
            rawurlencode($pixelId),
            rawurlencode($token)
        );

        $json = json_encode($body, JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return ['ok' => false, 'reason' => 'json_error'];
        }

        $ch = curl_init($url);
        if ($ch === false) {
            return ['ok' => false, 'reason' => 'curl_init_failed'];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        $ok = $http >= 200 && $http < 300;
        if (!$ok) {
            error_log('[MetaCAPI] http=' . $http . ' body=' . substr((string) $response, 0, 300) . ' curl=' . $err);
        }

        return [
            'ok' => $ok,
            'http' => $http,
            'skipped' => false,
            'reason' => $ok ? 'sent' : substr((string) $response, 0, 200),
        ];
    }

    public function isAllowed(string $eventName): bool
    {
        if (in_array($eventName, self::PIXEL_ONLY, true)) {
            return true; // válido en track, pero CAPI lo salta
        }
        return isset(self::EVENT_MAP[$eventName]);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function buildUserData(array $payload): array
    {
        $data = [];

        $ip = $this->clientIp();
        $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        if ($ip !== '') {
            $data['client_ip_address'] = $ip;
        }
        if ($ua !== '') {
            $data['client_user_agent'] = $ua;
        }

        $fbp = $payload['fbp'] ?? ($_COOKIE['_fbp'] ?? null);
        $fbc = $payload['fbc'] ?? ($_COOKIE['_fbc'] ?? null);
        if ((!is_string($fbc) || $fbc === '') && !empty($payload['fbclid'])) {
            $fbc = $this->formatFbc((string) $payload['fbclid']);
        }
        if (is_string($fbp) && $fbp !== '') {
            $data['fbp'] = $fbp;
        }
        if (is_string($fbc) && $fbc !== '') {
            $data['fbc'] = $fbc;
        }

        $externalId = (string) ($payload['external_id'] ?? $payload['session_id'] ?? '');
        if ($externalId !== '') {
            $data['external_id'] = [$this->hash($externalId)];
        }

        if (!empty($payload['email'])) {
            $em = $this->normalizeEmail((string) $payload['email']);
            if ($em !== '') {
                $data['em'] = [$this->hash($em)];
            }
        }
        if (!empty($payload['phone'])) {
            $ph = $this->normalizePhone((string) $payload['phone']);
            if ($ph !== '') {
                $data['ph'] = [$this->hash($ph)];
            }
        }
        if (!empty($payload['first_name']) || !empty($payload['name'])) {
            $fn = $this->normalizeName((string) ($payload['first_name'] ?? $this->firstName((string) $payload['name'])));
            if ($fn !== '') {
                $data['fn'] = [$this->hash($fn)];
            }
        }
        if (!empty($payload['last_name']) || !empty($payload['name'])) {
            $ln = $this->normalizeName((string) ($payload['last_name'] ?? $this->lastName((string) ($payload['name'] ?? ''))));
            if ($ln !== '') {
                $data['ln'] = [$this->hash($ln)];
            }
        }

        // Colombia matching
        $data['country'] = [$this->hash('co')];

        return $data;
    }

    private function clientIp(): string
    {
        $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if (is_string($xff) && $xff !== '') {
            $parts = array_map('trim', explode(',', $xff));
            if ($parts[0] !== '' && filter_var($parts[0], FILTER_VALIDATE_IP)) {
                return $parts[0];
            }
        }
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
    }

    private function formatFbc(string $fbclid): string
    {
        $fbclid = trim($fbclid);
        if ($fbclid === '') {
            return '';
        }
        return 'fb.1.' . (int) round(microtime(true) * 1000) . '.' . $fbclid;
    }

    private function hash(string $value): string
    {
        return hash('sha256', $value);
    }

    private function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return '';
        }
        // Colombia: asegurar código país 57
        if (str_starts_with($digits, '57') && strlen($digits) >= 12) {
            return $digits;
        }
        if (strlen($digits) === 10) {
            return '57' . $digits;
        }
        return $digits;
    }

    private function normalizeName(string $name): string
    {
        $name = strtolower(trim($name));
        $name = preg_replace('/\s+/', '', $name) ?? '';
        return $name;
    }

    private function firstName(string $full): string
    {
        $parts = preg_split('/\s+/', trim($full)) ?: [];
        return (string) ($parts[0] ?? '');
    }

    private function lastName(string $full): string
    {
        $parts = preg_split('/\s+/', trim($full)) ?: [];
        if (count($parts) < 2) {
            return '';
        }
        return (string) $parts[count($parts) - 1];
    }
}
