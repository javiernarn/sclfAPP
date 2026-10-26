<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A half-written report kept by Auto Save so it can follow the person to
 * another device. Plain field values only — never files.
 */
class FormDraft extends Model
{
    /** Forms that may store a draft (the frontend's useAutoSaveDraft formKey). */
    public const FORM_KEYS = ['lost-item', 'found-item', 'incident', 'service-request'];

    /** A draft nobody came back to for this long is dropped. */
    public const MAX_AGE_DAYS = 7;

    /** Largest stored draft (JSON bytes) — a report form is a few KB at most. */
    public const MAX_BYTES = 65536;

    protected $fillable = ['user_id', 'form_key', 'data', 'client_saved_at'];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'client_saved_at' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
