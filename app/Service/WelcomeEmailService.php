<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Service;

use Ccm\Cinematic\Config\Config;

final class WelcomeEmailService
{
    public function __construct(private readonly MailerService $mailer = new MailerService())
    {
    }

    /**
     * @param array{name:string,email:string,phone:string} $lead
     * @return array{welcome:bool,notify:bool}
     */
    public function sendForLead(array $lead): array
    {
        $cfg = Config::getInstance();
        $result = ['welcome' => false, 'notify' => false];

        try {
            $this->mailer->send(
                $lead['email'],
                'Bienvenido a CCM SOFTWARE_ — pronto te llamamos',
                $this->welcomeHtml($lead, $cfg),
                $this->welcomeText($lead, $cfg),
                $this->logoEmbed()
            );
            $result['welcome'] = true;
        } catch (\Throwable $e) {
            error_log('WelcomeEmail (client): ' . $e->getMessage());
        }

        $admin = trim((string) $cfg->get('ADMIN_NOTIFY_EMAIL', $cfg->get('CONTACT_EMAIL', '')));
        if ($admin !== '' && filter_var($admin, FILTER_VALIDATE_EMAIL)) {
            try {
                $this->mailer->send(
                    $admin,
                    'Nuevo lead rifas — ' . $lead['name'],
                    $this->notifyHtml($lead),
                    sprintf(
                        "Nuevo lead\nNombre: %s\nCorreo: %s\nCelular: %s\n",
                        $lead['name'],
                        $lead['email'],
                        $lead['phone']
                    )
                );
                $result['notify'] = true;
            } catch (\Throwable $e) {
                error_log('WelcomeEmail (admin): ' . $e->getMessage());
            }
        }

        return $result;
    }

    private function welcomeHtml(array $lead, Config $cfg): string
    {
        $name = htmlspecialchars($lead['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $brand = htmlspecialchars((string) $cfg->get('BRAND_NAME', 'CCM SOFTWARE_'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $waDisplay = htmlspecialchars((string) $cfg->get('CONTACT_PHONE_DISPLAY', '+57 323 374 5913'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $waNum = preg_replace('/\D+/', '', (string) $cfg->get('WHATSAPP_NUMBER', '573233745913')) ?: '573233745913';
        $email = htmlspecialchars((string) $cfg->get('CONTACT_EMAIL', 'contacto@ccmsoftware.com.co'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $price = htmlspecialchars((string) $cfg->get('PRICE_LABEL', '$600.000 COP / mes'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $waLink = 'https://wa.me/' . $waNum;
        // CID embebido: Gmail no puede cargar APP_URL local (.local)
        $logoSrc = 'cid:ccm-logo';

        return <<<HTML
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <style type="text/css">
    :root { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      .email-body, .email-shell, .email-card, .email-logo-cell {
        background-color: #F4F7FB !important;
        background: #F4F7FB !important;
      }
      .email-logo-cell { background-color: #ffffff !important; background: #ffffff !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
  <table role="presentation" class="email-shell" width="100%" cellspacing="0" cellpadding="0" bgcolor="#F4F7FB" style="background:#F4F7FB;background-color:#F4F7FB;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" class="email-card" width="100%" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.08);">
        <tr>
          <td class="email-logo-cell" bgcolor="#ffffff" align="center" style="padding:28px 32px 20px;text-align:center;background:#ffffff;background-color:#ffffff;border-bottom:1px solid #E2E8F0;">
            <!--[if mso]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:220px;"><v:fill type="frame" src="{$logoSrc}" /><v:textbox inset="0,0,0,0"><![endif]-->
            <img src="{$logoSrc}" alt="{$brand}" width="220" style="max-width:220px;width:220px;height:auto;display:block;margin:0 auto;border:0;outline:none;text-decoration:none;background-color:#ffffff;" />
            <!--[if mso]></v:textbox></v:rect><![endif]-->
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 32px;">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#0F172A;">Hola {$name}, ¡bienvenido!</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              Recibimos tu solicitud para el <strong>sistema de rifas</strong> de {$brand}.
              Pronto te llamaremos para activar tu plataforma y resolver cualquier duda.
            </p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155;">
              Mientras tanto, puedes escribirnos por WhatsApp o correo. Estamos listos para ayudarte a administrar tu rifa con un sistema profesional.
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:.06em;">Plan de interés</p>
            <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0891B2;">{$price}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
              <tr>
                <td style="border-radius:999px;background:#0891B2;">
                  <a href="{$waLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1.2;">Escribir por WhatsApp</a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#475569;">
              WhatsApp: <a href="{$waLink}" style="color:#0891B2;text-decoration:none;">{$waDisplay}</a><br>
              Correo: <a href="mailto:{$email}" style="color:#0891B2;text-decoration:none;">{$email}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 26px;background:#F8FAFC;font-size:12px;color:#94A3B8;text-align:center;">
            {$brand} · Medellín, Colombia · ccmsoftware.com.co
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }

    /**
     * @return list<array{path:string,cid:string,name:string,mime:string}>
     */
    private function logoEmbed(): array
    {
        // logo-ccm-email.png: RGB opaco sobre blanco (no se pierde en dark mode de Mail)
        $candidates = [
            dirname(__DIR__, 2) . '/public/assets/images/logo-ccm-email.png',
            dirname(__DIR__, 2) . '/assets/images/logo-ccm-email.png',
            dirname(__DIR__, 2) . '/public/assets/images/logo-ccm-on-light.png',
            dirname(__DIR__, 2) . '/assets/images/logo-ccm-on-light.png',
        ];
        foreach ($candidates as $path) {
            if (is_file($path)) {
                return [[
                    'path' => $path,
                    'cid' => 'ccm-logo',
                    'name' => 'logo-ccm-email.png',
                    'mime' => 'image/png',
                ]];
            }
        }
        return [];
    }

    private function welcomeText(array $lead, Config $cfg): string
    {
        $waDisplay = (string) $cfg->get('CONTACT_PHONE_DISPLAY', '+57 323 374 5913');
        $email = (string) $cfg->get('CONTACT_EMAIL', 'contacto@ccmsoftware.com.co');
        $brand = (string) $cfg->get('BRAND_NAME', 'CCM SOFTWARE_');

        return "Hola {$lead['name']},\n\n"
            . "Recibimos tu solicitud para el sistema de rifas de {$brand}. "
            . "Pronto te llamaremos para activarlo.\n\n"
            . "WhatsApp: {$waDisplay}\nCorreo: {$email}\n\n"
            . "— {$brand}\n";
    }

    private function notifyHtml(array $lead): string
    {
        $name = htmlspecialchars($lead['name'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $email = htmlspecialchars($lead['email'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $phone = htmlspecialchars($lead['phone'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return <<<HTML
<p><strong>Nuevo lead — sistema de rifas</strong></p>
<ul>
  <li>Nombre: {$name}</li>
  <li>Correo: {$email}</li>
  <li>Celular: {$phone}</li>
</ul>
<p>Llámalo pronto para cerrar la contratación.</p>
HTML;
    }
}
