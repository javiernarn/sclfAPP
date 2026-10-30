<?php

use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Admin\UserActivityController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EmailChangeController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\TwoFactorController;
use App\Http\Controllers\ActionRequestController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\PrintReportController;
use App\Http\Controllers\ClaimController;
use App\Http\Controllers\CounterController;
use App\Http\Controllers\DraftController;
use App\Http\Controllers\DispositionController;
use App\Http\Controllers\FoundItemController;
use App\Http\Controllers\HistoryController;
use App\Http\Controllers\LostItemController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PushController;
use App\Http\Controllers\QrController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ReportAttachmentController;
use App\Http\Controllers\ViolationController;
use App\Http\Controllers\SecurityIncidentController;
use App\Http\Controllers\ServiceRequestController;
use App\Http\Controllers\StorageLocationController;
use App\Http\Controllers\PublicVisitorController;
use App\Http\Controllers\VisitorController;
use Illuminate\Support\Facades\Route;

// Public routes — no login required
Route::middleware('throttle:login-ip')->post('/login', [AuthController::class, 'login']);
Route::middleware('throttle:refresh')->post('/token/refresh', [AuthController::class, 'refreshToken']);

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
Route::middleware('throttle:register')->post('/register', [AuthController::class, 'register']);
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

// Read-only check the Reset Password page makes as soon as it opens: is this
// emailed link still usable (not used, not expired, not replaced)? Separate
// from the group above so merely opening/refreshing the page doesn't eat the
// 6-per-minute budget the real reset needs.
Route::middleware('throttle:30,1')->post('/password/reset-token/check', [PasswordResetController::class, 'checkToken']);

// Visitor portal — the page behind the QR code on a visitor badge. No login: the
// visitor just scanned the badge. The token is signed (see App\Support\VisitorBadgeLink),
// every step releases only a little information (see PublicVisitorController), and the
// routes are throttled per IP so they cannot be used to probe badges.
Route::middleware('throttle:30,1')->prefix('public/visitor')->group(function () {
    Route::get('/{token}', [PublicVisitorController::class, 'show']);
    Route::post('/{token}/confirm', [PublicVisitorController::class, 'confirm']);
    Route::post('/{token}/not-me', [PublicVisitorController::class, 'notMe']);
});

// Protected routes — must be logged in (valid Sanctum token) AND have an
// account that hasn't been disabled by an administrator, AND (via
// require.full_access) hold a real session token rather than a
// still-mid-2FA-challenge pending one, AND (via profile.setup) have
// finished the mandatory first-login setup if the admin who created the
// account left it pending (see EnsureProfileSetupComplete — it allows
// /me, /logout and /profile/complete-setup through even while pending, so
// this whole group can still stay in one place).
// `staff.approval` is last on purpose: staff pass every role check below (so they
// can read what an admin reads), then this refuses any write that the admin
// hasn't approved. See RequireStaffApproval.
Route::middleware(['auth:sanctum', 'account.active', 'require.full_access', 'profile.setup', 'email.verified', 'staff.approval'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    // Ask for a new verification email (the only thing an unverified
    // account may do besides /me and /logout — see EnsureEmailVerified).
    Route::middleware('throttle:3,1')->post('/email/verification-notification', [EmailVerificationController::class, 'resend']);
    // Finish verifying with the 6-digit code from the email (no browser hop).
    Route::middleware('throttle:10,1')->post('/email/verify-code', [EmailVerificationController::class, 'verifyCode']);
    Route::get('/me', [AuthController::class, 'me']);
    // Checks the CURRENT password, so a stolen session must not be able to guess it.
    Route::middleware('throttle:5,1')->post('/change-password', [AuthController::class, 'changePassword']);

    // Mandatory first-login setup for an admin-created staff account —
    // see ProfileController::completeSetup() and SetupAccountPage.jsx.
    Route::middleware('throttle:10,1')->post('/profile/complete-setup', [ProfileController::class, 'completeSetup']);

    // Profile > Change email (students + instructors, switched by
    // SCLF_EMAIL_CHANGE_ENABLED). Step 1 checks the CURRENT password and
    // emails a 6-digit code to the new address; step 2 confirms the code.
    Route::middleware('throttle:5,1')->post('/profile/email/request', [EmailChangeController::class, 'request']);
    Route::middleware('throttle:10,1')->post('/profile/email/confirm', [EmailChangeController::class, 'confirm']);
    Route::middleware('throttle:20,1')->get('/profile/email/status', [EmailChangeController::class, 'status']);
    Route::middleware('throttle:20,1')->delete('/profile/email/pending', [EmailChangeController::class, 'cancel']);

    // Avatar-menu switches (currently: email notifications on/off).
    Route::middleware('throttle:30,1')->patch('/profile/preferences', [ProfileController::class, 'updatePreferences']);

    // Auto Save drafts (one per form per account) — follow the person to another device.
    Route::middleware('throttle:120,1')->group(function () {
        Route::delete('/drafts', [DraftController::class, 'destroyAll']);
        Route::get('/drafts/{form}', [DraftController::class, 'show']);
        Route::put('/drafts/{form}', [DraftController::class, 'store']);
        Route::delete('/drafts/{form}', [DraftController::class, 'destroy']);
    });

    // Two-factor authentication management (Profile page's Security
    // card). Setup/confirm/disable all require a fully-authenticated
    // session — none of these should be reachable with a 2fa-pending
    // token, which require.full_access already guarantees for the whole
    // group.
    Route::post('/2fa/setup', [TwoFactorController::class, 'setup']);
    Route::middleware('throttle:10,1')->post('/2fa/confirm', [TwoFactorController::class, 'confirm']);
    Route::middleware('throttle:5,1')->post('/2fa/disable', [TwoFactorController::class, 'disable']);

    // Lost Items — any authenticated user may browse/search; create is
    // restricted to student/instructor via LostItemPolicy inside the controller.
    Route::get('/lost-items', [LostItemController::class, 'index']);
    Route::middleware(['throttle:reports', 'daily.report:lost'])->post('/lost-items', [LostItemController::class, 'store']);
    Route::get('/lost-items/{lostItem}', [LostItemController::class, 'show']);
    Route::delete('/lost-items/{lostItem}', [LostItemController::class, 'destroy']);
    Route::get('/lost-items/{lostItem}/matches', [MatchController::class, 'forLostItem']);

    // Found Items
    Route::get('/found-items', [FoundItemController::class, 'index']);
    Route::middleware(['throttle:reports', 'daily.report:found'])->post('/found-items', [FoundItemController::class, 'store']);
    Route::get('/found-items/{foundItem}', [FoundItemController::class, 'show']);
    Route::get('/found-items/{foundItem}/matches', [MatchController::class, 'forFoundItem']);
    Route::get('/found-items/{foundItem}/movements', [StorageLocationController::class, 'history']);

    // Matches
    // Live score for a report that has not been filed yet (the report forms call this as you type).
    Route::post('/matches/preview', [MatchController::class, 'preview'])->middleware('throttle:90,1');
    Route::post('/matches/{match}/dismiss', [MatchController::class, 'dismiss']);

    // Claims
    Route::get('/claims', [ClaimController::class, 'index']);
    Route::middleware('throttle:reports')->post('/found-items/{foundItem}/claims', [ClaimController::class, 'store']);
    Route::get('/claims/{claim}', [ClaimController::class, 'show']);
    Route::middleware('throttle:uploads')->post('/claims/{claim}/evidence', [ClaimController::class, 'addEvidence']);
    // Private, policy-checked evidence retrieval — replaces the old
    // public('storage')-disk URL that anyone with the link could hit.
    Route::get('/claims/evidence/{evidence}/download', [ClaimController::class, 'downloadEvidence']);
    Route::post('/claims/{claim}/cancel', [ClaimController::class, 'cancel']);
    // Claimant downloads/re-downloads their own release QR (offline-friendly pass).
    Route::post('/claims/{claim}/download-release', [ClaimController::class, 'downloadRelease']);

    // Personal dashboard analytics (student/instructor) — only the caller's own records.
    Route::get('/analytics/me', [AnalyticsController::class, 'me']);

    // Printed dashboard (the QR on the paper opens /app/print/{token}). Open to the
    // account's owner, and to admin/staff/security — enforced in the controller.
    Route::get('/print-report/{token}', [PrintReportController::class, 'show'])->where('token', '[A-Za-z0-9_-]{16,64}');

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
    Route::get('/locations', [\App\Http\Controllers\ReferenceDataController::class, 'locations']);
    Route::get('/departments', [\App\Http\Controllers\ReferenceDataController::class, 'departments']);

    // Global Search — one box across found/lost items, claims, incidents,
    // service requests, and (staff-only) visitors. Each category
    // re-applies its own controller's visibility rule inside SearchService,
    // so this endpoint can't surface anything the person couldn't already
    // reach through that section's own list page.
    Route::get('/search', [SearchController::class, 'index']);
    // Suggestive search: role-aware suggestions when the box opens, and
    // type-ahead completions as the person types.
    Route::middleware('throttle:120,1')->get('/search/suggestions', [SearchController::class, 'suggestions']);
    // Recent (successful) searches, stored per account in recent_searches.
    Route::get('/search/recent', [SearchController::class, 'recent']);
    Route::post('/search/recent', [SearchController::class, 'storeRecent']);
    Route::delete('/search/recent/{id}', [SearchController::class, 'destroyRecent'])->whereNumber('id');
    Route::delete('/search/recent', [SearchController::class, 'clearRecent']);

    // Security Incidents — reporting is open to any authenticated user
    // (student/instructor/officer/admin); index()/show() self-scope to
    // "my reports" vs "everything" inside the controller depending on
    // role. Managing an incident (assign/resolve/close/reopen) is
    // officer/admin-only, see the role-restricted group below.
    Route::get('/security-incidents', [SecurityIncidentController::class, 'index']);
    Route::middleware(['throttle:reports', 'daily.report:incident'])->post('/security-incidents', [SecurityIncidentController::class, 'store']);
    Route::get('/security-incidents/{securityIncident}', [SecurityIncidentController::class, 'show']);
    // Editing your own fresh report lives here (any authenticated user);
    // the policy itself is what actually restricts it to the reporter
    // while status is still 'reported', or to staff short of closed.
    Route::patch('/security-incidents/{securityIncident}', [SecurityIncidentController::class, 'update']);

    // Service Requests — filing is open to any authenticated user, same
    // "my requests" vs "everything" self-scoping as Security Incidents
    // above. Cancelling your own still-open request is also here (not in
    // the role-restricted group below) since a requester — not just
    // staff — can call one off; ServiceRequestPolicy::cancel() covers
    // both cases.
    // Photo/video evidence attached to either of the above — private disk,
    // authorized against the parent report on every request.
    Route::get('/report-attachments/{attachment}', [ReportAttachmentController::class, 'show']);

    Route::get('/service-requests', [ServiceRequestController::class, 'index']);
    Route::middleware(['throttle:reports', 'daily.report:service'])->post('/service-requests', [ServiceRequestController::class, 'store']);
    Route::get('/service-requests/{serviceRequest}', [ServiceRequestController::class, 'show']);
    Route::post('/service-requests/{serviceRequest}/cancel', [ServiceRequestController::class, 'cancel']);

    // Counter queue — joining/viewing/cancelling your own ticket is open
    // to any authenticated user (student/instructor waiting in line);
    // running the queue (call/serve/complete/no-show/dashboard) is
    // officer/admin-only, see the role-restricted group below.
    Route::post('/storage-locations/{storageLocation}/queue/join', [CounterController::class, 'joinQueue']);
    Route::get('/counter/queue/mine', [CounterController::class, 'myQueueEntries']);
    Route::delete('/counter/queue/{queueEntry}', [CounterController::class, 'cancelQueueEntry']);

    // --- Security Officer / Admin only ---
    Route::middleware('role:security_officer,admin,staff')->group(function () {
        // Violations — reviewing sensitive photos/videos on reports. Staff
        // need no admin approval for these (see sclf.staff_approval.exempt_paths).
        Route::get('/violations', [ViolationController::class, 'index']);
        Route::post('/report-attachments/{attachment}/violation', [ViolationController::class, 'flag']);
        Route::post('/violations/{violation}/confirm', [ViolationController::class, 'confirm']);
        Route::post('/violations/{violation}/dismiss', [ViolationController::class, 'dismiss']);

        Route::post('/found-items/{foundItem}/verify', [FoundItemController::class, 'verify']);

        // Approve a lost report -> queued email to students/instructors.
        Route::post('/lost-items/{lostItem}/approve', [LostItemController::class, 'approve']);

        // Lost & found match queue — the handlers' (security / admin / staff)
        // view of every pairing the matching engine recorded.
        Route::get('/matches', [MatchController::class, 'index']);
        Route::get('/matches/pulse', [MatchController::class, 'pulse']);
        Route::get('/matches/model', [MatchController::class, 'model']);
        Route::get('/matches/{match}', [MatchController::class, 'show'])->whereNumber('match');
        Route::post('/matches/{match}/notify-owner', [MatchController::class, 'notifyOwner']);

        Route::get('/storage-locations', [StorageLocationController::class, 'index']);
        Route::post('/storage-locations', [StorageLocationController::class, 'store']);
        Route::patch('/storage-locations/{storageLocation}/capacity', [StorageLocationController::class, 'updateCapacity']);
        Route::patch('/storage-locations/{storageLocation}', [StorageLocationController::class, 'update']);
        Route::delete('/storage-locations/{storageLocation}', [StorageLocationController::class, 'destroy']);
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
        Route::get('/counter/owners/{owner}/lost-reports', [CounterController::class, 'ownerLostReports'])->whereNumber('owner');

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
        // Admin-only in practice — SecurityIncidentPolicy::delete() enforces
        // that regardless of this route sitting in the officer+admin group.
        Route::delete('/security-incidents/{securityIncident}', [SecurityIncidentController::class, 'destroy']);

        // Visitor Management — front-desk check-in/out log (no student-facing side).
        // READ (index, purpose-fields): Security Officer, Admin and Staff - the full history.
        // WRITE (check-in, edit, check-out, badges, student search): Security Officer ONLY -
        // enforced in VisitorController::ensureCanManage(). Delete: nobody (see destroy()).
        Route::get('/visitors', [VisitorController::class, 'index']);
        Route::get('/visitors/badges', [VisitorController::class, 'badges']);
        Route::get('/visitors/purpose-fields', [VisitorController::class, 'purposeFields']);
        Route::get('/visitors/student-search', [VisitorController::class, 'searchStudents']);
        Route::post('/visitors', [VisitorController::class, 'store']);
        Route::post('/visitors/{visitor}/check-out', [VisitorController::class, 'checkOut']);
        Route::patch('/visitors/{visitor}', [VisitorController::class, 'update']);
        // Admin-only in practice — enforced inline in the controller.
        Route::delete('/visitors/{visitor}', [VisitorController::class, 'destroy']);

        // Service Requests — managing the lifecycle (assign/start/
        // complete/close/reopen). Filing, viewing, and self-cancelling
        // live in the any-authenticated-user group above.
        Route::post('/service-requests/{serviceRequest}/assign', [ServiceRequestController::class, 'assign']);
        Route::post('/service-requests/{serviceRequest}/start', [ServiceRequestController::class, 'start']);
        Route::post('/service-requests/{serviceRequest}/complete', [ServiceRequestController::class, 'complete']);
        Route::post('/service-requests/{serviceRequest}/close', [ServiceRequestController::class, 'close']);
        Route::post('/service-requests/{serviceRequest}/reopen', [ServiceRequestController::class, 'reopen']);

        Route::get('/analytics/dashboard', [AnalyticsController::class, 'dashboard']);
        Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
        Route::get('/analytics/categories', [AnalyticsController::class, 'categories']);
        Route::get('/analytics/monthly', [AnalyticsController::class, 'monthly']);
    });

    // --- Student dashboard printing switch (clearance signing) ---
    // Anyone signed in can read it (the student's button needs it);
    // only the admin can change it.
    Route::get('/print-access', [\App\Http\Controllers\PrintAccessController::class, 'show']);
    Route::middleware('role:admin')->put('/admin/print-access', [\App\Http\Controllers\PrintAccessController::class, 'update']);
    Route::middleware('role:admin')->post('/admin/print-access/notify', [\App\Http\Controllers\PrintAccessController::class, 'notify']);

    // --- Approval requests (staff files them, admin reviews them) ---
    // Only the admin can open the request list; staff can no longer view it.
    Route::middleware('role:admin')->get('/action-requests', [ActionRequestController::class, 'index']);
    Route::middleware('role:admin,staff')->group(function () {
        Route::post('/action-requests', [ActionRequestController::class, 'store']);
        Route::delete('/action-requests/{actionRequest}', [ActionRequestController::class, 'cancel']);
    });

    // Only the one admin decides: Approve / Pending / Reject.
    Route::middleware('role:admin')->patch('/admin/action-requests/{actionRequest}', [ActionRequestController::class, 'updateStatus']);

    // --- Admin + Staff (staff are read-only here unless a request was approved) ---
    Route::middleware('role:admin,staff')->group(function () {
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
        // audit log: the Admin only (staff don't need the raw trail of who
        // did what, from which IP). Least privilege, see PHASE_5.md.
        Route::middleware('role:admin')->get('/audit-logs', [AuditLogController::class, 'index']);

        // User Activity — device/IP/spam monitoring. Separate from
        // /audit-logs (curated business events): this is the raw
        // request-level feed recorded by TrackUserActivity, used for
        // "who's actually using this, from where, and does it look like
        // abuse" rather than "what did this account do".
        // Admin only (IPs, devices and the abuse flags of every account).
        Route::middleware('role:admin')->group(function () {
            Route::get('/admin/activity', [UserActivityController::class, 'index']);
            Route::get('/admin/activity/users/{user}/summary', [UserActivityController::class, 'summary']);
        });

        // Departments — campus-scoped org units, distinct from users.course
        // (free-text academic program). See the departments migration.
        Route::get('/admin/departments', [\App\Http\Controllers\Admin\DepartmentController::class, 'index']);
        Route::post('/admin/departments', [\App\Http\Controllers\Admin\DepartmentController::class, 'store']);
        Route::put('/admin/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'update']);
        Route::delete('/admin/departments/{department}', [\App\Http\Controllers\Admin\DepartmentController::class, 'destroy']);
    });
});
