// Fixed reasons a reviewer picks from when marking / confirming / dismissing a
// violation. The server validates the same codes and prints the label on the
// student's dashboard. Keep in sync with App\Models\Violation::REASONS and
// ::DISMISS_REASONS.
export const VIOLATION_REASONS = [
    { value: 'nudity', label: 'Nudity' },
    { value: 'sexual_content', label: 'Sexual or sexually suggestive content' },
    { value: 'offensive_content', label: 'Offensive or obscene text, symbols or gestures' },
    { value: 'harassment', label: 'Harassment or shaming of another person' },
    { value: 'unrelated_upload', label: 'Unrelated or prank upload' },
    { value: 'other_sensitive', label: 'Other sensitive content' },
];

export const DISMISS_REASONS = [
    { value: 'accident_or_injury', label: 'Accident or injury (e.g. blood) — allowed in an incident report' },
    { value: 'harmless', label: 'Harmless content — nothing sensitive' },
    { value: 'scanner_mistake', label: 'The automatic scan made a mistake' },
    { value: 'other', label: 'Other' },
];
