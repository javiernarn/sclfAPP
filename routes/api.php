<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\LostItemController;
use Illuminate\Support\Facades\Route;

// Public routes — no login required
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes — must be logged in (valid Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Lost Items — any authenticated user
    Route::get('/lost-items', [LostItemController::class, 'index']);
    Route::post('/lost-items', [LostItemController::class, 'store']);
    Route::get('/lost-items/{lostItem}', [LostItemController::class, 'show']);

    // Admin-only test route
    Route::middleware('role:admin')->get('/admin-test', function () {
        return response()->json(['message' => 'Welcome, Admin! This endpoint is protected.']);
    });
});