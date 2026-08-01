<?php

use Illuminate\Support\Facades\Route;

// This catch-all route serves the same HTML shell for every URL.
// React Router (running in resources/js) takes over from here and
// decides what to actually display based on the URL path.
//
// All real logic (login, lost items, roles, etc.) now lives in
// routes/api.php instead, and is called from React using axios.

Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');