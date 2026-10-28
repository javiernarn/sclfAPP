<?php

namespace Tests\Feature;

use App\Rules\FormalProfilePhoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * Server-side half of the formal profile-photo check (the browser does the
 * face/pose checks). The rest of the suite switches the check off
 * (PHOTO_CHECK_ENFORCE=false in phpunit.xml) because its fake uploads are
 * tiny solid-colour images, so each test here turns it back on.
 */
class FormalProfilePhotoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('photo_check.enforce', true);
    }

    /**
     * A plain-background test picture with fine detail in the middle.
     *
     * @param  array{size?:int,bg?:array{0:int,1:int,2:int},blur?:bool,marker?:string}  $opt
     */
    private function photo(array $opt = []): UploadedFile
    {
        $size = $opt['size'] ?? 600;
        $bg = $opt['bg'] ?? [255, 255, 255];
        $im = imagecreatetruecolor($size, $size);
        imagefill($im, 0, 0, imagecolorallocate($im, ...$bg));
        mt_srand(7);
        for ($i = 0; $i < 2500; $i++) {
            $c = mt_rand(40, 200);
            imagefilledellipse(
                $im,
                mt_rand((int) ($size * .3), (int) ($size * .7)),
                mt_rand((int) ($size * .25), (int) ($size * .75)),
                6, 6, imagecolorallocate($im, $c, $c, $c)
            );
        }
        if (! empty($opt['blur'])) {
            for ($i = 0; $i < 60; $i++) {
                imagefilter($im, IMG_FILTER_GAUSSIAN_BLUR);
            }
        }
        $path = tempnam(sys_get_temp_dir(), 'ph').'.jpg';
        imagejpeg($im, $path, 92);
        if (! empty($opt['marker'])) {
            file_put_contents($path, $opt['marker'], FILE_APPEND);
        }

        return new UploadedFile($path, 'photo.jpg', 'image/jpeg', null, true);
    }

    private function errors(UploadedFile $file): array
    {
        $v = Validator::make(
            ['profile_picture' => $file],
            ['profile_picture' => ['required', 'image', 'max:5120', new FormalProfilePhoto]]
        );

        return $v->errors()->get('profile_picture');
    }

    public function test_a_sharp_plain_background_photo_is_accepted(): void
    {
        $this->assertSame([], $this->errors($this->photo()));
    }

    public function test_a_blurry_photo_is_refused(): void
    {
        $this->assertStringContainsString('blurry', $this->errors($this->photo(['blur' => true]))[0]);
    }

    public function test_a_coloured_background_is_refused(): void
    {
        $this->assertStringContainsString('plain white', $this->errors($this->photo(['bg' => [40, 90, 200]]))[0]);
    }

    public function test_a_tiny_photo_is_refused(): void
    {
        $this->assertStringContainsString('too small', $this->errors($this->photo(['size' => 200]))[0]);
    }

    public function test_images_tagged_as_ai_generated_are_refused(): void
    {
        $iptc = '<x:xmp>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</x:xmp>';
        $this->assertStringContainsString('AI-generated', $this->errors($this->photo(['marker' => $iptc]))[0]);

        $sd = 'parameters Negative prompt: ugly Steps: 20, Sampler: Euler';
        $this->assertStringContainsString('AI-generated', $this->errors($this->photo(['marker' => $sd]))[0]);
    }

    public function test_photos_retouched_in_an_editing_app_are_refused(): void
    {
        $this->assertStringContainsString('edited or retouched', $this->errors($this->photo(['marker' => 'Software: Adobe Photoshop 25.0']))[0]);
        $this->assertStringContainsString('edited or retouched', $this->errors($this->photo(['marker' => 'creator-tool: FaceApp']))[0]);
        // the generic "Photoshop 3.0" header many programs write is not an edit
        $this->assertSame([], $this->errors($this->photo(['marker' => 'Photoshop 3.0 8BIM'])));
        // an ordinary phone-camera tag is fine
        $this->assertSame([], $this->errors($this->photo(['marker' => 'Make: samsung Model: SM-A546E'])));
    }

    public function test_the_check_can_be_switched_off(): void
    {
        config()->set('photo_check.enforce', false);

        $this->assertSame([], $this->errors($this->photo(['size' => 200])));
    }
}
