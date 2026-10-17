<?php

namespace App\Services\Violations;

use Illuminate\Support\Facades\Http;

/**
 * Sends a photo to Google Vision (SafeSearch + text detection) and decides
 * whether it should be held for review.
 *
 * Only nudity-type results count: `adult` and `racy`. `violence` and
 * `medical` (blood, injuries, accidents) are what an incident report is
 * *supposed* to contain, so they never flag a file on their own.
 * Optionally, text found in the image (OCR) is checked against
 * SCLF_MODERATION_BLOCKED_WORDS.
 */
class ImageModerator
{
    private const LEVELS = ['UNKNOWN' => 0, 'VERY_UNLIKELY' => 1, 'UNLIKELY' => 2, 'POSSIBLE' => 3, 'LIKELY' => 4, 'VERY_LIKELY' => 5];

    /** Vision's request limit is 10 MB including base64 overhead. */
    public const MAX_BYTES = 7 * 1024 * 1024;

    /** Formats Vision can read. */
    public const SUPPORTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    /**
     * @return array{flagged:bool, labels:array<int,string>, reason:?string}
     * @throws \RuntimeException when the API call fails (the job retries)
     */
    public function inspect(string $imageBytes): array
    {
        $key = (string) config('sclf.moderation.api_key');
        if ($key === '') {
            throw new \RuntimeException('SCLF_MODERATION_API_KEY is not set.');
        }

        $response = Http::timeout((int) config('sclf.moderation.timeout', 20))
            ->acceptJson()
            ->post('https://vision.googleapis.com/v1/images:annotate?key=' . urlencode($key), [
                'requests' => [[
                    'image' => ['content' => base64_encode($imageBytes)],
                    'features' => [['type' => 'SAFE_SEARCH_DETECTION'], ['type' => 'TEXT_DETECTION']],
                ]],
            ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Moderation API returned HTTP ' . $response->status() . '.');
        }

        $result = $response->json('responses.0', []);
        if (! empty($result['error'])) {
            throw new \RuntimeException('Moderation API error: ' . ($result['error']['message'] ?? 'unknown'));
        }

        return $this->decide($result);
    }

    /** Pure decision logic, split out so it can be tested without the network. */
    public function decide(array $result): array
    {
        $threshold = self::LEVELS[strtoupper((string) config('sclf.moderation.threshold', 'LIKELY'))] ?? self::LEVELS['LIKELY'];
        $safe = $result['safeSearchAnnotation'] ?? [];
        $labels = [];

        foreach (['adult' => 'nudity', 'racy' => 'sexually suggestive'] as $field => $label) {
            if ((self::LEVELS[strtoupper((string) ($safe[$field] ?? 'UNKNOWN'))] ?? 0) >= $threshold) {
                $labels[] = $label;
            }
        }

        $text = mb_strtolower((string) ($result['textAnnotations'][0]['description'] ?? ''));
        if ($text !== '') {
            foreach ($this->blockedWords() as $word) {
                if (str_contains($text, $word)) {
                    $labels[] = 'text: ' . $word;
                }
            }
        }

        return [
            'flagged' => $labels !== [],
            'labels' => $labels,
            'reason' => $labels !== [] ? 'Automatic scan: ' . implode(', ', $labels) : null,
        ];
    }

    /** @return array<int,string> */
    protected function blockedWords(): array
    {
        $raw = (string) config('sclf.moderation.blocked_words', '');

        return array_values(array_filter(array_map(
            fn ($w) => mb_strtolower(trim($w)),
            explode(',', $raw),
        )));
    }
}
