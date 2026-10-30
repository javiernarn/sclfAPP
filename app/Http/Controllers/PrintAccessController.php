<?php

namespace App\Http\Controllers;

use App\Jobs\NotifyPrintOpenedJob;
use App\Models\AppSetting;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;

/**
 * Admin switch for "Print / Save as PDF" on the student & instructor
 * dashboard report (used while clearance signing is not open yet).
 *
 *  GET /print-access        any signed-in user  -> { enabled, message }
 *  PUT /admin/print-access  admin only          -> turn on / off, edit message
 *
 * The switch is enforced by PrintReportController: while it is off the
 * server does not send the report at all, so there is nothing to print
 * or screenshot.
 */
class PrintAccessController extends Controller
{
    public const KEY_ENABLED = 'student_print_enabled';
    public const KEY_MESSAGE = 'student_print_message';
    public const KEY_NOTIFIED_AT = 'student_print_notified_at';

    public const DEFAULT_MESSAGE = 'Printing and saving your dashboard as PDF is not open yet. '
        . 'Clearance signing has not started. Please wait for the announcement from the admin, '
        . 'then try again.';

    public static function isEnabled(): bool
    {
        return AppSetting::getValue(self::KEY_ENABLED, '0') === '1';
    }

    public static function message(): string
    {
        return AppSetting::getValue(self::KEY_MESSAGE) ?: self::DEFAULT_MESSAGE;
    }

    public function show()
    {
        return response()->json([
            'enabled' => self::isEnabled(),
            'message' => self::message(),
        ]);
    }

    public function update(Request $request, AuditLogService $audit)
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
            'message' => 'nullable|string|max:300',
        ]);

        $wasEnabled = self::isEnabled();
        $before = ['enabled' => $wasEnabled, 'message' => self::message()];
        $userId = $request->user()->id;

        AppSetting::setValue(self::KEY_ENABLED, $data['enabled'] ? '1' : '0', $userId);
        if (array_key_exists('message', $data)) {
            AppSetting::setValue(self::KEY_MESSAGE, trim((string) $data['message']) ?: null, $userId);
        }

        $after = ['enabled' => self::isEnabled(), 'message' => self::message()];

        // Only describe what really changed (saving the message must not
        // look like the switch was flipped).
        if ($after['enabled'] !== $wasEnabled) {
            $audit->log(
                'print_access.toggled',
                null,
                'Student dashboard printing was turned ' . ($after['enabled'] ? 'ON' : 'OFF') . " by admin #{$userId}.",
                $before,
                $after,
            );
        }
        if ($after['message'] !== $before['message']) {
            $audit->log('print_access.message_updated', null, "Printing-disabled message edited by admin #{$userId}.", $before, $after);
        }

        // OFF -> ON: tell the students (bell + push). Cool-down so flipping the
        // switch on/off/on never spams them.
        $notified = false;
        if ($after['enabled'] && ! $wasEnabled) {
            $last = AppSetting::getValue(self::KEY_NOTIFIED_AT);
            if (! $last || \Illuminate\Support\Carbon::parse($last)->addMinutes(10)->isPast()) {
                AppSetting::setValue(self::KEY_NOTIFIED_AT, now()->toIso8601String(), $userId);
                NotifyPrintOpenedJob::dispatchAfterResponse();
                $notified = true;
            }
        }

        return response()->json($after + ['notified' => $notified]);
    }

    /** Admin pressed "Notify students again" (printing must already be ON). */
    public function notify(Request $request)
    {
        if (! self::isEnabled()) {
            return response()->json(['message' => 'Turn printing ON first.'], 422);
        }

        $last = AppSetting::getValue(self::KEY_NOTIFIED_AT);
        if ($last && ! \Illuminate\Support\Carbon::parse($last)->addMinutes(10)->isPast()) {
            return response()->json(['message' => 'Students were notified less than 10 minutes ago. Please wait a bit.'], 429);
        }

        AppSetting::setValue(self::KEY_NOTIFIED_AT, now()->toIso8601String(), $request->user()->id);
        NotifyPrintOpenedJob::dispatchAfterResponse();

        return response()->json(['notified' => true]);
    }
}
