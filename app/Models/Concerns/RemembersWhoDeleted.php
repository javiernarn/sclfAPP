<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Add next to SoftDeletes. When the record is (soft) deleted it remembers who
 * did it and in which role, so a later visit to a deleted link can say
 * "deleted on <date> by an Administrator" (see MissingRecordResponder).
 *
 * Needs deleted_by + deleted_by_role columns — see the
 * add_deleted_by_to_soft_deleting_tables migration.
 */
trait RemembersWhoDeleted
{
    protected static function bootRemembersWhoDeleted(): void
    {
        static::deleted(function (Model $model) {
            // A permanent delete leaves nothing to annotate.
            if (method_exists($model, 'isForceDeleting') && $model->isForceDeleting()) {
                return;
            }

            // Only a signed-in request has a "who"; console/queue deletes stay anonymous.
            $actor = app()->bound('request') ? request()->user() : null;
            if (! $actor) {
                return;
            }

            $model->forceFill([
                'deleted_by' => $actor->id,
                'deleted_by_role' => self::deleterRoleLabel($actor),
            ])->saveQuietly();
        });
    }

    /** The label printed to people — a role, never a name. */
    public static function deleterRoleLabel(User $user): string
    {
        return match (true) {
            $user->hasAnyRole(['admin']) => 'Administrator',
            $user->hasAnyRole(['security_officer']) => 'Security Officer',
            $user->hasAnyRole(['staff']) => 'Staff',
            $user->hasAnyRole(['instructor']) => 'Instructor',
            default => 'Student',
        };
    }
}
