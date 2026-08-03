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
            ->when($request->entity_type, fn ($q) => $q->where('entity_type', $request->entity_type))
            ->when($request->user_id, fn ($q) => $q->where('user_id', $request->user_id))
            ->latest('created_at')
            ->paginate(25);

        return response()->json($logs);
    }
}
