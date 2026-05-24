<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function load_dotenv_if_present(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $envPath = __DIR__ . '/../.env';

    if (!is_file($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        error_log('Mailer env error: unable to read .env file.');
        return;
    }

    foreach ($lines as $line) {

        $line = trim($line);
        $line = preg_replace('/^\xEF\xBB\xBF/', '', $line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_starts_with($line, 'export ')) {
            $line = trim(substr($line, 7));
        }

        if (!str_contains($line, '=')) {
            continue;
        }

        [$name, $value] = array_pad(explode('=', $line, 2), 2, '');

        $name = trim($name);
        if (!preg_match('/^[A-Z0-9_]+$/', $name)) {
            continue;
        }

        $value = trim($value, " \t\n\r\0\x0B\"'");

        putenv($name . '=' . $value);

        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

function env_mail(string $key, string $default = ''): string
{
    load_dotenv_if_present();

    $value = getenv($key);

    if (is_string($value) && trim($value) !== '') {
        return trim($value);
    }

    foreach ([$_ENV[$key] ?? null, $_SERVER[$key] ?? null] as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }

    return $default;
}

function site_send_mail(string $to, string $subject, string $message): bool
{
    try {

        $mail = new PHPMailer(true);

        $mail->isSMTP();

        $mail->Host = env_mail('SMTP_HOST', 'smtp.gmail.com');

        $mail->SMTPAuth = true;

        $mail->Username = env_mail('SMTP_USER');

        $mail->Password = env_mail('SMTP_PASSWORD');

        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;

        $mail->Port = (int) env_mail('SMTP_PORT', '587');

        $mail->CharSet = 'UTF-8';

        $from = env_mail('MAIL_FROM', 'genefaluche@gmail.com');

        $mail->setFrom($from, 'GeneFaluche');

        $mail->addAddress($to);

        $mail->Subject = $subject;

        $mail->Body = $message;

        return $mail->send();

    } catch (Exception $exception) {

        error_log('Mailer Error: ' . $exception->getMessage());

        return false;
    }
}
