<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        if (!$request->user()->hasAdminAccess()) {
            abort(403);
        }

        $logs = AuditLog::with('user:id,name', 'user.roles:id,name')
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

        // Older sign-in rows were saved without user_id (login ran before the
        // user was authenticated). Their entity is the User, so recover the
        // name/role from entity_id for those rows.
        $legacyIds = $logs->getCollection()
            ->filter(fn ($l) => ! $l->user_id && $l->entity_type === User::class && $l->entity_id)
            ->pluck('entity_id')->unique();
        $legacyUsers = $legacyIds->isEmpty()
            ? collect()
            : User::withTrashed()->with('roles:id,name')->whereIn('id', $legacyIds)->get()->keyBy('id');

        $logs->getCollection()->transform(function ($l) use ($legacyUsers) {
            $u = $l->user ?: $legacyUsers->get($l->entity_id);
            $l->setRelation('user', null);
            $l->setAttribute('user_name', $u?->name);
            $l->setAttribute('user_role', $u ? $this->roleName($u) : null);

            return $l;
        });

        return response()->json($logs);
    }

    private function roleName(User $u): ?string
    {
        $names = $u->roles->pluck('name')->all();
        $labels = [
            'admin' => 'Admin',
            'staff' => 'Staff',
            'security_officer' => 'Security Officer',
            'instructor' => 'Instructor',
            'student' => 'Student',
        ];
        foreach ($labels as $role => $label) {
            if (in_array($role, $names, true)) {
                return $label;
            }
        }

        return $names ? ucwords(str_replace('_', ' ', $names[0])) : null;
    }
}
