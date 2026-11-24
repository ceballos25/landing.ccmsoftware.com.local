<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Controller;

use Ccm\Cinematic\Config\Config;

final class ConfigController
{
    public function handle(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
            return;
        }

        $config = Config::getInstance()->publicConfig();
        echo json_encode(['ok' => true, 'config' => $config], JSON_UNESCAPED_UNICODE);
    }
}
