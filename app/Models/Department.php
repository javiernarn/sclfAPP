<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $fillable = ['campus_id', 'name', 'code'];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
