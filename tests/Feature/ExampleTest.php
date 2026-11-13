<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        // CI's PHPUnit job does not build the frontend, so there is no
        // public/build/manifest.json. Stub Vite; this only checks the route boots.
        $this->withoutVite();

        $response = $this->get('/');

        $response->assertStatus(200);
    }
}
