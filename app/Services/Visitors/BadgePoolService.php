<?php

namespace App\Services\Visitors;

use App\Models\BadgeCycle;
use App\Models\Visitor;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Round-based pool of physical visitor badges (see config/sclf.php).
 *
 * A badge number n (1..size) for today's letter is in one of three states:
 *  - in_use:    handed to a visitor who has not checked out yet
 *  - returned:  already issued this round and handed back — NOT selectable
 *               until the round finishes
 *  - available: not issued yet this round — selectable
 *
 * When no badge is selectable any more (every one is either issued this
 * round or still out), the round advances and the returned badges become
 * selectable again, starting from the lowest number.
 *
 * Everything is derived from the visitors table, so deleting a mistaken
 * entry frees its badge. claim()/snapshot() must run inside a DB
 * transaction for the row lock on the cycle record to mean anything.
 */
class BadgePoolService
{
    public function size(): int
    {
        return (int) config('sclf.visitor_badges.size', 200);
    }

    public function prefixFor(?Carbon $date = null): string
    {
        $date ??= now();

        return config('sclf.visitor_badges.prefixes')[$date->dayOfWeek] ?? 'V';
    }

    /** Every configured badge letter, Monday first: ['M' => 'Monday', ...]. */
    public function sets(): array
    {
        $prefixes = config('sclf.visitor_badges.prefixes');
        $names = [0 => 'Sunday', 1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday'];
        $sets = [];
        foreach ([1, 2, 3, 4, 5, 6, 0] as $dow) {
            if (isset($prefixes[$dow])) {
                $sets[$prefixes[$dow]] = $names[$dow];
            }
        }

        return $sets;
    }

    public function label(string $prefix, int $seq): string
    {
        // M-01 .. M-09, M-10 .. M-200
        return $prefix . '-' . str_pad((string) $seq, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Full picture of today's pool for the picker UI.
     *
     * @param  int|null     $ignoreVisitorId  the visitor being edited — their own badge shows as selectable
     * @param  string|null  $prefix           which day's badge set to show; defaults to today's letter
     */
    public function snapshot(?int $campusId, ?int $ignoreVisitorId = null, ?string $prefix = null): array
    {
        return \DB::transaction(function () use ($campusId, $ignoreVisitorId, $prefix) {
            $prefix = strtoupper((string) $prefix);
            if (!array_key_exists($prefix, $this->sets())) {
                $prefix = $this->prefixFor();
            }
            $cycle = $this->normalizeCycle($campusId, $prefix);
            [$out, $used, $lastSeq] = $this->usage($campusId, $prefix, $cycle, $ignoreVisitorId);

            $badges = [];
            $available = [];
            for ($n = 1; $n <= $this->size(); $n++) {
                if (isset($out[$n])) {
                    $state = 'in_use';
                } elseif (isset($used[$n])) {
                    $state = 'returned';
                } else {
                    $state = 'available';
                    $available[] = $n;
                }

                $badges[] = [
                    'number' => $n,
                    'label' => $this->label($prefix, $n),
                    'state' => $state,
                    'holder' => $out[$n] ?? null,
                ];
            }

            $next = collect($available)->first(fn ($n) => $n > $lastSeq) ?? ($available[0] ?? null);

            return [
                'prefix' => $prefix,
                'today_prefix' => $this->prefixFor(),
                'sets' => collect($this->sets())->map(fn ($day, $letter) => ['prefix' => $letter, 'day' => $day])->values()->all(),
                'size' => $this->size(),
                'round' => $cycle,
                'next' => $next ? $this->label($prefix, $next) : null,
                'counts' => [
                    'available' => count($available),
                    'in_use' => count($out),
                    'waiting' => count($used),
                ],
                'badges' => $badges,
            ];
        });
    }

    /**
     * Validate a badge for issue and return the columns to store.
     *
     * @throws ValidationException
     */
    public function claim(?string $badge, ?int $campusId, ?int $ignoreVisitorId = null): array
    {
        $badge = strtoupper(preg_replace('/[\s\-]+/', '', (string) $badge));
        $sets = array_keys($this->sets());
        $first = $this->label($sets[0] ?? 'V', 1);

        if (!preg_match('/^([A-Z])(\d{1,4})$/', $badge, $m)
            || !in_array($m[1], $sets, true)
            || (int) $m[2] < 1 || (int) $m[2] > $this->size()) {
            throw ValidationException::withMessages([
                'badge_number' => "Pick a badge from the pool (for example {$first} to " . $this->label($sets[0] ?? 'V', $this->size()) . ').',
            ]);
        }

        $prefix = $m[1];
        $seq = (int) $m[2];
        $cycle = $this->normalizeCycle($campusId, $prefix);
        [$out, $used] = $this->usage($campusId, $prefix, $cycle, $ignoreVisitorId);
        $label = $this->label($prefix, $seq);

        if (isset($out[$seq])) {
            throw ValidationException::withMessages([
                'badge_number' => "Badge {$label} is still with {$out[$seq]} (not checked out).",
            ]);
        }

        if (isset($used[$seq])) {
            throw ValidationException::withMessages([
                'badge_number' => "Badge {$label} was already issued this round and returned. It becomes available again after the whole pool ({$this->label($prefix, 1)}–{$this->label($prefix, $this->size())}) has been issued.",
            ]);
        }

        return [
            'badge_number' => $label,
            'badge_prefix' => $prefix,
            'badge_seq' => $seq,
            'badge_cycle' => $cycle,
        ];
    }

    /**
     * Call right after a badge was issued: if that was the last selectable
     * badge of the round, roll over so the returned ones free up.
     */
    public function afterIssue(?int $campusId, string $prefix): void
    {
        $this->normalizeCycle($campusId, $prefix);
    }

    /**
     * Returns the effective round number, advancing it when no badge is
     * selectable but at least one is back in the box.
     */
    protected function normalizeCycle(?int $campusId, string $prefix): int
    {
        $row = BadgeCycle::query()
            ->where('prefix', $prefix)
            ->when($campusId, fn ($q) => $q->where('campus_id', $campusId), fn ($q) => $q->whereNull('campus_id'))
            ->lockForUpdate()
            ->first() ?? BadgeCycle::create(['campus_id' => $campusId, 'prefix' => $prefix, 'cycle' => 1]);

        [$out, $used] = $this->usage($campusId, $prefix, $row->cycle);
        $selectable = $this->size() - count($out) - count($used);

        if ($selectable <= 0 && count($out) < $this->size()) {
            $row->cycle++;
            $row->save();
        }

        return $row->cycle;
    }

    /**
     * @return array{0: array<int,string>, 1: array<int,true>, 2: int}
     *         [seq => holder name still out, seq => true issued this round & returned, last seq issued this round]
     */
    protected function usage(?int $campusId, string $prefix, int $cycle, ?int $ignoreVisitorId = null): array
    {
        /** @var Collection $rows */
        $rows = Visitor::query()
            ->where('badge_prefix', $prefix)
            ->when($campusId, fn ($q) => $q->where('campus_id', $campusId), fn ($q) => $q->whereNull('campus_id'))
            ->when($ignoreVisitorId, fn ($q) => $q->where('id', '!=', $ignoreVisitorId))
            ->where(fn ($q) => $q->where('status', Visitor::STATUS_CHECKED_IN)->orWhere('badge_cycle', $cycle))
            ->get(['id', 'full_name', 'status', 'badge_seq', 'badge_cycle']);

        $out = [];
        $used = [];
        $last = 0;

        foreach ($rows as $row) {
            if ($row->status === Visitor::STATUS_CHECKED_IN) {
                $out[$row->badge_seq] = $row->full_name;
            } else {
                $used[$row->badge_seq] = true;
            }
            if ((int) $row->badge_cycle === $cycle) {
                $last = max($last, (int) $row->badge_seq);
            }
        }

        return [$out, $used, $last];
    }
}
