<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\CounterQueueEntry;
use App\Models\StorageLocation;
use App\Models\User;
use App\Services\Counter\CounterQueueService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CounterQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function campus(): Campus
    {
        return Campus::firstOrCreate(['code' => 'MAIN'], ['name' => 'Main Campus']);
    }

    protected function officer(?Campus $campus = null): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $officer */
        $officer = User::factory()->create(['is_active' => true, 'campus_id' => $campus?->id]);
        $officer->assignRole('security_officer');

        return $officer;
    }

    protected function student(): User
    {
        $this->seed(RoleSeeder::class);

        /** @var User $student */
        $student = User::factory()->create(['is_active' => true]);
        $student->assignRole('student');

        return $student;
    }

    protected function counter(string $status = StorageLocation::STATUS_OPEN, ?Campus $campus = null): StorageLocation
    {
        return StorageLocation::create([
            'campus_id' => ($campus ?? $this->campus())->id,
            'type' => StorageLocation::TYPE_COUNTER,
            'label' => 'Counter 1',
            'code' => 'CTR-Q' . random_int(1, 999999),
            'is_active' => true,
            'status' => $status,
        ]);
    }

    protected function authHeaders(User $user): array
    {
        $token = $user->createToken('test', ['*'])->plainTextToken;

        return ['Authorization' => "Bearer {$token}"];
    }

    // --- join() ---

    public function test_a_student_can_join_the_queue(): void
    {
        $student = $this->student();
        $counter = $this->counter();

        $entry = app(CounterQueueService::class)->join($counter, $student, CounterQueueEntry::PURPOSE_CLAIM_ITEM);

        $this->assertSame(1, $entry->ticket_number);
        $this->assertSame(CounterQueueEntry::STATUS_WAITING, $entry->status);
    }

    public function test_joining_twice_returns_the_same_active_ticket(): void
    {
        $student = $this->student();
        $counter = $this->counter();

        $service = app(CounterQueueService::class);
        $first = $service->join($counter, $student, CounterQueueEntry::PURPOSE_INQUIRY);
        $second = $service->join($counter, $student, CounterQueueEntry::PURPOSE_INQUIRY);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, CounterQueueEntry::where('storage_location_id', $counter->id)->count());
    }

    public function test_ticket_numbers_increment_per_counter(): void
    {
        $counter = $this->counter();
        $service = app(CounterQueueService::class);

        $a = $service->join($counter, $this->student(), null);
        $b = $service->join($counter, $this->student(), null);

        $this->assertSame(1, $a->ticket_number);
        $this->assertSame(2, $b->ticket_number);
    }

    public function test_cannot_join_a_closed_counters_queue(): void
    {
        $student = $this->student();
        $counter = $this->counter(StorageLocation::STATUS_CLOSED);

        $this->expectException(ValidationException::class);

        app(CounterQueueService::class)->join($counter, $student, null);
    }

    public function test_cannot_join_a_non_counter_locations_queue(): void
    {
        $student = $this->student();
        $storage = StorageLocation::create([
            'campus_id' => $this->campus()->id,
            'type' => StorageLocation::TYPE_STORAGE,
            'room' => 'Room 1',
            'code' => 'STG-Q1',
            'is_active' => true,
        ]);

        $this->expectException(ValidationException::class);

        app(CounterQueueService::class)->join($storage, $student, null);
    }

    // --- callNext() / call() ---

    public function test_call_next_pulls_the_oldest_waiting_ticket(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        $service = app(CounterQueueService::class);

        $first = $service->join($counter, $this->student(), null);
        $service->join($counter, $this->student(), null);

        $called = $service->callNext($counter, $officer);

        $this->assertSame($first->id, $called->id);
        $this->assertSame(CounterQueueEntry::STATUS_CALLED, $called->status);
    }

    public function test_call_next_returns_null_when_nobody_waiting(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();

        $result = app(CounterQueueService::class)->callNext($counter, $officer);

        $this->assertNull($result);
    }

    public function test_officer_from_another_campus_cannot_call_next(): void
    {
        $campusA = Campus::firstOrCreate(['code' => 'A'], ['name' => 'Campus A']);
        $campusB = Campus::firstOrCreate(['code' => 'B'], ['name' => 'Campus B']);

        $officer = $this->officer($campusA);
        $counter = $this->counter(StorageLocation::STATUS_OPEN, $campusB);
        app(CounterQueueService::class)->join($counter, $this->student(), null);

        $this->expectException(ValidationException::class);

        app(CounterQueueService::class)->callNext($counter, $officer);
    }

    // --- full lifecycle ---

    public function test_full_lifecycle_waiting_to_completed(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        $service = app(CounterQueueService::class);

        $entry = $service->join($counter, $this->student(), CounterQueueEntry::PURPOSE_CLAIM_ITEM);
        $entry = $service->call($entry, $officer);
        $this->assertSame(CounterQueueEntry::STATUS_CALLED, $entry->status);

        $entry = $service->startServing($entry, $officer);
        $this->assertSame(CounterQueueEntry::STATUS_SERVING, $entry->status);

        $entry = $service->complete($entry, $officer);
        $this->assertSame(CounterQueueEntry::STATUS_COMPLETED, $entry->status);
        $this->assertNotNull($entry->completed_at);
    }

    public function test_cannot_complete_a_still_waiting_entry(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        $entry = app(CounterQueueService::class)->join($counter, $this->student(), null);

        $this->expectException(ValidationException::class);

        app(CounterQueueService::class)->complete($entry, $officer);
    }

    public function test_mark_no_show_requires_the_entry_to_have_been_called(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        $entry = app(CounterQueueService::class)->join($counter, $this->student(), null);

        $this->expectException(ValidationException::class);

        app(CounterQueueService::class)->markNoShow($entry, $officer);
    }

    public function test_no_show_after_being_called_succeeds(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        $service = app(CounterQueueService::class);

        $entry = $service->join($counter, $this->student(), null);
        $entry = $service->call($entry, $officer);
        $entry = $service->markNoShow($entry, $officer);

        $this->assertSame(CounterQueueEntry::STATUS_NO_SHOW, $entry->status);
    }

    // --- cancel() ---

    public function test_requester_can_cancel_their_own_waiting_ticket(): void
    {
        $student = $this->student();
        $counter = $this->counter();
        $entry = app(CounterQueueService::class)->join($counter, $student, null);

        $cancelled = app(CounterQueueService::class)->cancel($entry, $student);

        $this->assertSame(CounterQueueEntry::STATUS_CANCELLED, $cancelled->status);
    }

    public function test_a_different_student_cannot_cancel_someone_elses_ticket(): void
    {
        $owner = $this->student();
        $other = $this->student();
        $counter = $this->counter();
        $entry = app(CounterQueueService::class)->join($counter, $owner, null);

        $this->expectException(ValidationException::class);

        app(CounterQueueService::class)->cancel($entry, $other);
    }

    public function test_officer_can_cancel_on_behalf_of_a_requester(): void
    {
        $officer = $this->officer();
        $student = $this->student();
        $counter = $this->counter();
        $entry = app(CounterQueueService::class)->join($counter, $student, null);

        $cancelled = app(CounterQueueService::class)->cancel($entry, $officer);

        $this->assertSame(CounterQueueEntry::STATUS_CANCELLED, $cancelled->status);
    }

    // --- HTTP layer ---

    public function test_join_via_http(): void
    {
        $student = $this->student();
        $counter = $this->counter();

        $response = $this->withHeaders($this->authHeaders($student))
            ->postJson("/api/storage-locations/{$counter->id}/queue/join", ['purpose' => 'inquiry']);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
    }

    public function test_non_staff_cannot_list_the_full_queue_via_http(): void
    {
        $student = $this->student();
        $counter = $this->counter();

        $response = $this->withHeaders($this->authHeaders($student))
            ->getJson("/api/storage-locations/{$counter->id}/queue");

        $response->assertStatus(403);
    }

    public function test_officer_can_call_next_via_http(): void
    {
        $officer = $this->officer();
        $counter = $this->counter();
        app(CounterQueueService::class)->join($counter, $this->student(), null);

        $response = $this->withHeaders($this->authHeaders($officer))
            ->postJson("/api/storage-locations/{$counter->id}/queue/call-next");

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
    }
}
