<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()->hasRole('admin')) {
            abort(403);
        }

        $logs = AuditLog::with('user:id,name')
            ->when($request->action, fn ($q) => $q->where('action', $request->action))
            // actions[]=auth.login&actions[]=auth.logout — used by the global
            // Audit Log page to show sign-in activity only. Everything else
            // (claim status changes, item reports, storage moves, etc.)
            // lives on the specific account's own Activity tab instead
            // (Admin > Users > that user > All activity), scoped to just
            // them, so it doesn't get mixed in here across every user.
            ->when($request->actions, fn ($q) => $q->whereIn('action', (array) $request->actions))
            ->when($request->entity_type, fn ($q) => $q->where('entity_type', $request->entity_type))
            ->when($request->user_id, fn ($q) => $q->where('user_id', $request->user_id))
            ->latest('created_at')
            ->paginate(25);

        return response()->json($logs);
    }
}
