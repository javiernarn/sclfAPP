<?php

namespace Tests\Feature;

use App\Models\ReportAttachment;
use App\Models\SecurityIncident;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Optional photo/video evidence on incident reports and service requests:
 * reporters can attach it, Security/Admin/Staff can see it, other users can't.
 */
class ReportAttachmentTest extends TestCase
{
    use RefreshDatabase;

    protected function user(string $role): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $user */
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole($role);

        return $user;
    }

    protected function headers(User $user): array
    {
        // Sanctum's guard caches the first authenticated user for the rest
        // of a test, so without this a later request "as" someone else would
        // silently still run as the previous user. (Same reset as
        // StaffApprovalTest.) Called right before each request is built.
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer ' . $user->createToken('test', ['*'])->plainTextToken];
    }

    protected function incidentPayload(array $extra = []): array
    {
        return array_merge([
            'category' => SecurityIncident::CATEGORY_VANDALISM,
            'severity' => SecurityIncident::SEVERITY_MEDIUM,
            'title' => 'Graffiti on wall',
            'description' => 'Someone spray-painted the wall near the library.',
            'occurred_at' => now()->subHour()->toDateTimeString(),
        ], $extra);
    }

    protected function requestPayload(array $extra = []): array
    {
        return array_merge([
            'category' => ServiceRequest::CATEGORY_MAINTENANCE,
            'priority' => ServiceRequest::PRIORITY_MEDIUM,
            'title' => 'Leaking faucet',
            'description' => 'The faucet in the 2nd floor restroom keeps dripping.',
        ], $extra);
    }

    public function test_incident_can_be_filed_without_any_attachment(): void
    {
        Storage::fake('local');
        $student = $this->user('student');

        $this->postJson('/api/security-incidents', $this->incidentPayload(), $this->headers($student))
            ->assertCreated();

        $this->assertDatabaseCount('report_attachments', 0);
    }

    public function test_student_can_attach_photo_and_video_to_an_incident(): void
    {
        Storage::fake('local');
        $student = $this->user('student');

        $res = $this->post('/api/security-incidents', $this->incidentPayload([
            'attachments' => [
                UploadedFile::fake()->image('wall.jpg', 800, 600),
                UploadedFile::fake()->create('clip.mp4', 2000, 'video/mp4'),
            ],
        ]), $this->headers($student) + ['Accept' => 'application/json']);

        $res->assertCreated();
        $this->assertDatabaseCount('report_attachments', 2);
        $this->assertDatabaseHas('report_attachments', ['kind' => 'image', 'uploaded_by' => $student->id]);
        $this->assertDatabaseHas('report_attachments', ['kind' => 'video', 'uploaded_by' => $student->id]);

        foreach (ReportAttachment::all() as $att) {
            Storage::disk('local')->assertExists($att->path);
        }
    }

    public function test_instructor_can_attach_a_photo_to_a_service_request(): void
    {
        Storage::fake('local');
        $instructor = $this->user('instructor');

        $this->post('/api/service-requests', $this->requestPayload([
            'attachments' => [UploadedFile::fake()->image('faucet.png')],
        ]), $this->headers($instructor) + ['Accept' => 'application/json'])->assertCreated();

        $this->assertDatabaseHas('report_attachments', [
            'attachable_type' => ServiceRequest::class,
            'kind' => 'image',
        ]);
    }

    public function test_non_media_files_are_rejected(): void
    {
        Storage::fake('local');
        $student = $this->user('student');

        $this->post('/api/security-incidents', $this->incidentPayload([
            'attachments' => [UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')],
        ]), $this->headers($student) + ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertDatabaseCount('security_incidents', 0);
    }

    public function test_more_than_five_files_are_rejected(): void
    {
        Storage::fake('local');
        $student = $this->user('student');

        $files = array_map(fn ($i) => UploadedFile::fake()->image("p{$i}.jpg"), range(1, 6));

        $this->post('/api/security-incidents', $this->incidentPayload(['attachments' => $files]),
            $this->headers($student) + ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_oversized_photo_is_rejected(): void
    {
        Storage::fake('local');
        $student = $this->user('student');

        $this->post('/api/security-incidents', $this->incidentPayload([
            'attachments' => [UploadedFile::fake()->image('huge.jpg')->size(ReportAttachment::MAX_IMAGE_KB + 1)],
        ]), $this->headers($student) + ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_reporter_security_admin_and_staff_can_view_but_other_students_cannot(): void
    {
        Storage::fake('local');
        $reporter = $this->user('student');

        $this->post('/api/security-incidents', $this->incidentPayload([
            'attachments' => [UploadedFile::fake()->image('wall.jpg')],
        ]), $this->headers($reporter) + ['Accept' => 'application/json'])->assertCreated();

        $attachment = ReportAttachment::firstOrFail();
        $url = "/api/report-attachments/{$attachment->id}";

        $this->getJson($url, $this->headers($reporter))->assertOk();
        $this->getJson($url, $this->headers($this->user('security_officer')))->assertOk();
        $this->getJson($url, $this->headers($this->user('admin')))->assertOk();
        $this->getJson($url, $this->headers($this->user('staff')))->assertOk();

        $this->getJson($url, $this->headers($this->user('student')))->assertForbidden();
    }

    public function test_detail_endpoints_include_attachments_without_exposing_storage_path(): void
    {
        Storage::fake('local');
        $student = $this->user('student');
        $security = $this->user('security_officer');

        $created = $this->post('/api/service-requests', $this->requestPayload([
            'attachments' => [UploadedFile::fake()->image('faucet.jpg')],
        ]), $this->headers($student) + ['Accept' => 'application/json'])->assertCreated();

        $id = $created->json('data.id');

        $this->getJson("/api/service-requests/{$id}", $this->headers($security))
            ->assertOk()
            ->assertJsonCount(1, 'data.attachments')
            ->assertJsonPath('data.attachments.0.kind', 'image')
            ->assertJsonMissingPath('data.attachments.0.path');
    }
}
