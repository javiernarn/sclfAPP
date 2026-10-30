<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Tiny key/value settings table (see the app_settings migration).
 * Reads are cached; set() clears the cache so a change applies at once.
 */
class AppSetting extends Model
{
    protected $fillable = ['key', 'value', 'updated_by'];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        return Cache::remember("app_setting:{$key}", 60, function () use ($key, $default) {
            $row = static::where('key', $key)->first();

            return $row ? $row->value : $default;
        });
    }

    public static function setValue(string $key, ?string $value, ?int $userId = null): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value, 'updated_by' => $userId]);
        Cache::forget("app_setting:{$key}");
    }
}
