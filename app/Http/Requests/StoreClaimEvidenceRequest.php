<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClaimEvidenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('addEvidence', $this->route('claim'));
    }

    public function rules(): array
    {
        return [
            'type' => 'required|in:description,serial_number,purchase_info,photo,document,other',
            'content' => 'required_unless:type,photo,document|nullable|string|max:2000',
            'file' => 'required_if:type,photo,document|nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ];
    }
}
