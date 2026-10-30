<?php

namespace App\Console\Commands;

use App\Jobs\NotifyPrintOpenedJob;
use Illuminate\Console\Command;

/**
 * Manual / debugging way to send the "Printing is now open" notification
 * to every active student:  php artisan sclf:notify-print-open
 */
class NotifyStudentsPrintOpen extends Command
{
    protected $signature = 'sclf:notify-print-open';

    protected $description = 'Notify all active students that Print / Save as PDF is open (bell + push).';

    public function handle(): int
    {
        $sent = (new NotifyPrintOpenedJob())->handle();
        $this->info("Notified {$sent} student(s).");

        return self::SUCCESS;
    }
}
