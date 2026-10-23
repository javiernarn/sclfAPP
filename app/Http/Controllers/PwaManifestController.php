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
        $theme = $request->cookie('sclf-theme', 'white');
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
            'background_color' => $isBlack ? '#0a0c12' : '#ffffff',
            'theme_color' => $isBlack ? '#0a0c12' : '#ffffff',
            'lang' => 'en-PH',
            'categories' => ['education', 'productivity'],
            // Lets the browser answer "is this app already installed on this
            // device?" (navigator.getInstalledRelatedApps) so the install
            // banner stays hidden even when it is opened from a normal tab.
            'related_applications' => [
                ['platform' => 'webapp', 'url' => route('pwa.manifest')],
            ],
            'prefer_related_applications' => false,
            'icons' => [
                [
                    'src' => asset('images/site-logo.png'),
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => asset('images/site-logo.png'),
                    'sizes' => '384x384',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
                [
                    'src' => asset('images/site-logo.png'),
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'any',
                ],
            ],
        ];

        return response()
            ->json($manifest)
            ->header('Content-Type', 'application/manifest+json')
            ->header('Cache-Control', 'private, max-age=300');
    }
}
