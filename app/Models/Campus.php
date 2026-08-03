<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Campus extends Model
{
    protected $fillable = ['name', 'code'];

    public function buildings()
    {
        return $this->hasMany(Building::class);
    }

    public function locations()
    {
        return $this->hasMany(Location::class);
    }
}
