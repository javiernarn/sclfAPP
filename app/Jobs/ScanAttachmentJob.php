<?php

namespace App\Jobs;

use App\Models\ReportAttachment;
use App\Services\Attachments\ReportAttachmentService;
use App\Services\Violations\ImageModerator;
use App\Services\Violations\ViolationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Scans one report photo with the moderation API (see config sclf.moderation).
 * Videos and unsupported formats are marked `skipped` — they get manual
 * review only. A hit opens a pending violation; it counts against nobody
 * until a reviewer confirms it.
 */
class ScanAttachmentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function backoff(): array
    {
        return [30, 120];
    }

    public function __construct(public ReportAttachment $attachment)
    {
    }

    public function handle(ImageModerator $moderator, ViolationService $violations): void
    {
        $a = $this->attachment->fresh();
        if (! $a || $a->scan_status === 'clean' || $a->scan_status === 'flagged') {
            return;
        }

        // The key was removed after this job was queued: leave the file
        // visible and unscanned instead of failing and retrying forever.
        if (! ImageModerator::hasKey()) {
            $a->update(['scan_status' => 'skipped', 'scanned_at' => now()]);

            return;
        }

        $disk = Storage::disk(ReportAttachmentService::DISK);

        if (
            $a->kind !== ReportAttachment::KIND_IMAGE
            || ! in_array($a->mime_type, ImageModerator::SUPPORTED_MIME, true)
            || $a->size > ImageModerator::MAX_BYTES
            || ! $a->path
            || ! $disk->exists($a->path)
        ) {
            $a->update(['scan_status' => 'skipped', 'scanned_at' => now()]);

            return;
        }

        $result = $moderator->inspect($disk->get($a->path));

        $a->update([
            'scan_status' => $result['flagged'] ? 'flagged' : 'clean',
            'scan_labels' => $result['labels'] ?: null,
            'scanned_at' => now(),
        ]);

        if ($result['flagged']) {
            $violations->openFromScan($a, $result['labels'], $result['reason']);
        }
    }

    public function failed(\Throwable $e): void
    {
        // Out of retries: leave the file unscanned-but-visible and say so.
        $this->attachment->newQuery()->whereKey($this->attachment->getKey())
            ->update(['scan_status' => 'error', 'scanned_at' => now()]);
        report($e);
    }
}
