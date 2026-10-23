<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Instructors get their own `teaching_course` column (the course they
     * teach, from the same Department/Course list students pick from at
     * registration). Their instructor ID already lives in `staff_id`
     * (INS-YYYY-NNNN). `course` stays for students only.
     *
     * Any instructor who already had a value in `course` (saved by the
     * earlier version of this feature) is moved across to the new column.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('teaching_course')->nullable()->after('course');
        });

        $instructorIds = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('roles.name', 'instructor')
            ->where('model_has_roles.model_type', \App\Models\User::class)
            ->pluck('model_has_roles.model_id');

        if ($instructorIds->isNotEmpty()) {
            DB::table('users')
                ->whereIn('id', $instructorIds)
                ->whereNotNull('course')
                ->update([
                    'teaching_course' => DB::raw('course'),
                    'course' => null,
                ]);
        }
    }

    public function down(): void
    {
        // Put instructors' teaching course back into `course` before dropping.
        DB::table('users')
            ->whereNotNull('teaching_course')
            ->update(['course' => DB::raw('teaching_course')]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('teaching_course');
        });
    }
};
