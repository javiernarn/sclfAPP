<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

/**
 * "Your SCLF account details were updated" email, sent when an Admin/Staff
 * member edits an existing account (role, ID, name, email, campus, phone...).
 *
 * $changes is a list of ['label' => ..., 'old' => ..., 'new' => ...] rows, so
 * the person can see exactly what changed. It never contains a password; if the
 * password was reset, $passwordReset only tells them to use the new one they
 * were given. Not queued, same as AccountCreatedMail.
 */
class AccountUpdatedMail extends Mailable
{
    public function __construct(
        public string $fullName,
        public string $recipientEmail,
        public array $changes,
        public bool $passwordReset,
        public string $updatedBy,
        public string $loginUrl,
        public bool $toOldAddress = false,
    ) {
        $this->to($recipientEmail);
    }

    public function build()
    {
        return $this
            ->subject('Your SCLF account details have been updated - SCLF | Opol Community College')
            ->view('emails.account-updated')
            ->with([
                'fullName' => $this->fullName,
                'changes' => $this->changes,
                'passwordReset' => $this->passwordReset,
                'updatedBy' => $this->updatedBy,
                'loginUrl' => $this->loginUrl,
                'toOldAddress' => $this->toOldAddress,
            ]);
    }
}
