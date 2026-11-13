<?php

namespace App\Support;

/**
 * Reads one source map (v3 JSON) and answers "which original file, line and
 * column produced this position of the minified bundle?".
 *
 * Pure PHP and framework-free so it can be tested on its own. Only what
 * `client-errors:decode` needs is implemented: the VLQ `mappings` string and
 * the `sources` / `names` lists.
 */
class SourceMapDecoder
{
    private const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    /** @var array<int, array<int, array{0:int,1:int,2:int,3:int,4:?int}>> generated line (0-based) => segments sorted by column */
    private array $lines = [];

    /** @var string[] */
    private array $sources;

    /** @var string[] */
    private array $names;

    public function __construct(string $json)
    {
        $map = json_decode($json, true);
        if (! is_array($map) || ! isset($map['mappings']) || ! is_string($map['mappings'])) {
            throw new \InvalidArgumentException('Not a valid source map.');
        }

        $root = isset($map['sourceRoot']) && is_string($map['sourceRoot']) ? $map['sourceRoot'] : '';
        $this->sources = array_map(fn ($s) => self::cleanPath($root . (string) $s), (array) ($map['sources'] ?? []));
        $this->names = array_map('strval', (array) ($map['names'] ?? []));
        $this->parse($map['mappings']);
    }

    /**
     * @param  int  $line    1-based, as in a browser stack trace
     * @param  int  $column  1-based, as in a browser stack trace
     * @return array{source:string,line:int,column:int,name:?string}|null
     */
    public function lookup(int $line, int $column): ?array
    {
        $segments = $this->lines[$line - 1] ?? null;
        if ($segments === null || $column < 1) {
            return null;
        }

        $target = $column - 1;
        $lo = 0;
        $hi = count($segments) - 1;
        $best = null;
        while ($lo <= $hi) {
            $mid = intdiv($lo + $hi, 2);
            if ($segments[$mid][0] <= $target) {
                $best = $mid;
                $lo = $mid + 1;
            } else {
                $hi = $mid - 1;
            }
        }
        if ($best === null) {
            return null;
        }

        [, $src, $origLine, $origCol, $nameIdx] = $segments[$best];

        return [
            'source' => $this->sources[$src] ?? '?',
            'line' => $origLine + 1,
            'column' => $origCol + 1,
            'name' => $nameIdx !== null ? ($this->names[$nameIdx] ?? null) : null,
        ];
    }

    /** "../../resources/js/App.jsx" => "resources/js/App.jsx"; node_modules paths are kept. */
    public static function cleanPath(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        $path = (string) preg_replace('~^(?:\.{1,2}/)+~', '', $path);
        $path = (string) preg_replace('~^/+~', '', $path);

        return $path;
    }

    private function parse(string $mappings): void
    {
        $index = [];
        for ($i = 0, $n = strlen(self::BASE64); $i < $n; $i++) {
            $index[self::BASE64[$i]] = $i;
        }

        $src = $origLine = $origCol = $name = 0;
        foreach (explode(';', $mappings) as $lineNo => $lineData) {
            $genCol = 0; // the generated column restarts on every line
            $segments = [];

            if ($lineData !== '') {
                foreach (explode(',', $lineData) as $segment) {
                    $fields = self::vlq($segment, $index);
                    if ($fields === []) {
                        continue;
                    }
                    $genCol += $fields[0];
                    if (count($fields) < 4) {
                        continue; // a segment with no original position
                    }
                    $src += $fields[1];
                    $origLine += $fields[2];
                    $origCol += $fields[3];
                    $nameIdx = null;
                    if (count($fields) >= 5) {
                        $name += $fields[4];
                        $nameIdx = $name;
                    }
                    $segments[] = [$genCol, $src, $origLine, $origCol, $nameIdx];
                }
            }

            $this->lines[$lineNo] = $segments;
        }
    }

    /** @return int[] */
    private static function vlq(string $segment, array $index): array
    {
        $values = [];
        $shift = 0;
        $value = 0;
        for ($i = 0, $n = strlen($segment); $i < $n; $i++) {
            $digit = $index[$segment[$i]] ?? null;
            if ($digit === null) {
                return [];
            }
            $value += ($digit & 31) << $shift;
            if ($digit & 32) {
                $shift += 5;
                continue;
            }
            $values[] = ($value & 1) ? -($value >> 1) : ($value >> 1);
            $shift = 0;
            $value = 0;
        }

        return $values;
    }
}
