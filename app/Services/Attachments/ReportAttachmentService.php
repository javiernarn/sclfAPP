<?php

namespace App\Services\Attachments;

use App\Models\ReportAttachment;
use App\Models\User;
use App\Services\Audit\AuditLogService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class ReportAttachmentService
{
    public const DISK = 'local'; // private disk — storage/app/private

    public function __construct(
        protected AuditLogService $audit,
    ) {
    }

    /**
     * Store uploaded files against a report. Files are optional, so an
     * empty list is a no-op. If a later file fails to store, the ones
     * already written are removed so we never leave orphans on disk.
     *
     * @param  array<int, UploadedFile>  $files
     * @return Collection<int, ReportAttachment>
     */
    public function attach(Model $attachable, User $uploader, array $files): Collection
    {
        $files = array_values(array_filter($files, fn ($f) => $f instanceof UploadedFile));

        if ($files === []) {
            return collect();
        }

        $dir = 'report-attachments/' . class_basename($attachable) . '/' . $attachable->getKey();
        $written = [];
        $records = collect();

        try {
            foreach ($files as $file) {
                $mime = (string) $file->getMimeType();
                $path = $file->store($dir, self::DISK);

                if ($path === false) {
                    throw new \RuntimeException('Could not store the uploaded file.');
                }
                $written[] = $path;

                $records->push($attachable->attachments()->create([
                    'uploaded_by' => $uploader->id,
                    'kind' => str_starts_with($mime, 'video/') ? ReportAttachment::KIND_VIDEO : ReportAttachment::KIND_IMAGE,
                    'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                    'mime_type' => $mime,
                    'size' => $file->getSize(),
                    'path' => $path,
                ]));
            }
        } catch (\Throwable $e) {
            Storage::disk(self::DISK)->delete($written);
            $records->each->delete();
            throw $e;
        }

        $this->audit->log(
            'report.attachments_added',
            $attachable,
            "{$records->count()} photo/video attachment(s) added to " . class_basename($attachable) . " #{$attachable->getKey()} by {$uploader->name}.",
            actor: $uploader,
        );

        return $records;
    }
}
