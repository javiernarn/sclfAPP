<?php

namespace App\Rules;

use App\Support\ProfilePhotoInspector;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;

/**
 * Validation rule for profile pictures: the photo must look like a formal,
 * plain-background, sharp picture and must not carry AI-generation markers.
 * Add it AFTER the `image` / `max` rules. See App\Support\ProfilePhotoInspector
 * and config/photo_check.php.
 */
class FormalProfilePhoto implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! config('photo_check.enforce', true)) {
            return;
        }
        // `image` / `max` report invalid or oversize uploads themselves.
        if (! $value instanceof UploadedFile || ! $value->isValid() || $value->getRealPath() === false) {
            return;
        }

        $problems = ProfilePhotoInspector::inspect($value->getRealPath(), [
            'min_side' => (int) config('photo_check.min_side', 300),
            'min_sharpness' => (float) config('photo_check.min_sharpness', 40.0),
            'bg_min_fraction' => (float) config('photo_check.bg_min_fraction', 0.6),
            'max_pixels' => (int) config('photo_check.max_pixels', 25000000),
        ]);

        if ($problems !== []) {
            $fail($problems[0]['message']);
        }
    }
}
