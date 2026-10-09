<?php

namespace App\Services\Auth;

/**
 * Thrown when a refresh token belongs to a session that was ended because
 * the same account signed in on another device (single-device login).
 */
class SessionDisplacedException extends \RuntimeException
{
    public function __construct(public readonly ?string $device = null)
    {
        parent::__construct('This account was signed in on another device.');
    }
}
