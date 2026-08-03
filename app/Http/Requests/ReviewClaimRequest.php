<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReviewClaimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('review', $this->route('claim'));
    }

    public function rules(): array
    {
        return [
            'status' => 'required|in:under_review,more_evidence_required,approved,rejected',
            'notes' => 'nullable|string|max:1000',
        ];
    }
}
