// ============================================================================
// Device model lists — brand -> model suggestions.
//
// Each brand maps either to:
//   • an array of models (used for every item of that brand), or
//   • an object keyed by item name  ({ 'Smartphone (Android)': [...], 'Tablet': [...] })
//     so a Samsung *phone* never gets offered a Galaxy Buds model, and vice versa.
//     The special key `_all` is added to every item of that brand.
//
// Lists cover what students and staff in the Philippines actually carry,
// including older phones that are still in daily use. Anything missing can
// always be typed in — the box accepts free text.
//
// Helper `range` keeps the big numbered families short and typo-proof:
//   range('Galaxy A', ['03', '04', ...])  ->  ['Galaxy A03', 'Galaxy A04', ...]
// ============================================================================

const range = (prefix, nums, suffix = '') => nums.map((n) => `${prefix}${n}${suffix}`);
const withVariants = (base, variants) => [base, ...variants.map((v) => `${base} ${v}`)];

// ---------------------------------------------------------------------------
// Samsung
// ---------------------------------------------------------------------------
const SAMSUNG_PHONES = [
    // Galaxy S
    ...range('Galaxy S', ['8', '9', '9+', '10', '10+', '10e', '20', '20+', '20 Ultra', '20 FE', '21', '21+', '21 Ultra', '21 FE',
        '22', '22+', '22 Ultra', '23', '23+', '23 Ultra', '23 FE', '24', '24+', '24 Ultra', '24 FE', '25', '25+', '25 Ultra', '25 Edge', '25 FE']),
    // Galaxy A (budget & mid-range — the most common phones on campus)
    ...range('Galaxy A', ['01', '01 Core', '02', '02s', '03', '03s', '03 Core', '04', '04e', '04s', '05', '05s', '06', '07',
        '10', '10s', '11', '12', '13', '14', '15', '16', '17', '20', '20s', '21s', '22', '23', '24', '25', '26',
        '30', '30s', '31', '32', '33', '34', '35', '36', '50', '50s', '51', '52', '52s', '53', '54', '55', '56', '70', '71', '72', '73']),
    // Galaxy M / F
    ...range('Galaxy M', ['12', '13', '14', '15', '21', '22', '23', '31', '32', '33', '34', '35', '51', '52', '53', '54', '55']),
    ...range('Galaxy F', ['13', '14', '15', '23', '34']),
    // Galaxy J / Note (older, still around)
    ...range('Galaxy J', ['2 Prime', '4+', '5 Prime', '6', '6+', '7 Prime', '7 Pro', '8']),
    ...range('Galaxy Note ', ['8', '9', '10', '10+', '20', '20 Ultra']),
    // Foldables
    ...range('Galaxy Z Flip', ['', '3', '4', '5', '6', '7']),
    ...range('Galaxy Z Fold', ['', '2', '3', '4', '5', '6', '7']),
    'Galaxy XCover 6 Pro',
];

const SAMSUNG = {
    'Smartphone (Android)': SAMSUNG_PHONES,
    'Smartphone': SAMSUNG_PHONES,
    'Keypad phone': ['Guru Music 2', 'Metro 313', 'Hero', 'E1200', 'B310E', 'Guru FM Plus'],
    Tablet: ['Galaxy Tab A7 Lite', 'Galaxy Tab A7', 'Galaxy Tab A8', 'Galaxy Tab A9', 'Galaxy Tab A9+', 'Galaxy Tab S6 Lite', 'Galaxy Tab S7', 'Galaxy Tab S7 FE',
        'Galaxy Tab S8', 'Galaxy Tab S8+', 'Galaxy Tab S8 Ultra', 'Galaxy Tab S9', 'Galaxy Tab S9 FE', 'Galaxy Tab S9 Ultra', 'Galaxy Tab S10 FE', 'Galaxy Tab S10+', 'Galaxy Tab S10 Ultra'],
    'Wireless earbuds': ['Galaxy Buds', 'Galaxy Buds+', 'Galaxy Buds Live', 'Galaxy Buds Pro', 'Galaxy Buds2', 'Galaxy Buds2 Pro', 'Galaxy Buds FE', 'Galaxy Buds3', 'Galaxy Buds3 Pro'],
    Smartwatch: ['Galaxy Watch Active2', 'Galaxy Watch4', 'Galaxy Watch5', 'Galaxy Watch5 Pro', 'Galaxy Watch6', 'Galaxy Watch6 Classic', 'Galaxy Watch7', 'Galaxy Watch Ultra', 'Galaxy Fit3'],
    'Memory card': ['EVO Plus 64GB', 'EVO Plus 128GB', 'EVO Plus 256GB', 'PRO Endurance 64GB'],
    'Laptop': ['Galaxy Book2', 'Galaxy Book3', 'Galaxy Book3 Pro', 'Galaxy Book4', 'Galaxy Book4 Pro', 'Chromebook 4'],
};

// ---------------------------------------------------------------------------
// Apple — every iPhone from the 6 up, plus iPad, AirPods, Watch, MacBook
// ---------------------------------------------------------------------------
const IPHONES = [
    'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 'iPhone SE (1st gen)',
    'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
    'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max', 'iPhone SE (2nd gen)',
    'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
    'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone SE (3rd gen)',
    'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
    'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
    'iPhone 16e', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
    'iPhone 17', 'iPhone Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
];

const APPLE = {
    'iPhone (Apple)': IPHONES,
    'Smartphone': IPHONES,
    'Smartphone (Android)': [],
    Tablet: ['iPad (6th gen)', 'iPad (7th gen)', 'iPad (8th gen)', 'iPad (9th gen)', 'iPad (10th gen)', 'iPad (11th gen)',
        'iPad mini (5th gen)', 'iPad mini (6th gen)', 'iPad mini (A17 Pro)', 'iPad Air (3rd gen)', 'iPad Air (4th gen)', 'iPad Air (5th gen)', 'iPad Air (M2)', 'iPad Air (M3)',
        'iPad Pro 11"', 'iPad Pro 12.9"', 'iPad Pro 11" (M4)', 'iPad Pro 13" (M4)'],
    'Wireless earbuds': ['AirPods (1st gen)', 'AirPods (2nd gen)', 'AirPods (3rd gen)', 'AirPods 4', 'AirPods 4 (ANC)', 'AirPods Pro (1st gen)', 'AirPods Pro (2nd gen)', 'AirPods Pro 3'],
    Headphones: ['AirPods Max', 'Beats Solo3', 'Beats Studio3'],
    'Earphones (wired)': ['EarPods (Lightning)', 'EarPods (3.5mm)', 'EarPods (USB-C)'],
    Smartwatch: ['Apple Watch SE', 'Apple Watch SE (2nd gen)', 'Apple Watch Series 6', 'Apple Watch Series 7', 'Apple Watch Series 8', 'Apple Watch Series 9', 'Apple Watch Series 10', 'Apple Watch Series 11', 'Apple Watch Ultra', 'Apple Watch Ultra 2', 'Apple Watch Ultra 3'],
    'Phone charger / cable': ['Lightning cable', 'USB-C cable', '20W USB-C adapter', '5W adapter', 'MagSafe charger'],
    Laptop: ['MacBook Air M1', 'MacBook Air M2', 'MacBook Air M3', 'MacBook Air M4', 'MacBook Pro 13" M1', 'MacBook Pro 13" M2', 'MacBook Pro 14"', 'MacBook Pro 16"', 'MacBook (Intel)'],
    'Laptop charger': ['MagSafe 3', 'MagSafe 2', '67W USB-C', '70W USB-C', '96W USB-C', '140W USB-C'],
    Keyboard: ['Magic Keyboard', 'Smart Keyboard Folio'],
    'Computer mouse': ['Magic Mouse'],
};

// ---------------------------------------------------------------------------
// Other Android phone brands
// ---------------------------------------------------------------------------
const OPPO_PHONES = [
    ...range('A', ['1k', '3s', '5', '5s', '9 2020', '12', '15', '15s', '16', '16e', '17', '17k', '18', '31', '32', '33', '38', '53', '54', '55', '57', '58', '60', '74', '76', '77', '78', '79', '92', '93', '94', '95', '96', '98']).map((m) => `OPPO ${m}`),
    ...['Reno3', 'Reno4', 'Reno4 Z', 'Reno5', 'Reno5 Pro', 'Reno6', 'Reno6 Z', 'Reno7', 'Reno7 Z', 'Reno8', 'Reno8 T', 'Reno8 Pro', 'Reno10', 'Reno10 Pro', 'Reno10 Pro+', 'Reno11', 'Reno11 F', 'Reno11 Pro', 'Reno12', 'Reno12 F', 'Reno12 Pro', 'Reno13', 'Reno13 F', 'Reno13 Pro'],
    'Find X3 Pro', 'Find X5 Pro', 'Find X6 Pro', 'Find X7 Ultra', 'Find N2 Flip', 'Find N3 Flip', 'F19', 'F21 Pro', 'F23',
];

const VIVO_PHONES = [
    ...range('Y', ['01', '02', '02s', '03', '12', '15s', '16', '17', '19', '20', '20s', '21', '21s', '22', '22s', '27', '28', '30', '33s', '35', '36', '50', '51', '53s', '55', '56', '72', '75', '76', '100', '200']).map((m) => `vivo ${m}`),
    ...range('vivo V', ['15', '17', '19', '20', '21', '23', '25', '27', '29', '30', '40', '50']),
    ...range('vivo T', ['1', '2', '3']),
    ...range('vivo X', ['60', '70 Pro', '80', '90', '100', '200']),
    'vivo iQOO Z7', 'vivo iQOO Neo 7', 'vivo S1', 'vivo Z1 Pro',
];

const REALME_PHONES = [
    ...range('realme C', ['2', '3', '11', '12', '15', '17', '20', '21', '21Y', '25', '25s', '30', '30s', '31', '33', '35', '51', '53', '55', '61', '63', '65', '67', '71']),
    ...['realme 5', 'realme 5i', 'realme 6', 'realme 7', 'realme 7i', 'realme 8', 'realme 8 Pro', 'realme 9', 'realme 9i', 'realme 9 Pro', 'realme 10', 'realme 10 Pro',
        'realme 11', 'realme 11 Pro', 'realme 11x', 'realme 12', 'realme 12 Pro', 'realme 12+', 'realme 13', 'realme 13 Pro', 'realme 14 Pro', 'realme 14x'],
    ...range('realme Narzo ', ['20', '30', '50', '50A', '50i', '60', '60x', '70', '70 Pro', '80x']),
    ...range('realme GT ', ['Neo 3', 'Neo 5', 'Neo 6', '5 Pro', '6']),
    'realme Note 50', 'realme Note 60', 'realme X2', 'realme XT',
];

const XIAOMI_PHONES = [
    ...range('Xiaomi ', ['11T', '11T Pro', '11 Lite 5G NE', '12', '12T', '12T Pro', '12 Lite', '13', '13T', '13T Pro', '13 Lite', '14', '14T', '14T Pro', '15', '15T', '15T Pro']),
    ...range('Mi ', ['9T', '10T', '10T Pro', '11 Lite', '11i', 'A3', 'A2', '8']),
    'Xiaomi Mix Fold 3', 'Xiaomi Civi 4 Pro',
];

const REDMI_PHONES = [
    ...range('Redmi ', ['6A', '7', '7A', '8', '8A', '9', '9A', '9C', '9T', '10', '10A', '10C', '10 5G', '12', '12C', '12 5G', '13', '13C', '13C 5G', '14C', 'A1', 'A1+', 'A2', 'A2+', 'A3', 'A3x', 'A5']),
    ...range('Redmi Note ', ['7', '8', '8 Pro', '9', '9 Pro', '9S', '10', '10S', '10 Pro', '11', '11S', '11 Pro', '11 Pro+', '12', '12S', '12 Pro', '12 Pro+', '12 5G', '13', '13 Pro', '13 Pro+', '14', '14 Pro', '14 Pro+']),
    'Redmi K40', 'Redmi K50', 'Redmi K60', 'Redmi K70',
];

const POCO_PHONES = [
    ...range('POCO C', ['31', '40', '50', '51', '55', '61', '65', '71', '75']),
    ...range('POCO M', ['3', '3 Pro', '4', '4 Pro', '5', '5s', '6', '6 Pro', '7 Pro']),
    ...range('POCO X', ['3 NFC', '3 Pro', '4 Pro', '5', '5 Pro', '6', '6 Pro', '7', '7 Pro']),
    ...range('POCO F', ['3', '4', '4 GT', '5', '5 Pro', '6', '6 Pro', '7']),
];

const INFINIX_PHONES = [
    ...range('Infinix Smart ', ['4', '5', '6', '6 Plus', '7', '7 Plus', '8', '8 Plus', '9', '10']),
    ...range('Infinix Hot ', ['9', '9 Play', '10', '10 Play', '10s', '11', '11s', '12', '12 Play', '12i', '20', '20i', '20 5G', '30', '30i', '30 Play', '40', '40i', '40 Pro', '50', '50i', '50 Pro']),
    ...range('Infinix Note ', ['7', '8', '10', '10 Pro', '11', '11 Pro', '12', '12 Pro', '30', '30 Pro', '40', '40 Pro', '40 Pro+', '50', '50 Pro']),
    ...range('Infinix Zero ', ['X', '5G', '20', '30', '30 5G', '40', 'Ultra']),
    'Infinix GT 10 Pro', 'Infinix GT 20 Pro', 'Infinix Hot 10 Lite',
];

const TECNO_PHONES = [
    ...range('Tecno Spark ', ['6', '7', '7 Pro', '8', '8C', '8 Pro', '9', '9 Pro', '10', '10 Pro', '10C', '20', '20 Pro', '20 Pro+', '20C', '30', '30 Pro', '30C', '40', '40 Pro', '40C']),
    ...range('Tecno Camon ', ['16', '17', '18', '18 Premier', '19', '19 Neo', '19 Pro', '20', '20 Pro', '20 Premier', '30', '30 Pro', '30 Premier', '40', '40 Pro']),
    ...range('Tecno Pova ', ['2', '3', '4', '4 Pro', '5', '5 Pro', '6', '6 Pro', '6 Neo', '7']),
    ...range('Tecno Pop ', ['5', '6', '7', '8', '9']),
    'Tecno Phantom X2', 'Tecno Phantom X2 Pro', 'Tecno Phantom V Fold', 'Tecno Phantom V Flip',
];

const ITEL_PHONES = [
    'itel A48', 'itel A49', 'itel A56', 'itel A58', 'itel A60', 'itel A60s', 'itel A70', 'itel P40', 'itel P55', 'itel P55+', 'itel P65',
    'itel S23', 'itel S23+', 'itel S24', 'itel Vision 1', 'itel Vision 3', 'itel Vision 5', 'itel it2163', 'itel it5026',
];

const HUAWEI_PHONES = [
    ...range('Huawei Nova ', ['3i', '5T', '7i', '8i', '9', '9 SE', '10', '10 SE', '11', '11i', '11 Pro', '12', '12 SE', '13']),
    ...range('Huawei Y', ['5p', '6p', '7a', '7p', '9 Prime 2019', '9s', '61', '70', '70 Plus']),
    ...range('Huawei P', ['20 Pro', '30', '30 Lite', '30 Pro', '40', '40 Pro', '50', '50 Pro', '60 Pro', '70', '70 Pro']),
    ...range('Huawei Mate ', ['20 Pro', '30 Pro', '40 Pro', '50 Pro', '60 Pro', '70', '70 Pro']),
    'Huawei Pura 70', 'Huawei Pura 70 Pro',
];

const HONOR_PHONES = [
    'Honor 8X', 'Honor 9X', 'Honor 10 Lite', 'Honor X6', 'Honor X6a', 'Honor X7', 'Honor X7a', 'Honor X7b', 'Honor X8', 'Honor X8a', 'Honor X8b', 'Honor X9a', 'Honor X9b', 'Honor X9c',
    'Honor 50', 'Honor 70', 'Honor 90', 'Honor 90 Lite', 'Honor 200', 'Honor 200 Pro', 'Honor Magic5 Pro', 'Honor Magic6 Pro', 'Honor Magic V2', 'Honor Play',
];

const NOKIA_PHONES = [
    'Nokia 105', 'Nokia 106', 'Nokia 110', 'Nokia 130', 'Nokia 150', 'Nokia 215', 'Nokia 225', 'Nokia 3310', 'Nokia 5310', 'Nokia 6310', 'Nokia 8210',
    'Nokia C01 Plus', 'Nokia C2', 'Nokia C3', 'Nokia C12', 'Nokia C21 Plus', 'Nokia C22', 'Nokia C32', 'Nokia G10', 'Nokia G11', 'Nokia G21', 'Nokia G22', 'Nokia G42', 'Nokia G50', 'Nokia X20',
];

const MOTOROLA_PHONES = [
    'Moto E7', 'Moto E13', 'Moto E22', 'Moto E32', 'Moto E40', ...range('Moto G', ['04', '05', '14', '24', '24 Power', '34', '35', '54', '54 Power', '55', '84', '85', '100']),
    'Moto G Power', 'Moto G Stylus', 'Moto G Play', 'Moto G Pure', 'Moto G Fast', 'Moto G9 Play', 'Moto G30', 'Moto G60',
    'Edge 30', 'Edge 30 Fusion', 'Edge 40', 'Edge 40 Neo', 'Edge 50 Fusion', 'Edge 50 Pro', 'Edge 50 Ultra', 'Razr 40', 'Razr 40 Ultra', 'Razr 50', 'Razr 50 Ultra', 'Razr 60',
];

const ONEPLUS_PHONES = [
    'OnePlus 6T', 'OnePlus 7', 'OnePlus 7T', 'OnePlus 8', 'OnePlus 8T', 'OnePlus 9', 'OnePlus 9 Pro', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus 11', 'OnePlus 12', 'OnePlus 12R', 'OnePlus 13', 'OnePlus 13R',
    'OnePlus Nord', 'OnePlus Nord 2', 'OnePlus Nord 3', 'OnePlus Nord 4', 'OnePlus Nord CE', 'OnePlus Nord CE 2', 'OnePlus Nord CE 3', 'OnePlus Nord CE 3 Lite', 'OnePlus Nord CE 4', 'OnePlus Nord N20', 'OnePlus Nord N30', 'OnePlus Open',
];

const GOOGLE_PHONES = [
    'Pixel 3', 'Pixel 3a', 'Pixel 4', 'Pixel 4a', 'Pixel 5', 'Pixel 5a', 'Pixel 6', 'Pixel 6 Pro', 'Pixel 6a', 'Pixel 7', 'Pixel 7 Pro', 'Pixel 7a',
    'Pixel 8', 'Pixel 8 Pro', 'Pixel 8a', 'Pixel 9', 'Pixel 9 Pro', 'Pixel 9 Pro XL', 'Pixel 9 Pro Fold', 'Pixel 9a', 'Pixel 10', 'Pixel 10 Pro', 'Pixel 10 Pro XL', 'Pixel Fold',
];

const SONY_PHONES = ['Xperia 1 III', 'Xperia 1 IV', 'Xperia 1 V', 'Xperia 1 VI', 'Xperia 5 III', 'Xperia 5 IV', 'Xperia 5 V', 'Xperia 10 III', 'Xperia 10 IV', 'Xperia 10 V', 'Xperia 10 VI', 'Xperia L4'];

const ASUS_PHONES = ['Zenfone 8', 'Zenfone 9', 'Zenfone 10', 'Zenfone 11 Ultra', 'Zenfone Max Pro M1', 'Zenfone Max M2', 'ROG Phone 5', 'ROG Phone 6', 'ROG Phone 7', 'ROG Phone 8', 'ROG Phone 9'];

const CHERRY_PHONES = [
    'Aqua S9', 'Aqua S10', 'Aqua S10 Pro', 'Aqua S10 Max', 'Aqua Joy', 'Flare S7', 'Flare S8', 'Flare S8 Plus', 'Flare S8 Lite', 'Flare Y7', 'Flare J1',
    'Omega', 'Omega Lite', 'Omega HD', 'Omega 5G', 'Aqua Fun', 'Sonic', 'Touch HD', 'Cherry Mobile Flare Lite',
];

const MYPHONE_PHONES = ['myA1', 'myA2', 'myA3', 'myA6', 'myX', 'myX2', 'myX8', 'myX11', 'myPhone Hello', 'myPhone Hello 3', 'myPhone Rio', 'myPhone Agua Iceberg', 'myPhone Prime 2'];

const NOTHING_PHONES = ['Phone (1)', 'Phone (2)', 'Phone (2a)', 'Phone (2a) Plus', 'Phone (3a)', 'Phone (3a) Pro', 'CMF Phone 1'];

const ZTE_PHONES = ['Blade A31', 'Blade A51', 'Blade A53', 'Blade A72', 'Blade V40', 'Blade V40 Vita', 'Blade V50 Design', 'Axon 40 Ultra', 'Nubia Red Magic 8 Pro', 'Nubia Red Magic 9 Pro'];

const LENOVO_PHONES = ['K6 Note', 'K8 Plus', 'Z6 Pro', 'Legion Phone Duel 2', 'Motorola Edge'];

const ALCATEL_PHONES = ['1B', '1S', '3L', '3X', '1V', 'Alcatel 1', 'Alcatel 3', 'Alcatel 5'];

// ---------------------------------------------------------------------------
// Everything else — grouped by brand
// ---------------------------------------------------------------------------
export const DEVICE_MODELS = {
    // --- Phones & gadgets ---------------------------------------------------
    Samsung: SAMSUNG,
    Apple: APPLE,
    // The old catalog used "Apple (iPad)" / "Apple (MacBook)" as separate brand entries.
    'Apple (iPad)': APPLE.Tablet,
    'Apple (MacBook)': APPLE.Laptop,
    Oppo: {
        'Smartphone (Android)': OPPO_PHONES, Smartphone: OPPO_PHONES,
        'Wireless earbuds': ['Enco Buds', 'Enco Buds2', 'Enco Air', 'Enco Air2', 'Enco Air2 Pro', 'Enco Air3', 'Enco Free2', 'Enco X2', 'Enco W31'],
        Tablet: ['Pad Air', 'Pad 2', 'Pad Neo'], Smartwatch: ['Watch Free', 'Watch 3', 'Band 2', 'Band Sport'],
        'Power bank': ['VOOC Power Bank 10000mAh', 'SuperVOOC Power Bank 20000mAh'], 'Earphones (wired)': ['MH135', 'MH151'],
        'Phone charger / cable': ['VOOC 20W', 'SuperVOOC 65W', 'SuperVOOC 80W', 'USB-C cable'],
    },
    Vivo: {
        'Smartphone (Android)': VIVO_PHONES, Smartphone: VIVO_PHONES,
        'Wireless earbuds': ['TWS Neo', 'TWS 2', 'TWS 2e', 'TWS 3', 'TWS 3e'], Tablet: ['Pad', 'Pad 2', 'Pad Air'], Smartwatch: ['Watch', 'Watch 2', 'Band'],
        'Phone charger / cable': ['FlashCharge 18W', 'FlashCharge 44W', 'FlashCharge 66W', 'USB-C cable'],
    },
    Realme: {
        'Smartphone (Android)': REALME_PHONES, Smartphone: REALME_PHONES,
        'Wireless earbuds': ['Buds Air', 'Buds Air 2', 'Buds Air 3', 'Buds Air 5', 'Buds Air 5 Pro', 'Buds Air 6', 'Buds T100', 'Buds T110', 'Buds T300', 'Buds Q2', 'Buds Wireless 3'],
        Tablet: ['Pad', 'Pad Mini', 'Pad X', 'Pad 2'], Smartwatch: ['Watch 2', 'Watch 3', 'Watch S', 'Band 2'],
        'Power bank': ['10000mAh 30W', '10000mAh 18W', '20000mAh 22.5W'], 'Phone charger / cable': ['SuperVOOC 65W', 'SuperVOOC 33W', 'Dart 30W', 'USB-C cable'],
    },
    Xiaomi: {
        'Smartphone (Android)': XIAOMI_PHONES, Smartphone: XIAOMI_PHONES,
        'Wireless earbuds': ['Redmi Buds 3', 'Redmi Buds 3 Lite', 'Redmi Buds 4', 'Redmi Buds 4 Active', 'Redmi Buds 5', 'Redmi Buds 5 Pro', 'Redmi Buds Essential', 'Xiaomi Buds 3', 'Xiaomi Buds 4 Pro', 'Mi True Wireless Earbuds Basic 2'],
        Tablet: ['Pad 5', 'Pad 6', 'Pad 6 Pro', 'Redmi Pad', 'Redmi Pad SE', 'Redmi Pad Pro'],
        Smartwatch: ['Mi Band 4', 'Mi Band 5', 'Mi Band 6', 'Mi Band 7', 'Mi Band 8', 'Smart Band 8', 'Smart Band 9', 'Redmi Watch 3', 'Redmi Watch 3 Active', 'Watch S1', 'Watch 2 Pro'],
        'Power bank': ['10000mAh Redmi 18W', '10000mAh Mi 3', '20000mAh Mi 3i', '20000mAh Redmi 18W', 'Power Bank 4 Pro', 'Power Bank 33W'],
        'Earphones (wired)': ['Mi Dual Driver', 'Piston Basic', 'Mi In-Ear Basic', 'Type-C Earphones'],
        'Bluetooth speaker': ['Mi Portable Bluetooth Speaker', 'Mi Compact Speaker 2', 'Sound Pocket', 'Sound Outdoor'],
        'Phone charger / cable': ['33W Charger', '67W Charger', '120W Charger', 'USB-C cable'],
    },
    Redmi: {
        'Smartphone (Android)': REDMI_PHONES, Smartphone: REDMI_PHONES,
        'Wireless earbuds': ['Redmi Buds 3', 'Redmi Buds 3 Lite', 'Redmi Buds 4', 'Redmi Buds 4 Active', 'Redmi Buds 5', 'Redmi Buds 5 Pro', 'Redmi Buds Essential'],
        Tablet: ['Redmi Pad', 'Redmi Pad SE', 'Redmi Pad Pro'], Smartwatch: ['Redmi Watch 3', 'Redmi Watch 3 Active', 'Redmi Watch 5 Active', 'Redmi Smart Band Pro'],
        'Power bank': ['10000mAh 18W', '20000mAh 18W'],
    },
    Poco: { 'Smartphone (Android)': POCO_PHONES, Smartphone: POCO_PHONES, Tablet: ['Poco Pad'], 'Wireless earbuds': ['Poco Pods', 'Poco Buds Pro'] },
    Infinix: { 'Smartphone (Android)': INFINIX_PHONES, Smartphone: INFINIX_PHONES, 'Wireless earbuds': ['XBuds', 'XE23', 'XE22', 'XE27'], Tablet: ['XPAD', 'XPAD 20'], Smartwatch: ['XWatch 2', 'XWatch 3'] },
    Tecno: { 'Smartphone (Android)': TECNO_PHONES, Smartphone: TECNO_PHONES, Tablet: ['Megapad 10', 'Megapad 11', 'Tab 11'], 'Wireless earbuds': ['Buds 3', 'Buds 4', 'Air 1'], Smartwatch: ['Watch Pro', 'Watch 2'] },
    Itel: { 'Smartphone (Android)': ITEL_PHONES, Smartphone: ITEL_PHONES, 'Keypad phone': ['it2160', 'it2163', 'it5026', 'it5081', 'it9210', 'itel Magic 2', 'itel Super Guru 4G'] },
    Huawei: {
        'Smartphone (Android)': HUAWEI_PHONES, Smartphone: HUAWEI_PHONES,
        Tablet: ['MatePad SE', 'MatePad SE 11', 'MatePad 10.4', 'MatePad 11', 'MatePad 11.5', 'MatePad Air', 'MatePad Pro 11', 'MatePad Pro 12.6', 'MediaPad T3', 'MediaPad T5', 'MediaPad M5 Lite'],
        'Wireless earbuds': ['FreeBuds SE', 'FreeBuds SE 2', 'FreeBuds 4i', 'FreeBuds 5i', 'FreeBuds 6i', 'FreeBuds Pro', 'FreeBuds Pro 2', 'FreeBuds 5'],
        Smartwatch: ['Watch GT 2', 'Watch GT 3', 'Watch GT 4', 'Watch Fit', 'Watch Fit 2', 'Watch D', 'Band 6', 'Band 7', 'Band 8', 'Band 9'],
        Laptop: ['MateBook D14', 'MateBook D15', 'MateBook D16', 'MateBook 14', 'MateBook 14s', 'MateBook X Pro', 'MateBook X'],
    },
    Honor: { 'Smartphone (Android)': HONOR_PHONES, Smartphone: HONOR_PHONES, Tablet: ['Pad X8', 'Pad X8a', 'Pad X9', 'Pad 9', 'MagicPad 13'], 'Wireless earbuds': ['Earbuds X5', 'Earbuds X6', 'Earbuds X7', 'Choice Earbuds X5'], Smartwatch: ['Watch 4', 'Band 7', 'Band 9', 'Watch GS 3'] },
    Nokia: { 'Smartphone (Android)': NOKIA_PHONES.filter((m) => !/^Nokia (105|106|110|130|150|215|225|3310|5310|6310|8210)$/.test(m)), Smartphone: NOKIA_PHONES, 'Keypad phone': NOKIA_PHONES.filter((m) => /^Nokia (105|106|110|130|150|215|225|3310|5310|6310|8210)$/.test(m)) },
    Motorola: { 'Smartphone (Android)': MOTOROLA_PHONES, Smartphone: MOTOROLA_PHONES, Tablet: ['Moto Tab G62', 'Moto Tab G70', 'Moto Tab G20'] },
    OnePlus: { 'Smartphone (Android)': ONEPLUS_PHONES, Smartphone: ONEPLUS_PHONES, 'Wireless earbuds': ['Buds Z2', 'Buds Pro 2', 'Buds 3', 'Nord Buds 2', 'Nord Buds 3'], Tablet: ['Pad', 'Pad 2', 'Pad Go'], Smartwatch: ['Watch 2', 'Nord Watch', 'Band 2'] },
    Google: { 'Smartphone (Android)': GOOGLE_PHONES, Smartphone: GOOGLE_PHONES, 'Wireless earbuds': ['Pixel Buds A-Series', 'Pixel Buds Pro', 'Pixel Buds Pro 2'], Smartwatch: ['Pixel Watch', 'Pixel Watch 2', 'Pixel Watch 3'], Tablet: ['Pixel Tablet'] },
    Sony: {
        'Smartphone (Android)': SONY_PHONES, Smartphone: SONY_PHONES,
        'Wireless earbuds': ['WF-C500', 'WF-C510', 'WF-C700N', 'WF-1000XM3', 'WF-1000XM4', 'WF-1000XM5', 'LinkBuds S', 'LinkBuds', 'LinkBuds Fit'],
        Headphones: ['WH-CH510', 'WH-CH520', 'WH-CH720N', 'WH-1000XM3', 'WH-1000XM4', 'WH-1000XM5', 'WH-XB700', 'MDR-ZX110', 'MDR-ZX310', 'ULT WEAR'],
        'Earphones (wired)': ['MDR-EX15AP', 'MDR-EX155AP', 'MDR-E9LP', 'IER-EX15AP'],
        'Bluetooth speaker': ['SRS-XB13', 'SRS-XB100', 'SRS-XB23', 'SRS-XE200', 'SRS-XG300', 'ULT Field 1'],
        Camera: ['ZV-1', 'ZV-E10', 'Alpha a6000', 'Alpha a6400', 'Alpha a7 III', 'Alpha a7 IV', 'Cyber-shot DSC-W800', 'Cyber-shot DSC-HX99'],
        'Memory card': ['SF-M 64GB', 'SF-G 128GB'],
    },
    ASUS: { 'Smartphone (Android)': ASUS_PHONES, Smartphone: ASUS_PHONES },
    'Cherry Mobile': { 'Smartphone (Android)': CHERRY_PHONES, Smartphone: CHERRY_PHONES, 'Keypad phone': ['Cherry Mobile Flare J1', 'Cherry Mobile Super Phone', 'Cherry Mobile Xtreme'], Tablet: ['Tablet Superion Tab', 'Cherry Mobile Fusion Tab'] },
    MyPhone: { 'Smartphone (Android)': MYPHONE_PHONES, Smartphone: MYPHONE_PHONES, 'Keypad phone': ['myPhone Hello', 'myPhone Hello 3', 'myPhone Tricolor', 'myPhone Duo'] },
    Nothing: { 'Smartphone (Android)': NOTHING_PHONES, Smartphone: NOTHING_PHONES, 'Wireless earbuds': ['Ear (1)', 'Ear (2)', 'Ear (stick)', 'Ear (a)', 'Ear', 'CMF Buds', 'CMF Buds Pro'] },
    ZTE: { 'Smartphone (Android)': ZTE_PHONES, Smartphone: ZTE_PHONES },
    Alcatel: { 'Smartphone (Android)': ALCATEL_PHONES, Smartphone: ALCATEL_PHONES },
    Lenovo: {
        'Smartphone (Android)': LENOVO_PHONES, Smartphone: LENOVO_PHONES,
        Tablet: ['Tab M7', 'Tab M8', 'Tab M9', 'Tab M10', 'Tab M10 Plus', 'Tab P11', 'Tab P11 Pro', 'Tab P12', 'Yoga Tab 11'],
        'Wireless earbuds': ['LivePods LP40', 'LP1', 'LP5', 'LP11', 'XT82', 'XT83', 'XT88', 'HT38', 'LP40 Pro'],
        Laptop: ['IdeaPad 1', 'IdeaPad 3', 'IdeaPad Slim 3', 'IdeaPad Slim 5', 'IdeaPad Flex 5', 'IdeaPad Gaming 3', 'IdeaPad S145', 'V14', 'V15', 'ThinkPad E14', 'ThinkPad E15', 'ThinkPad L14', 'ThinkPad T14', 'ThinkPad X1 Carbon', 'ThinkBook 14', 'ThinkBook 15', 'Yoga Slim 7', 'Yoga 7', 'Legion 5', 'Legion 5 Pro', 'LOQ 15', 'LOQ 15IAX9', 'Chromebook Duet'],
    },

    // --- Audio & small gadgets ------------------------------------------------
    JBL: {
        'Wireless earbuds': ['Tune Beam', 'Tune Buds', 'Tune 130NC TWS', 'Tune 230NC TWS', 'Tune 235NC', 'Tune 520BT', 'Wave Beam', 'Wave Buds', 'Wave Flex', 'Wave 200TWS', 'Wave 300TWS', 'Vibe Beam', 'Vibe Buds', 'Endurance Peak 3', 'Live Pro 2'],
        Headphones: ['Tune 500BT', 'Tune 510BT', 'Tune 520BT', 'Tune 570BT', 'Tune 670NC', 'Tune 720BT', 'Tune 770NC', 'Tune 760NC', 'Live 460NC', 'Live 660NC', 'Quantum 100', 'Quantum 200', 'Quantum 400'],
        'Earphones (wired)': ['T110', 'T110BT', 'C100SI', 'C150SI', 'Tune 110'],
        'Bluetooth speaker': ['Go 2', 'Go 3', 'Go 4', 'Clip 3', 'Clip 4', 'Clip 5', 'Flip 5', 'Flip 6', 'Charge 5', 'Xtreme 3', 'Xtreme 4', 'Boombox 3', 'Partybox 110', 'Partybox 310', 'Pulse 5'],
    },
    Anker: {
        'Power bank': ['PowerCore 5000', 'PowerCore 10000', 'PowerCore 20000', 'PowerCore Slim 10000', 'PowerCore Essential 20000', 'PowerCore III Elite', 'PowerCore 26800', 'Nano Power Bank', '321 Power Bank', '522 Power Bank (PowerCore 10K)', '523 Power Bank', '533 Power Bank', '622 MagGo'],
        'Wireless earbuds': ['Soundcore Life P2', 'Soundcore Life P3', 'Soundcore Life Note 3', 'Soundcore R50i', 'Soundcore R100', 'Soundcore A20i', 'Soundcore A25i', 'Soundcore Liberty 4', 'Soundcore Liberty 4 NC', 'Soundcore Space A40'],
        Headphones: ['Soundcore Q20i', 'Soundcore Q30', 'Soundcore Q35', 'Soundcore Life Q20'],
        'Bluetooth speaker': ['Soundcore Motion 300', 'Soundcore Motion Boom', 'Soundcore Select 2', 'Soundcore 2', 'Soundcore Mini 3'],
        'Phone charger / cable': ['PowerLine III', 'PowerLine II', 'PowerPort III', 'Nano II 30W', 'Nano II 45W', '313 Charger 30W', '323 Charger 33W'],
    },
    'Soundcore (Anker)': { 'Wireless earbuds': ['Life P3', 'R50i', 'A25i', 'Liberty 4 NC', 'Space A40'] },
    QCY: { 'Wireless earbuds': ['T13', 'T13 ANC', 'T17', 'T20 (AilyPods)', 'T12', 'T11', 'HT03', 'HT05 (MeloBuds ANC)', 'HT07', 'MeloBuds Neo', 'G1'] },
    Beats: { Headphones: ['Solo3', 'Solo4', 'Studio3', 'Studio Pro', 'Flex'], 'Wireless earbuds': ['Studio Buds', 'Studio Buds+', 'Fit Pro', 'Powerbeats Pro', 'Beats Solo Buds'], 'Earphones (wired)': ['urBeats3', 'Beats Flex'] },
    Bose: { Headphones: ['QuietComfort 35 II', 'QuietComfort 45', 'QuietComfort Ultra', 'Noise Cancelling 700'], 'Wireless earbuds': ['QuietComfort Earbuds', 'QuietComfort Earbuds II', 'Sport Earbuds', 'Ultra Open Earbuds'], 'Bluetooth speaker': ['SoundLink Flex', 'SoundLink Micro', 'SoundLink Revolve'] },
    Logitech: {
        'Computer mouse': ['B100', 'B170', 'M90', 'M100', 'M170', 'M185', 'M187', 'M190', 'M220 Silent', 'M221 Silent', 'M240 Silent', 'M331 Silent', 'M350', 'M355', 'M510', 'M525', 'M557', 'M585', 'M590', 'MX Anywhere 3', 'MX Master 3', 'MX Master 3S', 'Pebble M350', 'Lift', 'G102 Lightsync', 'G203', 'G304', 'G305', 'G502 Hero', 'G Pro X Superlight'],
        Keyboard: ['K120', 'K230', 'K270', 'K380', 'K400 Plus', 'K580', 'MK120', 'MK235', 'MK270', 'MK295', 'MK545 Advanced', 'MX Keys', 'MX Keys Mini', 'Pebble Keys 2 K380s', 'G213', 'G413', 'G512', 'G Pro'],
        Headphones: ['H111', 'H151', 'H340', 'H390', 'H570e', 'H600', 'G331', 'G432', 'G435', 'G733', 'G Pro X'],
        Webcam: ['C270', 'C310', 'C505', 'C920', 'C922', 'C930e', 'Brio 100', 'Brio 300', 'Brio 500', 'StreamCam'],
    },
    A4Tech: {
        'Computer mouse': ['OP-620D', 'OP-720', 'OP-760', 'OP-530NU', 'OP-560NU', 'N-70FX', 'N-100', 'N-300', 'N-310', 'G3-200N', 'G3-220N', 'G3-280N', 'G3-300N', 'FG10', 'FG30', 'Bloody V7', 'Bloody V8', 'Bloody A7', 'Bloody J90'],
        Keyboard: ['KR-85550', 'KR-83', 'KRS-85', 'KK-3', 'KR-8372', 'FK10', 'FK11', 'FG1010', 'Bloody B120', 'Bloody B314'],
        Headphones: ['HS-28', 'HS-30', 'HS-100', 'HS-200', 'HS-60', 'Bloody G300', 'Bloody G437'],
        Webcam: ['PK-910H', 'PK-920H', 'PK-710G', 'PK-635G'],
    },
    Rapoo: { 'Computer mouse': ['M10', 'M10 Plus', 'N1162', 'N3500', 'M20 Plus', 'M100 Silent', 'M160', 'M200', 'M300', 'MT350', 'VT30', 'VT200'], Keyboard: ['NK1800', 'NK2500', 'E1050', 'E9350G', 'K8000', 'K2800', 'X1800S', 'V500', 'V700'], Headphones: ['H100', 'H120', 'VH160', 'VH200'] },
    Redragon: { 'Computer mouse': ['M601 Centrophorus', 'M602 Griffin', 'M607 Griffin', 'M608 Phaser', 'M711 Cobra', 'M719 Invader', 'M721 Lonewolf2', 'M913 Impact Elite', 'M987 Lite Pro', 'M988 Storm Elite', 'M990 Legend', 'M993 Perdition'], Keyboard: ['K552 Kumara', 'K556 Devarajas', 'K568 Dark Avenger', 'K582 Surara', 'K617 Fizz', 'K630 Dragonborn', 'K632 Noctis', 'K633 Ryze', 'K580 Vata'], Headphones: ['H120 Ares', 'H231 Scream', 'H260 Hylas', 'H320 Lamia 2', 'H350 Pandora', 'H510 Zeus'] },
    Fantech: { 'Computer mouse': ['X5s Zeus', 'X7 Blast', 'X9 Thor', 'X11 Daredevil', 'G10 Wireless', 'GO WG10', 'WG12R', 'WGC1', 'W189', 'W190', 'W191', 'W192', 'W193'], Keyboard: ['K511 Hunter Pro', 'K613L', 'MK884 Maxfit', 'MK852', 'MK885', 'K610', 'K613'], Headphones: ['HG11', 'HG15', 'HG20', 'HQ50', 'HG17s', 'MH82', 'MH83', 'MH85', 'WH01'] },
    Razer: { 'Computer mouse': ['DeathAdder Essential', 'DeathAdder V2', 'DeathAdder V3', 'Viper Mini', 'Viper V2', 'Basilisk V3', 'Orochi V2', 'Naga'], Keyboard: ['BlackWidow V3', 'Huntsman Mini', 'Huntsman V2', 'Cynosa Lite', 'Ornata V3', 'DeathStalker V2'], Headphones: ['Kraken', 'Kraken X', 'BlackShark V2', 'Barracuda X', 'Hammerhead True Wireless'] },
    Keychron: { Keyboard: ['K2', 'K3', 'K6', 'K8', 'K10', 'Q1', 'Q2', 'V1', 'C1', 'Lemokey L3'] },
    HyperX: { Headphones: ['Cloud Stinger', 'Cloud Stinger 2', 'Cloud II', 'Cloud III', 'Cloud Alpha', 'Cloud Flight'], 'Computer mouse': ['Pulsefire Core', 'Pulsefire Haste', 'Pulsefire Surge'], Keyboard: ['Alloy Core RGB', 'Alloy Origins', 'Alloy FPS Pro'] },
    SteelSeries: { Headphones: ['Arctis 1', 'Arctis 5', 'Arctis 7', 'Arctis Nova 1', 'Arctis Nova 3'], 'Computer mouse': ['Rival 3', 'Rival 5', 'Aerox 3'] },
    Remax: { 'Earphones (wired)': ['RM-510', 'RM-515', 'RM-502', 'RM-305M', 'RM-569'], 'Power bank': ['RPP-96', 'RPP-166', 'RPP-129', 'RPP-155', 'RPP-110', 'RPP-139'], 'Wireless earbuds': ['TWS-10', 'TWS-11', 'TWS-16', 'RB-T25'] },
    Baseus: { 'Power bank': ['Adaman 10000mAh', 'Adaman 20000mAh', 'Bipow 10000mAh', 'Bipow 20000mAh', 'Blade 20000mAh', 'Star-Lord 10000mAh', 'Airpow 20000mAh', 'Amblight 30000mAh'], 'Wireless earbuds': ['Bowie E3', 'Bowie E8', 'Bowie WM01', 'Bowie M2s', 'Encok W04', 'Encok W09', 'Encok True Wireless'], 'Phone charger / cable': ['Superior Series', 'Dynamic Series', 'Cafule Series', 'GaN3 Pro 65W', 'GaN5 Pro 65W', 'PowerCombo'] },
    Ugreen: { 'Power bank': ['10000mAh 20W', '20000mAh 45W', 'Nexode 20000mAh', 'Nexode 10000mAh'], 'Phone charger / cable': ['Nexode 30W', 'Nexode 65W', 'USB-C to USB-C', 'USB-C to Lightning', 'Micro USB'] },
    Romoss: { 'Power bank': ['Sense 4', 'Sense 6', 'Sense 8', 'PHP10', 'PHP20', 'PHP30', 'Solo 5', 'Solo 10', 'Simple 20'] },
    'Harman Kardon': { 'Bluetooth speaker': ['Onyx Studio 5', 'Onyx Studio 6', 'Onyx Studio 7', 'Aura Studio 3', 'Go + Play'] },
    Marshall: { 'Bluetooth speaker': ['Emberton', 'Emberton II', 'Willen', 'Acton II', 'Stanmore II', 'Kilburn II'], Headphones: ['Major III', 'Major IV', 'Major V', 'Monitor II'], 'Wireless earbuds': ['Minor III', 'Minor IV', 'Motif II'] },
    Kingston: { 'Flash drive (USB)': ['DataTraveler 32GB', 'DataTraveler 64GB', 'DataTraveler 128GB', 'DataTraveler Exodia 32GB', 'DataTraveler Exodia 64GB', 'DataTraveler Exodia 128GB', 'DataTraveler SE9', 'DataTraveler 70', 'DataTraveler Kyson', 'Canvas Select Plus'], 'Memory card': ['Canvas Select Plus 32GB', 'Canvas Select Plus 64GB', 'Canvas Select Plus 128GB', 'Canvas Go Plus 64GB', 'Canvas React Plus'], 'External hard drive': ['XS1000 1TB', 'XS2000 1TB', 'XS2000 2TB', 'XS1000 2TB'] },
    SanDisk: { 'Flash drive (USB)': ['Cruzer Blade 16GB', 'Cruzer Blade 32GB', 'Cruzer Blade 64GB', 'Cruzer Blade 128GB', 'Ultra 32GB', 'Ultra 64GB', 'Ultra 128GB', 'Ultra Flair 64GB', 'Ultra Flair 128GB', 'Ultra Dual Drive Go', 'Extreme Go 64GB', 'Cruzer Glide'], 'Memory card': ['Ultra 32GB', 'Ultra 64GB', 'Ultra 128GB', 'Extreme 64GB', 'Extreme 128GB', 'Extreme Pro 64GB', 'Extreme Pro 128GB', 'Max Endurance 64GB'], 'External hard drive': ['Extreme Portable SSD 500GB', 'Extreme Portable SSD 1TB', 'Extreme Portable SSD 2TB', 'Portable SSD E30 1TB'] },
    Toshiba: { 'Flash drive (USB)': ['TransMemory 16GB', 'TransMemory 32GB', 'TransMemory 64GB', 'Hayabusa 32GB', 'Hayabusa 64GB'], 'External hard drive': ['Canvio Basics 1TB', 'Canvio Basics 2TB', 'Canvio Ready 1TB', 'Canvio Advance 1TB', 'Canvio Flex 1TB'] },
    Transcend: { 'Flash drive (USB)': ['JetFlash 300', 'JetFlash 700', 'JetFlash 790', 'JetFlash 920'], 'External hard drive': ['StoreJet 25M3 1TB', 'StoreJet 25H3 1TB', 'StoreJet 25M3 2TB'], 'Memory card': ['SDXC 300S 64GB', 'microSDXC 300S 128GB'] },
    ADATA: { 'Flash drive (USB)': ['UV128', 'UV150', 'UV250', 'UV350', 'C906', 'C008'], 'External hard drive': ['HD650 1TB', 'HD710 Pro 1TB', 'HD330 1TB', 'HD650 2TB', 'HV620S 1TB'] },
    Adata: { 'Flash drive (USB)': ['UV128', 'UV150', 'UV250', 'UV350'], 'External hard drive': ['HD650 1TB', 'HD710 Pro 1TB', 'HD330 1TB'] },
    Seagate: { 'External hard drive': ['Expansion 500GB', 'Expansion 1TB', 'Expansion 2TB', 'Expansion 4TB', 'Backup Plus Slim 1TB', 'Backup Plus Slim 2TB', 'Backup Plus Portable 1TB', 'One Touch 1TB', 'One Touch 2TB', 'Basic 1TB', 'FireCuda Gaming 1TB'] },
    'Western Digital': { 'External hard drive': ['My Passport 1TB', 'My Passport 2TB', 'My Passport 4TB', 'Elements 1TB', 'Elements 2TB', 'Elements SE 1TB', 'My Book 4TB', 'My Passport SSD 500GB', 'My Passport SSD 1TB', 'Black P10 1TB'], 'Flash drive (USB)': ['Cruzer Blade 32GB', 'My Passport Go'], 'Memory card': ['Purple SC QD101 64GB', 'Blue SN580'] },
    Canon: { Camera: ['EOS 1500D', 'EOS 2000D', 'EOS 3000D', 'EOS 4000D', 'EOS 200D II', 'EOS 700D', 'EOS 750D', 'EOS 800D', 'EOS 850D', 'EOS 90D', 'EOS M50', 'EOS M50 Mark II', 'EOS R10', 'EOS R50', 'EOS R100', 'EOS RP', 'PowerShot SX430', 'PowerShot G7 X Mark III', 'IXUS 185', 'IXUS 190'] },
    Nikon: { Camera: ['D3300', 'D3400', 'D3500', 'D5300', 'D5600', 'D7200', 'D7500', 'D750', 'Z30', 'Z50', 'Z fc', 'Z5', 'Z6 II', 'Coolpix A10', 'Coolpix P1000', 'Coolpix W150', 'Coolpix B500'] },
    Fujifilm: { Camera: ['Instax Mini 11', 'Instax Mini 12', 'Instax Mini 40', 'Instax Mini Evo', 'Instax Wide 300', 'X-T30 II', 'X-S10', 'X-E4', 'X100V', 'X-T5'] },
    GoPro: { Camera: ['Hero 7 Black', 'Hero 8 Black', 'Hero 9 Black', 'Hero 10 Black', 'Hero 11 Black', 'Hero 12 Black', 'Hero 13 Black', 'Hero (2024)', 'Max'] },
    Panasonic: { Camera: ['Lumix G7', 'Lumix GH5', 'Lumix S5', 'Lumix FZ80', 'Lumix TZ90', 'Lumix ZS70'] },
    Amazfit: { Smartwatch: ['Bip 3', 'Bip 3 Pro', 'Bip 5', 'Bip 5 Unity', 'Bip U', 'Bip U Pro', 'GTS 2 Mini', 'GTS 4', 'GTS 4 Mini', 'GTR 4', 'GTR Mini', 'Active', 'Active Edge', 'Balance', 'Band 7', 'Cheetah', 'T-Rex 2', 'T-Rex 3', 'Falcon'] },
    Garmin: { Smartwatch: ['Forerunner 45', 'Forerunner 55', 'Forerunner 165', 'Forerunner 255', 'Forerunner 265', 'Forerunner 955', 'Venu 2', 'Venu 3', 'Venu Sq 2', 'Vivoactive 4', 'Vivoactive 5', 'Vivosmart 5', 'Instinct 2', 'Fenix 7'] },
    Fitbit: { Smartwatch: ['Charge 4', 'Charge 5', 'Charge 6', 'Inspire 2', 'Inspire 3', 'Versa 2', 'Versa 3', 'Versa 4', 'Sense', 'Sense 2', 'Luxe'] },
    'Amazon (Fire)': { Tablet: ['Fire 7', 'Fire HD 8', 'Fire HD 10', 'Fire Max 11', 'Kids Edition'] },
    Amazon: { Tablet: ['Fire 7', 'Fire HD 8', 'Fire HD 10', 'Fire Max 11'], 'E-reader': ['Kindle (basic)', 'Kindle Paperwhite', 'Kindle Oasis', 'Kindle Scribe'] },
    Kobo: { 'E-reader': ['Clara 2E', 'Clara HD', 'Libra 2', 'Sage', 'Nia'] },

    // --- Laptops --------------------------------------------------------------
    Acer: {
        Laptop: ['Aspire 1', 'Aspire 3', 'Aspire 3 Spin', 'Aspire 5', 'Aspire 7', 'Aspire Go 14', 'Aspire Go 15', 'Aspire Lite', 'Aspire Vero', 'Swift 1', 'Swift 3', 'Swift Go 14', 'Swift Go 16', 'Swift X', 'Spin 3', 'Spin 5', 'TravelMate P2', 'TravelMate P4', 'Extensa 15', 'Nitro 5', 'Nitro V 15', 'Nitro V 16', 'Predator Helios Neo 16', 'Predator Helios 300', 'Predator Triton', 'Chromebook 311', 'Chromebook 314', 'Chromebook Spin 513', 'Veriton'],
        'Laptop charger': ['45W (Round pin)', '45W (Slim)', '65W (Slim)', '65W USB-C', '90W', '135W'],
        Tablet: ['Iconia One', 'Iconia Tab 10'],
    },
    Dell: {
        Laptop: ['Inspiron 14', 'Inspiron 15', 'Inspiron 15 3000', 'Inspiron 15 5000', 'Inspiron 16', 'Inspiron 3511', 'Inspiron 3520', 'Inspiron 5410', 'Inspiron 5510', 'Vostro 14', 'Vostro 15', 'Vostro 3400', 'Vostro 3510', 'Vostro 3520', 'Latitude 3420', 'Latitude 3520', 'Latitude 5420', 'Latitude 5430', 'Latitude 7420', 'XPS 13', 'XPS 15', 'XPS 17', 'G15', 'G16', 'Alienware m15', 'Alienware x16', 'Chromebook 3100'],
        'Laptop charger': ['45W (Slim tip)', '65W (Slim tip)', '65W USB-C', '90W (Barrel)', '130W (Barrel)'],
        'Computer mouse': ['MS116', 'MS300', 'WM126', 'WM118', 'MS5120W', 'MS3320W'], Keyboard: ['KB216', 'KB522', 'KM636', 'KM117', 'KM5221W'],
    },
    HP: {
        Laptop: ['14s', '14-dq', '15s', '15s-fq', '15-dw', '15-ef', '240 G8', '245 G8', '250 G8', '255 G8', '250 G9', '255 G9', 'Pavilion 14', 'Pavilion 15', 'Pavilion x360', 'Pavilion Aero 13', 'Envy 13', 'Envy x360', 'Envy 15', 'Spectre x360', 'Victus 15', 'Victus 16', 'Omen 15', 'Omen 16', 'EliteBook 840', 'ProBook 440', 'ProBook 450', 'Chromebook 14', 'Chromebook x360', 'Stream 11', 'Stream 14'],
        'Laptop charger': ['45W (Blue tip)', '45W (Smart pin)', '65W (Blue tip)', '65W (Smart pin)', '65W USB-C', '90W', '150W'],
        'Computer mouse': ['X1000', 'X1500', 'X3000', 'X3500', 'S1000', 'S1500', 'Z3700', 'Z3200', 'Pavilion 200'], Keyboard: ['K200', 'K1500', 'K2500', 'KB-0316', 'Pavilion 600'],
        'Flash drive (USB)': ['v165w 32GB', 'v165w 64GB', 'x765w 64GB', 'x911w 64GB'],
    },
    MSI: { Laptop: ['Modern 14', 'Modern 15', 'Prestige 14', 'Prestige 16', 'Summit E13', 'Katana GF66', 'Katana 15', 'Katana 17', 'Thin GF63', 'Thin 15', 'Cyborg 15', 'Sword 15', 'Pulse 15', 'Stealth 14', 'Raider GE68', 'Titan GT77', 'Creator Z16'] },
    Gigabyte: { Laptop: ['G5 KE', 'G5 GE', 'G6', 'G7', 'Aorus 5', 'Aorus 15', 'Aorus 16X', 'Aero 14', 'Aero 16', 'A5 K1', 'A7 K1'] },
    'Microsoft Surface': { Laptop: ['Surface Laptop Go', 'Surface Laptop Go 2', 'Surface Laptop 3', 'Surface Laptop 4', 'Surface Laptop 5', 'Surface Laptop 6', 'Surface Laptop Studio'], Tablet: ['Surface Go', 'Surface Go 2', 'Surface Go 3', 'Surface Go 4', 'Surface Pro 7', 'Surface Pro 8', 'Surface Pro 9', 'Surface Pro 10', 'Surface Pro 11'] },
    Microsoft: { Laptop: ['Surface Laptop 3', 'Surface Laptop 4', 'Surface Laptop 5'], Tablet: ['Surface Go 3', 'Surface Pro 8', 'Surface Pro 9'], 'Computer mouse': ['Basic Optical Mouse', 'Bluetooth Mouse', 'Arc Mouse', 'Sculpt Comfort', 'Wireless Mobile Mouse 1850'], Keyboard: ['Wired Keyboard 600', 'Bluetooth Keyboard', 'Surface Keyboard', 'Sculpt Ergonomic'] },
    Chuwi: { Laptop: ['HeroBook Pro', 'HeroBook Plus', 'GemiBook', 'GemiBook Plus', 'CoreBook X', 'LarkBook X', 'MiniBook X', 'UBook'], Tablet: ['Hi10 X', 'Hi10 XR', 'Hipad Plus', 'Hipad X'] },

    // --- Gaming ---------------------------------------------------------------
    Nintendo: {
        'Game console': ['Switch (V1)', 'Switch (V2)', 'Switch Lite', 'Switch OLED', 'Switch 2', '3DS', '3DS XL', 'New 3DS XL', '2DS XL', 'DS Lite', 'DSi'],
        Controller: ['Joy-Con (L/R pair)', 'Joy-Con (Left)', 'Joy-Con (Right)', 'Switch Pro Controller', 'Switch 2 Pro Controller', 'Switch 2 Joy-Con', '8BitDo (compatible)'],
        Handheld: ['Switch Lite', '3DS XL'],
    },
    PlayStation: { 'Game console': ['PS5 (Disc)', 'PS5 (Digital)', 'PS5 Slim', 'PS5 Pro', 'PS4', 'PS4 Slim', 'PS4 Pro', 'PS3', 'PS Vita', 'PSP', 'PlayStation Portal'], Controller: ['DualSense (White)', 'DualSense (Black)', 'DualSense Edge', 'DualShock 4', 'DualShock 3'], Headphones: ['Pulse 3D', 'Pulse Elite', 'Pulse Explore Earbuds'] },
    Xbox: { 'Game console': ['Xbox Series X', 'Xbox Series S', 'Xbox One X', 'Xbox One S', 'Xbox One', 'Xbox 360'], Controller: ['Xbox Wireless Controller', 'Xbox Elite Series 2', 'Xbox Adaptive Controller'] },
    Valve: { 'Game console': ['Steam Deck LCD', 'Steam Deck OLED'], Controller: ['Steam Controller'] },
    ROG: { 'Game console': ['ROG Ally', 'ROG Ally X'] },
    Gamesir: { Controller: ['G4 Pro', 'G7 SE', 'T4 Pro', 'T4 Cyclone', 'X2 Pro', 'X3 Type-C', 'G8 Galileo', 'Nova Lite'] },
    '8BitDo': { Controller: ['Pro 2', 'Ultimate', 'Ultimate 2.4G', 'SN30 Pro', 'Lite 2', 'Zero 2'] },

    // --- Calculators ----------------------------------------------------------
    Casio: {
        'Scientific calculator': ['fx-82MS', 'fx-82ES Plus', 'fx-82ES Plus 2nd Edition', 'fx-82EX ClassWiz', 'fx-82SX Plus', 'fx-83GT Plus', 'fx-85ES Plus', 'fx-85GT Plus', 'fx-100MS', 'fx-115MS', 'fx-115ES Plus', 'fx-115ES Plus 2nd Edition', 'fx-350MS', 'fx-350ES Plus', 'fx-350EX ClassWiz', 'fx-570MS', 'fx-570ES Plus', 'fx-570ES Plus 2nd Edition', 'fx-570EX ClassWiz', 'fx-991MS', 'fx-991ES Plus', 'fx-991ES Plus 2nd Edition', 'fx-991EX ClassWiz', 'fx-991CW ClassWiz', 'fx-3650P II', 'fx-5800P', 'fx-9860GII', 'fx-CG50', 'fx-CG20', 'fx-9750GIII', 'fx-JP900', 'FX-300ES Plus', 'MS-80B', 'MS-120B', 'MX-12B', 'HL-820VA', 'DJ-120D Plus', 'JS-40B', 'SL-300LC', 'GX-12B'],
        Wristwatch: ['F-91W', 'A158W', 'A168W', 'AE-1200WH', 'AE-1000W', 'MQ-24', 'MTP-1374', 'MTP-1183', 'LTP-1302', 'LQ-139', 'W-217H', 'W-218H', 'W-800H', 'MRW-200H', 'MDV-106', 'Edifice EFR-526', 'Edifice EFV-100', 'Casio Vintage A700W', 'Casio Vintage A171W', 'Casio Vintage A178W', 'Casio Vintage Mini F-201W', 'Casio Collection LA680', 'Casio Collection LA670', 'Casio Collection LTP-V005', 'Casio Collection LTP-E145'],
        Keyboard: ['CTK-1500', 'CT-S100', 'CT-S200', 'Casiotone CT-S300', 'LK-S250'],
        'Musical instrument': ['CT-S100', 'CT-S300', 'CDP-S100', 'PX-S1100', 'SA-47', 'SA-76'],
    },
    Citizen: { 'Scientific calculator': ['SR-135N', 'SR-260N', 'SR-270X', 'CT-555N', 'CT-600J', 'SDC-444S', 'SDC-805BN'], Wristwatch: ['Eco-Drive', 'Eco-Drive Chandler', 'Promaster', 'Tsuyosa', 'NH8350', 'BI5000', 'AN3610'] },
    Sharp: { 'Scientific calculator': ['EL-W535', 'EL-W506T', 'EL-531', 'EL-501X', 'EL-520X', 'EL-W516', 'EL-W506X', 'EL-W535TG', 'EL-W535XH'] },
    'Texas Instruments': { 'Scientific calculator': ['TI-30XS', 'TI-30XIIS', 'TI-34 MultiView', 'TI-36X Pro', 'TI-84 Plus', 'TI-84 Plus CE', 'TI-83 Plus', 'TI-Nspire CX', 'TI-Nspire CX II'] },
    Deli: { 'Scientific calculator': ['D82ES', 'D991ES Plus', 'D991CN', 'D1710', 'W991ES'] },

    // --- Watches --------------------------------------------------------------
    'G-Shock': { Wristwatch: ['GA-2100', 'GA-2100-1A1', 'GA-700', 'GA-100', 'GA-110', 'GA-120', 'GA-140', 'GA-400', 'GA-B2100', 'GBD-800', 'GBD-200', 'GM-2100', 'GM-S2100', 'GMA-S2100', 'GW-M5610', 'GW-B5600', 'DW-5600E', 'DW-5600BB', 'DW-6900', 'DW-9052', 'G-9300 Mudman', 'GWG-2000 Mudmaster', 'GST-B100', 'G-Steel', 'AWG-M100', 'Mini GMD-S5600', 'GMA-P2100', 'Baby-G BA-110', 'Baby-G BGA-255', 'Baby-G BGD-565'] },
    Fossil: { Wristwatch: ['Grant', 'Neutra', 'Townsman', 'Machine', 'Minimalist', 'Gen 6 Smartwatch', 'Carlyle', 'Jacqueline', 'Georgia', 'Scarlette', 'Tailor', 'Everett', 'FB-01'] },
    Seiko: { Wristwatch: ['Seiko 5 SNK809', 'Seiko 5 SNKL23', 'Seiko 5 SRPD', 'Seiko Presage', 'Seiko Prospex', 'Seiko Solar', 'SUR', 'SGEH', 'SNE'] },
    Timex: { Wristwatch: ['Weekender', 'Expedition Scout', 'Ironman', 'Easy Reader', 'Marlin', 'Waterbury', 'Q Timex', 'Mod 44'] },
    Swatch: { Wristwatch: ['Sistem51', 'Big Bold', 'Skin', 'Gent', 'Irony', 'Scuba', 'Originals', 'MoonSwatch'] },
    'Daniel Wellington': { Wristwatch: ['Classic Petite', 'Classic', 'Iconic Link', 'Quadro', 'Petite', 'Dapper'] },
    Orient: { Wristwatch: ['Bambino', 'Tristar', 'Kamasu', 'Mako', 'Sun & Moon', 'Orient Star'] },

    // --- Footwear -------------------------------------------------------------
    Nike: {
        'Rubber shoes / Sneakers': ['Air Force 1 (Low)', 'Air Force 1 (High)', 'Air Max 90', 'Air Max 97', 'Air Max 270', 'Air Max SC', 'Air Max Excee', 'Air Max Bolt', 'Dunk Low', 'Dunk High', 'Blazer Mid 77', 'Cortez', 'Revolution 6', 'Revolution 7', 'Downshifter 12', 'Pegasus 40', 'Pegasus 41', 'Invincible', 'Court Vision Low', 'Court Borough Low', 'Jordan 1 Low', 'Jordan 1 Mid', 'Jordan 1 High', 'Jordan 4', 'Jordan Stay Loyal', 'Team Hustle', 'Ja 1', 'Zoom Freak', 'Kyrie Flytrap', 'Lebron Witness', 'Precision', 'Cosmic Unity', 'Free Run', 'Waffle One', 'Venture Runner', 'Tanjun', 'Zoom Vomero 5', 'P-6000'],
        'Slippers / Flip-flops': ['Victori One', 'Benassi JDI', 'Offcourt Slide', 'Air Max Cirro', 'Calm Slide', 'Kawa'],
        Cap: ['Heritage86', 'Club', 'Dri-FIT'],
    },
    Adidas: {
        'Rubber shoes / Sneakers': ['Superstar', 'Stan Smith', 'Samba OG', 'Gazelle', 'Campus 00s', 'Forum Low', 'Ultraboost', 'Ultraboost Light', 'Duramo SL', 'Galaxy 6', 'Runfalcon 3', 'Lite Racer', 'Grand Court', 'Courtblock', 'Handball Spezial', 'NMD_R1', 'Adizero', 'Response Runner', 'Questar', 'Terrex', 'Hoops 3.0', 'Dame', 'D.O.N.', 'Harden'],
        'Slippers / Flip-flops': ['Adilette Comfort', 'Adilette Shower', 'Adilette Aqua', 'Duramo Slide', 'Cloudfoam Slide'],
        Cap: ['Baseball Cap', 'Trefoil Cap'],
    },
    Converse: { 'Rubber shoes / Sneakers': ['Chuck Taylor All Star (High)', 'Chuck Taylor All Star (Low)', 'Chuck 70 (High)', 'Chuck 70 (Low)', 'One Star', 'Run Star Hike', 'Run Star Legacy', 'Jack Purcell', 'Weapon', 'All Star Lift Platform'] },
    Vans: { 'Rubber shoes / Sneakers': ['Old Skool', 'Sk8-Hi', 'Authentic', 'Era', 'Slip-On', 'Classic Slip-On', 'Knu Skool', 'Ultrarange', 'Filmore', 'Ward', 'Atwood', 'SK8-Low', 'Half Cab', 'Lowland'] },
    Skechers: { 'Rubber shoes / Sneakers': ['Go Walk Arch Fit', 'Go Walk Flex', 'Go Run Consistent', 'D\'Lites', 'Uno', 'Ultra Flex', 'Summits', 'Dynamight', 'Skech-Air', 'Max Cushioning', 'Arch Fit', 'Bobs Squad', 'Slip-ins'] },
    'New Balance': { 'Rubber shoes / Sneakers': ['574', '530', '327', '550', '480', '9060', '990v6', '2002R', '996', '997H', 'Fresh Foam 680', 'Fresh Foam 880', 'Fresh Foam X 1080', 'Fresh Foam Roav', 'Kawhi', 'DynaSoft Nitrel', '237', '373', '515', '520', '608'] },
    Fila: { 'Rubber shoes / Sneakers': ['Disruptor II', 'Disruptor 2', 'Ray Tracer', 'Venom', 'Fila Court', 'Fila Cage', 'Mind Blower', 'Fila Axilus', 'Fila Grant Hill 2', 'Fila Fila Racer', 'Fila Original Tennis'], 'Slippers / Flip-flops': ['Drifter', 'Sleek', 'Oversized Slide'] },
    Puma: { 'Rubber shoes / Sneakers': ['Suede Classic', 'RS-X', 'Smash v2', 'Caven', 'Carina', 'Cell Venom', 'Softride', 'Anzarun', 'Rebound', 'Court Classic', 'Scuderia Ferrari', 'Clyde', 'MB.03', 'Speedcat', 'Palermo', 'Future Rider'], 'Slippers / Flip-flops': ['Leadcat', 'Popcat', 'Divecat', 'Cool Cat'] },
    Crocs: { 'Slippers / Flip-flops': ['Classic Clog', 'Classic Slide', 'Classic Sandal', 'Literide', 'Bayaband', 'Crocband', 'Baya', 'Echo Clog', 'Mega Crush', 'Brooklyn', 'Kadee', 'Swiftwater'], Sandals: ['Classic Sandal', 'Swiftwater', 'Reviva'], 'Rain boots': ['Rain Boot', 'Handle It Rain Boot'] },
    Havaianas: { 'Slippers / Flip-flops': ['Top', 'Slim', 'Brasil Logo', 'You', 'Flash', 'Power 2.0', 'Hype', 'Dual', 'Tradicional', 'Kids Top', 'Urban', 'Square Logo', 'Flat', 'Fit'] },
    Bata: { 'Black school shoes': ['Power', 'Bata Power Duramax', 'Bata Hard Knocks', 'Bata Toughees', 'Bata Dress Shoes', 'Bata Mary Jane', 'North Star Court', 'Bata Bubblegummers'], 'Rubber shoes / Sneakers': ['Power Fusion', 'Power Nitro', 'Power Rise', 'Weinbrenner'], 'Slippers / Flip-flops': ['Comfit', 'Bata Slides', 'Scholl'] },
    'Hush Puppies': { 'Black school shoes': ['Leather Oxford', 'Loafers', 'Mary Jane', 'Derby', 'Slip-on'], 'Slippers / Flip-flops': ['Sandals', 'Slippers', 'Flip-flops'] },
    Clarks: { 'Black school shoes': ['Bushacre', 'Un Aldric', 'Bakra', 'Dress shoes', 'Loafer'] },
    Reebok: { 'Rubber shoes / Sneakers': ['Classic Leather', 'Club C 85', 'Nano X', 'Zig Kinetica', 'Energen Lite', 'Floatride', 'Royal Glide', 'Question Mid', 'Instapump Fury', 'Run Fusion'] },
    'Under Armour': { 'Rubber shoes / Sneakers': ['HOVR Sonic', 'HOVR Machina', 'Charged Assert', 'Charged Pursuit', 'Surge 3', 'Curry 1', 'Curry 2', 'Project Rock'], 'Slippers / Flip-flops': ['Ignite', 'Locker', 'Core'] },
    Kappa: { 'Rubber shoes / Sneakers': ['Kappa Authentic', 'Kappa Logo', 'Kappa Banda'] },
    Ascents: { 'Rubber shoes / Sneakers': ['Ascents Sports', 'Ascents Run', 'Ascents Court'] },
    Mizuno: { 'Rubber shoes / Sneakers': ['Wave Rider', 'Wave Prophecy', 'Wave Rebellion', 'Wave Inspire', 'Wave Sky', 'Wave Lightning', 'Wave Voltage', 'Wave Momentum', 'Wave Stealth', 'Morelia', 'Rebula'] },
    Islander: { 'Slippers / Flip-flops': ['Classic', 'Islander Basic', 'Islander Wedge'] },
    Birkenstock: { Sandals: ['Arizona', 'Gizeh', 'Madrid', 'Boston', 'Mayari', 'Milano', 'Zurich', 'Kyoto'], 'Slippers / Flip-flops': ['Arizona EVA', 'Gizeh EVA', 'Madrid EVA'] },
    Teva: { Sandals: ['Hurricane XLT2', 'Original Universal', 'Terra Fi 5', 'Tirra', 'Midform Universal'] },
    Sandugo: { 'Slippers / Flip-flops': ['Sandugo Classic', 'Sandugo Beach'] },
    Fitflop: { 'Slippers / Flip-flops': ['Iqushion', 'Lulu', 'Gracie', 'Walkstar'] },
};

// ASUS has laptops *and* phones — merge in the laptop list (kept apart to stay readable).
DEVICE_MODELS.ASUS = {
    ...DEVICE_MODELS.ASUS,
    Laptop: ['VivoBook Go 14', 'VivoBook Go 15', 'VivoBook 14', 'VivoBook 15', 'VivoBook 16', 'VivoBook S14', 'VivoBook S15', 'VivoBook Pro 15', 'Zenbook 14', 'Zenbook 14 OLED', 'Zenbook S 13', 'Zenbook S 14', 'Zenbook Duo', 'ROG Strix G15', 'ROG Strix G16', 'ROG Strix Scar 16', 'ROG Zephyrus G14', 'ROG Zephyrus G16', 'ROG Flow X13', 'TUF Gaming F15', 'TUF Gaming F17', 'TUF Gaming A15', 'TUF Gaming A16', 'TUF Dash F15', 'ExpertBook B1', 'ExpertBook B5', 'Chromebook CX1', 'Chromebook Flip CX3', 'E410', 'X441', 'X441BA', 'X543', 'X515', 'X415', 'X409', 'A416', 'K413'],
    'Laptop charger': ['45W (Small pin)', '65W (Small pin)', '65W USB-C', '90W', '120W (Big pin)', '150W', '180W'],
    Tablet: ['ZenPad 3S 10', 'ZenPad 10', 'Vivobook 13 Slate', 'ROG Flow Z13'],
    'Computer mouse': ['MU101C', 'WT465', 'WT425', 'ROG Gladius', 'ROG Keris', 'ROG Strix Impact', 'TUF Gaming M3', 'TUF Gaming M4'],
    Keyboard: ['W3000', 'ROG Strix Scope', 'TUF Gaming K1', 'ROG Falchion'],
    Headphones: ['ROG Delta S', 'ROG Cetra II', 'TUF Gaming H3', 'TUF Gaming H1'],
};

// -- Lookup ------------------------------------------------------------------
const norm = (s) => String(s || '').trim().toLowerCase();

// Items that share one model list with another item.
const ITEM_ALIASES = {
    'white rubber shoes (pe)': 'Rubber shoes / Sneakers',
    'black school shoes': 'Black school shoes',
    'tablet (android)': 'Tablet',
    'ipad': 'Tablet',
    'iphone': 'iPhone (Apple)',
    'cellphone': 'Smartphone',
    'mobile phone': 'Smartphone',
};

/**
 * Models of `brand` for a specific item (e.g. Samsung + "Tablet").
 * With an item name that the brand has no list for, returns [] (so a Samsung
 * "Phone charger" is never offered Galaxy S24). With no item name yet, returns
 * every model of the brand.
 */
export const deviceModelsFor = (brand, itemName) => {
    const hit = Object.entries(DEVICE_MODELS).find(([k]) => norm(k) === norm(brand));
    if (!hit) return null;
    const entry = hit[1];
    if (Array.isArray(entry)) return entry;
    if (!norm(itemName)) {
        return [...(entry._all || []), ...Object.entries(entry).filter(([k]) => k !== '_all').flatMap(([, v]) => v)];
    }
    const wanted = ITEM_ALIASES[norm(itemName)] || itemName;
    const item = Object.entries(entry).find(([k]) => norm(k) === norm(wanted));
    return item ? [...(entry._all || []), ...item[1]] : [];
};

/** Every model we know, regardless of brand/item (used to tell a listed model from a hand-typed one). */
export const allDeviceModels = () => Object.values(DEVICE_MODELS).flatMap((e) => (Array.isArray(e) ? e : Object.values(e).flat()));
