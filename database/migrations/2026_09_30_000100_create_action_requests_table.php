<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Staff approval workflow.
 *
 * A "staff" account can look at everything an admin can, but every write
 * (create / update / delete / status change) has to be requested first,
 * approved by the single admin, and only then can the staff member run it.
 * One row here = one such request.
 *
 * Also makes sure the new `staff` role exists on databases that were
 * seeded before it was introduced (RoleSeeder is not re-run on deploy).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();

            // What the staff member wants to do. method + route_uri (the route
            // *pattern*, e.g. "api/admin/users/{user}") + subject_key ("user=5")
            // is the signature the middleware matches an approval against.
            $table->string('method', 10);
            $table->string('route_uri');
            $table->string('subject_key')->nullable();
            $table->string('summary');
            $table->text('reason')->nullable();
            // Sanitised copy of what they were about to send (never passwords),
            // so the admin can see the actual change before approving it.
            $table->json('payload')->nullable();

            // pending -> approved -> executed, or pending -> rejected.
            // The admin can also move a request back to pending.
            $table->string('status', 20)->default('pending');
            $table->text('review_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['requester_id', 'status']);
            $table->index('status');
            $table->index(['requester_id', 'method', 'route_uri', 'subject_key'], 'action_requests_signature_index');
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Role::firstOrCreate(['name' => 'staff']);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('action_requests');
        // The role is intentionally left in place: users may already hold it.
    }
};
