<?php

namespace App\Services\Auth;

/**
 * Thrown by RefreshTokenService::rotate() when a refresh token that was
 * already rotated or revoked gets presented again — the signal used to
 * detect a possibly-stolen refresh token and revoke its whole family.
 */
class RefreshTokenReuseException extends \RuntimeException
{
}
