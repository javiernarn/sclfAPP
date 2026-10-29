<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PwaManifestController extends Controller
{
    /**
     * Serve the web app manifest dynamically so its theme_color and
     * background_color match the visitor's current light/dark theme
     * (read from the "sclf-theme" cookie useAppTheme.js writes).
     *
     * A static /manifest.json can't vary per visitor, so this route is
     * re-fetched by the browser periodically and on reinstall/relaunch,
     * picking up theme changes going forward.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $season = match (strtolower(trim((string) config('app.season', 'default')))) {
            'halloween', 'first', '1' => 'halloween',
            'christmas', 'second', '2', 'xmas' => 'christmas',
            'newyear', 'third', '3', 'ny', 'new-year', 'new_year' => 'newyear',
            default => 'default',
        };
        $theme = $request->cookie('sclf-theme', $season === 'default' ? 'white' : 'black');
        // 'dark-*' Custom themes are dark shells too.
        $theme = in_array($theme, ['black', 'dark-white', 'dark-blue', 'dark-yellow', 'dark-maroon']) ? 'black' : 'white';

        $isBlack = $theme === 'black';

        $manifest = [
            'name' => 'SCLF - Opol Community College',
            'short_name' => 'SCLF',
            'description' => 'Smart Campus Lost & Found system for Opol Community College.',
            // Scope is the whole site ('/'), not just /app/. With '/app/', the
            // installed app left its scope every time it opened /login,
            // /register or /forgot-password (first launch while signed out,
            // after logging out, an expired session) and the phone then drew
            // a browser-style address bar over the top — so it stopped
            // looking like a full-screen app. Inside '/', every screen stays
            // full-screen. (Trade-off: a password-reset link tapped in Gmail
            // now opens inside the installed app instead of the browser.)
            'id' => '/app/dashboard',
            'start_url' => '/app/dashboard',
            'scope' => '/',
            'display' => 'standalone',
            'display_override' => ['standalone', 'minimal-ui'],
            'orientation' => 'any',
            'background_color' => match ($season) {
                'halloween' => $isBlack ? '#0d0618' : '#ffe7c8',
                'christmas' => $isBlack ? '#06121c' : '#e6f3f1',
                'newyear' => $isBlack ? '#070a1f' : '#fff4d6',
                default => $isBlack ? '#0a0c12' : '#ffffff',
            },
            // Title-bar color of the installed app: navy in light themes,
            // white in dark/black themes.
            'theme_color' => match ($season) {
                'halloween' => $isBlack ? '#12071f' : '#f97316',
                'christmas' => $isBlack ? '#06140f' : '#b91c1c',
                'newyear' => $isBlack ? '#0b0f2e' : '#b45309',
                default => $isBlack ? '#ffffff' : '#01215f',
            },
            'lang' => 'en-PH',
            'dir' => 'ltr',
            'categories' => ['education', 'productivity'],
            // Lets the browser answer "is this app already installed on this
            // device?" (navigator.getInstalledRelatedApps) so the install
            // banner stays hidden even when it is opened from a normal tab.
            'related_applications' => [
                ['platform' => 'webapp', 'url' => route('pwa.manifest')],
            ],
            'prefer_related_applications' => false,
            'icons' => [
                // "any": the shield on a transparent background (tabs, taskbar, install dialogs).
                ['src' => asset('images/icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => asset('images/icon-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                // "maskable": full-bleed navy with the logo inside the safe zone, so Android
                // can crop it to a circle / squircle without clipping the shield.
                ['src' => asset('images/icon-maskable-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
            // Long-press the home-screen icon (Android) or right-click the taskbar /
            // dock icon (Windows, macOS, ChromeOS) for these. All inside the scope.
            'shortcuts' => [
                [
                    'name' => 'Report a lost item',
                    'short_name' => 'Lost item',
                    'description' => 'Report something you lost on campus',
                    'url' => '/app/lost-items/create',
                    'icons' => [['src' => asset('images/icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
                ],
                [
                    'name' => 'Report a found item',
                    'short_name' => 'Found item',
                    'description' => 'Report something you found on campus',
                    'url' => '/app/found-items/create',
                    'icons' => [['src' => asset('images/icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
                ],
                [
                    'name' => 'My claims',
                    'short_name' => 'Claims',
                    'description' => 'Track your item claims',
                    'url' => '/app/claims',
                    'icons' => [['src' => asset('images/icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
                ],
                [
                    'name' => 'Notifications',
                    'short_name' => 'Alerts',
                    'description' => 'See your latest notifications',
                    'url' => '/app/notifications',
                    'icons' => [['src' => asset('images/icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png']],
                ],
            ],
            // Desktop: opening the app (or a shortcut) while it is already running
            // focuses that window and navigates it, instead of opening a second one.
            'launch_handler' => ['client_mode' => ['navigate-existing', 'auto']],
        ];

        return response()
            ->json($manifest)
            ->header('Content-Type', 'application/manifest+json')
            // The body depends on the "sclf-theme" cookie.
            ->header('Vary', 'Cookie')
            ->header('Cache-Control', 'private, max-age=300');
    }
}
