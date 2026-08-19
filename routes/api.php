<?php

use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\TwoFactorController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\ClaimController;
use App\Http\Controllers\CounterController;
use App\Http\Controllers\DispositionController;
use App\Http\Controllers\FoundItemController;
use App\Http\Controllers\HistoryController;
use App\Http\Controllers\LostItemController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PushController;
use App\Http\Controllers\QrController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SecurityIncidentController;
use App\Http\Controllers\ServiceRequestController;
use App\Http\Controllers\StorageLocationController;
use App\Http\Controllers\VisitorController;
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
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
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
    Route::get('/departments', [\App\Http\Controllers\ReferenceDataController::class, 'departments']);

    // Global Search — one box across found/lost items, claims, incidents,
    // service requests, and (staff-only) assets/visitors. Each category
    // re-applies its own controller's visibility rule inside SearchService,
    // so this endpoint can't surface anything the person couldn't already
    // reach through that section's own list page.
    Route::get('/search', [SearchController::class, 'index']);

    // Security Incidents — reporting is open to any authenticated user
    // (student/instructor/officer/admin); index()/show() self-scope to
    // "my reports" vs "everything" inside the controller depending on
    // role. Managing an incident (assign/resolve/close/reopen) is
    // officer/admin-only, see the role-restricted group below.
    Route::get('/security-incidents', [SecurityIncidentController::class, 'index']);
    Route::post('/security-incidents', [SecurityIncidentController::class, 'store']);
    Route::get('/security-incidents/{securityIncident}', [SecurityIncidentController::class, 'show']);

    // Service Requests — filing is open to any authenticated user, same
    // "my requests" vs "everything" self-scoping as Security Incidents
    // above. Cancelling your own still-open request is also here (not in
    // the role-restricted group below) since a requester — not just
    // staff — can call one off; ServiceRequestPolicy::cancel() covers
    // both cases.
    Route::get('/service-requests', [ServiceRequestController::class, 'index']);
    Route::post('/service-requests', [ServiceRequestController::class, 'store']);
    Route::get('/service-requests/{serviceRequest}', [ServiceRequestController::class, 'show']);
    Route::post('/service-requests/{serviceRequest}/cancel', [ServiceRequestController::class, 'cancel']);

    // Assets — viewing your own assigned asset(s) ("My Assets") is open
    // to any authenticated user, same custodian-can-always-see-it rule
    // as AssetPolicy::view(). Registering/managing the registry itself
    // is officer/admin-only, see the role-restricted group below.
    Route::get('/assets', [AssetController::class, 'index']);
    Route::get('/assets/{asset}', [AssetController::class, 'show']);

    // Counter queue — joining/viewing/cancelling your own ticket is open
    // to any authenticated user (student/instructor waiting in line);
    // running the queue (call/serve/complete/no-show/dashboard) is
    // officer/admin-only, see the role-restricted group below.
    Route::post('/storage-locations/{storageLocation}/queue/join', [CounterController::class, 'joinQueue']);
    Route::get('/counter/queue/mine', [CounterController::class, 'myQueueEntries']);
    Route::delete('/counter/queue/{queueEntry}', [CounterController::class, 'cancelQueueEntry']);

    // --- Security Officer / Admin only ---
    Route::middleware('role:security_officer,admin')->group(function () {
        Route::post('/found-items/{foundItem}/verify', [FoundItemController::class, 'verify']);

        Route::get('/storage-locations', [StorageLocationController::class, 'index']);
        Route::post('/storage-locations', [StorageLocationController::class, 'store']);
        Route::patch('/storage-locations/{storageLocation}/capacity', [StorageLocationController::class, 'updateCapacity']);
        Route::post('/found-items/{foundItem}/assign-storage', [StorageLocationController::class, 'assign']);
        Route::post('/found-items/{foundItem}/move-storage', [StorageLocationController::class, 'move']);

        // Phase 3 — unclaimed items + disposition. Listing/sweeping is
        // campus-scoped inside the controller the same way the Counter
        // Dashboard is; dispose/restore additionally check the specific
        // item's campus, matching assign/move-storage above.
        Route::get('/inventory/unclaimed', [DispositionController::class, 'index']);
        Route::post('/inventory/unclaimed/sweep', [DispositionController::class, 'sweep']);
        Route::post('/found-items/{foundItem}/dispose', [DispositionController::class, 'dispose']);
        Route::post('/found-items/{foundItem}/restore', [DispositionController::class, 'restore']);

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

        // Counter staff assignment — read is available to any security
        // officer/admin (so whoever's on shift can see who's assigned
        // where); assign/unassign are further gated to admin-only inside
        // the controller, since staffing is a supervisory action.
        Route::get('/storage-locations/{storageLocation}/officers', [CounterController::class, 'officers']);
        Route::post('/storage-locations/{storageLocation}/officers', [CounterController::class, 'assignOfficer']);
        Route::delete('/storage-locations/{storageLocation}/officers/{user}', [CounterController::class, 'unassignOfficer']);

        // Counter Dashboard — live per-counter summary, status toggle,
        // and running the queue. Joining/cancelling your own queue ticket
        // lives in the any-authenticated-user group above; everything
        // here is about operating the counter, not waiting at it.
        Route::get('/counter/dashboard', [CounterController::class, 'dashboard']);
        Route::patch('/storage-locations/{storageLocation}/status', [CounterController::class, 'updateStatus']);
        Route::get('/storage-locations/{storageLocation}/queue', [CounterController::class, 'listQueue']);
        Route::post('/storage-locations/{storageLocation}/queue/call-next', [CounterController::class, 'callNextInQueue']);
        Route::post('/counter/queue/{queueEntry}/call', [CounterController::class, 'callQueueEntry']);
        Route::post('/counter/queue/{queueEntry}/serve', [CounterController::class, 'startServingQueueEntry']);
        Route::post('/counter/queue/{queueEntry}/complete', [CounterController::class, 'completeQueueEntry']);
        Route::post('/counter/queue/{queueEntry}/no-show', [CounterController::class, 'markQueueEntryNoShow']);

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

        // Security Incidents — managing an incident's lifecycle. Listing
        // and reporting live in the any-authenticated-user group above.
        Route::post('/security-incidents/{securityIncident}/assign', [SecurityIncidentController::class, 'assign']);
        Route::post('/security-incidents/{securityIncident}/resolve', [SecurityIncidentController::class, 'resolve']);
        Route::post('/security-incidents/{securityIncident}/close', [SecurityIncidentController::class, 'close']);
        Route::post('/security-incidents/{securityIncident}/reopen', [SecurityIncidentController::class, 'reopen']);

        // Visitor Management — front-desk check-in/out log, fully
        // officer/admin-only (no student-facing side to this one).
        Route::get('/visitors', [VisitorController::class, 'index']);
        Route::post('/visitors', [VisitorController::class, 'store']);
        Route::post('/visitors/{visitor}/check-out', [VisitorController::class, 'checkOut']);

        // Service Requests — managing the lifecycle (assign/start/
        // complete/close/reopen). Filing, viewing, and self-cancelling
        // live in the any-authenticated-user group above.
        Route::post('/service-requests/{serviceRequest}/assign', [ServiceRequestController::class, 'assign']);
        Route::post('/service-requests/{serviceRequest}/start', [ServiceRequestController::class, 'start']);
        Route::post('/service-requests/{serviceRequest}/complete', [ServiceRequestController::class, 'complete']);
        Route::post('/service-requests/{serviceRequest}/close', [ServiceRequestController::class, 'close']);
        Route::post('/service-requests/{serviceRequest}/reopen', [ServiceRequestController::class, 'reopen']);

        // Asset registry — register/assign/unassign/repair cycle/retire/
        // lost. Viewing (including a custodian's own "My Assets") lives
        // in the any-authenticated-user group above.
        Route::post('/assets', [AssetController::class, 'store']);
        Route::post('/assets/{asset}/assign', [AssetController::class, 'assign']);
        Route::post('/assets/{asset}/unassign', [AssetController::class, 'unassign']);
        Route::post('/assets/{asset}/send-for-repair', [AssetController::class, 'sendForRepair']);
        Route::post('/assets/{asset}/return-from-repair', [AssetController::class, 'returnFromRepair']);
        Route::post('/assets/{asset}/retire', [AssetController::class, 'retire']);
        Route::post('/assets/{asset}/report-lost', [AssetController::class, 'reportLost']);
        // Custodian lookup for the Asset assign form — see ReferenceDataController::lookupUser().
        Route::middleware('throttle:30,1')->get('/users/lookup', [\App\Http\Controllers\ReferenceDataController::class, 'lookupUser']);

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

        // Departments — campus-scoped org units, distinct from users.course
        // (free-text academic program). See the departments migration.
        Route::get('/admin/departments', [\App\Http\Controllers\Admin\DepartmentController::class, 'index']);
        Route::post('/admin/departments', [\App\Http\Controllers\Admin\DepartmentController::class, 'store']);
        Route::put('/admin/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'update']);
        Route::delete('/admin/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'destroy']);
    });
});
