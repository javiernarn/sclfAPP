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

class User extends Authenticatable
{
  
    use HasFactory, Notifiable, HasRoles, HasApiTokens, SoftDeletes;

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

    public function lostItems()
    {
        return $this->hasMany(LostItem::class);
    }

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