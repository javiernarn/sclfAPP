<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PwaManifestController;

// Dynamic PWA manifest — must come before the catch-all route below,
// so the browser actually gets /manifest.json instead of the SPA shell.
Route::get('/manifest.json', PwaManifestController::class)->name('pwa.manifest');

// Simple sitemap of the public (non-authenticated) pages, so Google has
// something to crawl and index beyond the login-gated dashboard routes.
Route::get('/sitemap.xml', function () {
    $pages = ['/', '/login', '/register', '/forgot-password'];
    $urls = collect($pages)->map(function ($path) {
        $loc = e(rtrim(config('app.url'), '/') . $path);
        return "  <url><loc>{$loc}</loc><changefreq>monthly</changefreq></url>";
    })->implode("\n");

    $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{$urls}
</urlset>
XML;

    return response($xml, 200)->header('Content-Type', 'application/xml');
})->name('sitemap');

// This catch-all route serves the same HTML shell for every URL.
// React Router (running in resources/js) takes over from here and
// decides what to actually display based on the URL path.
//
// All real logic (login, lost items, roles, etc.) now lives in
// routes/api.php instead, and is called from React using axios.

Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
