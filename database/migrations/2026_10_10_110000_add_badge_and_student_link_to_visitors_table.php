<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Visitor badge tracking + parent/guardian -> student link.
 *
 * badge_number already exists (nullable, legacy rows may not have one);
 * the "required" rule is enforced on new check-ins in the controller so old
 * records stay valid. This adds:
 *  - contact_number: reachable number for the visitor
 *  - student_user_id: the student a parent/guardian is visiting (nullable FK)
 *  - student_name / student_number: snapshots so the log still reads
 *    correctly if the student account is later renamed or removed
 *  - relationship: parent, guardian, sibling, etc.
 *  - index on badge_number so "which badge is still out" is fast
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->string('contact_number', 50)->nullable()->after('id_number');
            $table->foreignId('student_user_id')->nullable()->after('host_department')
                ->constrained('users')->nullOnDelete();
            $table->string('student_name')->nullable()->after('student_user_id');
            $table->string('student_number', 50)->nullable()->after('student_name');
            $table->string('relationship', 50)->nullable()->after('student_number');

            $table->index(['campus_id', 'badge_number', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('visitors', function (Blueprint $table) {
            $table->dropIndex(['campus_id', 'badge_number', 'status']);
            $table->dropConstrainedForeignId('student_user_id');
            $table->dropColumn(['contact_number', 'student_name', 'student_number', 'relationship']);
        });
    }
};
