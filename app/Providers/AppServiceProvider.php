<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

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

        // Note: the reset-link URL (pointing at the SPA's own
        // ResetPassword.jsx page — there's no server-rendered
        // "password.reset" route in this app) and the branded reset
        // email itself are both built in User::sendPasswordResetNotification()
        // now, since that email uses SCLF's own blade instead of the
        // default notification markdown mail.
    }
}
