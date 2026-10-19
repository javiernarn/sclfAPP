<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * "Verify your SCLF account" email. Same shape as PasswordResetMail
 * (fullName / verifyUrl / userEmail props -> build() -> matching blade view),
 * so it shares the logo, header and footer of the other SCLF emails.
 */
class VerifyEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    public $fullName;
    public $verifyUrl;
    public $userEmail;

    public function __construct(string $fullName, string $verifyUrl, string $email)
    {
        $this->fullName = $fullName;
        $this->verifyUrl = $verifyUrl;
        $this->userEmail = $email;
    }

    public function build()
    {
        return $this->to($this->userEmail)
                    ->subject('Verify your SCLF account - SCLF | Opol Community College')
                    ->view('emails.verify-email')
                    ->with([
                        'fullName' => $this->fullName,
                        'verifyUrl' => $this->verifyUrl,
                        'email' => $this->userEmail,
                    ]);
    }
}
