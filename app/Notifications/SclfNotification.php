<?php

namespace App\Notifications;

use App\Mail\NotificationMail;
use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

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

    /**
     * Only these two roles get an email copy of their in-app notification.
     * Security Officers / Admins live inside the system all day (that's
     * their job) and already see everything in the sidebar bell — mailing
     * them every claim submission etc. would just be noise. Students and
     * Instructors are occasional visitors who benefit from a nudge in
     * their inbox instead.
     */
    private const EMAILED_ROLES = ['student', 'instructor'];

    /**
     * type -> [badge label, tone] shown on the email. Tone drives the
     * accent color (see NotificationMail::TONES / emails.notification)
     * the same way the frontend picks a badge color per status.
     */
    private const META = [
        self::TYPE_POTENTIAL_MATCH => ['Possible Match Found', 'info'],
        self::TYPE_CLAIM_SUBMITTED => ['Claim Submitted', 'info'],
        self::TYPE_CLAIM_APPROVED => ['Claim Approved', 'success'],
        self::TYPE_CLAIM_REJECTED => ['Claim Rejected', 'danger'],
        self::TYPE_MORE_EVIDENCE_REQUIRED => ['Action Needed', 'warning'],
        self::TYPE_ITEM_READY_FOR_RELEASE => ['Ready For Pickup', 'success'],
        self::TYPE_ITEM_RELEASED => ['Item Released', 'success'],
        self::TYPE_FOUND_REPORT_APPROVED => ['Report Approved', 'success'],
        self::TYPE_FOUND_REPORT_REJECTED => ['Report Rejected', 'danger'],
        self::TYPE_SECURITY_VERIFICATION_COMPLETED => ['Verification Completed', 'info'],
    ];

    /**
     * relatedType -> path builder. Mirrors NotificationsPage.jsx's own
     * ROUTE_FOR_TYPE map exactly, so the email's "Login" button lands the
     * person on the same screen clicking the notification in-app would.
     */
    private const ROUTES = [
        Claim::class => '/claims/%d',
        LostItem::class => '/lost-items/%d/matches',
        FoundItem::class => '/found-items/%d',
    ];

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
        $channels = ['database'];

        if ($notifiable instanceof User && $notifiable->hasAnyRole(self::EMAILED_ROLES)) {
            $channels[] = 'mail';
        }

        // Unlike email (deliberately limited to students/instructors —
        // see EMAILED_ROLES above), push goes to whichever role opted in;
        // security officers/admins live in the sidebar bell all day but
        // may still want an OS-level nudge for something urgent. Only
        // added when the account actually has a subscribed device, so
        // WebPushChannel never runs a no-op query for everyone else.
        if ($notifiable instanceof User && $notifiable->pushSubscriptions()->exists()) {
            $channels[] = 'webpush';
        }

        return $channels;
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

    /**
     * Same branded blade approach as User::sendPasswordResetNotification()
     * — a dedicated Mailable + view instead of Laravel's default markdown
     * mail, so this reads like the rest of SCLF's emails.
     */
    public function toMail($notifiable): NotificationMail
    {
        $fullName = trim(($notifiable->first_name ?? '') . ' ' . ($notifiable->last_name ?? '')) ?: $notifiable->name;
        [$badge, $tone] = self::META[$this->type] ?? ['Notification', 'info'];

        return new NotificationMail(
            fullName: $fullName,
            title: $this->title,
            body: $this->message,
            badge: $badge,
            tone: $tone,
            actionUrl: $this->actionUrl(),
            userEmail: $notifiable->email,
        );
    }

    /**
     * Web Push payload — read by WebPushChannel and, on the receiving
     * end, by public/sw.js's 'push' handler. Reuses the same title/
     * message/icon as the in-app + email versions of this notification,
     * and the same deep-link logic as the email's "Login" button, except
     * pointed at the SPA route directly: a push arrives while the app may
     * already be open/installed, so there's no need to round-trip through
     * /login?redirect= the way a cold email click does.
     *
     * The body is deliberately trimmed here (and nowhere else — the
     * in-app bell and email both show $this->message in full). iOS clips
     * push notification bodies hard — around 2 lines before Safari cuts
     * it off mid-sentence with no ellipsis of its own — while Android
     * has noticeably more room. Rather than let either platform decide
     * where a sentence gets chopped, cut it ourselves at a sentence-safe
     * length and add our own "…", then rely on the notification's tap
     * target (spaUrl()) to get them the rest.
     */
    public function toWebPush($notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => Str::limit($this->message, 90),
            'icon' => asset('images/site-logo.png'),
            'badge' => asset('images/site-logo.png'),
            'url' => $this->spaUrl(),
            'tag' => $this->relatedType && $this->relatedId
                ? Str::slug("{$this->relatedType}-{$this->relatedId}")
                : $this->type,
        ];
    }

    /**
     * Same routing table as actionUrl() below, but returning a bare SPA
     * path (e.g. "/claims/12") instead of a full /login?redirect= URL —
     * what the service worker's notificationclick handler opens.
     */
    protected function spaUrl(): string
    {
        return ($this->relatedType && $this->relatedId && isset(self::ROUTES[$this->relatedType]))
            ? sprintf(self::ROUTES[$this->relatedType], $this->relatedId)
            : '/notifications';
    }

    /**
     * Deep link back into the SPA: the "Login" button in the email always
     * sends the person through /login first (they're reading this from an
     * inbox, not an open session), carrying a ?redirect= param LoginPage
     * hands off to MainPage so they land straight on the relevant claim /
     * match / found item afterwards instead of just the generic dashboard.
     * Falls back to the Notifications list itself when there's nothing
     * more specific to point at (or the type isn't one of the three
     * routable models above).
     */
    protected function actionUrl(): string
    {
        return rtrim(config('app.url'), '/') . '/login?redirect=' . urlencode($this->spaUrl());
    }
}
