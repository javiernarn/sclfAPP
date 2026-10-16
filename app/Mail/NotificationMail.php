<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Email copy of an in-app SclfNotification. Same shape/pattern as
 * PasswordResetMail (constructor props -> build() -> matching blade view)
 * — only sent for notifications SclfNotification::via() has already
 * decided belong to a Student or Instructor (see that class for the role
 * check and the badge/tone + login-redirect-URL it builds for us).
 */
class NotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    /** Accent color per badge tone — keys match SclfNotification::META. */
    public const TONES = [
        'success' => ['bg' => '#eff6ff', 'border' => '#2563eb', 'text' => '#1d4ed8'],
        'warning' => ['bg' => '#eff6ff', 'border' => '#2563eb', 'text' => '#1d4ed8'],
        'danger'  => ['bg' => '#eff6ff', 'border' => '#2563eb', 'text' => '#1d4ed8'],
        'info'    => ['bg' => '#eff6ff', 'border' => '#2563eb', 'text' => '#1d4ed8'],
    ];

    public $fullName;
    public $notifTitle;
    public $body;
    public $badge;
    public $tone;
    public $actionUrl;
    public $userEmail;

    public function __construct(
        string $fullName,
        string $title,
        string $body,
        string $badge,
        string $tone,
        string $actionUrl,
        string $userEmail,
    ) {
        $this->fullName = $fullName;
        $this->notifTitle = $title;
        $this->body = $body;
        $this->badge = $badge;
        $this->tone = self::TONES[$tone] ?? self::TONES['info'];
        $this->actionUrl = $actionUrl;
        $this->userEmail = $userEmail;
    }

    public function build()
    {
        return $this->to($this->userEmail)
                    ->subject("{$this->notifTitle} - SCLF | Opol Community College")
                    ->view('emails.notification')
                    ->with([
                        'fullName' => $this->fullName,
                        'notifTitle' => $this->notifTitle,
                        'body' => $this->body,
                        'badge' => $this->badge,
                        'tone' => $this->tone,
                        'actionUrl' => $this->actionUrl,
                        'email' => $this->userEmail,
                    ]);
    }
}
