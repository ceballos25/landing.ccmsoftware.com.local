<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Controller;

use Ccm\Cinematic\Service\JobQueue;
use Ccm\Cinematic\Service\MetaCapiService;
use Ccm\Cinematic\Service\RateLimiter;
use Ccm\Cinematic\Service\WelcomeEmailService;

final class LeadController
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
        if (!(new RateLimiter())->allow('lead_' . $ip, 5, 3600)) {
            http_response_code(429);
            echo json_encode(['ok' => false, 'error' => 'rate_limited']);
            return;
        }

        $raw = file_get_contents('php://input');
        if (!is_string($raw) || strlen($raw) > 8192) {
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

        $name = trim((string) ($data['name'] ?? ''));
        $email = trim((string) ($data['email'] ?? ''));
        $phone = preg_replace('/\D+/', '', (string) ($data['phone'] ?? '')) ?? '';
        $sessionId = substr(trim((string) ($data['session_id'] ?? '')), 0, 64);

        if (strlen($name) < 2 || strlen($name) > 80) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'invalid_name']);
            return;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'invalid_email']);
            return;
        }
        if (strlen($phone) < 10 || strlen($phone) > 15) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'invalid_phone']);
            return;
        }

        $root = dirname(__DIR__, 2);
        $dir = $root . '/storage/leads';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $lead = [
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
        ];

        // Envío síncrono (como cuando sí llegaban). La cola sola se rompió por permisos/worker.
        $mail = ['welcome' => false, 'notify' => false];
        try {
            $mail = (new WelcomeEmailService())->sendForLead($lead);
        } catch (\Throwable $e) {
            error_log('LeadController mail: ' . $e->getMessage());
        }

        // Reintento en cola si falló alguno (worker en background)
        $queued = false;
        if (!$mail['welcome'] || !$mail['notify']) {
            $queued = (new JobQueue())->push('lead_email', ['lead' => $lead]);
        }

        // CAPI Lead con PII hasheada (EMQ alto) — consent implícito al enviar el formulario
        $capiLead = ['ok' => false, 'skipped' => true];
        try {
            $capiLead = (new MetaCapiService())->send([
                'event_name' => 'Lead',
                'event_id' => 'lead_' . bin2hex(random_bytes(8)),
                'session_id' => $sessionId !== '' ? $sessionId : ('s_' . bin2hex(random_bytes(8))),
                'scene' => 'OFFER',
                'interaction' => 'hire_form',
                'content_name' => 'hire_form',
                'page_url' => (string) (\Ccm\Cinematic\Config\Config::getInstance()->get('APP_URL', '')),
                'external_id' => $sessionId !== '' ? $sessionId : $email,
                'email' => $email,
                'phone' => $phone,
                'name' => $name,
                'value' => (float) \Ccm\Cinematic\Config\Config::getInstance()->getInt('PRICE_COP', 600000),
                'fbp' => isset($_COOKIE['_fbp']) ? (string) $_COOKIE['_fbp'] : '',
                'fbc' => isset($_COOKIE['_fbc']) ? (string) $_COOKIE['_fbc'] : '',
            ], true);
        } catch (\Throwable $e) {
            error_log('LeadController CAPI: ' . $e->getMessage());
        }

        $row = [
            'created_at' => date('c'),
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'session_id' => $sessionId,
            'ip' => $ip,
            'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250),
            'email_welcome' => $mail['welcome'],
            'email_notify' => $mail['notify'],
            'email_queued' => $queued,
            'capi_lead' => !empty($capiLead['ok']),
        ];

        $line = json_encode($row, JSON_UNESCAPED_UNICODE) . PHP_EOL;
        $ok = (bool) @file_put_contents($dir . '/leads.jsonl', $line, FILE_APPEND | LOCK_EX);

        echo json_encode([
            'ok' => $ok,
            'email_sent' => $mail['welcome'] || $mail['notify'],
            'email_welcome' => $mail['welcome'],
            'email_notify' => $mail['notify'],
            'email_queued' => $queued,
            'capi_lead' => $capiLead,
        ]);
    }
}
