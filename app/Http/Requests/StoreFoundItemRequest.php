<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFoundItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasAnyRole(['student', 'faculty', 'security_officer']);
    }

    public function rules(): array
    {
        return [
            'item_name' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'nullable|string|max:100',
            'brand' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'unique_characteristics' => 'nullable|string|max:500',
            'location_found' => 'nullable|string|max:255',
            'date_found' => 'nullable|date',
            'time_found' => 'nullable',
            'campus_id' => 'nullable|exists:campuses,id',
            'image' => 'nullable|image|max:5120',
        ];
    }
}
