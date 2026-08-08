<?php

use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\TwoFactorController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\ClaimController;
use App\Http\Controllers\CounterController;
use App\Http\Controllers\FoundItemController;
use App\Http\Controllers\HistoryController;
use App\Http\Controllers\LostItemController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PushController;
use App\Http\Controllers\QrController;
use App\Http\Controllers\StorageLocationController;
use Illuminate\Support\Facades\Route;

// Public routes — no login required
Route::post('/login', [AuthController::class, 'login']);
Route::middleware('throttle:10,1')->post('/token/refresh', [AuthController::class, 'refreshToken']);

// Mid-login 2FA challenge: authenticated only by the short-lived
// "2fa-pending" token issued from login() above, not a full session — so
// this deliberately sits outside the require.full_access group below
// (that middleware exists specifically to block a pending token from
// reaching anything else).
Route::middleware(['auth:sanctum', 'throttle:10,1'])->post('/2fa/login-verify', [TwoFactorController::class, 'verifyLogin']);

// Throttled separately from login: registration and the availability probe
// are both unauthenticated and repeatable, so without a limit either one
// can be hammered for account-creation spam or used to enumerate which
// emails/phones/student IDs are already registered (checkAvailability
// doesn't reveal *whose* account it is, but an attacker can still brute
// force through the whole ID space if nothing throttles the requests).
Route::middleware('throttle:5,60')->post('/register', [AuthController::class, 'register']);
Route::middleware('throttle:20,1')->post('/check-availability', [AuthController::class, 'checkAvailability']);


// Password recovery — intentionally separate from AuthController/login,
// mirroring the Forgot/Reset Password pages living in their own files.
// Mirrors the Alumni system's recovery flow: find account -> send/resend
// reset link -> reset. `find-account` additionally self-throttles per
// email+IP (5 attempts / 10 minutes) inside the controller.
Route::middleware('throttle:6,1')->group(function () {
    Route::post('/password/find-account', [PasswordResetController::class, 'findAccount']);
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
});

// Protected routes — must be logged in (valid Sanctum token) AND have an
// account that hasn't been disabled by an administrator, AND (via
// require.full_access) hold a real session token rather than a
// still-mid-2FA-challenge pending one.
Route::middleware(['auth:sanctum', 'account.active', 'require.full_access'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Two-factor authentication management (Profile page's Security
    // card). Setup/confirm/disable all require a fully-authenticated
    // session — none of these should be reachable with a 2fa-pending
    // token, which require.full_access already guarantees for the whole
    // group.
    Route::post('/2fa/setup', [TwoFactorController::class, 'setup']);
    Route::post('/2fa/confirm', [TwoFactorController::class, 'confirm']);
    Route::post('/2fa/disable', [TwoFactorController::class, 'disable']);

    // Lost Items — any authenticated user may browse/search; create is
    // restricted to student/instructor via LostItemPolicy inside the controller.
    Route::get('/lost-items', [LostItemController::class, 'index']);
    Route::post('/lost-items', [LostItemController::class, 'store']);
    Route::get('/lost-items/{lostItem}', [LostItemController::class, 'show']);
    Route::delete('/lost-items/{lostItem}', [LostItemController::class, 'destroy']);
    Route::get('/lost-items/{lostItem}/matches', [MatchController::class, 'forLostItem']);

    // Found Items
    Route::get('/found-items', [FoundItemController::class, 'index']);
    Route::post('/found-items', [FoundItemController::class, 'store']);
    Route::get('/found-items/{foundItem}', [FoundItemController::class, 'show']);
    Route::get('/found-items/{foundItem}/matches', [MatchController::class, 'forFoundItem']);
    Route::get('/found-items/{foundItem}/movements', [StorageLocationController::class, 'history']);

    // Matches
    Route::post('/matches/{match}/dismiss', [MatchController::class, 'dismiss']);

    // Claims
    Route::get('/claims', [ClaimController::class, 'index']);
    Route::post('/found-items/{foundItem}/claims', [ClaimController::class, 'store']);
    Route::get('/claims/{claim}', [ClaimController::class, 'show']);
    Route::post('/claims/{claim}/evidence', [ClaimController::class, 'addEvidence']);
    // Private, policy-checked evidence retrieval — replaces the old
    // public('storage')-disk URL that anyone with the link could hit.
    Route::get('/claims/evidence/{evidence}/download', [ClaimController::class, 'downloadEvidence']);
    Route::post('/claims/{claim}/cancel', [ClaimController::class, 'cancel']);
    // Claimant downloads/re-downloads their own release QR (offline-friendly pass).
    Route::post('/claims/{claim}/download-release', [ClaimController::class, 'downloadRelease']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // Web Push — OS-level notifications outside the browser/PWA. See
    // PushController, WebPushChannel, and public/sw.js.
    Route::get('/push/status', [PushController::class, 'status']);
    Route::post('/push/subscribe', [PushController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushController::class, 'unsubscribe']);

    // Reference data for forms/dropdowns
    Route::get('/campuses', [\App\Http\Controllers\ReferenceDataController::class, 'campuses']);
    Route::get('/buildings', [\App\Http\Controllers\ReferenceDataController::class, 'buildings']);
    Route::get('/locations', [\App\Http\Controllers\ReferenceDataController::class, 'locations']);

    // --- Security Officer / Admin only ---
    Route::middleware('role:security_officer,admin')->group(function () {
        Route::post('/found-items/{foundItem}/verify', [FoundItemController::class, 'verify']);

        Route::get('/storage-locations', [StorageLocationController::class, 'index']);
        Route::post('/storage-locations', [StorageLocationController::class, 'store']);
        Route::post('/found-items/{foundItem}/assign-storage', [StorageLocationController::class, 'assign']);
        Route::post('/found-items/{foundItem}/move-storage', [StorageLocationController::class, 'move']);

        Route::patch('/claims/{claim}/review', [ClaimController::class, 'review']);
        Route::post('/claims/{claim}/generate-release', [ClaimController::class, 'generateRelease']);
        Route::post('/claims/{claim}/regenerate-release', [ClaimController::class, 'regenerateRelease']);
        // Fallback when a student can't show their QR (lost phone, expired
        // code) — officer identity + a required reason stand in for the
        // token check. See ItemReleaseService::manualRelease().
        Route::post('/claims/{claim}/manual-release', [ClaimController::class, 'manualRelease']);

        // Counter — walk-in item check-in for a known owner (see
        // CounterIntakeService). Search is its own throttle since it's a
        // student-directory lookup, not tied to a specific record.
        Route::middleware('throttle:60,1')->get('/counter/owners', [CounterController::class, 'searchOwners']);
        Route::post('/counter/check-in', [CounterController::class, 'checkIn']);

        // Throttled separately from the rest of the security group — this is
        // the actual point where an item leaves the building, and a camera
        // scanner can retry fast, so cap attempts to slow down guessing.
        Route::middleware('throttle:30,1')->post('/qr/scan', [QrController::class, 'scan']);
        // Fallback decode for "Upload QR Image" when the browser's own
        // decoder can't read the file — throttled separately and more
        // tightly since image decoding is heavier per-request than a
        // plain payload scan.
        Route::middleware('throttle:20,1')->post('/qr/decode-image', [QrController::class, 'decodeImage']);
        Route::post('/qr/{qrRelease}/revoke', [QrController::class, 'revoke']);

        // History — read-only. Counter release history (CounterIntakeService
        // + ItemReleaseService, scoped to counter check-ins) and Lost &
        // Found release history (the full claim pipeline's release step,
        // any intake channel). See HistoryController for how release
        // method (qr_scan vs manual) is derived from the audit trail.
        Route::get('/history/counter-releases', [HistoryController::class, 'counterReleases']);
        Route::get('/history/lost-found-releases', [HistoryController::class, 'releases']);

        Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('/analytics/categories', [AnalyticsController::class, 'categories']);
        Route::get('/analytics/high-risk-locations', [AnalyticsController::class, 'highRiskLocations']);
        Route::get('/analytics/monthly', [AnalyticsController::class, 'monthly']);
        Route::get('/analytics/peak-hours', [AnalyticsController::class, 'peakHours']);
    });

    // --- Admin only ---
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin-test', function () {
            return response()->json(['message' => 'Welcome, Admin! This endpoint is protected.']);
        });

        // Cleanup: hard-remove a claim record from the list (e.g.
        // redundant/cancelled claims). Separate from /claims/{claim}/cancel,
        // which only transitions status and keeps the record.
        Route::delete('/claims/{claim}', [ClaimController::class, 'destroy']);
        // Bulk cleanup: wipe every cancelled claim for one user in one go,
        // used by the admin User Details page.
        Route::delete('/admin/users/{user}/claims/cancelled', [ClaimController::class, 'destroyCancelledForUser']);

        Route::get('/admin/users', [AdminUserController::class, 'index']);
        Route::post('/admin/users', [AdminUserController::class, 'store']);
        Route::get('/admin/users/{user}', [AdminUserController::class, 'show'])->withTrashed();
        Route::put('/admin/users/{user}', [AdminUserController::class, 'update']);
        Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
        Route::post('/admin/users/{id}/restore', [AdminUserController::class, 'restore']);
        // audit log
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
    });
});
