<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * One personal email per recipient account: To = that person, greeting =
 * that person's name. Sent immediately by BroadcastLostItemJob, which itself
 * runs after the approver's response, so no queue worker is needed.
 */
class LostItemAlertMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ?int $userId,
        public string $fullName,
        public ?string $userEmail,
        public array $item,
    ) {
    }

    public function build()
    {
        $base = rtrim(config('app.url'), '/');
        $uid = $this->userId ? '&uid=' . $this->userId : '';

        // Both links go through /login first (they're opened from an inbox);
        // LoginPage then forwards to ?redirect= — same mechanism
        // NotificationMail already uses.
        $foundUrl = $base . '/login?redirect=' . urlencode('/app/found-items/create') . $uid;
        $viewUrl = $base . '/login?redirect=' . urlencode('/app/notifications') . $uid;

        if ($this->userEmail) {
            $this->to($this->userEmail);
        }

        return $this
            ->subject("Lost item: {$this->item['item_name']} - SCLF | Opol Community College")
            ->view('emails.lost-item-alert')
            ->with([
                'fullName' => $this->fullName,
                'item' => $this->item,
                'foundUrl' => $foundUrl,
                'viewUrl' => $viewUrl,
            ]);
    }
}
