<?php

namespace App\Http\Controllers;

use App\Models\ReportAttachment;
use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use App\Models\Violation;
use App\Services\Violations\ViolationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Reviewing violations on report photos/videos. Every route here sits behind
 * the admin / staff / security_officer role middleware (see routes/api.php).
 */
class ViolationController extends Controller
{
    public function __construct(protected ViolationService $violations)
    {
    }

    /** Violation list for reviewers; `status` = pending_review|confirmed|dismissed, `user_id` narrows to one person. */
    public function index(Request $request)
    {
        $request->validate([
            'status' => 'nullable|in:' . implode(',', [Violation::STATUS_PENDING, Violation::STATUS_CONFIRMED, Violation::STATUS_DISMISSED]),
            'user_id' => 'nullable|integer',
        ]);

        $paginator = Violation::query()
            ->with(['user:id,name,student_id,staff_id', 'reviewer:id,name', 'attachment:id,kind,original_name,attachable_type,attachable_id'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->latest('id')
            ->paginate(20);

        $paginator->getCollection()->transform(fn (Violation $v) => $this->present($v));

        return response()->json($paginator);
    }

    /** "Mark as violation" on a photo/video — confirmed immediately. */
    public function flag(Request $request, ReportAttachment $attachment)
    {
        $parent = $attachment->attachable;
        abort_if(! $parent, 404);
        $this->authorize('view', $parent);

        $data = $request->validate(['reason' => ['required', 'string', Rule::in(array_keys(Violation::REASONS))]]);

        $violation = $this->violations->markManually($attachment, $request->user(), Violation::REASONS[$data['reason']]);

        return response()->json(['message' => 'Marked as a violation.', 'violation' => $this->present($violation->load('user:id,name,student_id,staff_id'))], 201);
    }

    /** Scanner hit looks right → counts against the user. */
    public function confirm(Request $request, Violation $violation)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', Rule::in(array_keys(Violation::REASONS))]]);

        $violation = $this->violations->confirm(
            $violation,
            $request->user(),
            isset($data['reason']) ? Violation::REASONS[$data['reason']] : null,
        );

        return response()->json(['message' => 'Violation confirmed.', 'violation' => $this->present($violation->load('user:id,name,student_id,staff_id'))]);
    }

    /** "Not a violation" — e.g. blood or an accident photo. */
    public function dismiss(Request $request, Violation $violation)
    {
        $data = $request->validate(['reason' => ['required', 'string', Rule::in(array_keys(Violation::DISMISS_REASONS))]]);

        $violation = $this->violations->dismiss($violation, $request->user(), Violation::DISMISS_REASONS[$data['reason']]);

        return response()->json(['message' => 'Marked as not a violation.', 'violation' => $this->present($violation->load('user:id,name,student_id,staff_id'))]);
    }

    protected function present(Violation $v): array
    {
        $attachment = $v->attachment;
        $parentLabel = null;
        $parentPath = null;

        if ($attachment) {
            if ($attachment->attachable_type === (new SecurityIncident)->getMorphClass() || $attachment->attachable_type === SecurityIncident::class) {
                $parentLabel = 'Incident #' . $attachment->attachable_id;
                $parentPath = '/app/incidents/' . $attachment->attachable_id;
            } elseif ($attachment->attachable_type === (new ServiceRequest)->getMorphClass() || $attachment->attachable_type === ServiceRequest::class) {
                $parentLabel = 'Service request #' . $attachment->attachable_id;
                $parentPath = '/app/service-requests/' . $attachment->attachable_id;
            }
        }

        return [
            'id' => $v->id,
            'status' => $v->status,
            'type' => $v->type,
            'source' => $v->source,
            'reason' => $v->reason,
            'review_note' => $v->review_note,
            'scan_labels' => $v->scan_labels,
            'created_at' => optional($v->created_at)->toIso8601String(),
            'reviewed_at' => optional($v->reviewed_at)->toIso8601String(),
            'user' => $v->user ? ['id' => $v->user->id, 'name' => $v->user->name, 'display_id' => $v->user->display_id] : null,
            'reviewer' => $v->reviewer ? ['id' => $v->reviewer->id, 'name' => $v->reviewer->name] : null,
            'file' => $attachment ? ['id' => $attachment->id, 'kind' => $attachment->kind, 'name' => $attachment->original_name] : null,
            'report' => $parentLabel ? ['label' => $parentLabel, 'path' => $parentPath] : null,
        ];
    }
}
