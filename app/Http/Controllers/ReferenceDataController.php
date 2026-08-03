<?php

namespace App\Http\Controllers;

use App\Models\Building;
use App\Models\Campus;
use App\Models\Location;
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
}
