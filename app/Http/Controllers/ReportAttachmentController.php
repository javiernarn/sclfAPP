<?php

namespace App\Http\Controllers;

use App\Models\ReportAttachment;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportAttachmentController extends Controller
{
    /**
     * Stream a report's photo/video to anyone allowed to view the parent
     * report (its reporter, plus Security / Admin / Staff — see
     * SecurityIncidentPolicy::view() and ServiceRequestPolicy::view()).
     * Files are on the private disk, so there is no URL that works
     * without a valid token and a passing authorization check.
     *
     * Served as BinaryFileResponse so HTTP Range requests (video seeking)
     * work out of the box.
     */
    public function show(ReportAttachment $attachment): BinaryFileResponse
    {
        $parent = $attachment->attachable;
        abort_if(!$parent, 404);

        $this->authorize('view', $parent);

        $disk = Storage::disk('local');
        abort_if(!$attachment->path || !$disk->exists($attachment->path), 404);

        return response()->file($disk->path($attachment->path), [
            // Only ever a validated image/* or video/* type is stored.
            'Content-Type' => $attachment->mime_type,
            'Content-Disposition' => 'inline; filename="' . addslashes($attachment->original_name) . '"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
