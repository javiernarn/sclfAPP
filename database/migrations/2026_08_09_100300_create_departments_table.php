<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A real department/office relationship — distinct from users.course,
     * which is free-text academic-program info a student fills in at
     * registration (e.g. "BS Computer Science") and isn't used anywhere
     * as an organizational department today. Departments are
     * campus-scoped (a department belongs to one campus) since that's
     * how the rest of this schema (buildings, locations, storage) is
     * already organized.
     */
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('code')->nullable();
            $table->timestamps();

            $table->unique(['campus_id', 'code']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('department_id')
                ->nullable()
                ->after('campus_id')
                ->constrained('departments')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('department_id');
        });

        Schema::dropIfExists('departments');
    }
};
