<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
// use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Authenticatable
{
  
    use HasFactory, Notifiable, HasRoles, HasApiTokens, SoftDeletes;

    /**
     * Role -> ID-number prefix used by generateStaffId(). Students are
     * intentionally excluded — their student_id is self-chosen at
     * registration (YYYY-N-NNNNN), not system-generated.
     */
    public const STAFF_ID_PREFIXES = [
        'admin' => 'ADM',
        'security_officer' => 'SEC',
        'instructor' => 'INS',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'address',
        'gender',
        'student_id',
        'staff_id',
        'course',
        'profile_picture',
        'is_active',
        'password',
    ];

    /**
     * The accessors to append to the model's array/JSON form.
     *
     * @var list<string>
     */
    protected $appends = [
        'profile_picture_url',
        'display_id',
    ];

    /**
     * Full public URL for the stored profile picture, or null.
     */
    public function getProfilePictureUrlAttribute(): ?string
    {
        return $this->profile_picture ? asset('storage/' . $this->profile_picture) : null;
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Generate the next sequential ID number for a staff role
     * (instructor / security_officer / admin), e.g. "SEC-2026-0001".
     *
     * Format: {PREFIX}-{YEAR}-{4-digit sequence, resets every year}.
     * The sequence is derived from the highest existing number for that
     * prefix+year (including soft-deleted/disabled accounts, so a
     * disabled officer's number is never reused), computed inside a
     * row-locking transaction so two admins creating an account for the
     * same role at the same moment can't be handed the same number.
     *
     * Returns null for roles without a staff prefix (e.g. 'student',
     * which uses the self-chosen student_id instead).
     */
    public static function generateStaffId(string $role): ?string
    {
        $prefix = self::STAFF_ID_PREFIXES[$role] ?? null;

        if (!$prefix) {
            return null;
        }

        $year = now()->format('Y');
        $pattern = "{$prefix}-{$year}-";

        return DB::transaction(function () use ($prefix, $year, $pattern) {
            $last = static::withTrashed()
                ->where('staff_id', 'like', $pattern . '%')
                ->lockForUpdate()
                ->orderByDesc('staff_id')
                ->value('staff_id');

            $next = 1;
            if ($last && preg_match('/(\d+)$/', $last, $m)) {
                $next = ((int) $m[1]) + 1;
            }

            return sprintf('%s-%s-%04d', $prefix, $year, $next);
        });
    }

    /**
     * The role-appropriate ID number to display, whichever of
     * student_id / staff_id applies to this account. Used by the
     * frontend Profile page and Admin user list so each role only
     * ever sees "its own" ID field instead of every field at once.
     */
    public function getDisplayIdAttribute(): ?string
    {
        return $this->student_id ?: $this->staff_id;
    }

    public function lostItems()
    {
        return $this->hasMany(LostItem::class);
    }

    /**
     * Every FoundItem row with user_id = this account, regardless of how
     * it was logged. For an online report this genuinely means "found and
     * reported by this person" — but CounterIntakeService::checkIn() also
     * stamps user_id with the *officer's* id (there's no independent
     * finder in that flow), so on its own this relation over-counts a
     * busy officer's counter check-ins as items they personally found.
     * Callers that need "found items reported through the app" should
     * scope this to intake_channel = FoundItem::CHANNEL_ONLINE_REPORT
     * (see UserController::show()); callers that need "items checked in
     * at the counter" should use counterCheckIns() above instead.
     */
    public function foundItems()
    {
        return $this->hasMany(FoundItem::class, 'user_id');
    }

    public function claims()
    {
        return $this->hasMany(Claim::class, 'claimant_id');
    }

    public function reviewedClaims()
    {
        return $this->hasMany(Claim::class, 'reviewed_by');
    }

    /**
     * Items this account checked in directly at a security counter for a
     * known owner (CounterIntakeService::checkIn()). There's no separate
     * "finder" in that flow — the officer standing at the counter is the
     * one logging the record — so this is keyed on security_officer_id,
     * not user_id (see the comment on foundItems() above for why user_id
     * alone can't be trusted for this).
     */
    public function counterCheckIns()
    {
        return $this->hasMany(FoundItem::class, 'security_officer_id')
            ->where('intake_channel', FoundItem::CHANNEL_COUNTER_INTAKE);
    }

    /**
     * Items this account has physically handed over to a claimant, via
     * either a QR scan (ItemReleaseService::scanAndRelease()) or a manual
     * override (::manualRelease()) — both log an InventoryMovement with
     * action=released and moved_by=the releasing officer, regardless of
     * whether the original item came in through the counter or the full
     * online report -> match -> claim pipeline.
     */
    public function itemsReleased()
    {
        return $this->hasMany(InventoryMovement::class, 'moved_by')
            ->where('action', InventoryMovement::ACTION_RELEASED);
    }

    /**
     * This account's registered Web Push subscriptions — one per
     * browser/device that's granted notification permission. See
     * PushSubscription and App\Notifications\Channels\WebPushChannel.
     */
    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    /**
     * Send the password reset link email.
     *
     * Overridden so the email uses SCLF's own branded blade
     * (resources/views/emails/password-reset.blade.php) instead of
     * Laravel's default notification markdown mail — same format as the
     * Alumni system's reset email, just with SCLF's own content. The
     * reset URL points at the SPA's own ResetPassword.jsx page (there's
     * no server-rendered "password.reset" route in this app).
     */
    public function sendPasswordResetNotification($token): void
    {
        $email = urlencode($this->getEmailForPasswordReset());
        $resetUrl = rtrim(config('app.url'), '/') . "/reset-password/{$token}?email={$email}";
        $fullName = trim(($this->first_name ?? '') . ' ' . ($this->last_name ?? '')) ?: $this->name;

        \Illuminate\Support\Facades\Mail::to($this->email)->send(
            new \App\Mail\PasswordResetMail($fullName, $resetUrl, $this->email)
        );
    }
}