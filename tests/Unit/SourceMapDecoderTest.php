<?php

namespace Tests\Unit;

use App\Support\SourceMapDecoder;
use App\Support\StackDecoder;
use PHPUnit\Framework\TestCase;

class SourceMapDecoderTest extends TestCase
{
    private const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    private function vlq(int $n): string
    {
        $n = $n < 0 ? ((-$n) << 1) | 1 : $n << 1;
        $out = '';
        do {
            $digit = $n & 31;
            $n >>= 5;
            if ($n > 0) {
                $digit |= 32;
            }
            $out .= self::B64[$digit];
        } while ($n > 0);

        return $out;
    }

    /**
     * Builds a map from lines of [genCol, source, origLine, origCol, name?] (all 0-based, absolute),
     * so the test does not depend on a hand-typed mappings string.
     */
    private function map(array $lines, array $sources = ['../../resources/js/App.jsx', '../../resources/js/Claim.jsx'], array $names = ['render', 'submit']): string
    {
        $src = $oLine = $oCol = $name = 0;
        $encodedLines = [];
        foreach ($lines as $segments) {
            $genCol = 0;
            $enc = [];
            foreach ($segments as $s) {
                $seg = $this->vlq($s[0] - $genCol) . $this->vlq($s[1] - $src) . $this->vlq($s[2] - $oLine) . $this->vlq($s[3] - $oCol);
                [$genCol, $src, $oLine, $oCol] = [$s[0], $s[1], $s[2], $s[3]];
                if (isset($s[4])) {
                    $seg .= $this->vlq($s[4] - $name);
                    $name = $s[4];
                }
                $enc[] = $seg;
            }
            $encodedLines[] = implode(',', $enc);
        }

        return json_encode(['version' => 3, 'sources' => $sources, 'names' => $names, 'mappings' => implode(';', $encodedLines)]);
    }

    public function test_a_position_maps_back_to_the_original_file_line_and_column(): void
    {
        $json = $this->map([
            [[0, 0, 0, 0], [120, 1, 141, 16, 1], [150000, 0, 9, 2]],   // line 1 (one long minified line)
            [[0, 0, 20, 4, 0]],                                          // line 2
        ]);
        $d = new SourceMapDecoder($json);

        // stack positions are 1-based; the third segment proves 6-digit columns work
        $this->assertSame(['source' => 'resources/js/Claim.jsx', 'line' => 142, 'column' => 17, 'name' => 'submit'], $d->lookup(1, 121));
        $this->assertSame(['source' => 'resources/js/Claim.jsx', 'line' => 142, 'column' => 17, 'name' => 'submit'], $d->lookup(1, 130), 'inside a segment: the one before it wins');
        $this->assertSame(['source' => 'resources/js/App.jsx', 'line' => 10, 'column' => 3, 'name' => null], $d->lookup(1, 150001));
        $this->assertSame(['source' => 'resources/js/App.jsx', 'line' => 21, 'column' => 5, 'name' => 'render'], $d->lookup(2, 1));
    }

    public function test_positions_with_no_mapping_return_null(): void
    {
        $d = new SourceMapDecoder($this->map([[[10, 0, 0, 0]]]));

        $this->assertNull($d->lookup(1, 5), 'before the first segment of the line');
        $this->assertNull($d->lookup(9, 1), 'line does not exist');
        $this->assertNull($d->lookup(1, 0), 'columns are 1-based');
    }

    public function test_an_invalid_map_is_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new SourceMapDecoder('{"version":3}');
    }

    public function test_paths_are_cleaned(): void
    {
        $this->assertSame('resources/js/a.jsx', SourceMapDecoder::cleanPath('../../../resources/js/a.jsx'));
        $this->assertSame('node_modules/x/y.js', SourceMapDecoder::cleanPath('../node_modules/x/y.js'));
    }

    public function test_the_stack_decoder_rewrites_known_frames_and_leaves_others(): void
    {
        $dir = sys_get_temp_dir() . '/sclf-maps-' . bin2hex(random_bytes(4));
        mkdir($dir);
        file_put_contents($dir . '/main-AAAA.js.map', $this->map([[[0, 1, 141, 16, 1]]]));

        try {
            $out = (new StackDecoder($dir))->decode(
                "TypeError: boom\n at fn (https://app.test/build/assets/main-AAAA.js:1:5)\n at https://app.test/build/assets/other-BBBB.js:1:5"
            );
        } finally {
            @unlink($dir . '/main-AAAA.js.map');
            @rmdir($dir);
        }

        $this->assertStringContainsString('main-AAAA.js:1:5  => resources/js/Claim.jsx:142:17 (submit)', $out);
        $this->assertStringContainsString('other-BBBB.js:1:5', $out);
        $this->assertStringNotContainsString('other-BBBB.js:1:5  =>', $out, 'no map for that build: left as it was');
    }
}
