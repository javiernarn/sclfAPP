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
    public const SITE_NAME = 'SCLF - Opol Community College';

    public const DESCRIPTION = 'Smart Campus Lost & Found system for Opol Community College. Report, search, and claim lost or found items on campus.';

    /** Public pages that belong in search results (and in sitemap.xml). */
    public const INDEXABLE = [
        '/' => 'SCLF - Opol Community College | Smart Campus Lost & Found',
        '/login' => 'Login | SCLF - Opol Community College',
        '/register' => 'Register | SCLF - Opol Community College',
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
            'description' => self::DESCRIPTION,
            'robots' => $robots,
            'indexable' => $indexable,
            // Only indexable pages declare a canonical URL.
            'canonical' => $indexable ? $base . ($path === '/' ? '/' : $path) : null,
            'base' => $base,
            'image' => $base . '/images/og-image.png',
            'imageAlt' => 'SCLF - Smart Campus Lost & Found, Opol Community College',
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
                    'logo' => $base . '/images/icon-512.png',
                ],
                [
                    '@type' => 'WebSite',
                    '@id' => $base . '/#website',
                    'url' => $base . '/',
                    'name' => 'SCLF - Smart Campus Lost & Found',
                    'description' => self::DESCRIPTION,
                    'inLanguage' => 'en-PH',
                    'publisher' => ['@id' => $base . '/#organization'],
                ],
                [
                    '@type' => 'WebApplication',
                    '@id' => $base . '/#app',
                    'url' => $base . '/',
                    'name' => 'SCLF - Opol Community College',
                    'description' => self::DESCRIPTION,
                    'applicationCategory' => 'EducationalApplication',
                    'operatingSystem' => 'Any',
                    'inLanguage' => 'en-PH',
                    'image' => $base . '/images/og-image.png',
                    'publisher' => ['@id' => $base . '/#organization'],
                ],
            ],
        ];
    }
}
