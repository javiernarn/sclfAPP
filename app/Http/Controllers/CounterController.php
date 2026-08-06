<?php

namespace App\Http\Controllers;

use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Counter\CounterIntakeService;
use Illuminate\Http\Request;

class CounterController extends Controller
{
    public function __construct(protected CounterIntakeService $intake)
    {
    }

    /**
     * Look up a student/instructor by school ID or name so the officer can
     * attach an item to the right owner. Deliberately narrow: only the
     * fields needed to confirm identity at the counter, never email/phone/
     * address — this is a public-facing search surface (any officer can
     * search any student), so it's kept as tight as the UI actually needs.
     */
    public function searchOwners(Request $request)
    {
        $request->validate(['q' => 'required|string|min:2|max:100']);

        $owners = User::query()
            ->role(['student', 'instructor'])
            ->where('is_active', true)
            ->where(function ($q) use ($request) {
                $q->where('student_id', 'like', "%{$request->q}%")
                    ->orWhere('name', 'like', "%{$request->q}%");
            })
            ->select('id', 'name', 'student_id', 'course', 'profile_picture')
            ->limit(10)
            ->get();

        return response()->json(['data' => $owners]);
    }

    /**
     * Check an item in at a counter for an already-identified owner. This
     * only logs the item and creates its pre-approved claim — it never
     * hands back a release QR. That's generated separately, later, from
     * the Claims page (same as any other approved claim), so checking an
     * item in and releasing it can't be done by the same officer in one
     * uninterrupted action.
     */
    public function checkIn(Request $request)
    {
        if (!$request->user()->hasAnyRole(['security_officer', 'admin'])) {
            abort(403);
        }

        $validated = $request->validate([
            'owner_id' => 'required|exists:users,id',
            'storage_location_id' => 'required|exists:storage_locations,id',
            'item_name' => 'required|string|max:150',
            'description' => 'nullable|string|max:1000',
            'category' => 'nullable|string|max:100',
        ]);

        $owner = User::findOrFail($validated['owner_id']);
        $counter = StorageLocation::findOrFail($validated['storage_location_id']);

        $result = $this->intake->checkIn($request->user(), $owner, $counter, $validated);

        return response()->json([
            'success' => true,
            'message' => "Item checked in for {$owner->name}. They've been notified.",
            'data' => [
                'found_item' => $result['found_item'],
                'claim' => $result['claim'],
            ],
        ], 201);
    }
}
