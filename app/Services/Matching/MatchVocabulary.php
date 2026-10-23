<?php

namespace App\Services\Matching;

/**
 * Everything the matching engine "knows" about the real world:
 * brand aliases, item synonyms, colour families, campus zones, categories.
 *
 * Pure PHP on purpose (no Eloquent / Str helpers) so the whole engine can be
 * exercised without booting the framework. Every table here is plain data —
 * extend it when you notice two words that mean the same thing on campus.
 */
class MatchVocabulary
{
    // -- Text helpers ---------------------------------------------------------

    public static function lower(?string $s): string
    {
        return mb_strtolower(trim((string) $s));
    }

    /** Lower-case, strip punctuation/brackets, collapse whitespace. */
    public static function clean(?string $s): string
    {
        $s = self::lower($s);
        $s = preg_replace('/[^\p{L}\p{N}\s\+\.]+/u', ' ', $s);

        return trim(preg_replace('/\s+/u', ' ', $s));
    }

    private const STOPWORDS = [
        'a', 'an', 'the', 'and', 'or', 'of', 'with', 'in', 'on', 'at', 'to', 'for', 'is', 'it', 'its', 'my', 'was',
        'has', 'have', 'had', 'there', 'that', 'this', 'very', 'some', 'ng', 'sa', 'na', 'ang', 'mga', 'yung',
        'item', 'thing', 'color', 'colour', 'one', 'also', 'from', 'by', 'as', 'be', 'are', 'were', 'lost', 'found',
    ];

    /** Light stemmer: plurals and a few common suffixes. Good enough for item words. */
    public static function stem(string $w): string
    {
        if (mb_strlen($w) > 4 && str_ends_with($w, 'ies')) {
            return mb_substr($w, 0, -3) . 'y';
        }
        if (mb_strlen($w) > 3 && str_ends_with($w, 'es') && preg_match('/(ss|sh|ch|x|z)es$/', $w)) {
            return mb_substr($w, 0, -2);
        }
        if (mb_strlen($w) > 3 && str_ends_with($w, 's') && !str_ends_with($w, 'ss')) {
            return mb_substr($w, 0, -1);
        }

        return $w;
    }

    /** Meaningful, stemmed, de-duplicated tokens. */
    public static function tokens(?string $s): array
    {
        $out = [];
        foreach (preg_split('/[^\p{L}\p{N}\+]+/u', self::lower($s), -1, PREG_SPLIT_NO_EMPTY) as $w) {
            if (in_array($w, self::STOPWORDS, true) || (mb_strlen($w) < 2 && !ctype_digit($w))) {
                continue;
            }
            $out[self::stem($w)] = true;
        }

        return array_keys($out);
    }

    // -- Categories -----------------------------------------------------------

    /** Older / free-typed category names -> the canonical catalog names. */
    private const CATEGORY_ALIASES = [
        'electronics' => 'phones & gadgets',
        'gadgets' => 'phones & gadgets',
        'phones' => 'phones & gadgets',
        'phone' => 'phones & gadgets',
        'mobile' => 'phones & gadgets',
        'laptops' => 'laptops & computer accessories',
        'computers' => 'laptops & computer accessories',
        'wallets' => 'wallets, money & cards',
        'wallet' => 'wallets, money & cards',
        'money' => 'wallets, money & cards',
        'cards' => 'wallets, money & cards',
        'id cards' => 'ids & documents',
        'ids' => 'ids & documents',
        'id' => 'ids & documents',
        'documents' => 'ids & documents',
        'bag' => 'bags',
        'supplies' => 'school supplies',
        'books' => 'books & notebooks',
        'clothing' => 'uniforms & clothing',
        'clothes' => 'uniforms & clothing',
        'uniforms' => 'uniforms & clothing',
        'shoes' => 'footwear',
        'bottles' => 'water bottles & food containers',
        'umbrellas' => 'umbrellas & rain gear',
        'jewelry' => 'accessories & jewelry',
        'accessories' => 'accessories & jewelry',
        'sports' => 'sports & pe gear',
        'key' => 'keys',
    ];

    /** Categories that are "close cousins" — a mismatch between them is not a hard conflict. */
    private const CATEGORY_NEIGHBOURS = [
        ['phones & gadgets', 'laptops & computer accessories', 'gaming & entertainment'],
        ['bags', 'wallets, money & cards', 'school supplies'],
        ['ids & documents', 'wallets, money & cards', 'books & notebooks'],
        ['uniforms & clothing', 'footwear', 'accessories & jewelry'],
        ['water bottles & food containers', 'umbrellas & rain gear', 'bags'],
        ['school supplies', 'books & notebooks', 'laptops & computer accessories'],
    ];

    public static function category(?string $c): string
    {
        $k = self::clean($c);

        return self::CATEGORY_ALIASES[$k] ?? $k;
    }

    public static function categoriesRelated(string $a, string $b): bool
    {
        foreach (self::CATEGORY_NEIGHBOURS as $group) {
            if (in_array($a, $group, true) && in_array($b, $group, true)) {
                return true;
            }
        }

        return false;
    }

    // -- Brands ---------------------------------------------------------------

    /** alias -> canonical brand. Keys are already clean()ed. */
    private const BRAND_ALIASES = [
        'samsong' => 'samsung', 'samsumg' => 'samsung', 'sammsung' => 'samsung', 'galaxy' => 'samsung',
        'apple iphone' => 'apple', 'apple ipad' => 'apple', 'apple macbook' => 'apple', 'iphone' => 'apple',
        'ipad' => 'apple', 'macbook' => 'apple', 'airpods' => 'apple', 'apple watch' => 'apple',
        'mi' => 'xiaomi', 'xiomi' => 'xiaomi', 'xiaomi redmi' => 'redmi', 'redme' => 'redmi',
        'oppo' => 'oppo', 'opo' => 'oppo', 'viva' => 'vivo', 'real me' => 'realme', 'reame' => 'realme',
        'hawei' => 'huawei', 'huwei' => 'huawei', 'infinics' => 'infinix', 'infinx' => 'infinix',
        'cherry' => 'cherry mobile', 'cm' => 'cherry mobile', 'hmd' => 'nokia', 'nokia hmd' => 'nokia',
        'google pixel' => 'google', 'pixel' => 'google', 'one plus' => 'oneplus', '1+' => 'oneplus',
        'soundcore anker' => 'anker', 'soundcore' => 'anker', 'asus rog' => 'asus', 'rog' => 'asus',
        'acer predator' => 'acer', 'g shock' => 'casio', 'gshock' => 'casio', 'baby g' => 'casio',
        'land bank' => 'landbank', 'land bank of the philippines' => 'landbank', 'bank of the philippine islands' => 'bpi',
        'banco de oro' => 'bdo', 'northface' => 'the north face', 'north face' => 'the north face',
        'jan sport' => 'jansport', 'new balence' => 'new balance', 'addidas' => 'adidas', 'adedas' => 'adidas',
        'nike air' => 'nike', 'hello kitty' => 'sanrio', 'mickey mouse disney' => 'disney', 'mickey mouse' => 'disney',
        'aqua flask' => 'aquaflask', 'hydroflask' => 'hydro flask', 'tupper ware' => 'tupperware',
        'faber castell' => 'faber-castell', 'fabercastell' => 'faber-castell',
        'wd' => 'western digital', 'western digital wd' => 'western digital',
        'lenovo thinkpad' => 'lenovo', 'hp pavilion' => 'hp', 'hewlett packard' => 'hp',
        'microsoft surface' => 'microsoft', 'surface' => 'microsoft', 'amazon fire' => 'amazon',
        'universal' => 'universal',
        'no brand unbranded' => 'no brand', 'no brand' => 'no brand', 'unbranded' => 'no brand', 'generic' => 'no brand',
        'none' => 'no brand', 'n a' => 'no brand', 'na' => 'no brand',
    ];

    /** Sub-brands that belong to a parent: a partial (not full) match with each other. */
    private const BRAND_FAMILIES = [
        ['xiaomi', 'redmi', 'poco'],
        ['oppo', 'realme', 'oneplus'],
        ['huawei', 'honor'],
        ['infinix', 'tecno', 'itel'],
        ['casio', 'g-shock'],
        ['nokia', 'hmd'],
        ['sanrio', 'miniso'],
    ];

    /** Brands whose products run iOS vs Android — used for the platform sanity check. */
    private const IOS_BRANDS = ['apple'];

    private const ANDROID_BRANDS = [
        'samsung', 'oppo', 'vivo', 'realme', 'xiaomi', 'redmi', 'poco', 'infinix', 'tecno', 'itel', 'huawei', 'honor',
        'nokia', 'motorola', 'oneplus', 'google', 'sony', 'asus', 'cherry mobile', 'myphone', 'nothing', 'zte', 'lenovo',
        'alcatel',
    ];

    public static function brand(?string $b): string
    {
        $k = self::clean($b);
        // "Apple (iPad)" / "Samsung (Galaxy)" -> look at the part before the bracket too.
        $beforeBracket = self::clean(preg_replace('/\(.*?\)/u', '', (string) $b));
        if (isset(self::BRAND_ALIASES[$k])) {
            return self::BRAND_ALIASES[$k];
        }
        if ($beforeBracket !== '' && isset(self::BRAND_ALIASES[$beforeBracket])) {
            return self::BRAND_ALIASES[$beforeBracket];
        }

        return $beforeBracket !== '' ? $beforeBracket : $k;
    }

    public static function isNoBrand(string $canonicalBrand): bool
    {
        return $canonicalBrand === 'no brand';
    }

    public static function brandsSameFamily(string $a, string $b): bool
    {
        foreach (self::BRAND_FAMILIES as $fam) {
            if (in_array($a, $fam, true) && in_array($b, $fam, true)) {
                return true;
            }
        }

        return false;
    }

    /** 'ios' | 'android' | null — from the brand, the item name and the model text. */
    public static function platform(?string $brand, ?string $itemName = null, ?string $model = null): ?string
    {
        $text = self::clean(($itemName ?? '') . ' ' . ($model ?? ''));
        if (preg_match('/\b(iphone|ipad|airpods?|apple watch|macbook|ipod)\b/', $text)) {
            return 'ios';
        }
        if (preg_match('/\b(galaxy|pixel|xperia|redmi|poco|android)\b/', $text)) {
            return 'android';
        }
        $b = self::brand($brand);
        if (in_array($b, self::IOS_BRANDS, true)) {
            return 'ios';
        }
        if (in_array($b, self::ANDROID_BRANDS, true)) {
            return 'android';
        }

        return null;
    }

    // -- Item names -----------------------------------------------------------

    /**
     * Synonym groups: every phrase in a group means the same kind of thing.
     * Group id is the first entry. Phrases are clean()ed on lookup.
     */
    private const ITEM_GROUPS = [
        'smartphone' => ['smartphone', 'smart phone', 'cellphone', 'cell phone', 'mobile phone', 'mobile', 'phone', 'android phone', 'android',
            'iphone', 'iphone apple', 'cp', 'celphone', 'handphone'],
        'keypad phone' => ['keypad phone', 'feature phone', 'basic phone', 'cellphone keypad', 'nokia keypad'],
        'tablet' => ['tablet', 'tab', 'ipad', 'android tablet', 'galaxy tab', 'matepad'],
        'smartwatch' => ['smartwatch', 'smart watch', 'apple watch', 'galaxy watch', 'fitness band', 'fitness tracker', 'mi band', 'smart band'],
        'wireless earbuds' => ['wireless earbuds', 'earbuds', 'airpods', 'airpod', 'tws', 'bluetooth earbuds', 'buds', 'true wireless earbuds'],
        'earphones' => ['earphones', 'earphones wired', 'wired earphones', 'earphone', 'earpiece', 'in ear'],
        'headphones' => ['headphones', 'headphone', 'headset', 'over ear headphones', 'gaming headset'],
        'power bank' => ['power bank', 'powerbank', 'portable charger', 'battery pack'],
        'charger' => ['phone charger cable', 'charger', 'phone charger', 'charging cable', 'usb cable', 'adapter', 'lightning cable', 'type c cable'],
        'flash drive' => ['flash drive usb', 'flash drive', 'usb', 'thumb drive', 'usb drive', 'pen drive', 'flashdrive'],
        'speaker' => ['bluetooth speaker', 'speaker', 'portable speaker'],
        'camera' => ['camera', 'digital camera', 'dslr', 'action camera', 'gopro'],
        'laptop' => ['laptop', 'notebook computer', 'notebook pc', 'macbook', 'chromebook', 'computer', 'netbook'],
        'laptop charger' => ['laptop charger', 'laptop adapter', 'charger laptop', 'laptop power adapter'],
        'mouse' => ['computer mouse', 'mouse', 'wireless mouse', 'gaming mouse'],
        'keyboard' => ['keyboard', 'wireless keyboard', 'gaming keyboard'],
        'hard drive' => ['external hard drive', 'hard drive', 'hdd', 'external hdd', 'ssd', 'external ssd', 'portable hard drive'],
        'memory card' => ['memory card', 'sd card', 'micro sd', 'microsd', 'tf card'],
        'backpack' => ['backpack', 'back pack', 'school bag', 'rucksack', 'bagpack', 'bag pack'],
        'sling bag' => ['sling bag', 'crossbody bag', 'cross body bag', 'belt bag', 'chest bag', 'body bag'],
        'handbag' => ['handbag', 'hand bag', 'purse', 'shoulder bag', 'tote bag', 'tote'],
        'laptop bag' => ['laptop bag', 'laptop sleeve', 'laptop case'],
        'pencil case' => ['pencil case', 'pouch', 'pencil pouch', 'pen case', 'pencil bag'],
        'wallet' => ['wallet', 'billfold', 'bifold wallet', 'trifold wallet', 'pitaka'],
        'coin purse' => ['coin purse', 'coin pouch', 'change purse'],
        'card holder' => ['card holder', 'cardholder', 'card case', 'cardcase'],
        'atm card' => ['atm debit card', 'atm card', 'debit card', 'atm', 'bank card', 'credit card'],
        'school id' => ['school id', 'student id', 'id card', 'campus id', 'id', 'student card'],
        'id holder' => ['id lace id holder', 'id lace', 'id holder', 'lanyard', 'id lanyard'],
        'calculator' => ['scientific calculator', 'calculator', 'calc', 'casio calculator'],
        'ballpen' => ['ballpen', 'ball pen', 'pen', 'ballpoint pen'],
        'pencil' => ['pencil mechanical pencil', 'pencil', 'mechanical pencil'],
        'textbook' => ['textbook', 'text book', 'book', 'reference book'],
        'notebook' => ['notebook', 'note book', 'notebooks', 'spiral notebook', 'composition notebook'],
        'water bottle' => ['water bottle tumbler', 'water bottle', 'tumbler', 'bottle', 'flask', 'aquaflask', 'hydro flask', 'water jug'],
        'thermos' => ['thermos insulated flask', 'thermos', 'insulated flask', 'vacuum flask'],
        'lunch box' => ['lunch box baon container', 'lunch box', 'lunchbox', 'baon', 'food container', 'tupperware', 'snack box', 'baon container'],
        'umbrella' => ['umbrella folding', 'umbrella long stick', 'umbrella', 'payong', 'folding umbrella'],
        'eyeglasses' => ['eyeglasses', 'glasses', 'eye glasses', 'spectacles', 'specs', 'salamin'],
        'sunglasses' => ['sunglasses', 'shades', 'sun glasses'],
        'wristwatch' => ['wristwatch', 'watch', 'wrist watch', 'analog watch', 'digital watch'],
        // Keys are split by what they open: a house key must not score as "the same item" as a
        // motorcycle key. The generic 'key' group is a cousin of each (see GROUP_COUSINS).
        'key' => ['key', 'keys', 'bunch of keys', 'susi', 'set of keys'],
        'house key' => ['house key', 'boarding house dorm key', 'dorm key', 'gate key', 'door key', 'apartment key'],
        'locker key' => ['locker key', 'cabinet drawer key', 'cabinet key', 'drawer key'],
        'classroom key' => ['classroom office key', 'classroom key', 'office key', 'room key', 'laboratory key'],
        'motorcycle key' => ['motorcycle key', 'motor key', 'tricycle key', 'scooter key', 'motorbike key'],
        'car key' => ['car key remote', 'car key', 'car remote', 'vehicle key', 'car fob'],
        'padlock' => ['padlock with key', 'padlock', 'bicycle e bike lock key', 'bike lock key', 'lock key'],
        'access card' => ['key fob rfid access card', 'key fob', 'rfid card', 'access card'],
        'keychain' => ['keychain', 'key chain', 'key ring', 'keyring'],
        'rubber shoes' => ['rubber shoes sneakers', 'rubber shoes', 'sneakers', 'shoes', 'running shoes', 'white rubber shoes pe', 'sapatos'],
        'school shoes' => ['black school shoes', 'school shoes', 'leather shoes', 'formal shoes'],
        'slippers' => ['slippers flip flops', 'slippers', 'flip flops', 'tsinelas', 'sandals', 'sandal'],
        'jacket' => ['jacket hoodie', 'jacket', 'hoodie', 'sweater', 'cardigan', 'windbreaker'],
        'polo' => ['school uniform polo blouse', 'polo', 'blouse', 'uniform top', 'school uniform'],
        'pe shirt' => ['pe uniform t shirt', 'pe shirt', 'pe uniform', 'tshirt', 't shirt', 'shirt'],
        'cap' => ['cap hat', 'cap', 'hat', 'baseball cap'],
        'lab gown' => ['lab gown apron', 'lab gown', 'lab coat', 'apron'],
        'console' => ['game console', 'nintendo switch', 'switch', 'ps5', 'ps4', 'steam deck', 'handheld console'],
        'controller' => ['controller', 'gamepad', 'joystick', 'joy con', 'dualsense', 'dualshock'],
        'helmet' => ['helmet', 'motorcycle helmet', 'bike helmet', 'half face helmet', 'full face helmet'],
        'rosary' => ['rosary', 'rosaryo'],
        'bible' => ['bible prayer book', 'bible', 'prayer book', 'missal'],
    ];

    private static ?array $itemIndex = null;

    private static function itemIndex(): array
    {
        if (self::$itemIndex === null) {
            self::$itemIndex = [];
            foreach (self::ITEM_GROUPS as $group => $phrases) {
                foreach ($phrases as $p) {
                    self::$itemIndex[self::clean($p)] ??= $group;
                }
            }
        }

        return self::$itemIndex;
    }

    /** Synonym-group id for an item name, or null when we have no entry for it. */
    public static function itemGroup(?string $name): ?string
    {
        $idx = self::itemIndex();
        $k = self::clean($name);
        if ($k === '') {
            return null;
        }
        if (isset($idx[$k])) {
            return $idx[$k];
        }
        // "Black Samsung phone" -> try every word and every adjacent pair against the table,
        // preferring longer phrases.
        $words = preg_split('/\s+/u', $k, -1, PREG_SPLIT_NO_EMPTY);
        $n = count($words);
        for ($len = min(3, $n); $len >= 1; $len--) {
            for ($i = 0; $i + $len <= $n; $i++) {
                $phrase = implode(' ', array_slice($words, $i, $len));
                if (isset($idx[$phrase]) && !in_array($phrase, ['id', 'tab', 'mobile', 'android', 'book', 'cp', 'shirt', 'switch', 'usb'], true)) {
                    return $idx[$phrase];
                }
            }
        }

        return null;
    }

    /** Pairs of groups that are the same kind of thing at a coarser level (partial credit). */
    private const GROUP_COUSINS = [
        ['smartphone', 'tablet'], ['wireless earbuds', 'earphones'], ['earphones', 'headphones'], ['wireless earbuds', 'headphones'],
        ['backpack', 'sling bag'], ['backpack', 'handbag'], ['sling bag', 'handbag'], ['backpack', 'laptop bag'], ['handbag', 'laptop bag'],
        ['wallet', 'coin purse'], ['wallet', 'card holder'], ['coin purse', 'card holder'], ['pencil case', 'coin purse'],
        ['school id', 'id holder'], ['school id', 'atm card'],
        ['water bottle', 'thermos'], ['water bottle', 'lunch box'],
        ['rubber shoes', 'school shoes'], ['rubber shoes', 'slippers'], ['school shoes', 'slippers'],
        ['eyeglasses', 'sunglasses'], ['key', 'keychain'],
        ['key', 'house key'], ['key', 'locker key'], ['key', 'classroom key'], ['key', 'motorcycle key'], ['key', 'car key'], ['key', 'padlock'],
        ['house key', 'locker key'], ['house key', 'classroom key'], ['locker key', 'padlock'], ['motorcycle key', 'car key'], ['access card', 'classroom key'],
        ['jacket', 'polo'], ['polo', 'pe shirt'], ['jacket', 'pe shirt'],
        ['textbook', 'notebook'], ['ballpen', 'pencil'], ['laptop', 'tablet'], ['laptop charger', 'charger'],
        ['console', 'controller'], ['hard drive', 'flash drive'], ['flash drive', 'memory card'], ['power bank', 'charger'],
        ['smartwatch', 'wristwatch'],
    ];

    public static function groupsCousins(string $a, string $b): bool
    {
        foreach (self::GROUP_COUSINS as [$x, $y]) {
            if (($a === $x && $b === $y) || ($a === $y && $b === $x)) {
                return true;
            }
        }

        return false;
    }

    // -- Colours --------------------------------------------------------------

    /** colour word -> [canonical name, family] */
    private const COLORS = [
        'black' => ['black', 'dark'], 'itim' => ['black', 'dark'], 'jet black' => ['black', 'dark'],
        'white' => ['white', 'light'], 'puti' => ['white', 'light'], 'off white' => ['white', 'light'], 'cream' => ['beige', 'light'],
        'gray' => ['gray', 'neutral'], 'grey' => ['gray', 'neutral'], 'silver' => ['silver', 'neutral'], 'graphite' => ['gray', 'neutral'],
        'space gray' => ['gray', 'neutral'], 'space grey' => ['gray', 'neutral'], 'titanium' => ['gray', 'neutral'],
        'gold' => ['gold', 'warm metal'], 'rose gold' => ['rose gold', 'warm metal'], 'champagne' => ['gold', 'warm metal'],
        'red' => ['red', 'red'], 'pula' => ['red', 'red'], 'maroon' => ['maroon', 'red'], 'burgundy' => ['maroon', 'red'], 'wine' => ['maroon', 'red'],
        'pink' => ['pink', 'red'], 'rosas' => ['pink', 'red'], 'magenta' => ['pink', 'red'],
        'orange' => ['orange', 'orange'], 'kahel' => ['orange', 'orange'],
        'yellow' => ['yellow', 'yellow'], 'dilaw' => ['yellow', 'yellow'],
        'green' => ['green', 'green'], 'berde' => ['green', 'green'], 'light green' => ['light green', 'green'], 'olive' => ['green', 'green'],
        'mint' => ['light green', 'green'], 'teal' => ['teal', 'green'], 'turquoise' => ['teal', 'green'],
        'blue' => ['blue', 'blue'], 'asul' => ['blue', 'blue'], 'navy blue' => ['navy blue', 'blue'], 'navy' => ['navy blue', 'blue'],
        'sky blue' => ['sky blue', 'blue'], 'light blue' => ['sky blue', 'blue'], 'royal blue' => ['blue', 'blue'], 'dark blue' => ['navy blue', 'blue'],
        'violet' => ['violet', 'purple'], 'purple' => ['violet', 'purple'], 'lavender' => ['violet', 'purple'], 'lila' => ['violet', 'purple'],
        'brown' => ['brown', 'brown'], 'kayumanggi' => ['brown', 'brown'], 'beige' => ['beige', 'light'], 'khaki' => ['beige', 'light'], 'tan' => ['brown', 'brown'],
        'transparent' => ['transparent', 'clear'], 'clear' => ['transparent', 'clear'], 'transparent clear' => ['transparent', 'clear'],
        'multicolor' => ['multicolor', 'multi'], 'multi color' => ['multicolor', 'multi'], 'colorful' => ['multicolor', 'multi'], 'rainbow' => ['multicolor', 'multi'],
    ];

    /** Families that sit next to each other (a "near" colour, worth partial credit). */
    private const COLOR_NEAR = [
        ['dark', 'neutral'], ['light', 'neutral'], ['warm metal', 'yellow'], ['warm metal', 'neutral'], ['red', 'orange'],
        ['red', 'purple'], ['blue', 'purple'], ['blue', 'green'], ['brown', 'orange'], ['brown', 'warm metal'], ['light', 'warm metal'],
        ['yellow', 'orange'], ['light', 'yellow'],
    ];

    /** @return array<int, array{0:string,1:string}> list of [canonical, family] found in a colour field */
    public static function colors(?string $text): array
    {
        $k = self::clean($text);
        if ($k === '') {
            return [];
        }
        $found = [];
        // Longest phrases first so "rose gold" wins over "gold", "navy blue" over "blue".
        $keys = array_keys(self::COLORS);
        usort($keys, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        $rest = ' ' . $k . ' ';
        foreach ($keys as $key) {
            $needle = ' ' . $key . ' ';
            if (str_contains($rest, $needle)) {
                $found[self::COLORS[$key][0]] = self::COLORS[$key];
                $rest = str_replace($needle, ' ', $rest);
            }
        }

        return array_values($found);
    }

    public static function familiesNear(string $a, string $b): bool
    {
        foreach (self::COLOR_NEAR as [$x, $y]) {
            if (($a === $x && $b === $y) || ($a === $y && $b === $x)) {
                return true;
            }
        }

        return false;
    }

    // -- Places ---------------------------------------------------------------

    /** canonical place => zone */
    private const PLACE_ZONES = [
        'library' => 'academic', 'classroom' => 'academic', 'computer laboratory' => 'academic', 'science laboratory' => 'academic',
        'faculty room' => 'academic', 'multipurpose hall' => 'academic',
        'canteen' => 'food', 'cafeteria' => 'food',
        'covered court' => 'sports', 'gym' => 'sports', 'gymnasium' => 'sports', 'bleachers' => 'sports', 'stage' => 'sports',
        'quadrangle' => 'outdoor', 'oval' => 'outdoor', 'field' => 'outdoor', 'garden' => 'outdoor', 'parking' => 'outdoor',
        'waiting shed' => 'gate', 'guard house' => 'gate', 'gate' => 'gate', 'terminal' => 'gate',
        'registrar' => 'office', 'cashier' => 'office', 'clinic' => 'office', 'guidance' => 'office', 'administration' => 'office',
        'admin' => 'office', 'bookstore' => 'office', 'main building' => 'office',
        'comfort room' => 'common', 'cr' => 'common', 'restroom' => 'common', 'hallway' => 'common', 'corridor' => 'common',
        'stairs' => 'common', 'student lounge' => 'common', 'lounge' => 'common', 'chapel' => 'common', 'prayer room' => 'common',
    ];

    /** @return array<string,string> canonical places mentioned in free text => zone */
    public static function places(?string $text): array
    {
        $k = ' ' . self::clean($text) . ' ';
        $out = [];
        foreach (self::PLACE_ZONES as $place => $zone) {
            if (str_contains($k, ' ' . $place . ' ')) {
                $out[$place] = $zone;
            }
        }

        return $out;
    }

    // -- Models ---------------------------------------------------------------

    private const MODEL_VARIANT_WORDS = ['pro', 'max', 'plus', 'ultra', 'mini', 'lite', 'fe', 'se', 'air', 'edge', 'fold', 'flip', 'neo', 'gt', 'prime', 'core', 'go', 'note'];

    /**
     * Break a model string into [base tokens, variant tokens].
     * "Galaxy A15 5G" -> base [a15], variant [] ;  "iPhone 13 Pro Max" -> base [13], variant [max, pro].
     */
    public static function modelParts(?string $model, ?string $brand = null): array
    {
        $k = self::clean($model);
        $k = preg_replace('/\b(galaxy|iphone|ipad|redmi|poco|xiaomi|samsung|apple|oppo|vivo|realme|infinix|tecno|huawei|honor|nokia|moto|motorola|aspire|ideapad|vivobook|inspiron|thinkpad|gen|generation|th|nd|rd|st|5g|4g|lte|dual sim|sim)\b/u', ' ', $k);
        $k = preg_replace('/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/u', ' ', $k);   // a15 -> a 15 ; 128gb -> 128 gb
        $words = preg_split('/\s+/u', trim($k), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $base = [];
        $variant = [];
        foreach ($words as $w) {
            if (in_array($w, self::MODEL_VARIANT_WORDS, true)) {
                $variant[$w] = true;
            } elseif (!in_array($w, ['gb', 'tb', 'ram', 'rom'], true)) {
                $base[] = $w;
            }
        }
        $variant = array_keys($variant);
        sort($variant);

        return [$base, $variant];
    }
}
