<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VerifyFoundItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('verify', $this->route('foundItem'));
    }

    public function rules(): array
    {
        return [
            'approved' => 'required|boolean',
            'notes' => 'nullable|string|max:1000',
        ];
    }
}
