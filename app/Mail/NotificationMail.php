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
        'success' => ['bg' => '#eafaf0', 'border' => '#16a34a', 'text' => '#15803d'],
        'warning' => ['bg' => '#fff8d8', 'border' => '#e0b100', 'text' => '#92720a'],
        'danger'  => ['bg' => '#fdeeee', 'border' => '#dc2626', 'text' => '#b91c1c'],
        'info'    => ['bg' => '#eef1fd', 'border' => '#4f46e5', 'text' => '#4338ca'],
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
