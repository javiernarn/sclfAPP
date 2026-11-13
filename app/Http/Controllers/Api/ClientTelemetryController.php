<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ClientTelemetry;
use App\Support\UserAgentParser;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * POST /api/client-errors: the browser's way to say "something broke" or
 * "this page was slow". Three kinds of report arrive here, all written to
 * storage/logs/client.log (channel "client"):
 *
 *   {type: error|rejection|boundary, message, stack, url, ...}   a crash
 *   {type: vitals, path, metrics: [{name, value, rating}, ...]}   Web Vitals
 *   {"csp-report": {...}}                                          CSP violation
 *
 * Deliberately: public (a crash on the login page must be reportable), always
 * answers quickly with an empty body, never logs the user id / IP / query
 * string, and never trusts the client to have cleaned anything.
 */
class ClientTelemetryController extends Controller
{
    private const MAX_BODY_BYTES = 16384;
    private const VITALS = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'];
    private const RATINGS = ['good', 'needs-improvement', 'poor'];
    private const ERROR_TYPES = ['error', 'rejection', 'boundary'];

    public function store(Request $request): Response
    {
        if (! config('sclf.telemetry.enabled', true)) {
            return response()->noContent();
        }

        $raw = $request->getContent();
        if (strlen($raw) > self::MAX_BODY_BYTES) {
            return response('', 413);
        }

        $data = json_decode($raw, true);
        if (! is_array($data)) {
            return response('', 422);
        }

        // Site-wide ceiling: a flood from many addresses still cannot fill the disk.
        $key = 'client-telemetry-global';
        $max = (int) config('sclf.telemetry.max_per_minute', 300);
        if (RateLimiter::tooManyAttempts($key, $max)) {
            return response()->noContent();
        }

        if (isset($data['csp-report']) && is_array($data['csp-report'])) {
            $logged = $this->cspReport($data['csp-report'], $request);
        } elseif (($data['type'] ?? null) === 'vitals') {
            $logged = $this->vitals($data, $request);
        } elseif (in_array($data['type'] ?? null, self::ERROR_TYPES, true)) {
            $logged = $this->error($data, $request);
        } else {
            return response('', 422);
        }

        if ($logged) {
            RateLimiter::hit($key, 60);
        }

        return response()->noContent();
    }

    private function error(array $d, Request $request): bool
    {
        $type = (string) $d['type'];
        $message = ClientTelemetry::text($d['message'] ?? '', 300);
        $stack = ClientTelemetry::text($d['stack'] ?? '', 3000);
        if ($message === '' && $stack === '') {
            return false;
        }

        // Same error again within the window: not logged a second time.
        $fp = ClientTelemetry::fingerprint($type, $message, $stack);
        $window = max(1, (int) config('sclf.telemetry.dedupe_minutes', 10));
        if (! Cache::add('client-error:' . $fp, 1, now()->addMinutes($window))) {
            return false;
        }

        Log::channel('client')->error('client_error', [
            'fingerprint' => $fp,
            'type' => $type,
            'message' => $message,
            'stack' => $stack,
            'component_stack' => ClientTelemetry::text($d['component_stack'] ?? '', 1200),
            'path' => ClientTelemetry::path($d['url'] ?? ''),
            'release' => ClientTelemetry::text($d['release'] ?? '', 40),
            'client' => $this->client($request),
        ]);

        return true;
    }

    private function vitals(array $d, Request $request): bool
    {
        $metrics = [];
        foreach (array_slice((array) ($d['metrics'] ?? []), 0, 8) as $m) {
            if (! is_array($m) || ! in_array($m['name'] ?? null, self::VITALS, true) || ! is_numeric($m['value'] ?? null)) {
                continue;
            }
            $metrics[$m['name']] = [
                'value' => round((float) $m['value'], $m['name'] === 'CLS' ? 4 : 0),
                'rating' => in_array($m['rating'] ?? null, self::RATINGS, true) ? $m['rating'] : null,
            ];
        }
        if ($metrics === []) {
            return false;
        }

        Log::channel('client')->info('web_vitals', [
            'path' => ClientTelemetry::path($d['path'] ?? ''),
            'metrics' => $metrics,
            'nav' => ClientTelemetry::text($d['nav'] ?? '', 20),
            'client' => $this->client($request),
        ]);

        return true;
    }

    private function cspReport(array $r, Request $request): bool
    {
        $directive = ClientTelemetry::text($r['effective-directive'] ?? $r['violated-directive'] ?? '', 60);
        $blocked = ClientTelemetry::text($r['blocked-uri'] ?? $r['blockedURL'] ?? '', 200);
        $document = ClientTelemetry::path($r['document-uri'] ?? $r['documentURL'] ?? '');
        if ($directive === '' && $blocked === '') {
            return false;
        }

        // Browser extensions trigger CSP reports on every page; they are not ours to fix.
        if (preg_match('~^(chrome|moz|safari|safari-web)-extension:|^(about|webkit-masked-url)~i', $blocked)) {
            return false;
        }

        $fp = substr(sha1($directive . '|' . $blocked . '|' . $document), 0, 20);
        $window = max(1, (int) config('sclf.telemetry.dedupe_minutes', 10));
        if (! Cache::add('client-csp:' . $fp, 1, now()->addMinutes($window))) {
            return false;
        }

        Log::channel('client')->warning('csp_violation', [
            'fingerprint' => $fp,
            'directive' => $directive,
            'blocked' => $blocked,
            'page' => $document,
            'source_file' => ClientTelemetry::text($r['source-file'] ?? $r['sourceFile'] ?? '', 200),
            'line' => is_numeric($r['line-number'] ?? null) ? (int) $r['line-number'] : null,
            'disposition' => ClientTelemetry::text($r['disposition'] ?? '', 12),
            'client' => $this->client($request),
        ]);

        return true;
    }

    /** Coarse browser family only; the raw User-Agent string is not stored. */
    private function client(Request $request): array
    {
        $ua = UserAgentParser::parse($request->userAgent());

        return [
            'browser' => $ua['browser'] ?? null,
            'platform' => $ua['platform'] ?? null,
            'device' => $ua['device_type'] ?? null,
        ];
    }
}
