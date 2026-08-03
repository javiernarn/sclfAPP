<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Mirrors alumniApp's App\Mail\PasswordResetMail — same shape (fullName /
 * resetUrl / userEmail props, same build() pattern) and the paired blade
 * view follows the same visual layout. Only the branding/copy inside the
 * blade is SCLF-specific.
 */
class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public $fullName;
    public $resetUrl;
    public $userEmail;

    public function __construct(string $fullName, string $resetUrl, string $email)
    {
        $this->fullName = $fullName;
        $this->resetUrl = $resetUrl;
        $this->userEmail = $email;
    }

    public function build()
    {
        return $this->subject('Password Reset Request - SCLF | Opol Community College')
                    ->view('emails.password-reset')
                    ->with([
                        'fullName' => $this->fullName,
                        'resetUrl' => $this->resetUrl,
                        'email' => $this->userEmail,
                    ]);
    }
}
