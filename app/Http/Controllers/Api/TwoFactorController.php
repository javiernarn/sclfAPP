<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Auth\RefreshTokenService;
use App\Services\Auth\TwoFactorAuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class TwoFactorController extends Controller
{
    public function __construct(
        protected TwoFactorAuthService $twoFactor,
        protected RefreshTokenService $tokens,
    ) {
    }

    /**
     * Step 1: generate (or regenerate) a pending secret + QR payload.
     * Requires the user to already be fully logged in — you can't enroll
     * in 2FA using a 2fa-pending token, RequireFullAccess blocks that.
     */
    public function setup(Request $request)
    {
        $result = $this->twoFactor->setup($request->user());

        return response()->json([
            'secret' => $result['secret'],
            'otpauth_uri' => $result['otpauth_uri'],
        ]);
    }

    /**
     * Step 2: confirm the code from the authenticator app actually works,
     * which flips 2FA on and returns the one-time-visible recovery codes.
     */
    public function confirm(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
        ]);

        try {
            $recoveryCodes = $this->twoFactor->confirm($request->user(), $validated['code']);
        } catch (\InvalidArgumentException $e) {
            throw ValidationException::withMessages(['code' => [$e->getMessage()]]);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['code' => [$e->getMessage()]]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication is now enabled.',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Turn 2FA off. Requires the current password as confirmation — this
     * is a meaningful security downgrade for the account, not something
     * that should happen from just holding a valid session token (e.g. an
     * unattended logged-in browser).
     */
    public function disable(Request $request)
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        if (!Hash::check($validated['password'], $request->user()->password)) {
            throw ValidationException::withMessages([
                'password' => ['Your password is incorrect.'],
            ]);
        }

        $this->twoFactor->disable($request->user());

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication has been disabled.',
        ]);
    }

    /**
     * Step 3 of a 2FA login: exchange the temporary pending token + a
     * valid TOTP/recovery code for a real access+refresh token pair.
     * Authenticated by the pending token itself (auth:sanctum), not a
     * fresh password check — the password was already verified in
     * AuthController::login() to get this far.
     */
    public function verifyLogin(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $user = $request->user();
        $code = trim($validated['code']);

        // Recovery codes are formatted XXXX-XXXX (see
        // TwoFactorAuthService::generateRecoveryCodes) vs. a plain 6-digit
        // TOTP code, so which check to run is unambiguous from the shape
        // of what was submitted.
        $verified = str_contains($code, '-')
            ? $this->twoFactor->verifyRecoveryCode($user, $code)
            : $this->twoFactor->verifyCode($user, $code);

        if (!$verified) {
            throw ValidationException::withMessages([
                'code' => ['That code is invalid or has expired.'],
            ]);
        }

        // The pending token has done its job — replace it with the real
        // thing rather than letting it linger until its 5-minute expiry.
        $request->user()->currentAccessToken()->delete();

        $pair = $this->tokens->issue($user, $request);

        return response()->json([
            'user' => $user->only(
                'id', 'name', 'first_name', 'last_name', 'email', 'phone_number',
                'address', 'gender', 'student_id', 'staff_id', 'display_id', 'course',
                'profile_picture_url', 'two_factor_enabled'
            ),
            'roles' => $user->getRoleNames(),
            'access_token' => $pair['access_token'],
            'refresh_token' => $pair['refresh_token'],
            'expires_in' => $pair['expires_in'],
        ]);
    }
}
