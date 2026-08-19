<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Models\User;
use App\Services\Assets\AssetService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AssetController extends Controller
{
    public function __construct(
        protected AssetService $assets,
    ) {
    }

    /**
     * Staff see the full campus registry; anyone else only sees assets
     * currently assigned to them ("My Assets") — same "own records vs.
     * everything" split as SecurityIncidentController::index(), just
     * keyed on custodianship instead of who reported something.
     */
    public function index(Request $request)
    {
        $viewer = $request->user();
        $isStaff = $viewer->hasAnyRole(['security_officer', 'admin']);

        $query = Asset::query()
            ->with(['assignee:id,name', 'building:id,name', 'campus:id,name,code'])
            ->when(!$isStaff, fn ($q) => $q->where('assigned_to', $viewer->id))
            ->when(
                $isStaff && $viewer->campus_id && !$viewer->hasRole('admin'),
                fn ($q) => $q->where('campus_id', $viewer->campus_id)
            )
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->string('search');
                $q->where(function ($sub) use ($term) {
                    $sub->where('name', 'like', "%{$term}%")
                        ->orWhere('asset_tag', 'like', "%{$term}%")
                        ->orWhere('serial_number', 'like', "%{$term}%");
                });
            })
            ->orderByDesc('created_at');

        return response()->json(['data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate([
            'building_id' => 'nullable|exists:buildings,id',
            'category' => 'required|string|in:' . implode(',', Asset::CATEGORIES),
            'name' => 'required|string|max:150',
            'description' => 'nullable|string|max:2000',
            'brand' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100',
            'location_text' => 'nullable|string|max:255',
            'acquired_at' => 'nullable|date|before_or_equal:today',
            'value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
        ]);

        try {
            $asset = $this->assets->register($request->user(), $validated);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'data' => $asset], 201);
    }

    public function show(Request $request, Asset $asset)
    {
        $this->authorize('view', $asset);

        $asset->load([
            'assignee:id,name,email',
            'building:id,name',
            'campus:id,name,code',
            'creator:id,name',
            'movements' => fn ($q) => $q->with(['fromUser:id,name', 'toUser:id,name', 'mover:id,name'])->latest(),
        ]);

        return response()->json(['data' => $asset]);
    }

    public function assign(Request $request, Asset $asset)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $custodian = User::findOrFail($validated['user_id']);

        try {
            $asset = $this->assets->assign($asset, $custodian, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => "Assigned to {$custodian->name}.", 'data' => $asset]);
    }

    public function unassign(Request $request, Asset $asset)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate(['notes' => 'nullable|string|max:500']);

        try {
            $asset = $this->assets->unassign($asset, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Returned to storage.', 'data' => $asset]);
    }

    public function sendForRepair(Request $request, Asset $asset)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate(['notes' => 'nullable|string|max:500']);

        try {
            $asset = $this->assets->sendForRepair($asset, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Sent for repair.', 'data' => $asset]);
    }

    public function returnFromRepair(Request $request, Asset $asset)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate(['notes' => 'nullable|string|max:500']);

        try {
            $asset = $this->assets->returnFromRepair($asset, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Returned from repair.', 'data' => $asset]);
    }

    public function retire(Request $request, Asset $asset)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate(['notes' => 'nullable|string|max:500']);

        try {
            $asset = $this->assets->retire($asset, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Asset retired.', 'data' => $asset]);
    }

    public function reportLost(Request $request, Asset $asset)
    {
        $this->authorize('manage', Asset::class);

        $validated = $request->validate(['notes' => 'nullable|string|max:500']);

        try {
            $asset = $this->assets->reportLost($asset, $request->user(), $validated['notes'] ?? null);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Asset reported lost.', 'data' => $asset]);
    }
}
