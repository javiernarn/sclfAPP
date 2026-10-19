<?php

namespace Tests\Feature;

use App\Jobs\ScanAttachmentJob;
use App\Models\ReportAttachment;
use App\Models\SecurityIncident;
use App\Models\User;
use App\Models\Violation;
use App\Services\Violations\ImageModerator;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Violations on report photos/videos: reviewers flag, confirm or dismiss;
 * flagged files are hidden from non-reviewers; confirmed ones show on the
 * printed dashboard; the optional scanner opens pending violations.
 */
class ViolationTest extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role): User
    {
        $this->seed(RoleSeeder::class);

        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function headers(User $user): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer ' . $user->createToken('test', ['*'])->plainTextToken];
    }

    /** An incident with one photo uploaded by $reporter. */
    protected function attachmentBy(User $reporter): ReportAttachment
    {
        Storage::fake('local');

        $incident = SecurityIncident::create([
            'reported_by' => $reporter->id,
            'category' => SecurityIncident::CATEGORY_VANDALISM,
            'severity' => SecurityIncident::SEVERITY_LOW,
            'title' => 'Test incident',
            'description' => 'Something happened.',
            'occurred_at' => now()->subHour(),
            'status' => SecurityIncident::STATUS_REPORTED,
        ]);

        $path = UploadedFile::fake()->image('photo.jpg')->store('report-attachments/test', 'local');

        return $incident->attachments()->create([
            'uploaded_by' => $reporter->id,
            'kind' => 'image',
            'original_name' => 'photo.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1000,
            'path' => $path,
        ]);
    }

    public function test_reviewer_can_mark_a_file_as_violation_and_it_is_recorded_against_the_uploader(): void
    {
        $student = $this->user('student');
        $student->update(['student_id' => '2026-0001']);
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);

        // display_id is computed from student_id/staff_id (not a column); SQLite
        // hides a bad column name, so assert the real value comes back.
        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($security))
            ->assertCreated()
            ->assertJsonPath('violation.status', 'confirmed')
            ->assertJsonPath('violation.reason', 'Nudity')
            ->assertJsonPath('violation.user.display_id', '2026-0001');

        $this->assertDatabaseHas('violations', [
            'user_id' => $student->id,
            'report_attachment_id' => $att->id,
            'status' => 'confirmed',
            'source' => 'manual',
            'reviewed_by' => $security->id,
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'violation.marked']);
    }

    public function test_students_cannot_mark_violations(): void
    {
        $student = $this->user('student');
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($student))->assertForbidden();
        $this->assertDatabaseCount('violations', 0);
    }

    public function test_staff_can_mark_violations_without_an_admin_approval(): void
    {
        $student = $this->user('student');
        $staff = $this->user('staff');
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($staff))->assertCreated();
    }

    public function test_a_file_cannot_be_marked_twice(): void
    {
        $student = $this->user('student');
        $admin = $this->user('admin');
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($admin))->assertCreated();
        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($admin))->assertStatus(422);
        $this->assertDatabaseCount('violations', 1);
    }

    public function test_flagged_file_is_hidden_from_the_reporter_but_open_to_reviewers(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);

        $this->getJson("/api/report-attachments/{$att->id}", $this->headers($student))->assertOk();

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($security))->assertCreated();

        $this->getJson("/api/report-attachments/{$att->id}", $this->headers($student))->assertForbidden();
        $this->getJson("/api/report-attachments/{$att->id}", $this->headers($security))->assertOk();
    }

    public function test_dismissing_makes_the_file_visible_again_and_records_nothing_against_the_user(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);
        $violation = app(\App\Services\Violations\ViolationService::class)->openFromScan($att, ['nudity']);

        $this->getJson("/api/report-attachments/{$att->id}", $this->headers($student))->assertForbidden();

        $this->postJson("/api/violations/{$violation->id}/dismiss", ['reason' => 'accident_or_injury'], $this->headers($security))
            ->assertOk()
            ->assertJsonPath('violation.status', 'dismissed');

        $this->getJson("/api/report-attachments/{$att->id}", $this->headers($student))->assertOk();
        $this->assertSame(0, Violation::where('user_id', $student->id)->confirmed()->count());
    }

    public function test_only_admin_can_undo_a_confirmed_violation(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $admin = $this->user('admin');
        $att = $this->attachmentBy($student);

        $v = app(\App\Services\Violations\ViolationService::class)->markManually($att, $security, null);

        $this->postJson("/api/violations/{$v->id}/dismiss", ['reason' => 'harmless'], $this->headers($security))->assertStatus(422);
        $this->postJson("/api/violations/{$v->id}/dismiss", ['reason' => 'harmless'], $this->headers($admin))->assertOk();
    }

    public function test_attachment_json_hides_reviewer_data_from_the_reporter(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);
        $att->update(['scan_status' => 'flagged', 'scan_labels' => ['nudity']]);
        app(\App\Services\Violations\ViolationService::class)->openFromScan($att->fresh(), ['nudity']);

        $this->getJson("/api/security-incidents/{$att->attachable_id}", $this->headers($student))
            ->assertOk()
            ->assertJsonPath('data.attachments.0.moderation.hidden', true)
            ->assertJsonMissingPath('data.attachments.0.moderation.scan_labels')
            ->assertJsonMissingPath('data.attachments.0.moderation.violation');

        $this->getJson("/api/security-incidents/{$att->attachable_id}", $this->headers($security))
            ->assertOk()
            ->assertJsonPath('data.attachments.0.moderation.violation.status', 'pending_review')
            ->assertJsonPath('data.attachments.0.moderation.scan_labels.0', 'nudity');
    }

    public function test_printed_dashboard_shows_no_violations_then_the_confirmed_ones(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);

        $this->getJson("/api/print-report/{$student->public_token}", $this->headers($student))
            ->assertOk()
            ->assertJsonPath('violations.count', 0)
            ->assertJsonPath('violations.items', []);

        // Pending does not count, and the student is not told about it.
        $v = app(\App\Services\Violations\ViolationService::class)->openFromScan($att, ['nudity']);
        $this->getJson("/api/print-report/{$student->public_token}", $this->headers($student))
            ->assertJsonPath('violations.count', 0)
            ->assertJsonPath('violations.pending', null);
        $this->getJson("/api/print-report/{$student->public_token}", $this->headers($security))
            ->assertJsonPath('violations.pending', 1);

        $this->postJson("/api/violations/{$v->id}/confirm", [], $this->headers($security))->assertOk();

        $this->getJson("/api/print-report/{$student->public_token}", $this->headers($security))
            ->assertOk()
            ->assertJsonPath('violations.count', 1)
            ->assertJsonPath('violations.items.0.id', $v->id);
    }

    public function test_violation_list_is_for_reviewers_only(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');

        $this->getJson('/api/violations', $this->headers($student))->assertForbidden();
        $student->update(['student_id' => '2026-0002']);
        $att = $this->attachmentBy($student);
        app(\App\Services\Violations\ViolationService::class)->openFromScan($att, ['nudity']);

        $this->getJson('/api/violations', $this->headers($security))
            ->assertOk()
            ->assertJsonPath('data.0.user.display_id', '2026-0002');
    }

    public function test_scanner_decision_flags_nudity_but_not_blood_or_accident_photos(): void
    {
        $moderator = new ImageModerator();

        $nudity = $moderator->decide(['safeSearchAnnotation' => ['adult' => 'VERY_LIKELY', 'racy' => 'LIKELY', 'violence' => 'UNLIKELY', 'medical' => 'UNLIKELY']]);
        $this->assertTrue($nudity['flagged']);
        $this->assertContains('nudity', $nudity['labels']);

        $blood = $moderator->decide(['safeSearchAnnotation' => ['adult' => 'VERY_UNLIKELY', 'racy' => 'UNLIKELY', 'violence' => 'VERY_LIKELY', 'medical' => 'VERY_LIKELY']]);
        $this->assertFalse($blood['flagged']);
    }

    public function test_scanner_flags_words_found_by_ocr(): void
    {
        config(['sclf.moderation.blocked_words' => 'badword, other']);

        $r = (new ImageModerator())->decide([
            'safeSearchAnnotation' => ['adult' => 'VERY_UNLIKELY', 'racy' => 'VERY_UNLIKELY'],
            'textAnnotations' => [['description' => 'some BADWORD here']],
        ]);

        $this->assertTrue($r['flagged']);
        $this->assertSame(['text: badword'], $r['labels']);
    }

    public function test_scan_job_opens_a_pending_violation_for_a_flagged_photo(): void
    {
        config(['sclf.moderation.api_key' => 'test-key']);
        Http::fake(['vision.googleapis.com/*' => Http::response([
            'responses' => [['safeSearchAnnotation' => ['adult' => 'VERY_LIKELY', 'racy' => 'LIKELY']]],
        ])]);

        $student = $this->user('student');
        $att = $this->attachmentBy($student);

        (new ScanAttachmentJob($att))->handle(app(ImageModerator::class), app(\App\Services\Violations\ViolationService::class));

        $this->assertSame('flagged', $att->fresh()->scan_status);
        $this->assertDatabaseHas('violations', ['report_attachment_id' => $att->id, 'status' => 'pending_review', 'source' => 'scanner']);
    }

    public function test_scan_job_marks_a_clean_photo_clean(): void
    {
        config(['sclf.moderation.api_key' => 'test-key']);
        Http::fake(['vision.googleapis.com/*' => Http::response([
            'responses' => [['safeSearchAnnotation' => ['adult' => 'VERY_UNLIKELY', 'racy' => 'UNLIKELY', 'violence' => 'VERY_LIKELY']]],
        ])]);

        $student = $this->user('student');
        $att = $this->attachmentBy($student);

        (new ScanAttachmentJob($att))->handle(app(ImageModerator::class), app(\App\Services\Violations\ViolationService::class));

        $this->assertSame('clean', $att->fresh()->scan_status);
        $this->assertDatabaseCount('violations', 0);
    }

    public function test_uploads_are_only_queued_for_scanning_when_the_switch_is_on(): void
    {
        Bus::fake();
        $student = $this->user('student');
        Storage::fake('local');
        $incident = SecurityIncident::create([
            'reported_by' => $student->id, 'category' => SecurityIncident::CATEGORY_VANDALISM, 'severity' => SecurityIncident::SEVERITY_LOW,
            'title' => 'T', 'description' => 'D', 'occurred_at' => now()->subHour(), 'status' => SecurityIncident::STATUS_REPORTED,
        ]);
        $service = app(\App\Services\Attachments\ReportAttachmentService::class);

        config(['sclf.moderation.enabled' => false]);
        $service->attach($incident, $student, [UploadedFile::fake()->image('a.jpg')]);
        Bus::assertNotDispatched(ScanAttachmentJob::class);

        config(['sclf.moderation.enabled' => true]);
        $service->attach($incident, $student, [UploadedFile::fake()->image('b.jpg')]);
        Bus::assertDispatched(ScanAttachmentJob::class);
    }

    public function test_marking_needs_a_reason_from_the_fixed_list(): void
    {
        $student = $this->user('student');
        $admin = $this->user('admin');
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", [], $this->headers($admin))->assertStatus(422);
        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'made up words'], $this->headers($admin))->assertStatus(422);
        $this->assertDatabaseCount('violations', 0);
    }

    public function test_the_chosen_reason_is_what_prints_on_the_dashboard(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'harassment'], $this->headers($security))->assertCreated();

        $this->getJson("/api/print-report/{$student->public_token}", $this->headers($security))
            ->assertJsonPath('violations.items.0.reason', 'Harassment or shaming of another person');
    }

    public function test_confirming_a_scan_hit_with_a_picked_reason_replaces_the_automatic_text(): void
    {
        $student = $this->user('student');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);
        $v = app(\App\Services\Violations\ViolationService::class)->openFromScan($att, ['nudity'], 'Automatic scan: nudity');

        $this->postJson("/api/violations/{$v->id}/confirm", ['reason' => 'sexual_content'], $this->headers($security))->assertOk();

        $this->assertSame('Sexual or sexually suggestive content', $v->fresh()->reason);
    }

    public function test_a_report_with_a_confirmed_violation_cannot_be_deleted_until_it_is_undone(): void
    {
        $student = $this->user('student');
        $admin = $this->user('admin');
        $security = $this->user('security_officer');
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($security))->assertCreated();

        // Locked: the admin is told to undo the violation first.
        $this->deleteJson("/api/security-incidents/{$att->attachable_id}", [], $this->headers($admin))
            ->assertStatus(422)
            ->assertJsonPath('success', false);
        $this->assertNull(SecurityIncident::find($att->attachable_id)->deleted_at);
        $this->assertDatabaseHas('violations', ['report_attachment_id' => $att->id, 'status' => 'confirmed']);

        // The detail payload says why (drives the disabled button in the UI).
        $this->getJson("/api/security-incidents/{$att->attachable_id}", $this->headers($admin))
            ->assertJsonPath('data.violation_locked', true);

        // Undo it, and the delete goes through.
        $violation = Violation::where('report_attachment_id', $att->id)->firstOrFail();
        $this->postJson("/api/violations/{$violation->id}/dismiss", ['reason' => 'harmless'], $this->headers($admin))->assertOk();

        $this->deleteJson("/api/security-incidents/{$att->attachable_id}", [], $this->headers($admin))->assertOk();
    }

    public function test_a_service_request_with_a_confirmed_violation_cannot_be_cancelled_by_its_owner(): void
    {
        Storage::fake('local');
        $student = $this->user('student');
        $security = $this->user('security_officer');

        $request = \App\Models\ServiceRequest::create([
            'requested_by' => $student->id,
            'category' => \App\Models\ServiceRequest::CATEGORY_MAINTENANCE,
            'priority' => \App\Models\ServiceRequest::PRIORITY_MEDIUM,
            'title' => 'Leaking faucet',
            'description' => 'Dripping.',
            'status' => \App\Models\ServiceRequest::STATUS_SUBMITTED,
        ]);
        $path = UploadedFile::fake()->image('p.jpg')->store('report-attachments/test', 'local');
        $att = $request->attachments()->create([
            'uploaded_by' => $student->id, 'kind' => 'image', 'original_name' => 'p.jpg',
            'mime_type' => 'image/jpeg', 'size' => 1000, 'path' => $path,
        ]);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($security))->assertCreated();

        $this->postJson("/api/service-requests/{$request->id}/cancel", [], $this->headers($student))
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertSame(\App\Models\ServiceRequest::STATUS_SUBMITTED, $request->fresh()->status);
    }

    public function test_printed_dashboard_shows_the_reviewers_role_never_their_name(): void
    {
        $student = $this->user('student');
        $admin = $this->user('admin');
        $admin->update(['name' => 'Jonee John']);
        $att = $this->attachmentBy($student);

        $this->postJson("/api/report-attachments/{$att->id}/violation", ['reason' => 'nudity'], $this->headers($admin))->assertCreated();

        $response = $this->getJson("/api/print-report/{$student->public_token}", $this->headers($student))->assertOk();

        $response->assertJsonPath('violations.items.0.confirmed_by', 'Administrator');
        $this->assertStringNotContainsString('Jonee John', $response->getContent());
    }
}
