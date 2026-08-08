<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClaimEvidence extends Model
{
    protected $fillable = [
        'claim_id', 'submitted_by', 'type', 'content', 'file_path',
    ];

    // file_path now lives on the private disk (storage/app/private), so
    // there is no longer a public asset URL to append — exposing one would
    // recreate the same unauthenticated-access issue this replaces.
    // Frontend gets a boolean and fetches the actual bytes through the
    // authenticated /claims/evidence/{evidence}/download endpoint instead.
    protected $appends = ['has_file'];

    public function claim()
    {
        return $this->belongsTo(Claim::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function getHasFileAttribute(): bool
    {
        return (bool) $this->file_path;
    }
}
