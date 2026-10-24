<?php

namespace Tests\Feature;

use App\Models\FoundItem;
use App\Models\User;
use App\Support\PrivateMedia;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Profile pictures and found/lost item photos are private: stored on the
 * private disk and reachable only through short-lived signed /media links.
 */
class PrivatePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
        $this->seed(RoleSeeder::class);
    }

    private function student(array $attrs = []): User
    {
        $user = User::factory()->create(array_merge(['is_active' => true], $attrs));
        $user->assignRole('student');

        return $user;
    }

    private function storeAvatar(string $name = 'face.jpg'): string
    {
        return UploadedFile::fake()->image($name, 40, 40)->store('profile-pictures', PrivateMedia::DISK);
    }

    public function test_profile_picture_url_is_a_signed_media_link_not_a_storage_link(): void
    {
        $user = $this->student(['profile_picture' => $this->storeAvatar()]);

        $url = $user->profile_picture_url;

        $this->assertStringStartsWith('/media/profile-pictures/', $url);
        $this->assertStringContainsString('signature=', $url);
        $this->assertStringContainsString('expires=', $url);
        $this->assertStringNotContainsString('/storage/', $url);
    }

    public function test_the_same_photo_keeps_the_same_link_so_browsers_can_cache_it(): void
    {
        $user = $this->student(['profile_picture' => $this->storeAvatar()]);

        $this->assertSame($user->profile_picture_url, $user->fresh()->profile_picture_url);
    }

    public function test_no_picture_means_no_url(): void
    {
        $this->assertNull($this->student()->profile_picture_url);
        $this->assertNull(PrivateMedia::url(null));
    }

    public function test_a_signed_link_serves_the_image_with_safe_headers(): void
    {
        $user = $this->student(['profile_picture' => $this->storeAvatar()]);

        $response = $this->get($user->profile_picture_url);

        $response->assertOk();
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringStartsWith('image/', $response->headers->get('Content-Type'));
    }

    public function test_the_bare_path_without_a_signature_is_refused(): void
    {
        $path = $this->storeAvatar();

        $this->get('/media/' . $path)->assertForbidden();
    }

    public function test_a_tampered_signed_link_is_refused(): void
    {
        $one = $this->student(['profile_picture' => $this->storeAvatar('a.jpg')]);
        $two = $this->student(['profile_picture' => $this->storeAvatar('b.jpg')]);

        // Take user one's signature and point it at user two's file.
        $query = parse_url($one->profile_picture_url, PHP_URL_QUERY);
        $otherFile = basename($two->profile_picture);

        $this->get("/media/profile-pictures/{$otherFile}?{$query}")->assertForbidden();
    }

    public function test_a_link_stops_working_after_it_expires(): void
    {
        $user = $this->student(['profile_picture' => $this->storeAvatar()]);
        $url = $user->profile_picture_url;

        $this->get($url)->assertOk();

        $this->travel(3)->days();

        $this->get($url)->assertForbidden();
    }

    public function test_email_links_are_absolute_last_a_week_and_still_open_the_photo(): void
    {
        config(['app.url' => 'https://sclf.example']);
        $path = $this->storeAvatar();

        $url = PrivateMedia::emailUrl($path);

        $this->assertStringStartsWith('https://sclf.example/media/profile-pictures/', $url);

        // The server sees only the path + query, so strip the host the way a real request does.
        $relative = substr($url, strlen('https://sclf.example'));
        $this->get($relative)->assertOk();

        $this->travel(6)->days();
        $this->get($relative)->assertOk();

        $this->travel(2)->days();
        $this->get($relative)->assertForbidden();
    }

    public function test_only_images_in_the_allowed_folders_are_ever_served(): void
    {
        // A non-image that happens to sit in an allowed folder.
        Storage::disk('local')->put('profile-pictures/notes.jpg', 'just some text, not a picture');
        $user = $this->student(['profile_picture' => 'profile-pictures/notes.jpg']);
        $this->get($user->profile_picture_url)->assertNotFound();

        // Other private folders can never be reached, even with a hand-built path.
        $this->assertNull(PrivateMedia::url('report-attachments/SecurityIncident/1/x.jpg'));
        $this->assertNull(PrivateMedia::url('profile-pictures/../.env'));
        $this->assertNull(PrivateMedia::url('profile-pictures/a/b.jpg'));
    }

    public function test_new_uploads_land_on_the_private_disk_only(): void
    {
        $student = $this->student();

        $this->actingAs($student)->postJson('/api/found-items', [
            'item_name' => 'Blue Umbrella',
            'description' => 'Found near the cafeteria entrance.',
            'image' => UploadedFile::fake()->image('umbrella.jpg', 80, 80),
        ])->assertStatus(201);

        $path = FoundItem::where('item_name', 'Blue Umbrella')->value('image_path');

        $this->assertNotEmpty($path);
        $this->assertStringStartsWith('found-items/', $path);
        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertMissing($path);

        $this->assertStringStartsWith('/media/found-items/', FoundItem::where('image_path', $path)->first()->image_url);
    }
}
