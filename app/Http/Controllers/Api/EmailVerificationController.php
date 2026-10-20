<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use App\Services\Auth\EmailVerificationCodeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

class EmailVerificationController extends Controller
{
    public function __construct(protected AuditLogService $audit, protected EmailVerificationCodeService $codes)
    {
    }

    /**
     * The link in the email lands here (web route, GET /email/verify/{id}/{hash}).
     *
     * It does NOT need the person to be signed in, because many students open
     * the email on their phone but registered on a laptop. Trust comes from
     * the signed, expiring URL plus the hash of the email address.
     *
     * Always ends in a redirect to the login page with a short status flag,
     * so a stale or tampered link just shows a friendly message.
     */
    public function verify(Request $request, int $id, string $hash)
    {
        if (! URL::hasValidSignature($request)) {
            return redirect('/login?verify=invalid');
        }

        $user = User::find($id);

        if (! $user || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return redirect('/login?verify=invalid');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();

            $this->audit->log(
                'auth.email_verified',
                $user,
                "User #{$user->id} verified their email address.",
                null,
                null,
                $user,
            );
        }

        return redirect('/login?verify=ok');
    }

    /**
     * Verify with the 6-digit code from the email, typed inside the app
     * itself. Same result as clicking the link, without leaving the PWA.
     */
    public function verifyCode(Request $request)
    {
        $request->validate(['code' => ['required', 'digits:6']]);

        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already verified.', 'email_verified' => true]);
        }

        $result = $this->codes->check($user, (string) $request->input('code'));

        if ($result !== EmailVerificationCodeService::OK) {
            $messages = [
                EmailVerificationCodeService::INVALID => 'That code is not correct. Please check it and try again.',
                EmailVerificationCodeService::EXPIRED => 'That code has expired. Press "Resend email" to get a new one.',
                EmailVerificationCodeService::LOCKED => 'Too many wrong attempts. Press "Resend email" to get a new code.',
            ];

            return response()->json(['message' => $messages[$result], 'email_verified' => false], 422);
        }

        $user->markEmailAsVerified();

        $this->audit->log(
            'auth.email_verified',
            $user,
            "User #{$user->id} verified their email address with a code.",
            null,
            null,
            $user,
        );

        return response()->json(['message' => 'Your email is verified.', 'email_verified' => true]);
    }

    /**
     * Send (or re-send) the verification email for the signed-in account.
     * Throttled in routes/api.php (3 per minute).
     */
    public function resend(Request $request)
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already verified.', 'email_verified' => true]);
        }

        $this->send($user);

        return response()->json([
            'message' => 'A new verification link has been sent. It expires in 60 minutes.',
            'email_verified' => false,
        ]);
    }

    /**
     * Send the email without ever failing the caller. If the mail server is
     * down, registration must still succeed; the person can press "Resend".
     */
    public static function send(User $user): bool
    {
        try {
            $user->sendEmailVerificationNotification();

            return true;
        } catch (\Throwable $e) {
            Log::warning('Could not send verification email', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
