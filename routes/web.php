<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PwaManifestController;

// Dynamic PWA manifest — must come before the catch-all route below,
// so the browser actually gets /manifest.json instead of the SPA shell.
Route::get('/manifest.json', PwaManifestController::class)->name('pwa.manifest');

// This catch-all route serves the same HTML shell for every URL.
// React Router (running in resources/js) takes over from here and
// decides what to actually display based on the URL path.
//
// All real logic (login, lost items, roles, etc.) now lives in
// routes/api.php instead, and is called from React using axios.

Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
