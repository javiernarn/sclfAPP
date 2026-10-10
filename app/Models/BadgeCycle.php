<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BadgeCycle extends Model
{
    protected $fillable = ['campus_id', 'prefix', 'cycle'];
}
