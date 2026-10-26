<?php

namespace App\Http\Controllers;

use App\Models\Visitor;
use App\Services\Audit\AuditLogService;
use App\Services\Visitors\PurposeDetails;
use App\Support\VisitorBadgeLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * The public page behind the QR code on a visitor badge (/visitor/{token}).
 * No login: the visitor just scanned the badge.
 *
 * Information is released in steps, so a stranger who only finds or
 * photographs a badge learns as little as possible:
 *   show()    -> only the FIRST name, to ask "Are you ...?"
 *   confirm() -> "Yes, that's me": the visitor must TYPE THEIR LAST NAME; only a
 *                correct answer unlocks the welcome page (5 wrong tries lock it
 *                for 15 minutes and Security is told)
 *   notMe()   -> "No": enough for a finder to return the badge (first name, the
 *                initial of the last name, purpose, host / office) — never the
 *                full name, or it would give away the answer to the question
 *                above — and Security is told the badge may be lost.
 * ID number, contact number and notes are never returned here.
 *
 * The QR identifies the physical badge (it is reused every day), so every
 * step looks up the visitor who is checked in with that badge right now. Once
 * the badge is handed back, the page shows nothing about anyone.
 */
class PublicVisitorController extends Controller
{
    private const MAX_WRONG = 5;
    private const LOCK_SECONDS = 900; // 15 minutes

    public function __construct(protected AuditLogService $audit)
    {
    }

    public function show(string $token): JsonResponse
    {
        $parsed = VisitorBadgeLink::parse($token);
        if (! $parsed) {
            return response()->json(['state' => 'invalid', 'portal' => $this->portal()], 404);
        }

        $visitor = $this->activeVisitor($parsed);
        if (! $visitor) {
            return response()->json(['state' => 'inactive', 'badge' => $parsed[1], 'portal' => $this->portal()]);
        }

        $visitor->increment('badge_scan_count');

        return response()->json([
            'state' => 'active',
            'badge' => $parsed[1],
            // First name only. `verify_with` says what the visitor must type to unlock the page.
            'visitor' => ['first_name' => $this->name($visitor)['first_name']],
            'verify_with' => $this->expectedAnswer($visitor)[0],
            'portal' => $this->portal(),
        ]);
    }

    /** "Yes, that's me" — the visitor types their last name; a correct answer unlocks the welcome page. */
    public function confirm(Request $request, string $token): JsonResponse
    {
        $parsed = VisitorBadgeLink::parse($token);
        $visitor = $parsed ? $this->activeVisitor($parsed) : null;
        if (! $visitor) {
            return response()->json(['state' => $parsed ? 'inactive' : 'invalid', 'portal' => $this->portal()], $parsed ? 200 : 404);
        }

        // Too many wrong answers for this badge: locked for a while, whoever is asking.
        $key = 'visitor-portal:' . $visitor->id;
        if (RateLimiter::tooManyAttempts($key, self::MAX_WRONG)) {
            return response()->json(['state' => 'locked', 'minutes' => (int) ceil(RateLimiter::availableIn($key) / 60), 'portal' => $this->portal()], 429);
        }

        [$kind, $expected] = $this->expectedAnswer($visitor);
        $given = $this->normalize((string) $request->input('last_name', ''));
        if ($given === '' || ! hash_equals($this->normalize($expected), $given)) {
            RateLimiter::hit($key, self::LOCK_SECONDS);

            if (RateLimiter::tooManyAttempts($key, self::MAX_WRONG)) {
                $this->audit->log(
                    'visitor.portal_locked',
                    $visitor,
                    "Badge {$visitor->badge_number} (visitor {$visitor->full_name}) was locked on the visitor page after " . self::MAX_WRONG . ' wrong last-name answers. The badge may be lost or in the wrong hands.',
                );
                $visitor->forceFill(['badge_found_reported_at' => $visitor->badge_found_reported_at ?? now()])->save();

                return response()->json(['state' => 'locked', 'minutes' => (int) ceil(RateLimiter::availableIn($key) / 60), 'portal' => $this->portal()], 429);
            }

            return response()->json([
                'state' => 'wrong',
                'verify_with' => $kind,
                'attempts_left' => max(0, self::MAX_WRONG - RateLimiter::attempts($key)),
                'portal' => $this->portal(),
            ], 422);
        }

        RateLimiter::clear($key);

        if (! $visitor->welcomed_at) {
            $visitor->forceFill(['welcomed_at' => now()])->save();
        }

        $stated = PurposeDetails::statedMinutes($visitor->purpose_details);
        $visitor->loadMissing('campus:id,name');

        return response()->json([
            'state' => 'welcome',
            'visitor' => $this->name($visitor),
            'visit' => [
                'purpose' => $visitor->purpose,
                'purpose_label' => PurposeDetails::purposeLabel($visitor->purpose),
                'host_name' => $visitor->host_name,
                'host_department' => $visitor->host_department,
                'student_name' => $visitor->student_name,
                'badge_number' => $visitor->badge_number,
                'campus' => $visitor->campus?->name,
                'checked_in_at' => $visitor->checked_in_at?->toIso8601String(),
                'expected_stay' => PurposeDetails::durationLabel($visitor->purpose_details),
                'leave_by' => $stated ? $visitor->checked_in_at?->copy()->addMinutes($stated)->toIso8601String() : null,
            ],
            'details' => PurposeDetails::publicRows($visitor->purpose, $visitor->purpose_details),
            'guidance' => PurposeDetails::guidance($visitor->purpose, $visitor->purpose_details, $visitor->host_name, $visitor->host_department),
            'portal' => $this->portal(),
        ]);
    }

    /** "No, I'm not this person" — someone is holding a badge that is not theirs. */
    public function notMe(string $token): JsonResponse
    {
        $parsed = VisitorBadgeLink::parse($token);
        $visitor = $parsed ? $this->activeVisitor($parsed) : null;
        if (! $visitor) {
            return response()->json(['state' => $parsed ? 'inactive' : 'invalid', 'portal' => $this->portal()], $parsed ? 200 : 404);
        }

        $firstReport = ! $visitor->badge_found_reported_at;
        $visitor->forceFill(['badge_found_reported_at' => now()])->save();

        if ($firstReport) {
            $this->audit->log(
                'visitor.badge_found_reported',
                $visitor,
                "Someone who is not {$visitor->full_name} opened badge {$visitor->badge_number} and reported it as found/not theirs.",
            );
        }

        $visitor->loadMissing('campus:id,name');

        return response()->json([
            'state' => 'found',
            // Never the full name: the last name is the answer to the unlock question.
            'owner' => [
                'first_name' => $this->name($visitor)['first_name'],
                'last_initial' => ($last = $this->name($visitor)['last_name']) ? Str::upper(Str::substr($last, 0, 1)) . '.' : null,
            ],
            'visit' => [
                'purpose_label' => PurposeDetails::purposeLabel($visitor->purpose),
                'host_name' => $visitor->host_name,
                'host_department' => $visitor->host_department,
                'campus' => $visitor->campus?->name,
                'badge_number' => $visitor->badge_number,
            ],
            'portal' => $this->portal(),
        ]);
    }

    /** The visitor currently checked in with this badge, if any. */
    protected function activeVisitor(array $parsed): ?Visitor
    {
        [$campusId, $label] = $parsed;

        return Visitor::query()
            ->where('badge_number', $label)
            ->where('status', Visitor::STATUS_CHECKED_IN)
            ->when($campusId, fn ($q) => $q->where('campus_id', $campusId), fn ($q) => $q->whereNull('campus_id'))
            ->orderByDesc('checked_in_at')
            ->first();
    }

    /** What the visitor must type: [kind, answer]. Visitors with a one-word name type that name. */
    protected function expectedAnswer(Visitor $visitor): array
    {
        [$first, $last] = $visitor->nameParts();

        return $last ? ['last_name', $last] : ['name', (string) ($first ?: $visitor->full_name)];
    }

    /** Ignore case, accents, extra spaces and punctuation: "dela  Cruz" = "Dela Cruz". */
    protected function normalize(string $value): string
    {
        return preg_replace('/[^a-z0-9]/', '', Str::lower(Str::ascii($value)));
    }

    protected function name(Visitor $visitor): array
    {
        [$first, $last] = $visitor->nameParts();

        return ['first_name' => $first, 'last_name' => $last, 'full_name' => $visitor->full_name];
    }

    protected function portal(): array
    {
        return array_intersect_key(config('sclf.visitor_portal'), array_flip(['college', 'intro', 'security_office', 'conduct', 'privacy']));
    }
}
