<?php

namespace App\Support;

/**
 * Rewrites the minified frames of a browser stack trace ("...main-C7U8P8xH.js:1:148213")
 * into the original location, using the private source maps left by `npm run build`.
 */
class StackDecoder
{
    /** @var array<string, SourceMapDecoder|null> */
    private array $maps = [];

    public function __construct(private readonly string $mapDirectory)
    {
    }

    /** Each frame that can be decoded gets "  => original/file.jsx:line:col (name)" appended. */
    public function decode(string $stack): string
    {
        return (string) preg_replace_callback(
            '~([A-Za-z0-9._-]+\.m?js):(\d+):(\d+)~',
            function (array $m) {
                $map = $this->map($m[1]);
                $hit = $map?->lookup((int) $m[2], (int) $m[3]);
                if ($hit === null) {
                    return $m[0];
                }

                return $m[0] . '  => ' . $hit['source'] . ':' . $hit['line'] . ':' . $hit['column']
                    . ($hit['name'] ? ' (' . $hit['name'] . ')' : '');
            },
            $stack
        );
    }

    private function map(string $bundleName): ?SourceMapDecoder
    {
        if (array_key_exists($bundleName, $this->maps)) {
            return $this->maps[$bundleName];
        }

        // basename() so a crafted stack can never point outside the map directory
        $file = rtrim($this->mapDirectory, '/\\') . DIRECTORY_SEPARATOR . basename($bundleName) . '.map';
        $decoder = null;
        if (is_file($file)) {
            try {
                $decoder = new SourceMapDecoder((string) file_get_contents($file));
            } catch (\Throwable) {
                $decoder = null;
            }
        }

        return $this->maps[$bundleName] = $decoder;
    }
}
