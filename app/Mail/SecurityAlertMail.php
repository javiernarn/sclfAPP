<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Sent by `php artisan security:watch` when a threshold is crossed. */
class SecurityAlertMail extends Mailable
{
    /** @param array<int,string> $findings */
    public function __construct(public array $findings)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'SCLF security alert');
    }

    public function content(): Content
    {
        $items = collect($this->findings)->map(fn ($f) => '<li>' . e($f) . '</li>')->implode('');

        return new Content(htmlString:
            '<p><strong>SCLF security alert</strong> (' . e(now()->toDateTimeString()) . ')</p>'
            . '<ul>' . $items . '</ul>'
            . '<p>Review Admin &gt; Audit Log and Admin &gt; User Activity for details.</p>'
        );
    }
}
