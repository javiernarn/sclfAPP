<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreClaimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\Claim::class);
    }

    public function rules(): array
    {
        return [
            'lost_item_id' => 'nullable|exists:lost_items,id',
        ];
    }
}
