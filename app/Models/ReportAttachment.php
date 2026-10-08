<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A photo or video a reporter attached to a SecurityIncident or a
 * ServiceRequest so Security/Admin/Staff can see what the report refers to.
 *
 * Files live on the private ("local") disk — never the public one — and are
 * only ever served through ReportAttachmentController::show(), which checks
 * that the viewer is allowed to see the parent report. Same approach (and
 * same reasoning) as ClaimEvidence.
 */
class ReportAttachment extends Model
{
    public const KIND_IMAGE = 'image';
    public const KIND_VIDEO = 'video';

    public const MAX_FILES = 5;
    public const MAX_IMAGE_KB = 10 * 1024;  // 10 MB
    public const MAX_VIDEO_KB = 50 * 1024;  // 50 MB

    public const ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
        'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp',
    ];

    protected $fillable = [
        'attachable_type', 'attachable_id', 'uploaded_by',
        'kind', 'original_name', 'mime_type', 'size', 'path',
    ];

    // The raw storage path is an implementation detail and should never
    // reach the browser; the frontend fetches bytes by id instead.
    protected $hidden = ['path'];

    protected $casts = ['size' => 'integer'];

    public function attachable()
    {
        return $this->morphTo();
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /**
     * Validation rules for an optional `attachments[]` upload field, shared
     * by the incident and service-request controllers so both enforce the
     * same limits. Sniffs the real MIME type (not just the extension).
     */
    public static function rules(): array
    {
        return [
            'attachments' => 'nullable|array|max:' . self::MAX_FILES,
            'attachments.*' => [
                'file',
                'mimetypes:' . implode(',', self::ALLOWED_MIME_TYPES),
                'max:' . self::MAX_VIDEO_KB,
                function (string $attribute, $value, \Closure $fail) {
                    if (
                        $value instanceof \Illuminate\Http\UploadedFile
                        && str_starts_with((string) $value->getMimeType(), 'image/')
                        && $value->getSize() > self::MAX_IMAGE_KB * 1024
                    ) {
                        $fail('Each photo must be 10 MB or smaller.');
                    }
                },
            ],
        ];
    }

    public static function messages(): array
    {
        return [
            'attachments.max' => 'You can attach up to ' . self::MAX_FILES . ' photos/videos.',
            'attachments.*.mimetypes' => 'Only photos (JPG, PNG, WEBP, GIF, HEIC) and videos (MP4, WEBM, MOV) can be attached.',
            'attachments.*.max' => 'Each video must be 50 MB or smaller.',
            'attachments.*.uploaded' => 'A file failed to upload — it may be larger than the server allows.',
        ];
    }
}
