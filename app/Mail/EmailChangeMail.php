<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "Confirm your new email" message with the 6-digit code. Sent to the NEW
 * address only. Same shape as VerifyEmailMail (props -> build() -> blade) so it
 * shares the logo, header and footer of the other SCLF emails.
 */
class EmailChangeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $fullName,
        public string $newEmail,
        public string $oldEmail,
        public string $code,
        public int $minutes,
    ) {
        // Set here (not only in build()) so the recipient is known before the
        // message is rendered; Mail::fake() and hasTo() never call build().
        $this->to($newEmail);
    }

    public function build()
    {
        return $this
            ->subject('Confirm your new email - SCLF | Opol Community College')
            ->view('emails.email-change')
            ->with([
                'fullName' => $this->fullName,
                'newEmail' => $this->newEmail,
                'oldEmail' => $this->oldEmail,
                'code' => $this->code,
                'minutes' => $this->minutes,
            ]);
    }
}
