<?php

namespace App\Support;

/**
 * Safe building block for `LIKE '%term%'` searches.
 *
 * The value is always sent to the database as a bound parameter, so this is
 * not about SQL injection. It stops two other things:
 *  - `%` and `_` typed by the user acting as wildcards (a search for `%_%_%_`
 *    would otherwise force slow full scans),
 *  - absurdly long search strings.
 */
class Like
{
    public const MAX_LENGTH = 100;

    /** Escape LIKE wildcards and cut the term to MAX_LENGTH characters. */
    public static function escape(?string $value): string
    {
        $value = mb_substr(trim((string) $value), 0, self::MAX_LENGTH);

        return addcslashes($value, '\\%_');
    }

    /** `%term%` ready to hand to ->where(column, 'like', ...). */
    public static function contains(?string $value): string
    {
        return '%' . self::escape($value) . '%';
    }
}
