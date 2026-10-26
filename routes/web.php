<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\PwaManifestController;
use App\Support\Seo;

// Dynamic PWA manifest — must come before the catch-all route below,
// so the browser actually gets /manifest.json instead of the SPA shell.
Route::get('/manifest.json', PwaManifestController::class)->name('pwa.manifest');

// Profile pictures and item photos from the private disk. Access is the
// signed link itself (an <img> tag cannot send a bearer token); see
// App\Support\PrivateMedia. Must come before the catch-all route below.
Route::get('/media/{dir}/{file}', [MediaController::class, 'show'])
    ->middleware(['signed:relative', 'throttle:600,1'])
    // Stateless: an image request should not open a session or set cookies.
    ->withoutMiddleware([
        \Illuminate\Cookie\Middleware\EncryptCookies::class,
        \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
        \Illuminate\Session\Middleware\StartSession::class,
        \Illuminate\View\Middleware\ShareErrorsFromSession::class,
        // CSRF needs the session (it reads/sets the XSRF-TOKEN cookie after the
        // response), so with StartSession removed it throws "Session store not
        // set on request" -> 500. A GET image has nothing to protect anyway.
        \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class,
    ])
    ->name('media.show');

// Link from the verification email. Must come before the catch-all route
// below. Name 'verification.verify' is what Laravel's VerifyEmail
// notification looks for when it builds the signed URL.
Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->whereNumber('id')
    ->middleware('throttle:10,1')
    ->name('verification.verify');

// robots.txt, built per environment so the Sitemap line is an absolute URL
// (the spec requires one). NOTE: a physical public/robots.txt is served by
// the web server before Laravel ever runs, so that file must be deleted for
// this route to take effect.
Route::get('/robots.txt', function (\Illuminate\Http\Request $request) {
    $base = Seo::baseUrl($request);

    $body = implode("\n", [
        'User-agent: *',
        'Allow: /',
        // Signed-in app, tokenised links, private files and the API are
        // never meant to appear in search results.
        'Disallow: /app/',
        'Disallow: /reset-password/',
        'Disallow: /visitor/',
        'Disallow: /email/',
        'Disallow: /media/',
        'Disallow: /api/',
        '',
        "Sitemap: {$base}/sitemap.xml",
        '',
    ]);

    return response($body, 200)
        ->header('Content-Type', 'text/plain; charset=UTF-8')
        ->header('Cache-Control', 'public, max-age=3600');
})->name('robots');

// Sitemap of the public (non-authenticated) pages that are meant to be
// indexed — kept in step with Seo::INDEXABLE so a page is never listed
// while also being marked noindex.
Route::get('/sitemap.xml', function (\Illuminate\Http\Request $request) {
    $base = Seo::baseUrl($request);
    $urls = collect(array_keys(Seo::INDEXABLE))->map(function ($path) use ($base) {
        $loc = e($base . $path);
        $priority = $path === '/' ? '1.0' : '0.8';
        return "  <url><loc>{$loc}</loc><changefreq>monthly</changefreq><priority>{$priority}</priority></url>";
    })->implode("\n");

    $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{$urls}
</urlset>
XML;

    return response($xml, 200)
        ->header('Content-Type', 'application/xml; charset=UTF-8')
        ->header('Cache-Control', 'public, max-age=3600');
})->name('sitemap');

// This catch-all route serves the same HTML shell for every URL.
// React Router (running in resources/js) takes over from here and
// decides what to actually display based on the URL path.
//
// All real logic (login, lost items, roles, etc.) now lives in
// routes/api.php instead, and is called from React using axios.

Route::get('/{any}', function (\Illuminate\Http\Request $request) {
    $seo = Seo::forRequest($request);

    // Same robots rule as the <meta name="robots"> tag, also sent as a header
    // so crawlers that skip the HTML still see it.
    return response()
        ->view('app', ['seo' => $seo])
        ->header('X-Robots-Tag', $seo['robots']);
})->where('any', '.*');
