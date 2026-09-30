<?php

namespace App\Support;

/**
 * Small, dependency-free "what is this" reader for a raw User-Agent string.
 *
 * Deliberately not a full UA database (ua-parser, whichbrowser, etc.) — this
 * environment can't reach Packagist over the network, and for the admin
 * activity view we only need a friendly label ("iPhone · Safari"), not
 * precise version detection. Order of checks matters: some engines spoof
 * pieces of another's UA string (e.g. Edge includes "Chrome" and "Safari"),
 * so more specific checks run before their broader supersets.
 */
class UserAgentParser
{
    public const DEVICE_MOBILE = 'mobile';
    public const DEVICE_TABLET = 'tablet';
    public const DEVICE_DESKTOP = 'desktop';
    public const DEVICE_BOT = 'bot';
    public const DEVICE_UNKNOWN = 'unknown';

    /**
     * @return array{device_type:string, platform:?string, browser:?string, label:string}
     */
    public static function parse(?string $userAgent): array
    {
        $ua = trim((string) $userAgent);

        if ($ua === '') {
            return [
                'device_type' => self::DEVICE_UNKNOWN,
                'platform' => null,
                'browser' => null,
                'label' => 'Unknown device',
            ];
        }

        if (preg_match('/bot|crawler|spider|curl|wget|postman|python-requests|axios\/|guzzlehttp/i', $ua)) {
            return [
                'device_type' => self::DEVICE_BOT,
                'platform' => null,
                'browser' => null,
                'label' => 'Bot / script',
            ];
        }

        $platform = self::detectPlatform($ua);
        $browser = self::detectBrowser($ua);
        $deviceType = self::detectDeviceType($ua, $platform);

        $label = trim(implode(' · ', array_filter([$platform, $browser])));

        return [
            'device_type' => $deviceType,
            'platform' => $platform,
            'browser' => $browser,
            'label' => $label !== '' ? $label : 'Unknown device',
        ];
    }

    private static function detectPlatform(string $ua): ?string
    {
        return match (true) {
            (bool) preg_match('/iPhone/i', $ua) => 'iPhone',
            (bool) preg_match('/iPad/i', $ua) => 'iPad',
            (bool) preg_match('/Android/i', $ua) => 'Android',
            (bool) preg_match('/Windows NT/i', $ua) => 'Windows',
            (bool) preg_match('/Macintosh|Mac OS X/i', $ua) => 'macOS',
            (bool) preg_match('/CrOS/i', $ua) => 'ChromeOS',
            (bool) preg_match('/Linux/i', $ua) => 'Linux',
            default => null,
        };
    }

    private static function detectBrowser(string $ua): ?string
    {
        return match (true) {
            (bool) preg_match('/EdgA|EdgiOS|Edge|Edg\//i', $ua) => 'Edge',
            (bool) preg_match('/OPR\/|Opera/i', $ua) => 'Opera',
            (bool) preg_match('/SamsungBrowser/i', $ua) => 'Samsung Internet',
            (bool) preg_match('/FBAN|FBAV/i', $ua) => 'Facebook In-App Browser',
            (bool) preg_match('/Instagram/i', $ua) => 'Instagram In-App Browser',
            (bool) preg_match('/CriOS/i', $ua) => 'Chrome',
            (bool) preg_match('/Firefox|FxiOS/i', $ua) => 'Firefox',
            (bool) preg_match('/Chrome\//i', $ua) => 'Chrome',
            (bool) preg_match('/Safari/i', $ua) => 'Safari',
            default => null,
        };
    }

    private static function detectDeviceType(string $ua, ?string $platform): string
    {
        if ($platform === 'iPad' || preg_match('/Tablet|Nexus 7|Nexus 10/i', $ua)) {
            return self::DEVICE_TABLET;
        }

        if ($platform === 'iPhone' || (preg_match('/Android/i', $ua) && preg_match('/Mobile/i', $ua)) || preg_match('/Mobile Safari|IEMobile|BlackBerry/i', $ua)) {
            return self::DEVICE_MOBILE;
        }

        if (in_array($platform, ['Windows', 'macOS', 'Linux', 'ChromeOS'], true)) {
            return self::DEVICE_DESKTOP;
        }

        return self::DEVICE_UNKNOWN;
    }
}
