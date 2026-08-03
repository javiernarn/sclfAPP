<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClaimEvidence extends Model
{
    protected $fillable = [
        'claim_id', 'submitted_by', 'type', 'content', 'file_path',
    ];

    protected $appends = ['file_url'];

    public function claim()
    {
        return $this->belongsTo(Claim::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function getFileUrlAttribute(): ?string
    {
        return $this->file_path ? asset('storage/' . $this->file_path) : null;
    }
}
