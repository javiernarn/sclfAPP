<?php

namespace App\Jobs;

use App\Models\AppSetting;
use App\Models\User;
use App\Notifications\SclfNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Tells every active student (in-app bell + push) that the admin has opened
 * "Print / Save as PDF" for clearance signing. Instructors are never
 * restricted, so they are not notified. Runs after the admin's click has
 * already returned; one failing account never stops the rest.
 */
class NotifyPrintOpenedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    public function handle(): int
    {
        @set_time_limit(0);
        $sent = 0;

        // Emails are off by default (a whole-school email blast); the bell and
        // push still go out. Turn on with SCLF_PRINT_OPEN_EMAILS=true.
        $extra = ['link' => '/app/dashboard'];
        if (! config('sclf.print_open_emails')) {
            $extra['no_email'] = true;
        }

        User::query()
            ->where('is_active', true)
            ->role('student')
            ->select(['id', 'name', 'first_name', 'last_name', 'email', 'email_notifications'])
            ->chunkById(100, function ($students) use ($extra, &$sent) {
                foreach ($students as $student) {
                    try {
                        $student->notify(new SclfNotification(
                            SclfNotification::TYPE_PRINT_OPENED,
                            'Printing is now open',
                            'Clearance signing is open. You can now Print / Save as PDF your dashboard report.',
                            null,
                            null,
                            $extra,
                        ));
                        $sent++;
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            });

        AppSetting::setValue('student_print_notified_count', (string) $sent);

        return $sent;
    }
}
