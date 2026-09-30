<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserActivity extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'method', 'path', 'route_name', 'status_code',
        'ip_address', 'user_agent', 'device_type', 'platform', 'browser',
        'is_suspicious', 'flag_reason', 'created_at',
    ];

    protected $casts = [
        'is_suspicious' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
