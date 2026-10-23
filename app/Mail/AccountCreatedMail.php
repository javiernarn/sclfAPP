<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

/**
 * "Your SCLF account has been created" email, sent when an admin/staff member
 * creates an Instructor / Security Officer / Staff account.
 *
 * Same shape and branding (OCC logo, header, footer) as PasswordResetMail and
 * VerifyEmailMail. It carries the temporary password the admin typed, so it is
 * deliberately NOT queued (no Queueable / ShouldQueue): the password is sent
 * straight away and never written into the jobs table. The account is also
 * flagged must_setup_profile, so the temporary password only works until the
 * person sets their own at first sign-in.
 */
class AccountCreatedMail extends Mailable
{
    public function __construct(
        public string $fullName,
        public string $userEmail,
        public string $temporaryPassword,
        public string $roleLabel,
        public ?string $staffId,
        public ?string $campusName,
        public ?string $phoneNumber,
        public ?string $genderLabel,
        public string $createdBy,
        public string $loginUrl,
        public ?string $teachingCourse = null,
    ) {
        // Set the recipient here (not only in build()) so the address is already
        // on the mailable when Mail::fake() / hasTo() inspects it.
        $this->to($userEmail);
    }

    public function build()
    {
        return $this
            ->subject('Your SCLF account has been created - SCLF | Opol Community College')
            ->view('emails.account-created')
            ->with([
                'fullName' => $this->fullName,
                'email' => $this->userEmail,
                'temporaryPassword' => $this->temporaryPassword,
                'roleLabel' => $this->roleLabel,
                'staffId' => $this->staffId,
                'campusName' => $this->campusName,
                'phoneNumber' => $this->phoneNumber,
                'genderLabel' => $this->genderLabel,
                'createdBy' => $this->createdBy,
                'loginUrl' => $this->loginUrl,
                'teachingCourse' => $this->teachingCourse,
            ]);
    }
}
