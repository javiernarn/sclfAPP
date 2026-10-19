<?php

namespace App\Console\Commands;

use App\Mail\SecurityAlertMail;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserActivity;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Looks at the last few minutes of audit/activity data and raises an alert
 * (log + one email per hour) when something looks like an attack: a burst of
 * failed logins, one IP hammering the login, flagged requests, many
 * denied/limited requests, or server errors.
 *
 * Thresholds live in config/security.php. Scheduled in routes/console.php,
 * so on Hostinger it only needs the normal "run the scheduler every minute"
 * cron job.
 */
class SecurityWatch extends Command
{
    protected $signature = 'security:watch {--minutes= : Look-back window (default from config)} {--dry-run : Print only, do not email}';

    protected $description = 'Detect unusual login / traffic patterns and alert the administrators';

    public function handle(): int
    {
        $cfg = config('security.alerts');
        $minutes = (int) ($this->option('minutes') ?: $cfg['window_minutes']);
        $since = now()->subMinutes($minutes);

        $failedActions = ['auth.failed_login', 'auth.throttled_login', 'auth.blocked_login', 'auth.2fa_failed', 'auth.2fa_locked'];

        $failedLogins = AuditLog::where('created_at', '>=', $since)->whereIn('action', $failedActions)->count();

        $topIp = AuditLog::where('created_at', '>=', $since)
            ->whereIn('action', $failedActions)
            ->whereNotNull('ip_address')
            ->selectRaw('ip_address, COUNT(*) as hits')
            ->groupBy('ip_address')
            ->orderByDesc('hits')
            ->first();

        $suspicious = UserActivity::where('created_at', '>=', $since)->where('is_suspicious', true)->count();
        $denied = UserActivity::where('created_at', '>=', $since)->whereIn('status_code', [401, 403, 429])->count();
        $serverErrors = UserActivity::where('created_at', '>=', $since)->where('status_code', '>=', 500)->count();

        $findings = [];

        if ($failedLogins >= $cfg['failed_logins']) {
            $findings[] = "{$failedLogins} failed or blocked sign-in events (limit {$cfg['failed_logins']}).";
        }
        if ($topIp && $topIp->hits >= $cfg['failed_logins_per_ip']) {
            $findings[] = "IP {$topIp->ip_address} caused {$topIp->hits} failed sign-in events (limit {$cfg['failed_logins_per_ip']}).";
        }
        if ($suspicious >= $cfg['suspicious_requests']) {
            $findings[] = "{$suspicious} requests were flagged as suspicious (limit {$cfg['suspicious_requests']}).";
        }
        if ($denied >= $cfg['denied_requests']) {
            $findings[] = "{$denied} requests were denied or rate limited (401/403/429; limit {$cfg['denied_requests']}).";
        }
        if ($serverErrors >= $cfg['server_errors']) {
            $findings[] = "{$serverErrors} server errors (5xx; limit {$cfg['server_errors']}).";
        }

        $this->line(sprintf(
            'Last %d min: failed logins %d, suspicious %d, denied %d, server errors %d.',
            $minutes, $failedLogins, $suspicious, $denied, $serverErrors
        ));

        if (! $findings) {
            return self::SUCCESS;
        }

        foreach ($findings as $finding) {
            $this->warn($finding);
        }
        Log::warning('security:watch thresholds exceeded', ['window_minutes' => $minutes, 'findings' => $findings]);

        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }

        // At most one email per cooldown, so an ongoing attack doesn't flood the inbox.
        if (! Cache::add('security-watch-alert-sent', 1, now()->addMinutes($cfg['cooldown_minutes']))) {
            return self::SUCCESS;
        }

        $recipients = $cfg['to']
            ? array_map('trim', explode(',', $cfg['to']))
            : User::role('admin')->pluck('email')->all();

        if (! $recipients) {
            return self::SUCCESS;
        }

        try {
            Mail::to($recipients)->send(new SecurityAlertMail($findings));
        } catch (\Throwable $e) {
            Log::error('Could not send the security alert email', ['error' => $e->getMessage()]);
        }

        return self::SUCCESS;
    }
}
