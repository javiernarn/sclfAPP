<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class SclfNotification extends Notification
{
    use Queueable;

    // Event type constants — used by the frontend to pick an icon/route.
    public const TYPE_POTENTIAL_MATCH = 'potential_match';
    public const TYPE_CLAIM_SUBMITTED = 'claim_submitted';
    public const TYPE_CLAIM_APPROVED = 'claim_approved';
    public const TYPE_CLAIM_REJECTED = 'claim_rejected';
    public const TYPE_MORE_EVIDENCE_REQUIRED = 'more_evidence_required';
    public const TYPE_ITEM_READY_FOR_RELEASE = 'item_ready_for_release';
    public const TYPE_ITEM_RELEASED = 'item_released';
    public const TYPE_FOUND_REPORT_APPROVED = 'found_report_approved';
    public const TYPE_FOUND_REPORT_REJECTED = 'found_report_rejected';
    public const TYPE_SECURITY_VERIFICATION_COMPLETED = 'security_verification_completed';

    public function __construct(
        protected string $type,
        protected string $title,
        protected string $message,
        protected ?string $relatedType = null,
        protected ?int $relatedId = null,
        protected array $extra = [],
    ) {
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return array_merge([
            'type' => $this->type,
            'title' => $this->title,
            'message' => $this->message,
            'related_type' => $this->relatedType,
            'related_id' => $this->relatedId,
        ], $this->extra);
    }
}
