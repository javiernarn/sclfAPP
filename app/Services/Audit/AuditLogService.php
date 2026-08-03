<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogService
{
    /**
     * Record an audit event. $entity may be any Eloquent model or null for
     * events not tied to a specific record (e.g. login, failed login).
     */
    public function log(
        string $action,
        ?object $entity = null,
        ?string $description = null,
        ?array $before = null,
        ?array $after = null,
        ?User $actor = null,
    ): AuditLog {
        $request = request();

        return AuditLog::create([
            'user_id' => $actor?->id ?? $request?->user()?->id,
            'action' => $action,
            'entity_type' => $entity ? get_class($entity) : null,
            'entity_id' => $entity->id ?? null,
            'description' => $description,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'before' => $before,
            'after' => $after,
            'created_at' => now(),
        ]);
    }
}
