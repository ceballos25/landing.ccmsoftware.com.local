<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Service;

use Ccm\Cinematic\Config\Config;
use PDO;
use PDOException;

final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): ?PDO
    {
        $config = Config::getInstance();
        if (!$config->getBool('DB_ENABLED', false)) {
            return null;
        }

        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = $config->get('DB_HOST', '127.0.0.1');
        $port = $config->get('DB_PORT', '3306');
        $name = $config->get('DB_NAME', 'ccm_cinematic');
        $user = $config->get('DB_USER', '');
        $pass = $config->get('DB_PASS', '');

        if ($user === '' || $name === '') {
            return null;
        }

        try {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException) {
            return null;
        }

        return self::$pdo;
    }
}
