<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Server-side SEO values for the single-page app shell (resources/views/app.blade.php).
 *
 * Every URL is answered with the same HTML shell, so without this each page
 * (login, register, the whole signed-in /app/ area, password-reset links,
 * visitor badges...) would advertise the same title and a canonical URL
 * pointing at itself. Here only the genuinely public pages are indexable;
 * everything else is marked noindex and gets no canonical tag.
 */
class Seo
{
    public const SITE_NAME = 'SCLF - Smart Campus Lost & Found | Opol Community College';

    /** Short brand + other names people search for (used as the WebSite alternateName). */
    public const ALTERNATE_NAMES = ['SCLF', 'OCC SCLF', 'SCLF OCC', 'Smart Campus Lost and Found', 'OCC Lost and Found'];

    public const DESCRIPTION = 'SCLF (Smart Campus Lost & Found) is the official lost and found system of Opol Community College (OCC). Report lost items, browse found items, get match suggestions and track your claims.';

    /** Public pages that belong in search results (and in sitemap.xml). */
    public const INDEXABLE = [
        '/' => 'SCLF - Smart Campus Lost & Found | Opol Community College (OCC)',
        '/login' => 'Login | SCLF - Smart Campus Lost & Found, Opol Community College',
        '/register' => 'Register | SCLF - Smart Campus Lost & Found, Opol Community College',
    ];

    /** Per-page meta descriptions (unique text per URL; Google rewrites duplicates). */
    public const DESCRIPTIONS = [
        '/' => 'SCLF (Smart Campus Lost & Found) is the lost and found system of Opol Community College (OCC). Report a lost item, browse found items, see suggested matches and track your claim, all in one place.',
        '/login' => 'Sign in to SCLF (Smart Campus Lost & Found) of Opol Community College to report lost items, check found items and track your claims.',
        '/register' => 'Create your SCLF (Smart Campus Lost & Found) account for Opol Community College to report lost items, search found items and claim them.',
    ];

    /** Public pages that should stay out of search results but may be followed. */
    public const NOINDEX_FOLLOW = ['/forgot-password'];

    public static function baseUrl(?Request $request = null): string
    {
        $configured = rtrim((string) config('app.url'), '/');
        $host = $configured !== '' ? parse_url($configured, PHP_URL_HOST) : null;

        // APP_URL is still the framework default on a fresh/dev install:
        // use the host the visitor actually reached instead.
        if (!$host || $host === 'localhost') {
            return rtrim($request ? $request->root() : $configured, '/');
        }

        return $configured;
    }

    public static function normalizePath(Request $request): string
    {
        $path = '/' . trim($request->path(), '/');

        return $path === '' ? '/' : $path;
    }

    public static function forRequest(Request $request): array
    {
        $path = self::normalizePath($request);
        $base = self::baseUrl($request);

        $indexable = array_key_exists($path, self::INDEXABLE);

        if ($indexable) {
            $robots = 'index, follow, max-image-preview:large';
            $title = self::INDEXABLE[$path];
        } elseif (in_array($path, self::NOINDEX_FOLLOW, true)) {
            $robots = 'noindex, follow';
            $title = 'Forgot Password | ' . self::SITE_NAME;
        } else {
            $robots = 'noindex, nofollow';
            $title = self::SITE_NAME;
        }

        return [
            'title' => $title,
            'description' => self::DESCRIPTIONS[$path] ?? self::DESCRIPTION,
            'robots' => $robots,
            // Search Console / Bing Webmaster ownership tags (set in .env, see config/app.php).
            'googleVerification' => config('app.google_site_verification'),
            'bingVerification' => config('app.bing_site_verification'),
            'indexable' => $indexable,
            // Only indexable pages declare a canonical URL.
            'canonical' => $indexable ? $base . ($path === '/' ? '/' : $path) : null,
            'base' => $base,
            'image' => $base . '/images/og-image.png',
            'imageAlt' => 'SCLF - Smart Campus Lost & Found, Opol Community College',
            'siteName' => self::SITE_NAME,
            'jsonLd' => $indexable ? self::jsonLd($base) : null,
        ];
    }

    /**
     * Schema.org data for the public pages. Only facts the app itself states
     * are included (no invented address, phone number or social profiles).
     */
    protected static function jsonLd(string $base): array
    {
        return [
            '@context' => 'https://schema.org',
            '@graph' => [
                [
                    '@type' => 'CollegeOrUniversity',
                    '@id' => $base . '/#organization',
                    'name' => 'Opol Community College',
                    'alternateName' => ['OCC'],
                    'logo' => $base . '/images/icon-512.png',
                ],
                [
                    '@type' => 'WebSite',
                    '@id' => $base . '/#website',
                    'url' => $base . '/',
                    'name' => 'SCLF - Smart Campus Lost & Found',
                    'alternateName' => self::ALTERNATE_NAMES,
                    'description' => self::DESCRIPTION,
                    'inLanguage' => 'en-PH',
                    'publisher' => ['@id' => $base . '/#organization'],
                ],
                [
                    '@type' => 'WebApplication',
                    '@id' => $base . '/#app',
                    'url' => $base . '/',
                    'name' => 'SCLF - Smart Campus Lost & Found',
                    'alternateName' => self::ALTERNATE_NAMES,
                    'description' => self::DESCRIPTION,
                    'applicationCategory' => 'EducationalApplication',
                    'operatingSystem' => 'Any',
                    'inLanguage' => 'en-PH',
                    'image' => $base . '/images/og-image.png',
                    'publisher' => ['@id' => $base . '/#organization'],
                    'creator' => [
                        '@type' => 'Person',
                        'name' => 'Jonee John R. Antiquina',
                        'sameAs' => ['https://www.facebook.com/EphemeralKun'],
                    ],
                    'isAccessibleForFree' => true,
                    'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'PHP'],
                ],
            ],
        ];
    }
}
