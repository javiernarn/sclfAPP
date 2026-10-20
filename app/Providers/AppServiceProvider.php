<?php

namespace App\Providers;

use App\Notifications\Channels\WebPushChannel;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        $this->configureRateLimiting();

        // Make every generated link (signed email links, redirects, assets)
        // https:// in production. Set FORCE_HTTPS=true in the live .env.
        if (config('app.force_https')) {
            URL::forceScheme('https');
        }

        // Branded verification email (logo + header + footer, same layout as
        // the password-reset email). The link is a signed, 60-minute URL
        // (route 'verification.verify' in routes/web.php). Returning a
        // Mailable from toMailUsing keeps it a VerifyEmail notification, so
        // Notification::fake() / assertSentTo(VerifyEmail::class) still work.
        VerifyEmail::toMailUsing(function ($notifiable, string $url) {
            $fullName = trim(($notifiable->first_name ?? '') . ' ' . ($notifiable->last_name ?? '')) ?: $notifiable->name;

            // A fresh 6-digit code travels with the link, so the person can
            // finish verifying inside the installed app without opening a browser.
            $code = app(\App\Services\Auth\EmailVerificationCodeService::class)->issue($notifiable);

            return new \App\Mail\VerifyEmailMail($fullName, $url, $notifiable->email, $code);
        });

        // One password policy for every place a password is set (register,
        // admin-create/update, first-login setup, change, reset). It matches
        // what the React forms already tell people (8+ chars, upper, lower,
        // number). To make it stricter later, raise min() here AND the
        // client-side "8" checks listed in PHASE_1.md. In production the
        // password is also checked against known-breached lists; if that
        // lookup is unreachable Laravel lets the password through (fail open).
        Password::defaults(function () {
            $rule = Password::min(8)->mixedCase()->numbers();

            return app()->isProduction() ? $rule->uncompromised() : $rule;
        });

        // 'webpush' — OS-level push notifications outside the browser/PWA,
        // alongside the existing 'database' and 'mail' channels. See
        // WebPushChannel + SclfNotification::via()/toWebPush().
        Notification::extend('webpush', fn ($app) => new WebPushChannel);

        // Note: the reset-link URL (pointing at the SPA's own
        // ResetPassword.jsx page — there's no server-rendered
        // "password.reset" route in this app) and the branded reset
        // email itself are both built in User::sendPasswordResetNotification()
        // now, since that email uses SCLF's own blade instead of the
        // default notification markdown mail.
    }

    /**
     * Abuse protection. Each limiter is applied by name in routes/api.php
     * (`throttle:name`), except `api`, which covers every API route via
     * bootstrap/app.php.
     *
     * Remember that students on campus Wi-Fi often share ONE public IP, so
     * limits keyed on IP are generous on purpose; per-user limits are tighter.
     * Behind a proxy/CDN set TRUSTED_PROXIES (see .env.production.example) or
     * every visitor will look like the same IP.
     */
    protected function configureRateLimiting(): void
    {
        $tooMany = fn (string $message) => function (Request $request, array $headers) use ($message) {
            return response()->json(['message' => $message], 429, $headers);
        };

        $userOrIp = fn (Request $request) => $request->user()?->id ?: $request->ip();

        // Default for every API call: a real person never gets near this, a
        // scraper or runaway script does.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(240)
            ->by($userOrIp($request))
            ->response($tooMany('Too many requests. Please slow down and try again in a minute.')));

        // Silent token refresh. Every signed-in browser refreshes about every
        // 15 minutes, so a whole campus behind one IP must not share a tiny
        // bucket. Limit per refresh token (a stuck client) plus a generous
        // per-IP ceiling (a bot).
        RateLimiter::for('refresh', function (Request $request) {
            $token = \App\Support\RefreshCookie::read($request) ?: (string) $request->input('refresh_token');

            return [
                Limit::perMinute(10)->by('refresh-token|' . ($token !== '' ? hash('sha256', $token) : $request->ip())),
                Limit::perMinute(300)->by('refresh-ip|' . $request->ip()),
            ];
        });

        // Per-IP ceiling on /login. The per-email+IP lockout in AuthController
        // stops guessing ONE account; this stops one machine trying one
        // password against hundreds of accounts (password spraying).
        RateLimiter::for('login-ip', fn (Request $request) => Limit::perMinute(60)
            ->by('login|' . $request->ip())
            ->response($tooMany('Too many sign-in attempts from this network. Please wait a minute and try again.')));

        // Self-registration. Verification email + per-IP cap keep bots out
        // while a whole classroom on one campus IP can still sign up.
        RateLimiter::for('register', fn (Request $request) => [
            Limit::perHour(30)->by('register|' . $request->ip()),
            Limit::perMinute(5)->by('register-min|' . $request->ip()),
        ]);

        // Creating things that notify staff / hold files: lost & found reports,
        // incidents, service requests, claims.
        RateLimiter::for('reports', fn (Request $request) => Limit::perHour(30)
            ->by('reports|' . $userOrIp($request))
            ->response($tooMany('You have submitted a lot of reports in a short time. Please try again later.')));

        // File uploads (evidence photos, attachments).
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(20)
            ->by('uploads|' . $userOrIp($request))
            ->response($tooMany('Too many uploads. Please wait a moment and try again.')));
    }
}
