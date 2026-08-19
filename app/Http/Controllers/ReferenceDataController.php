<?php

namespace App\Http\Controllers;

use App\Models\Building;
use App\Models\Campus;
use App\Models\Department;
use App\Models\Location;
use App\Models\User;
use Illuminate\Http\Request;

class ReferenceDataController extends Controller
{
    public function campuses()
    {
        return response()->json(Campus::orderBy('name')->get());
    }

    public function buildings(Request $request)
    {
        return response()->json(
            Building::when($request->campus_id, fn ($q) => $q->where('campus_id', $request->campus_id))
                ->orderBy('name')
                ->get()
        );
    }

    public function locations(Request $request)
    {
        return response()->json(
            Location::when($request->campus_id, fn ($q) => $q->where('campus_id', $request->campus_id))
                ->orderBy('name')
                ->get()
        );
    }

    public function departments(Request $request)
    {
        return response()->json(
            Department::when($request->campus_id, fn ($q) => $q->where('campus_id', $request->campus_id))
                ->orderBy('name')
                ->get()
        );
    }

    /**
     * Exact-email lookup, officer/admin only (see routes/api.php) — used
     * by the Asset assign form to find a custodian by email without
     * exposing the full admin user directory (that stays admin-only, see
     * AdminUserController). Deliberately a single exact match rather
     * than a name/partial search: a proper "browse staff/students"
     * picker is a bigger feature than this endpoint is meant to cover,
     * same reasoning IncidentDetail's "assign to someone else" left as
     * a documented judgment call in Phase 4.
     */
    public function lookupUser(Request $request)
    {
        $validated = $request->validate(['email' => 'required|email']);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            return response()->json(['message' => 'No user found with that email.'], 404);
        }

        return response()->json(['data' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ]]);
    }
}
