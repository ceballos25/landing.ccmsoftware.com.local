<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Config;

final class Config
{
    private static ?self $instance = null;

    /** @var array<string, string> */
    private array $values = [];

    private function __construct(string $envPath)
    {
        $this->loadEnv($envPath);
    }

    public static function getInstance(?string $envPath = null): self
    {
        if (self::$instance === null) {
            // Preferir env externo ~/websites/.env-ra (nunca secrets en el repo)
            $candidates = array_values(array_filter([
                $envPath,
                dirname(__DIR__, 3) . '/.env-ra', // ~/websites/.env-ra
                dirname(__DIR__, 2) . '/.env-ra',
            ]));
            $path = null;
            foreach ($candidates as $candidate) {
                if (is_string($candidate) && is_readable($candidate)) {
                    $path = $candidate;
                    break;
                }
            }
            if ($path === null) {
                throw new \RuntimeException('No se encontró ~/websites/.env-ra');
            }
            self::$instance = new self($path);
        }

        return self::$instance;
    }

    public static function reset(): void
    {
        self::$instance = null;
    }

    private function loadEnv(string $path): void
    {
        $example = dirname($path) . '/.env.example';
        if (is_readable($example)) {
            $this->parseFile($example);
        }
        if (is_readable($path)) {
            $this->parseFile($path);
        }
    }

    private function parseFile(string $path): void
    {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }
            $this->values[$key] = $value;
        }
    }

    public function get(string $key, ?string $default = null): ?string
    {
        return $this->values[$key] ?? $default;
    }

    public function getBool(string $key, bool $default = false): bool
    {
        $value = $this->get($key);
        if ($value === null) {
            return $default;
        }
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    public function getInt(string $key, int $default = 0): int
    {
        $value = $this->get($key);
        if ($value === null || $value === '') {
            return $default;
        }
        return (int) $value;
    }

    /**
     * Configuración pública segura para el frontend (sin secretos).
     *
     * @return array<string, mixed>
     */
    public function publicConfig(): array
    {
        $whatsapp = preg_replace('/\D+/', '', (string) $this->get('WHATSAPP_NUMBER', '')) ?? '';
        $price = $this->getInt('PRICE_COP', 600000);

        return [
            'brandName' => $this->get('BRAND_NAME', 'CCM SOFTWARE_'),
            'brandLegal' => $this->get('BRAND_LEGAL', 'CCM SOFTWARE_ S.A.S.'),
            'brandLogo' => '/assets/images/logo-ccm-on-light.png?v=2',
            'priceCop' => $price,
            'priceLabel' => $this->get('PRICE_LABEL', '$600.000 COP / mes'),
            'whatsappConfigured' => $whatsapp !== '',
            'whatsappNumber' => $whatsapp,
            'contactEmail' => $this->get('CONTACT_EMAIL', 'contacto@ccmsoftware.com.co'),
            'contactPhoneDisplay' => $this->get('CONTACT_PHONE_DISPLAY', '+57 323 374 5913'),
            'metaPixelId' => $this->get('META_PIXEL_ID', ''),
            'metaTrackingEnabled' => $this->getBool('META_TRACKING_ENABLED', false),
            'requireConsent' => $this->getBool('REQUIRE_CONSENT', true),
        ];
    }
}
