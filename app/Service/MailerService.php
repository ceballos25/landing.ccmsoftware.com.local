<?php

declare(strict_types=1);

namespace Ccm\Cinematic\Service;

use Ccm\Cinematic\Config\Config;
use PHPMailer\PHPMailer\Exception as PhpMailerException;
use PHPMailer\PHPMailer\PHPMailer;
use RuntimeException;
use InvalidArgumentException;

/**
 * Envío SMTP (Gmail) vía PHPMailer — misma config que bingo (.env GMAIL_*).
 */
final class MailerService
{
    /**
     * @param list<array{path:string,cid:string,name?:string,mime?:string}> $embedded
     */
    public function send(
        string $to,
        string $subject,
        string $html,
        string $text = '',
        array $embedded = []
    ): void {
        $cfg = Config::getInstance();
        $user = trim((string) $cfg->get('GMAIL_USER', ''));
        $pass = trim((string) $cfg->get('GMAIL_APP_PASSWORD', ''));
        $from = trim((string) $cfg->get('GMAIL_FROM', $user));
        $fromName = trim((string) $cfg->get('GMAIL_FROM_NAME', 'CCM SOFTWARE_'));

        if ($user === '' || $pass === '') {
            throw new RuntimeException('Falta GMAIL_USER / GMAIL_APP_PASSWORD en .env');
        }

        $to = trim($to);
        if ($to === '' || filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Destinatario inválido');
        }

        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host = (string) $cfg->get('GMAIL_HOST', 'smtp.gmail.com');
            $mail->SMTPAuth = true;
            $mail->Username = $user;
            $mail->Password = $pass;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = (int) ($cfg->get('GMAIL_PORT', '587') ?: 587);
            $mail->CharSet = 'UTF-8';

            $mail->setFrom($from !== '' ? $from : $user, $fromName);
            $mail->addAddress($to);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $html;
            $mail->AltBody = $text !== ''
                ? $text
                : strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $html));

            foreach ($embedded as $item) {
                $path = (string) ($item['path'] ?? '');
                $cid = (string) ($item['cid'] ?? '');
                if ($path === '' || $cid === '' || !is_file($path)) {
                    continue;
                }
                $mail->addEmbeddedImage(
                    $path,
                    $cid,
                    (string) ($item['name'] ?? basename($path)),
                    PHPMailer::ENCODING_BASE64,
                    (string) ($item['mime'] ?? 'image/png')
                );
            }

            $mail->send();
        } catch (PhpMailerException $e) {
            error_log('MailerService: ' . $e->getMessage());
            throw new RuntimeException('No fue posible enviar el correo.');
        }
    }
}
