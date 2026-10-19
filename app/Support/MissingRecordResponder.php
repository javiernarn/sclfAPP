<?php

namespace App\Support;

use App\Models\Claim;
use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use App\Models\StorageLocation;
use App\Models\Visitor;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Turns Laravel's raw "No query results for model [App\Models\X] 3" into
 * something a person can act on, for every API route in the app:
 *
 *  - the record was deleted      -> 410 "This incident report was deleted on
 *                                   Oct 18, 2026 at 10:02 AM by an Administrator."
 *  - it never existed / no access -> 404 "This incident report couldn't be found..."
 *
 * Deletion details are shown only to someone who could have opened the record
 * while it existed (same policy as before it was deleted), so probing ids
 * can't be used to learn what was deleted or by whom. Only the ROLE of the
 * person who deleted it is shown, never their name.
 */
class MissingRecordResponder
{
    /** Model => how it's named in a sentence. */
    private const LABELS = [
        SecurityIncident::class => 'incident report',
        ServiceRequest::class => 'service request',
        LostItem::class => 'lost item report',
        FoundItem::class => 'found item',
        Claim::class => 'claim',
        Visitor::class => 'visitor record',
        StorageLocation::class => 'storage location',
    ];

    private const ARTICLES = [
        'Administrator' => 'an Administrator',
        'Security Officer' => 'a Security Officer',
        'Staff' => 'a Staff member',
        'Instructor' => 'the Instructor who filed it',
        'Student' => 'the Student who filed it',
    ];

    /** Hook for bootstrap/app.php — null means "not ours, use the default 404". */
    public function handle(NotFoundHttpException $e, Request $request): ?JsonResponse
    {
        $previous = $e->getPrevious();

        if (! $previous instanceof ModelNotFoundException || ! ($request->expectsJson() || $request->is('api/*'))) {
            return null;
        }

        return $this->respond($previous, $request);
    }

    public function respond(ModelNotFoundException $e, Request $request): JsonResponse
    {
        $class = $e->getModel();
        $label = self::LABELS[$class] ?? 'record';

        $deleted = $this->deletedRecordFor($class, $e->getIds(), $request);

        if ($deleted && $deleted->deleted_at) {
            $when = $deleted->deleted_at->copy()->timezone(config('app.timezone'))->format('M j, Y \a\t g:i A');
            $role = $deleted->deleted_by_role;
            $by = $role ? ' by ' . (self::ARTICLES[$role] ?? $role) : '';

            return response()->json([
                'success' => false,
                'code' => 'record_deleted',
                'message' => ucfirst("this {$label} was deleted on {$when}{$by}."),
                'deleted' => [
                    'label' => $label,
                    'at' => $deleted->deleted_at->toIso8601String(),
                    'by_role' => $role,
                ],
            ], 410);
        }

        return response()->json([
            'success' => false,
            'code' => 'record_not_found',
            'message' => ucfirst("this {$label} couldn’t be found. It may have been removed, or you may not have access to it."),
        ], 404);
    }

    /** The soft-deleted row, but only if this viewer was allowed to see it. */
    private function deletedRecordFor(string $class, array $ids, Request $request)
    {
        $viewer = $request->user();

        if (! $viewer || empty($ids) || ! class_exists($class)
            || ! in_array(SoftDeletes::class, class_uses_recursive($class), true)) {
            return null;
        }

        $record = $class::onlyTrashed()->find($ids[0]);
        if (! $record) {
            return null;
        }

        $allowed = Gate::getPolicyFor($record)
            ? Gate::forUser($viewer)->allows('view', $record)
            : $viewer->hasAnyRole(['admin', 'staff', 'security_officer']);

        return $allowed ? $record : null;
    }
}
