<?php

namespace Tests\Feature;

use Tests\TestCase;

class DecodeClientStackCommandTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir() . '/sclf-maps-' . bin2hex(random_bytes(4));
        mkdir($this->dir);
        // One segment: generated 1:0 -> sources[0] line 10, column 4 (mappings "AAUI").
        file_put_contents($this->dir . '/main-AAAA.js.map', json_encode([
            'version' => 3, 'sources' => ['../../resources/js/App.jsx'], 'names' => [], 'mappings' => 'AAUI',
        ]));
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir . '/*') ?: []);
        @rmdir($this->dir);
        parent::tearDown();
    }

    public function test_it_decodes_a_stack_given_on_the_command_line(): void
    {
        $this->artisan('client-errors:decode', [
            '--stack' => 'at https://app.test/build/assets/main-AAAA.js:1:1',
            '--maps' => $this->dir,
        ])->expectsOutputToContain('resources/js/App.jsx:11:5')->assertExitCode(0);
    }

    public function test_it_fails_clearly_when_there_are_no_maps(): void
    {
        $this->artisan('client-errors:decode', ['--stack' => 'x', '--maps' => $this->dir . '/missing'])
            ->expectsOutputToContain('No source maps found')
            ->assertExitCode(1);
    }
}
