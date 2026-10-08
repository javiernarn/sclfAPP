<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\FoundItem;
use App\Models\LostItem;
use App\Models\User;
use App\Notifications\SclfNotification;
use App\Services\Inventory\InventoryService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Whoever handles lost & found (security officer and staff — see
 * User::LOST_FOUND_HANDLER_ROLES; never the admin) must be told when a lost report or found
 * report is filed, and when the matcher turns up something worth reviewing.
 */
class LostFoundHandlerNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function makeUser(string $role, ?int $campusId = null): User
    {
        $this->seed(RoleSeeder::class);
        $user = User::factory()->create(['is_active' => true, 'campus_id' => $campusId]);
        $user->assignRole($role);

        return $user;
    }

    protected function campus(string $code): Campus
    {
        return Campus::firstOrCreate(['code' => $code], ['name' => "Campus {$code}"]);
    }

    /** @return list<string> notification types sent to this user */
    protected function sentTypes(User $user): array
    {
        return Notification::sent($user, SclfNotification::class)
            ->map(fn ($n) => $n->toArray($user)['type'])
            ->values()
            ->all();
    }

    public function test_a_lost_report_notifies_security_and_staff_but_not_the_admin(): void
    {
        Notification::fake();

        $student = $this->makeUser('student');
        $otherStudent = $this->makeUser('student');
        $security = $this->makeUser('security_officer');
        $admin = $this->makeUser('admin');
        $staff = $this->makeUser('staff');

        $this->actingAs($student)->postJson('/api/lost-items', [
            'item_name' => 'Black Wallet',
            'description' => 'Leather wallet with school ID.',
        ])->assertCreated();

        foreach ([$security, $staff] as $handler) {
            $this->assertContains(SclfNotification::TYPE_LOST_REPORTED, $this->sentTypes($handler));
        }
        $this->assertSame([], $this->sentTypes($admin));
        $this->assertSame([], $this->sentTypes($otherStudent));
        $this->assertNotContains(SclfNotification::TYPE_LOST_REPORTED, $this->sentTypes($student));
    }

    public function test_a_found_report_notifies_handlers_but_not_the_officer_who_filed_it(): void
    {
        Notification::fake();

        $filer = $this->makeUser('security_officer');
        $otherOfficer = $this->makeUser('security_officer');
        $admin = $this->makeUser('admin');
        $student = $this->makeUser('student');

        $this->actingAs($filer)->postJson('/api/found-items', [
            'item_name' => 'Blue Umbrella',
            'description' => 'Left at the gate.',
        ])->assertCreated();

        $this->assertContains(SclfNotification::TYPE_FOUND_REPORTED, $this->sentTypes($otherOfficer));
        $this->assertSame([], $this->sentTypes($admin));
        $this->assertSame([], $this->sentTypes($filer));
        $this->assertSame([], $this->sentTypes($student));
    }

    public function test_handler_notifications_deep_link_to_the_review_queue(): void
    {
        Notification::fake();

        $student = $this->makeUser('student');
        $security = $this->makeUser('security_officer');

        $this->actingAs($student)->postJson('/api/found-items', [
            'item_name' => 'Calculator',
            'description' => 'Found in room 2.',
        ])->assertCreated();

        $notification = Notification::sent($security, SclfNotification::class)->first();
        $this->assertSame('/app/security/found-items', $notification->toArray($security)['link']);
    }

    public function test_officers_on_another_campus_are_skipped_for_a_campus_report(): void
    {
        Notification::fake();

        $main = $this->campus('MAIN');
        $annex = $this->campus('ANNEX');

        $student = $this->makeUser('student');
        $mainOfficer = $this->makeUser('security_officer', $main->id);
        $annexOfficer = $this->makeUser('security_officer', $annex->id);
        $unscopedOfficer = $this->makeUser('security_officer');
        $admin = $this->makeUser('admin');

        $this->actingAs($student)->postJson('/api/lost-items', [
            'item_name' => 'Water Bottle',
            'description' => 'Green bottle.',
            'campus_id' => $main->id,
        ])->assertCreated();

        $this->assertContains(SclfNotification::TYPE_LOST_REPORTED, $this->sentTypes($mainOfficer));
        $this->assertContains(SclfNotification::TYPE_LOST_REPORTED, $this->sentTypes($unscopedOfficer));
        $this->assertSame([], $this->sentTypes($admin));
        $this->assertSame([], $this->sentTypes($annexOfficer));
    }

    public function test_a_report_with_no_campus_reaches_campus_bound_officers_too(): void
    {
        Notification::fake();

        $annex = $this->campus('ANNEX');
        $student = $this->makeUser('student');
        $annexOfficer = $this->makeUser('security_officer', $annex->id);

        $this->actingAs($student)->postJson('/api/lost-items', [
            'item_name' => 'Notebook',
            'description' => 'Blue notebook.',
        ])->assertCreated();

        $this->assertContains(SclfNotification::TYPE_LOST_REPORTED, $this->sentTypes($annexOfficer));
    }

    public function test_inactive_handlers_are_not_notified(): void
    {
        Notification::fake();

        $student = $this->makeUser('student');
        $inactive = $this->makeUser('security_officer');
        $inactive->update(['is_active' => false]);

        $this->actingAs($student)->postJson('/api/lost-items', [
            'item_name' => 'Keys',
            'description' => 'Three keys on a ring.',
        ])->assertCreated();

        $this->assertSame([], $this->sentTypes($inactive));
    }

    public function test_approving_a_found_item_that_matches_a_lost_report_alerts_handlers(): void
    {
        $officer = $this->makeUser('security_officer');
        $admin = $this->makeUser('admin');
        $owner = $this->makeUser('student');

        $shared = [
            'item_name' => 'Samsung Galaxy phone',
            'description' => 'Black phone with a cracked corner and blue case',
            'category' => 'Electronics',
            'brand' => 'Samsung',
            'color' => 'Black',
            'unique_characteristics' => 'cracked corner',
        ];

        LostItem::factory()->create($shared + [
            'user_id' => $owner->id,
            'location_lost' => 'Library',
            'date_lost' => now()->toDateString(),
        ]);
        $found = FoundItem::factory()->create($shared + [
            'status' => FoundItem::STATUS_PENDING_REVIEW,
            'verification_status' => 'pending',
            'location_found' => 'Library',
            'date_found' => now()->toDateString(),
        ]);

        Notification::fake();

        app(InventoryService::class)->verify($found, $officer, true);

        $this->assertContains(SclfNotification::TYPE_MATCH_FOR_REVIEW, $this->sentTypes($officer));
        $this->assertSame([], $this->sentTypes($admin));
        // The owner is not pinged by this path — a handler confirms the
        // match from the Matches queue first.
        $this->assertNotContains(SclfNotification::TYPE_MATCH_FOR_REVIEW, $this->sentTypes($owner));
    }

    public function test_a_weak_match_does_not_alert_handlers(): void
    {
        $officer = $this->makeUser('security_officer');
        $owner = $this->makeUser('student');

        LostItem::factory()->create([
            'user_id' => $owner->id,
            'item_name' => 'Red scarf',
            'description' => 'Woolen scarf',
            'category' => 'Clothing',
            'brand' => null,
            'color' => 'Red',
            'location_lost' => 'Gymnasium',
        ]);
        $found = FoundItem::factory()->create([
            'item_name' => 'Silver laptop charger',
            'description' => 'Charger with long cable',
            'category' => 'Electronics',
            'brand' => 'Acer',
            'color' => 'Silver',
            'location_found' => 'Cafeteria',
            'status' => FoundItem::STATUS_PENDING_REVIEW,
            'verification_status' => 'pending',
        ]);

        Notification::fake();

        app(InventoryService::class)->verify($found, $officer, true);

        $this->assertNotContains(SclfNotification::TYPE_MATCH_FOR_REVIEW, $this->sentTypes($officer));
    }
}
