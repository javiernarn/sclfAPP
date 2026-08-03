<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdminCreateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\User::class);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            'last_name' => ['required', 'string', 'max:255', 'regex:/^[\pL\s\'-]+$/u'],
            'email' => ['required', 'email', 'max:255', 'lowercase', 'unique:users'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'in:faculty,security_officer,admin'],
            // Philippine mobile numbers: 11 digits starting with 09.
            'phone_number' => ['nullable', 'string', 'regex:/^09\d{9}$/', 'unique:users,phone_number'],
            'gender' => ['nullable', 'string', 'in:male,female,other,prefer_not_to_say'],
            // Optional at creation — staff can also add one later from
            // their own Profile page. Same limits as self-registration.
            'profile_picture' => ['nullable', 'image', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.regex' => 'First name can only contain letters, spaces, hyphens and apostrophes.',
            'last_name.regex' => 'Last name can only contain letters, spaces, hyphens and apostrophes.',
            'email.unique' => 'That email address is already in use by another account.',
            'phone_number.regex' => 'Enter a valid Philippine mobile number, e.g. 09171234567.',
            'phone_number.unique' => 'That phone number is already linked to another account.',
        ];
    }
}
