<?php

namespace Tests\Feature;

use App\Models\SecurityIncident;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A deleted record remembers who deleted it (as a role) and when, and every
 * "can't find it" answer is a readable message — never Laravel's raw
 * "No query results for model [...]".
 */
class DeletedRecordMessageTest extends TestCase
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

    protected function incidentBy(User $reporter): SecurityIncident
    {
        return SecurityIncident::create([
            'reported_by' => $reporter->id,
            'category' => SecurityIncident::CATEGORY_VANDALISM,
            'severity' => SecurityIncident::SEVERITY_LOW,
            'title' => 'Broken window',
            'description' => 'Found it this morning.',
            'occurred_at' => now()->subHour(),
            'status' => SecurityIncident::STATUS_REPORTED,
        ]);
    }

    public function test_deleting_remembers_who_deleted_it_by_role(): void
    {
        $student = $this->user('student');
        $admin = $this->user('admin');
        $incident = $this->incidentBy($student);

        $this->deleteJson("/api/security-incidents/{$incident->id}", [], $this->headers($admin))->assertOk();

        $row = SecurityIncident::withTrashed()->find($incident->id);
        $this->assertSame($admin->id, $row->deleted_by);
        $this->assertSame('Administrator', $row->deleted_by_role);
        $this->assertNotNull($row->deleted_at);
    }

    public function test_opening_a_deleted_incident_says_when_and_by_which_role(): void
    {
        $student = $this->user('student');
        $admin = $this->user('admin');
        $incident = $this->incidentBy($student);
        $this->deleteJson("/api/security-incidents/{$incident->id}", [], $this->headers($admin))->assertOk();

        foreach ([$admin, $student] as $viewer) { // staff, and the person who filed it
            $response = $this->getJson("/api/security-incidents/{$incident->id}", $this->headers($viewer))
                ->assertStatus(410)
                ->assertJsonPath('code', 'record_deleted')
                ->assertJsonPath('deleted.by_role', 'Administrator');

            $message = $response->json('message');
            $this->assertStringContainsString('was deleted on', $message);
            $this->assertStringContainsString('by an Administrator', $message);
            $this->assertStringNotContainsString('No query results', $message);
            $this->assertStringNotContainsString($admin->name, $message); // role only, never the name
        }
    }

    public function test_someone_with_no_access_is_not_told_it_was_deleted(): void
    {
        $owner = $this->user('student');
        $admin = $this->user('admin');
        $stranger = $this->user('student');
        $incident = $this->incidentBy($owner);
        $this->deleteJson("/api/security-incidents/{$incident->id}", [], $this->headers($admin))->assertOk();

        $this->getJson("/api/security-incidents/{$incident->id}", $this->headers($stranger))
            ->assertStatus(404)
            ->assertJsonPath('code', 'record_not_found');
    }

    public function test_a_record_that_never_existed_gets_a_readable_404(): void
    {
        $admin = $this->user('admin');

        $response = $this->getJson('/api/security-incidents/999999', $this->headers($admin))
            ->assertStatus(404)
            ->assertJsonPath('code', 'record_not_found');

        $this->assertStringNotContainsString('No query results', $response->json('message'));
        $this->assertStringContainsString('incident report', $response->json('message'));
    }
}
