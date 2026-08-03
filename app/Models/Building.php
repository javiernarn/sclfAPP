<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Building extends Model
{
    protected $fillable = ['campus_id', 'name', 'code'];

    public function campus()
    {
        return $this->belongsTo(Campus::class);
    }

    public function locations()
    {
        return $this->hasMany(Location::class);
    }
}
