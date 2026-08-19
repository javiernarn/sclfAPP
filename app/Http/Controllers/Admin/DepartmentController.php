<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Services\Audit\AuditLogService;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function __construct(protected AuditLogService $audit)
    {
    }

    public function index(Request $request)
    {
        $departments = Department::with('campus:id,name')
            ->when($request->campus_id, fn ($q) => $q->where('campus_id', $request->campus_id))
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $departments]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'campus_id' => 'required|exists:campuses,id',
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:50',
        ]);

        $department = Department::create($validated);
        $department->load('campus:id,name');

        $this->audit->log(
            'department.created',
            $department,
            "Department '{$department->name}' created by admin #{$request->user()->id}."
        );

        return response()->json(['success' => true, 'data' => $department], 201);
    }

    public function update(Request $request, Department $department)
    {
        $validated = $request->validate([
            'campus_id' => 'sometimes|exists:campuses,id',
            'name' => 'sometimes|string|max:150',
            'code' => 'sometimes|nullable|string|max:50',
        ]);

        $department->update($validated);

        $this->audit->log(
            'department.updated',
            $department,
            "Department #{$department->id} updated by admin #{$request->user()->id}."
        );

        return response()->json(['success' => true, 'data' => $department->fresh('campus:id,name')]);
    }

    public function destroy(Request $request, Department $department)
    {
        // Users in this department keep their record — department_id is
        // nullOnDelete (see the departments migration) — so deleting a
        // department never orphans/deletes user accounts, only clears
        // their department link.
        $name = $department->name;
        $department->delete();

        $this->audit->log(
            'department.deleted',
            null,
            "Department '{$name}' deleted by admin #{$request->user()->id}."
        );

        return response()->json(['success' => true, 'message' => 'Department deleted.']);
    }
}
