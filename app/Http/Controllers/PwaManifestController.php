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
        $theme = in_array($theme, ['black', 'white']) ? $theme : 'white';

        $isBlack = $theme === 'black';

        $manifest = [
            'name' => 'SCLF - Opol Community College',
            'short_name' => 'SCLF',
            'description' => 'Smart Campus Lost & Found system for Opol Community College.',
            // Scoped to /app/ (not '/') so the installed WebAPK on Android
            // only ever intercepts authenticated app routes — /login,
            // /register, /forgot-password, and /reset-password/{token}
            // stay outside the scope and always open in the regular
            // browser, e.g. when tapped from a Gmail/SMS link.
            'start_url' => '/app/dashboard',
            'scope' => '/app/',
            'display' => 'standalone',
            'orientation' => 'any',
            'background_color' => $isBlack ? '#0a0c12' : '#ffffff',
            'theme_color' => $isBlack ? '#0a0c12' : '#ffffff',
            'lang' => 'en-PH',
            'categories' => ['education', 'productivity'],
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
