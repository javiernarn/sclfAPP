// ============================================================================
// Lost & Found catalog — the things that actually get lost in Philippine
// schools, and how the report fields relate to each other.
//
//   Category ─┬─> Item name   (what kind of thing it is)
//             ├─> Brand       (brands people really own for that kind of item)
//             │      └─────> Model   (only for brands we know models for)
//             ├─> Color       (common colors, one shared palette)
//             ├─> Details     (tap-to-add "unique characteristics" ideas)
//             └─> Place       (where that kind of item usually gets lost/found)
//
// Every field stays free-text: the pick-lists only SUGGEST. Someone can always
// type their own value when ours doesn't have it.
//
// Why a fixed vocabulary matters: ItemMatchingService compares category,
// brand and color as exact (case-insensitive) strings. When both the person
// who lost something and the person who found it pick "Samsung" and "Black"
// from the list, those 15 + 10 + 20 points actually line up; free spelling
// ("Samsong", "blk") silently drops them.
// ============================================================================

import { deviceModelsFor, allDeviceModels } from './deviceModels';
import { ITEM_RULES, EXTRA_ITEMS, NO_BRAND } from './itemRules';

export { NO_BRAND };

// --- Shared palette ---------------------------------------------------------
export const COLORS = [
    { value: 'Black', swatch: '#111827' },
    { value: 'White', swatch: '#ffffff' },
    { value: 'Gray', swatch: '#9ca3af' },
    { value: 'Silver', swatch: '#cbd5e1' },
    { value: 'Gold', swatch: '#d4af37' },
    { value: 'Rose gold', swatch: '#e0a899' },
    { value: 'Red', swatch: '#dc2626' },
    { value: 'Maroon', swatch: '#7f1d1d' },
    { value: 'Pink', swatch: '#ec4899' },
    { value: 'Orange', swatch: '#f97316' },
    { value: 'Yellow', swatch: '#facc15' },
    { value: 'Green', swatch: '#16a34a' },
    { value: 'Light green', swatch: '#86efac' },
    { value: 'Teal', swatch: '#0d9488' },
    { value: 'Blue', swatch: '#2563eb' },
    { value: 'Navy blue', swatch: '#1e3a8a' },
    { value: 'Sky blue', swatch: '#38bdf8' },
    { value: 'Violet', swatch: '#7c3aed' },
    { value: 'Brown', swatch: '#78350f' },
    { value: 'Beige', swatch: '#e7d8b8' },
    { value: 'Transparent / Clear', swatch: 'transparent' },
    { value: 'Multicolor', swatch: 'conic-gradient(#dc2626,#facc15,#16a34a,#2563eb,#7c3aed,#dc2626)' },
];

// --- Places on a Philippine campus -------------------------------------------
export const PLACES = [
    'Library', 'Canteen / Cafeteria', 'Covered court / Gym', 'Quadrangle / Oval', 'Guard house / Gate',
    'Registrar\'s Office', 'Cashier', 'Clinic', 'Comfort room (CR)', 'Computer laboratory',
    'Science laboratory', 'Chapel / Prayer room', 'Faculty room', 'Administration building',
    'Hallway / Corridor', 'Stairs', 'Parking area', 'Waiting shed', 'Bleachers / Stage',
    'Student lounge', 'Classroom', 'Multipurpose hall', 'Guidance Office', 'Bookstore',
    'Tricycle / Jeepney terminal outside', 'Field / Garden',
    'Locker area', 'Habal-habal / Tricycle waiting area', 'Drafting / Engineering room', 'Skills / Nursing laboratory',
    'Auditorium / AVR', 'Student organization room', 'Dormitory / Boarding house',
];

// --- Categories -------------------------------------------------------------
// items:    suggestions for "Item name"
// brands:   suggestions for "Brand" (an item may override with its own `brands`)
// models:   brand -> model suggestions (only where we are confident they exist)
// brandLabel / modelLabel / modelHint: wording tweaks so the form reads naturally
// hasBrand / hasModel: false hides the field when it makes no sense (IDs, keys…)
// traits:   tap-to-add ideas for "Unique characteristics"
// places:   where this kind of item usually turns up (shown first)
export const CATALOG = [
    {
        name: 'Phones & Gadgets',
        // Phones are split by platform so the brand and model lists stay short and correct:
        // "Smartphone (Android)" -> Samsung, Oppo, Vivo…   "iPhone (Apple)" -> Apple only.
        items: ['Smartphone (Android)', 'iPhone (Apple)', 'Keypad phone', 'Tablet', 'Smartwatch', 'Wireless earbuds', 'Earphones (wired)', 'Headphones',
            'Power bank', 'Phone charger / cable', 'Flash drive (USB)', 'Bluetooth speaker', 'Camera', 'E-reader', 'Phone case', 'Selfie stick / Tripod'],
        brands: [...new Set([...['Samsung', 'Oppo', 'Vivo', 'Realme', 'Xiaomi', 'Redmi', 'Poco', 'Infinix', 'Tecno', 'Itel', 'Huawei', 'Honor', 'Nokia', 'Motorola', 'OnePlus', 'Google', 'Sony', 'ASUS', 'Cherry Mobile', 'MyPhone', 'Nothing', 'ZTE', 'Lenovo', 'Alcatel'], 'Apple', 'JBL', 'Anker', 'Kingston', 'SanDisk', 'Beats', 'Bose', 'Marshall', 'QCY', 'Baseus', 'Ugreen', 'Remax', 'Romoss',
            'Amazfit', 'Garmin', 'Fitbit', 'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'Panasonic', 'Toshiba', 'Transcend', 'ADATA', 'Amazon', 'Kobo', 'Harman Kardon', 'Realme'])],
        itemBrands: {
            'Smartphone (Android)': ['Samsung', 'Oppo', 'Vivo', 'Realme', 'Xiaomi', 'Redmi', 'Poco', 'Infinix', 'Tecno', 'Itel', 'Huawei', 'Honor', 'Nokia', 'Motorola', 'OnePlus', 'Google', 'Sony', 'ASUS', 'Cherry Mobile', 'MyPhone', 'Nothing', 'ZTE', 'Lenovo', 'Alcatel'],
            'iPhone (Apple)': ['Apple'],
            'Keypad phone': ['Nokia', 'Itel', 'Samsung', 'Cherry Mobile', 'MyPhone', 'Tecno', 'Infinix', 'Alcatel'],
            Tablet: ['Apple', 'Samsung', 'Huawei', 'Lenovo', 'Xiaomi', 'Redmi', 'Poco', 'Realme', 'Oppo', 'Vivo', 'Honor', 'OnePlus', 'Google', 'Motorola', 'Tecno', 'Infinix', 'Cherry Mobile', 'Microsoft Surface', 'Amazon (Fire)', 'Acer', 'ASUS'],
            Smartwatch: ['Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Huawei', 'Honor', 'Amazfit', 'Garmin', 'Fitbit', 'Realme', 'Oppo', 'Vivo', 'OnePlus', 'Google', 'Infinix', 'Tecno'],
            'Wireless earbuds': ['Apple', 'Samsung', 'Redmi', 'Xiaomi', 'JBL', 'Anker', 'Realme', 'Oppo', 'Vivo', 'Sony', 'Huawei', 'Honor', 'OnePlus', 'Nothing', 'QCY', 'Lenovo', 'Baseus', 'Remax', 'Beats', 'Bose', 'Marshall', 'Google', 'Infinix', 'Tecno'],
            'Earphones (wired)': ['Samsung', 'Apple', 'Sony', 'JBL', 'Xiaomi', 'Oppo', 'Realme', 'Remax', 'Beats', 'Vivo', 'Huawei'],
            Headphones: ['Sony', 'JBL', 'Beats', 'Bose', 'Apple', 'Audio-Technica', 'Logitech', 'Redragon', 'A4Tech', 'Rapoo', 'Fantech', 'HyperX', 'SteelSeries', 'Razer', 'Anker', 'Marshall'],
            'Power bank': ['Anker', 'Xiaomi', 'Redmi', 'Realme', 'Oppo', 'Romoss', 'Baseus', 'Samsung', 'Remax', 'Ugreen', 'Cherry Mobile'],
            'Phone charger / cable': ['Samsung', 'Apple', 'Oppo', 'Vivo', 'Realme', 'Xiaomi', 'Anker', 'Baseus', 'Ugreen', 'Huawei', 'OnePlus', 'Remax'],
            'Flash drive (USB)': ['Kingston', 'SanDisk', 'Toshiba', 'HP', 'Transcend', 'ADATA'],
            'Bluetooth speaker': ['JBL', 'Sony', 'Xiaomi', 'Anker', 'Harman Kardon', 'Marshall', 'Bose'],
            Camera: ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'GoPro', 'Panasonic'],
            'E-reader': ['Amazon', 'Kobo'],
        },
        // Item-specific model lists now live in deviceModels.js (≈3,700 models, 100+ brands).
        models: {},
        modelHint: 'e.g. Galaxy A15, iPhone 13, Redmi 12C',
        traits: ['Cracked screen', 'Tempered glass / screen protector', 'Phone case (describe color/design)', 'Sticker on the back',
            'Ring holder / pop socket', 'Custom lock-screen wallpaper', 'Dual SIM', 'Scratches on the back', 'Name label / initials'],
        places: ['Classroom', 'Library', 'Canteen / Cafeteria', 'Computer laboratory', 'Covered court / Gym', 'Comfort room (CR)'],
    },
    {
        name: 'Laptops & Computer Accessories',
        items: ['Laptop', 'Laptop charger', 'Computer mouse', 'Keyboard', 'External hard drive', 'Memory card', 'Webcam',
            'Graphics tablet', 'USB hub / adapter', 'Laptop sleeve'],
        brands: ['Acer', 'ASUS', 'Lenovo', 'HP', 'Dell', 'Apple', 'MSI', 'Gigabyte', 'Huawei', 'Samsung', 'Microsoft Surface', 'Chuwi', 'Logitech', 'A4Tech', 'Rapoo', 'Redragon', 'Fantech', 'Razer', 'Keychron', 'Kingston', 'SanDisk', 'Seagate', 'Western Digital', 'Toshiba', 'Transcend', 'ADATA'],
        itemBrands: {
            Laptop: ['Acer', 'ASUS', 'Lenovo', 'HP', 'Dell', 'Apple', 'MSI', 'Huawei', 'Gigabyte', 'Samsung', 'Microsoft Surface', 'Chuwi'],
            'Laptop charger': ['Acer', 'ASUS', 'Lenovo', 'HP', 'Dell', 'Apple', 'Huawei', 'MSI', 'Universal'],
            'Computer mouse': ['Logitech', 'A4Tech', 'Rapoo', 'Redragon', 'Fantech', 'Razer', 'HP', 'Dell', 'ASUS', 'Microsoft', 'HyperX', 'SteelSeries'],
            Keyboard: ['Logitech', 'A4Tech', 'Rapoo', 'Redragon', 'Fantech', 'Keychron', 'Royal Kludge', 'Razer', 'HP', 'Dell', 'ASUS', 'Microsoft', 'HyperX'],
            'External hard drive': ['Seagate', 'Western Digital', 'Toshiba', 'Transcend', 'ADATA', 'Kingston', 'SanDisk'],
            'Memory card': ['SanDisk', 'Kingston', 'Samsung', 'Transcend'],
        },
        models: {},
        modelHint: 'e.g. Aspire 5, VivoBook 14, IdeaPad 3',
        traits: ['Stickers on the cover', 'Dent / scratch on the corner', 'Name tag or label', 'Cracked hinge', 'Charger included', 'Sleeve / case color', 'Wallpaper on login screen'],
        places: ['Computer laboratory', 'Library', 'Classroom', 'Student lounge', 'Canteen / Cafeteria'],
    },
    {
        name: 'Bags',
        items: ['Backpack', 'Sling bag', 'Shoulder bag', 'Handbag', 'Tote bag', 'Drawstring bag', 'Laptop bag', 'Gym bag', 'Messenger bag',
            'Pouch', 'Pencil case', 'Lunch bag', 'Eco bag', 'Trolley bag'],
        brands: ['Jansport', 'Adidas', 'Nike', 'Puma', 'Fila', 'Hawk', 'Bench', 'Penshoppe', 'Herschel', 'Northface', 'Samsonite', 'American Tourister', 'Eastpak', 'Converse', 'Lacoste', 'Kipling', 'Hello Kitty', 'Sanrio', 'Mickey Mouse (Disney)'],
        itemBrands: {
            'Pencil case': ['Faber-Castell', 'Sterling', 'Hello Kitty', 'Sanrio', 'Disney', 'Miniso', 'Best Buy'],
            'Lunch bag': ['Tupperware', 'Miniso', 'Thermos', 'Hello Kitty', 'Disney'],
            Pouch: ['Miniso', 'Bench', 'Penshoppe', 'Hello Kitty', 'Sanrio'],
        },
        hasModel: false,
        traits: ['Keychain / charm attached', 'Name tag or ID holder', 'Patches / pins', 'Torn or broken zipper', 'Stains or marks', 'Contents inside (books, umbrella…)', 'Reflective strip', 'Water-bottle pocket'],
        places: ['Classroom', 'Canteen / Cafeteria', 'Library', 'Covered court / Gym', 'Waiting shed', 'Hallway / Corridor'],
    },
    {
        name: 'Wallets, Money & Cards',
        items: ['Wallet', 'Coin purse', 'Card holder', 'ATM / Debit card', 'Cash (money)', 'Allowance envelope', 'Money clip', 'Passbook'],
        brands: ['Bench', 'Penshoppe', 'Nike', 'Adidas', 'Levi\'s', 'Folded & Hung', 'Fossil', 'Michael Kors', 'Hello Kitty', 'Sanrio', 'Miniso', NO_BRAND],
        brandLabel: 'Brand / Bank',
        itemBrands: {
            'ATM / Debit card': ['BDO', 'BPI', 'Landbank', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'RCBC', 'China Bank', 'GCash Mastercard', 'Maya', 'Land Bank'],
            Passbook: ['BDO', 'BPI', 'Landbank', 'Metrobank', 'PNB', 'Coop bank / Credit union'],
        },
        hasModel: false,
        traits: ['Contains ID / cards (do not list numbers)', 'Has coins inside', 'Zipper or snap button', 'Photo inside', 'Initials / name engraved', 'Torn edge', 'Approximate amount (no exact figure)'],
        places: ['Canteen / Cafeteria', 'Cashier', 'Registrar\'s Office', 'Bookstore', 'Classroom', 'Comfort room (CR)'],
    },
    {
        name: 'IDs & Documents',
        items: ['School ID', 'ID lace / ID holder', 'Driver\'s license', 'National ID (PhilSys)', 'UMID', 'Voter\'s ID', 'Passport', 'Birth certificate / PSA copy',
            'Enrollment form / COR', 'Report card / Form 138', 'Diploma / Certificate', 'Clearance form', 'Folder / Envelope with papers', 'Official receipt'],
        hasBrand: false,
        hasModel: false,
        traits: ['Name printed on it (initials only is fine)', 'Laminated', 'In a plastic sleeve / ID holder', 'Folded or bent', 'Year level / course shown', 'Colored lanyard attached'],
        places: ['Registrar\'s Office', 'Cashier', 'Guard house / Gate', 'Library', 'Classroom', 'Administration building'],
        privacyNote: 'For IDs and documents, don\'t type the full ID number or personal details here — Security will verify the real owner.',
    },
    {
        name: 'School Supplies',
        items: ['Scientific calculator', 'Ballpen', 'Pencil / Mechanical pencil', 'Fountain pen', 'Highlighter / Marker set', 'Ruler / Protractor',
            'Compass / Drawing set', 'T-square', 'Drawing tubes / Plan holder', 'Art materials', 'Pencil case', 'Clear book / Long folder',
            'Stapler / Hole puncher', 'Index cards / Pad paper'],
        brands: ['Casio', 'Faber-Castell', 'Pilot', 'HBW', 'Mongol', 'Panda', 'Staedtler', 'Pentel', 'Uni', 'Zebra', 'Stabilo', 'Sterling', 'Best Buy', 'Deli', 'Scotch', 'Joyko'],
        itemBrands: {
            'Scientific calculator': ['Casio', 'Citizen', 'Sharp', 'Texas Instruments', 'Deli', 'Joyko', 'Canon'],
            Ballpen: ['Pilot', 'HBW', 'Panda', 'Uni', 'Zebra', 'Pentel', 'Faber-Castell', 'Staedtler', 'Bic', 'Sakura'],
            'Pencil / Mechanical pencil': ['Mongol', 'Faber-Castell', 'Staedtler', 'Pentel', 'Uni', 'Pilot'],
            'Fountain pen': ['Pilot', 'Parker', 'Lamy', 'Sheaffer', 'Platinum'],
            'Highlighter / Marker set': ['Stabilo', 'Faber-Castell', 'Pilot', 'Sharpie', 'Zebra', 'Staedtler'],
            'Ruler / Protractor': ['Staedtler', 'Faber-Castell', 'Joyko', 'Deli'],
            'Compass / Drawing set': ['Staedtler', 'Faber-Castell', 'Maped', 'Joyko'],
            'Art materials': ['Faber-Castell', 'Crayola', 'Staedtler', 'Prismacolor', 'Joyko'],
        },
        models: {},
        modelHint: 'e.g. fx-991ES Plus (calculators)',
        traits: ['Initials / name written on it', 'Cover or case color', 'Scratched or cracked', 'Sticker on it', 'Complete set (describe)', 'Taped or glued part', 'Spare batteries inside'],
        places: ['Classroom', 'Library', 'Science laboratory', 'Computer laboratory', 'Hallway / Corridor'],
    },
    {
        name: 'Books & Notebooks',
        items: ['Textbook', 'Notebook', 'Reviewer / Module', 'Workbook', 'Planner / Journal', 'Sketchpad', 'Bible / Prayer book', 'Novel / Storybook',
            'Dictionary', 'Laboratory manual', 'Binder', 'Printed handouts / Papers'],
        brands: ['Sterling', 'Best Buy', 'Cambridge', 'Orions', 'Moleskine', 'Rex Book Store', 'Vibal', 'Phoenix', 'Pearson', 'McGraw-Hill', 'Cengage', 'Oxford', 'Hello Kitty', 'Disney'],
        brandLabel: 'Brand / Publisher',
        itemBrands: {
            Notebook: ['Sterling', 'Best Buy', 'Cambridge', 'Orions', 'Moleskine', 'Hello Kitty', 'Disney', 'Joyko'],
            Textbook: ['Rex Book Store', 'Vibal', 'Phoenix', 'Pearson', 'McGraw-Hill', 'Cengage', 'Oxford', 'Cambridge', 'Wiley'],
            'Bible / Prayer book': ['Catholic Bible', 'Gideons', 'Tagalog Bible', 'Cebuano Bible', 'Daily Missal'],
            Binder: ['Joyko', 'Best Buy', 'Hello Kitty', 'Mead'],
        },
        hasModel: false,
        traits: ['Name / section written inside the cover', 'Subject label', 'Book cover (describe)', 'Sticky notes or tabs', 'Highlighted pages', 'Loose pages', 'Tape on the spine', 'Bookmark inside'],
        places: ['Library', 'Classroom', 'Canteen / Cafeteria', 'Student lounge', 'Chapel / Prayer room'],
    },
    {
        name: 'Uniforms & Clothing',
        items: ['School uniform (polo / blouse)', 'School uniform (pants / skirt)', 'PE uniform (T-shirt)', 'PE uniform (jogging pants)', 'Jacket / Hoodie',
            'Lab gown / Apron', 'Organization / Department shirt', 'Jersey', 'Cap / Hat', 'Scarf / Bandana', 'Raincoat / Poncho', 'Necktie / Neckerchief',
            'Belt', 'Socks', 'Gloves'],
        brands: ['Uniqlo', 'Bench', 'Penshoppe', 'Giordano', 'Oxgn', 'Human', 'Nike', 'Adidas', 'Puma', 'Fila', 'Under Armour', 'Champion', 'Cotton On', 'Zara', 'H&M', 'Hanes', NO_BRAND],
        hasModel: false,
        traits: ['Name or initials written on the label', 'Embroidered name / school logo', 'Missing button', 'Stain or tear', 'Size on label', 'Patches or pins', 'Wrapped in a plastic bag'],
        places: ['Covered court / Gym', 'Comfort room (CR)', 'Classroom', 'Science laboratory', 'Quadrangle / Oval', 'Bleachers / Stage'],
    },
    {
        name: 'Footwear',
        items: ['Rubber shoes / Sneakers', 'Black school shoes', 'White rubber shoes (PE)', 'Sandals', 'Slippers / Flip-flops', 'Heels / Flats', 'Boots', 'Rain boots'],
        brands: ['Nike', 'Adidas', 'Converse', 'Vans', 'Skechers', 'Fila', 'Puma', 'New Balance', 'Crocs', 'Havaianas', 'Bata', 'Hush Puppies', 'Clarks', 'Under Armour', 'Reebok', 'Ascents', 'Kappa', 'Mizuno', 'Islander', 'Birkenstock', NO_BRAND],
        itemBrands: {
            'Rubber shoes / Sneakers': ['Nike', 'Adidas', 'Converse', 'Vans', 'Skechers', 'Fila', 'Puma', 'New Balance', 'Under Armour', 'Reebok', 'Ascents', 'Kappa', 'Mizuno', 'Bata', NO_BRAND],
            'White rubber shoes (PE)': ['Nike', 'Adidas', 'Converse', 'Vans', 'Skechers', 'Fila', 'Puma', 'New Balance', 'Bata', 'Ascents', NO_BRAND],
            'Black school shoes': ['Bata', 'Hush Puppies', 'Clarks', NO_BRAND],
            'Slippers / Flip-flops': ['Havaianas', 'Crocs', 'Islander', 'Sandugo', 'Fitflop', NO_BRAND],
            Sandals: ['Birkenstock', 'Crocs', 'Teva', 'Havaianas', 'Islander', NO_BRAND],
        },
        modelHint: 'e.g. Air Force 1, Chuck Taylor',
        traits: ['Size (on the tongue / sole)', 'Left or right only', 'Worn sole / dirty', 'Name written inside', 'Distinct laces', 'Spare shoes in a plastic bag'],
        places: ['Covered court / Gym', 'Classroom', 'Chapel / Prayer room', 'Comfort room (CR)', 'Hallway / Corridor'],
    },
    {
        name: 'Water Bottles & Food Containers',
        items: ['Water bottle / Tumbler', 'Thermos / Insulated flask', 'Lunch box / Baon container', 'Food container', 'Drinking cup / Mug', 'Utensil set (spoon & fork)', 'Snack box'],
        brands: ['Aquaflask', 'Hydro Flask', 'Tupperware', 'Lock&Lock', 'Stanley', 'Thermos', 'Contigo', 'Owala', 'Nalgene', 'Rubbermaid', 'Miniso', 'Cuckoo', 'Zojirushi', 'Hello Kitty', NO_BRAND],
        hasModel: false,
        traits: ['Dent on the body', 'Stickers', 'Name or initials on it', 'Strap / carrier', 'Straw or cover type', 'Content or leftover food', 'Chipped paint'],
        places: ['Canteen / Cafeteria', 'Classroom', 'Covered court / Gym', 'Library', 'Quadrangle / Oval'],
    },
    {
        name: 'Umbrellas & Rain Gear',
        items: ['Umbrella (folding)', 'Umbrella (long / stick)', 'Raincoat', 'Poncho', 'Rain boots', 'Waterproof bag cover'],
        brands: ['Totes', 'Fibrella', 'Miniso', NO_BRAND],
        hasModel: false,
        traits: ['Pattern or print', 'Wooden / curved handle', 'Broken rib / bent frame', 'Name or tape on the handle', 'Cover or sleeve color', 'Auto-open button', 'Missing strap'],
        places: ['Waiting shed', 'Classroom', 'Guard house / Gate', 'Hallway / Corridor', 'Canteen / Cafeteria'],
    },
    {
        name: 'Accessories & Jewelry',
        items: ['Eyeglasses', 'Eyeglasses case', 'Sunglasses', 'Wristwatch', 'Bracelet', 'Necklace', 'Ring', 'Earrings', 'Hair clip / Hair tie / Headband',
            'Rosary', 'Handkerchief', 'Lanyard', 'Pin / Brooch', 'Retainer / Dental device'],
        brands: ['Casio', 'G-Shock', 'Fossil', 'Seiko', 'Timex', 'Swatch', 'Daniel Wellington', 'Citizen', 'Orient', 'Ray-Ban', 'Oakley', 'Pandora', 'Miniso', 'Bench', NO_BRAND],
        itemBrands: {
            Eyeglasses: ['Ray-Ban', 'Oakley', 'Eyemaster', 'Optical Center', 'Owndays', NO_BRAND],
            Sunglasses: ['Ray-Ban', 'Oakley', 'Gucci', 'Polaroid', 'Miniso', NO_BRAND],
            Wristwatch: ['Casio', 'G-Shock', 'Fossil', 'Seiko', 'Timex', 'Swatch', 'Citizen', 'Daniel Wellington', 'Orient', NO_BRAND],
            Rosary: ['Wooden', 'Crystal', 'Glow-in-the-dark', 'Metal'],
        },
        modelHint: 'e.g. F-91W, GA-2100, Seiko 5 SNK809 (watches)',
        traits: ['Prescription / grade (don\'t give exact values)', 'Frame style / color', 'Engraving or initials', 'Missing stone or bead', 'Case color', 'Strap material (leather / rubber / metal)', 'Cracked lens'],
        places: ['Comfort room (CR)', 'Covered court / Gym', 'Classroom', 'Chapel / Prayer room', 'Science laboratory'],
    },
    {
        name: 'Keys',
        items: ['House key', 'Locker key', 'Motorcycle key', 'Car key / Remote', 'Padlock with key', 'Bunch of keys', 'Keychain', 'Classroom / Office key'],
        brands: [NO_BRAND],
        traits: ['Keychain / charm', 'Number of keys', 'Plastic key cover color', 'Remote fob attached', 'Key tag with number', 'Lanyard or carabiner'],
        places: ['Parking area', 'Classroom', 'Guard house / Gate', 'Covered court / Gym', 'Faculty room'],
    },
    {
        name: 'Sports & PE Gear',
        items: ['Basketball', 'Volleyball', 'Badminton racket', 'Shuttlecock set', 'Table tennis paddle', 'Football / Soccer ball', 'Jump rope', 'Yoga mat',
            'Shin guards', 'Knee / Ankle support', 'Sports jersey set', 'Whistle', 'Dumbbell / Gym gear', 'Swimwear / Goggles'],
        brands: ['Molten', 'Mikasa', 'Spalding', 'Wilson', 'Yonex', 'Li-Ning', 'Victor', 'Nike', 'Adidas', 'Mizuno', 'Puma', 'Decathlon', 'Speedo', NO_BRAND],
        itemBrands: {
            Basketball: ['Molten', 'Spalding', 'Wilson', 'Nike', 'Adidas'],
            Volleyball: ['Mikasa', 'Molten', 'Mizuno', 'Wilson'],
            'Badminton racket': ['Yonex', 'Li-Ning', 'Victor', 'Apacs', 'Carlton'],
        },
        hasModel: false,
        traits: ['Name or number written on it', 'Worn grip / faded print', 'Cover or bag color', 'Strings / net condition', 'Team or section label', 'Pump or accessories included'],
        places: ['Covered court / Gym', 'Quadrangle / Oval', 'Field / Garden', 'Bleachers / Stage', 'Classroom'],
    },
    {
        name: 'Personal Care & Medical',
        items: ['Towel / Face towel', 'Makeup pouch', 'Perfume / Cologne', 'Lotion / Sunscreen', 'Comb / Hairbrush', 'Alcohol / Sanitizer bottle', 'Face mask case', 'Inhaler',
            'Medicine / Vitamins', 'Toothbrush kit', 'Menstrual kit', 'Facial wipes / Tissue pouch', 'Contact lens case', 'Hijab / Veil'],
        brands: ['Safeguard', 'Dove', 'Nivea', 'Watsons', 'Careline', 'Silka', 'Belo', 'Johnson\'s', 'Cetaphil', 'Ventolin', 'Miniso', NO_BRAND],
        hasModel: false,
        traits: ['Scent or label', 'Pouch color / print', 'Initials on it', 'Partly used', 'Prescription label (don\'t share personal details)'],
        places: ['Comfort room (CR)', 'Clinic', 'Classroom', 'Covered court / Gym', 'Student lounge'],
    },
    {
        name: 'Gaming & Entertainment',
        items: ['Game console', 'Handheld console', 'Controller / Gamepad', 'Gaming headset', 'Gaming mouse', 'Game cartridge / disc', 'Trading cards', 'Board game / Cards', 'Fidget / Rubik\'s cube', 'Drone'],
        brands: ['Nintendo', 'PlayStation', 'Xbox', 'Valve', 'ROG', 'Gamesir', '8BitDo', 'Razer', 'HyperX', 'SteelSeries', 'Logitech', 'Redragon', 'Fantech', 'DJI', NO_BRAND],
        itemBrands: {
            'Game console': ['Nintendo', 'PlayStation', 'Xbox', 'Valve', 'ROG'],
            'Handheld console': ['Nintendo', 'Valve', 'ROG', 'PlayStation'],
            'Controller / Gamepad': ['Nintendo', 'PlayStation', 'Xbox', 'Gamesir', '8BitDo', 'Razer', 'Logitech', NO_BRAND],
            'Gaming headset': ['Razer', 'HyperX', 'SteelSeries', 'Logitech', 'Redragon', 'Fantech', 'PlayStation', 'Xbox'],
            'Gaming mouse': ['Razer', 'Logitech', 'Redragon', 'Fantech', 'HyperX', 'SteelSeries', 'A4Tech', 'ASUS'],
        },
        traits: ['Stickers or skin on it', 'Custom grips / thumb sticks', 'Name or tag written on it', 'Scratches or scuffs', 'Case or pouch (describe)', 'Game cartridge inside', 'Charging cable included'],
        places: ['Student lounge', 'Computer laboratory', 'Library', 'Canteen / Cafeteria', 'Classroom'],
    },
    {
        name: 'Helmets & Riding Gear',
        items: ['Motorcycle helmet', 'Bicycle helmet', 'Riding gloves', 'Face shield / Visor', 'Riding jacket', 'Face mask / Balaclava', 'Phone holder (bike/motor)'],
        brands: ['Spyder', 'MT', 'LS2', 'HJC', 'Shoei', 'KYT', 'Index', 'Zeus', 'Givi', 'Andes', 'Takachi', 'Cardo', 'Alpinestars', 'Giro', 'Bell', 'Rockbros', NO_BRAND],
        brandLabel: 'Brand',
        hasModel: false,
        traits: ['Sticker or decal on it', 'Visor type (clear / tinted / mirror)', 'Name written inside', 'Scratches or dents', 'Chin strap color', 'Helmet bag / lock included'],
        places: ['Parking area', 'Guard house / Gate', 'Covered court / Gym', 'Classroom', 'Waiting shed'],
    },
    {
        name: 'Other',
        items: ['Toy / Plush', 'Musical instrument', 'Musical instrument case', 'Art / Project in progress', 'Tool / Equipment', 'Gift item', 'Package / Parcel', 'Unknown item'],
        brands: [NO_BRAND],
        traits: ['Anything unusual about it', 'Color pattern', 'Name or label', 'Damaged part', 'Contents inside'],
        places: ['Classroom', 'Library', 'Hallway / Corridor', 'Canteen / Cafeteria', 'Guard house / Gate'],
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const norm = (s) => String(s || '').trim().toLowerCase();
const dedupe = (arr) => {
    const seen = new Set();
    return (arr || []).filter((x) => { const k = norm(x); if (!k || seen.has(k)) return false; seen.add(k); return true; });
};

export const CATEGORY_NAMES = CATALOG.map((c) => c.name);

// A category the person typed (or an older free-text one) may not be in the catalog.
export const findCategory = (name) => CATALOG.find((c) => norm(c.name) === norm(name)) || null;

// Match item names loosely too, so "Smartphone" or "smart phone" still finds the item entry.
export const itemsFor = (category) => {
    const cat = findCategory(category);
    return dedupe([...(cat?.items || []), ...(EXTRA_ITEMS[cat?.name] || [])]);
};

// The per-item rule (itemRules.js) for the picked item, or null for a typed / unknown item.
export const ruleFor = (category, itemName) => {
    const cat = findCategory(category);
    const rules = cat && ITEM_RULES[cat.name];
    if (!rules || !itemName) return null;
    const hit = Object.entries(rules).find(([k]) => norm(k) === norm(itemName));
    return hit ? hit[1] : null;
};

export const brandsFor = (category, itemName) => {
    const cat = findCategory(category);
    if (!cat) return [];
    const rule = ruleFor(category, itemName);
    if (rule?.noBrand) return [];
    if (rule?.brands) return dedupe([...rule.brands, ...(rule.brands.includes(NO_BRAND) ? [] : [NO_BRAND])]);
    const specific = cat.itemBrands && Object.entries(cat.itemBrands).find(([k]) => norm(k) === norm(itemName));
    if (specific) return dedupe([...specific[1], NO_BRAND]);
    return dedupe(cat.brands);
};

const flatModels = (m) => (Array.isArray(m) ? m : Object.values(m || {}).flat());

// Models for brand (+ the specific item, so a Samsung phone and a Samsung tablet get different lists).
export const modelsFor = (category, brand, itemName) => {
    if (!brand) return [];
    const rule = ruleFor(category, itemName);
    if (rule?.noBrand || rule?.noModel) return [];
    if (rule?.models) {
        const own = Object.entries(rule.models).find(([k]) => norm(k) === norm(brand));
        return own ? dedupe(own[1]) : [];
    }
    const dev = deviceModelsFor(brand, itemName);
    if (dev && dev.length) return dedupe(dev);
    const cat = findCategory(category);
    if (!cat?.models) return [];
    const hit = Object.entries(cat.models).find(([k]) => norm(k) === norm(brand));
    return hit ? dedupe(flatModels(hit[1])) : [];
};

// ---------------------------------------------------------------------------
// Extra details ("specs & extras") — structured picks that the matching engine
// compares field by field (storage 128GB vs 64GB, size M vs L, left vs right shoe…).
// Stored as { key: value } in the report's `details`.
// ---------------------------------------------------------------------------
const opt = (key, label, options, hint) => ({ key, label, options, hint });
const STORAGE = ['8GB', '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
const PHONE_ATTRS = [
    opt('storage', 'Storage', STORAGE, 'Settings → About phone. Skip if unsure.'),
    opt('case', 'Case / cover', ['No case', 'Clear case', 'Black case', 'Colored case', 'Wallet / flip case', 'Rugged case', 'Printed / designed case'], 'What was on it when lost / found.'),
    opt('screen', 'Screen', ['Intact', 'Cracked', 'Has tempered glass', 'Has screen protector']),
    opt('sim_slots', 'SIM', ['Single SIM', 'Dual SIM', 'eSIM']),
];
const SIZE_LMS = ['Small', 'Medium', 'Large'];
const SHOE_SIZES = ['EU 34', 'EU 35', 'EU 36', 'EU 37', 'EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43', 'EU 44', 'EU 45', 'EU 46', 'EU 47'];
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const ATTRIBUTES = {
    'Phones & Gadgets': {
        default: [],
        items: {
            'Smartphone (Android)': PHONE_ATTRS,
            'iPhone (Apple)': PHONE_ATTRS,
            'Keypad phone': [opt('sim_slots', 'SIM', ['Single SIM', 'Dual SIM']), opt('case', 'Case / cover', ['No case', 'Has case'])],
            Tablet: [opt('storage', 'Storage', STORAGE), opt('screen_size', 'Screen size', ['7"', '8"', '9"', '10"', '11"', '12.9"', '13"']), opt('case', 'Case / cover', ['No case', 'Flip cover', 'Rugged case', 'Keyboard case']), opt('connectivity', 'Connectivity', ['Wi-Fi only', 'Wi-Fi + Cellular'])],
            Smartwatch: [opt('case_size', 'Case size', ['38 mm', '40 mm', '41 mm', '42 mm', '44 mm', '45 mm', '46 mm', '49 mm']), opt('strap', 'Strap', ['Silicone / rubber', 'Leather', 'Metal', 'Fabric / nylon', 'Sport loop'])],
            'Wireless earbuds': [opt('with_case', 'Charging case', ['With case', 'Earbud(s) only', 'Case only']), opt('side', 'Which piece', ['Both buds', 'Left only', 'Right only'])],
            'Earphones (wired)': [opt('connector', 'Connector', ['3.5mm jack', 'USB-C', 'Lightning'])],
            Headphones: [opt('style', 'Style', ['Over-ear', 'On-ear', 'Neckband']), opt('connection', 'Connection', ['Wired', 'Bluetooth', 'Both'])],
            'Power bank': [opt('capacity', 'Capacity', ['5000mAh', '10000mAh', '20000mAh', '30000mAh', '50000mAh'])],
            'Flash drive (USB)': [opt('capacity', 'Capacity', ['8GB', '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'])],
            'Phone charger / cable': [opt('connector', 'Connector', ['USB-C', 'Lightning', 'Micro-USB', 'Wall adapter only']), opt('power', 'Power', ['5W', '10W', '18W', '20W', '25W', '33W', '45W', '65W'])],
            'Bluetooth speaker': [opt('size', 'Size', ['Mini / clip', 'Portable', 'Large'])],
            Camera: [opt('kind', 'Type', ['DSLR', 'Mirrorless', 'Point & shoot', 'Instant (Instax)', 'Action cam'])],
        },
    },
    'Laptops & Computer Accessories': {
        default: [],
        items: {
            Laptop: [opt('screen_size', 'Screen size', ['11"', '13"', '14"', '15.6"', '16"', '17"']), opt('ram', 'RAM', ['4GB', '8GB', '16GB', '32GB']), opt('storage', 'Storage', ['128GB', '256GB', '512GB', '1TB', '2TB']), opt('case', 'Sleeve / case', ['No sleeve', 'Black sleeve', 'Colored sleeve', 'Hard shell cover'])],
            'Laptop charger': [opt('power', 'Power', ['45W', '65W', '90W', '120W', '135W', '150W', '180W']), opt('connector', 'Connector', ['USB-C', 'Barrel (round pin)', 'Barrel (slim / small pin)', 'MagSafe'])],
            'Computer mouse': [opt('connection', 'Connection', ['Wired', 'Wireless (USB dongle)', 'Bluetooth'])],
            Keyboard: [opt('connection', 'Connection', ['Wired', 'Wireless (USB dongle)', 'Bluetooth']), opt('layout', 'Layout', ['Full-size', 'Compact / TKL', 'Mini'])],
            'External hard drive': [opt('capacity', 'Capacity', ['250GB', '500GB', '1TB', '2TB', '4TB', '5TB'])],
            'Memory card': [opt('capacity', 'Capacity', ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB']), opt('kind', 'Type', ['microSD', 'SD'])],
        },
    },
    Bags: { default: [opt('size', 'Size', SIZE_LMS), opt('compartments', 'Compartments', ['1', '2', '3', '4+']), opt('laptop_sleeve', 'Laptop sleeve inside', ['Yes', 'No'])], items: {} },
    'Wallets, Money & Cards': { default: [opt('material', 'Material', ['Leather', 'Faux leather', 'Fabric', 'Plastic', 'Canvas']), opt('fold', 'Style', ['Bi-fold', 'Tri-fold', 'Long / zippered', 'Short / compact', 'Card holder'])], items: {} },
    'IDs & Documents': { default: [opt('holder', 'Holder', ['No holder', 'Plastic sleeve', 'Hard case', 'Lanyard attached'])], items: {} },
    'School Supplies': { default: [], items: { 'Scientific calculator': [opt('cover', 'Cover', ['With slide cover', 'No cover', 'Has pouch'])], 'Pencil case': [opt('size', 'Size', SIZE_LMS), opt('kind', 'Type', ['Zippered pouch', 'Hard box', 'Roll-up'])] } },
    'Books & Notebooks': { default: [opt('cover', 'Cover', ['Hard cover', 'Soft cover', 'Spiral', 'Plastic cover']), opt('size', 'Size', ['Pocket', 'A5', 'A4 / Letter', 'Legal'])], items: {} },
    'Uniforms & Clothing': { default: [opt('size', 'Size', SHIRT_SIZES), opt('sleeve', 'Sleeve', ['Short sleeve', 'Long sleeve', 'Sleeveless'])], items: { 'School uniform (pants / skirt)': [opt('size', 'Size', ['24', '26', '28', '30', '32', '34', '36', 'XS', 'S', 'M', 'L', 'XL'])] } },
    Footwear: { default: [opt('size', 'Size', SHOE_SIZES), opt('pair', 'Which one(s)', ['Complete pair', 'Left only', 'Right only']), opt('closure', 'Closure', ['Laces', 'Velcro', 'Slip-on', 'Buckle'])], items: {} },
    'Water Bottles & Food Containers': { default: [opt('capacity', 'Capacity', ['350ml', '500ml', '600ml', '750ml', '1L', '1.2L', '1.5L', '2L']), opt('lid', 'Lid / cap', ['Screw cap', 'Flip lid', 'Straw lid', 'Spout lid', 'Handle lid'])], items: {} },
    'Umbrellas & Rain Gear': { default: [opt('kind', 'Type', ['Folding', 'Long / stick', 'Automatic', 'Golf']), opt('size', 'Size', SIZE_LMS)], items: {} },
    'Accessories & Jewelry': { default: [], items: { Wristwatch: [opt('strap', 'Strap', ['Leather', 'Rubber / resin', 'Metal', 'Fabric']), opt('display', 'Display', ['Analog', 'Digital', 'Analog-digital'])], Eyeglasses: [opt('frame', 'Frame', ['Plastic', 'Metal', 'Rimless', 'Half-rim']), opt('lens', 'Lens', ['Clear', 'Anti-radiation / blue light', 'Tinted', 'Photochromic'])], Sunglasses: [opt('frame', 'Frame', ['Plastic', 'Metal', 'Rimless'])], Necklace: [opt('material', 'Material', ['Gold', 'Silver', 'Stainless', 'Beads', 'Fashion'])], Ring: [opt('material', 'Material', ['Gold', 'Silver', 'Stainless', 'Fashion']), opt('size', 'Size', ['5', '6', '7', '8', '9', '10', '11'])] } },
    Keys: { default: [opt('key_count', 'Number of keys', ['1', '2', '3', '4', '5 or more']), opt('has_remote', 'Remote / fob', ['Yes', 'No'])], items: {} },
    'Sports & PE Gear': { default: [opt('size', 'Size', ['Size 5', 'Size 6', 'Size 7', 'Youth', 'Adult', ...SIZE_LMS])], items: {} },
    'Personal Care & Medical': { default: [opt('size', 'Size', ['Travel size', 'Regular', 'Large'])], items: {} },
    'Gaming & Entertainment': { default: [opt('storage', 'Storage', ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'])], items: { 'Controller / Gamepad': [opt('connection', 'Connection', ['Wired', 'Wireless', 'Bluetooth'])], 'Game console': [opt('edition', 'Edition', ['Standard', 'Digital', 'Slim', 'Pro', 'Lite', 'OLED'])] } },
    'Helmets & Riding Gear': { default: [opt('size', 'Size', ['S', 'M', 'L', 'XL', 'Free size']), opt('style', 'Style', ['Half face', 'Full face', 'Open face / 3-4', 'Modular', 'Bicycle'])], items: {} },
    Other: { default: [opt('size', 'Size', SIZE_LMS)], items: {} },
};

/** The structured detail fields to show for this category + item (may be empty). */
export const attributesFor = (category, itemName) => {
    const cat = findCategory(category);
    if (!cat) return [];
    const a = ATTRIBUTES[cat.name];
    if (!a) return [];
    const rule = ruleFor(category, itemName);
    if (rule?.attrs) return rule.attrs;
    const hit = Object.entries(a.items || {}).find(([k]) => norm(k) === norm(itemName));
    if (hit) return hit[1];
    // Phones sometimes carry the legacy item name "Smartphone".
    if (cat.name === 'Phones & Gadgets' && /smartphone|iphone|cellphone|mobile/i.test(itemName || '')) return PHONE_ATTRS;
    return a.default || [];
};

export const traitsFor = (category, itemName) => {
    const own = ruleFor(category, itemName)?.traits;
    return dedupe(own && own.length ? own : (findCategory(category)?.traits || []));
};

export const hasBrand = (category, itemName) => findCategory(category)?.hasBrand !== false && !ruleFor(category, itemName)?.noBrand;
export const hasModel = (category, itemName) => {
    if (findCategory(category)?.hasModel === false) return false;
    const r = ruleFor(category, itemName);
    return !(r?.noBrand || r?.noModel);
};

// Field wording can change per item ("Bank" for an ATM card, "Motorcycle brand" for a motorcycle key).
export const brandLabelFor = (category, itemName) => ruleFor(category, itemName)?.brandLabel || findCategory(category)?.brandLabel || 'Brand';
export const modelLabelFor = (category, itemName) => ruleFor(category, itemName)?.modelLabel || findCategory(category)?.modelLabel || 'Model';
export const modelHintFor = (category, itemName) => {
    const r = ruleFor(category, itemName);
    return r && 'modelHint' in r ? r.modelHint : findCategory(category)?.modelHint;
};

// Places grouped: the ones this kind of item usually turns up first.
export const placeOptions = (category, itemName) => {
    const likely = ruleFor(category, itemName)?.places || findCategory(category)?.places || [];
    const likelySet = new Set(likely.map(norm));
    return [
        ...likely.map((p) => ({ value: p, group: 'Likely for this item' })),
        ...PLACES.filter((p) => !likelySet.has(norm(p))).map((p) => ({ value: p, group: likely.length ? 'Other places on campus' : undefined })),
    ];
};

export const colorOptions = COLORS.map((c) => ({ value: c.value, swatch: c.swatch }));

// One readable sentence from what was picked — a starting point for the description.
export const draftDescription = ({ category, item_name, brand, color, model }) => {
    const cleanBrand = brand && brand !== NO_BRAND ? brand : '';
    const head = [color, cleanBrand, model].filter(Boolean).join(' ');
    const noun = item_name || (category ? category.toLowerCase() : 'item');
    return `${head ? `${head} ` : ''}${noun}`.replace(/\s+/g, ' ').trim();
};

// Is `value` one of `options`? (case-insensitive) — used to decide whether a
// downstream field was filled from a list (safe to reset) or typed by hand (keep).
export const isListed = (value, options) => {
    const v = norm(value);
    return !!v && (options || []).some((o) => norm(typeof o === 'string' ? o : o.value) === v);
};

// When the category changes, reset only the dependent fields whose current
// value came from the OLD category's lists. Hand-typed values are kept.
export const reconcileOnCategoryChange = (form, nextCategory) => {
    const prev = form.category;
    const next = { ...form, category: nextCategory };
    if (isListed(form.item_name, itemsFor(prev))) next.item_name = '';
    if (isListed(form.brand, brandsFor(prev, form.item_name))) next.brand = '';
    if (isListed(form.model, [...flatModels(findCategory(prev)?.models), ...allDeviceModels()])) next.model = '';
    next.details = {}; // spec fields differ per category
    if (!hasBrand(nextCategory, next.item_name)) { next.brand = ''; next.model = ''; }
    if (!hasModel(nextCategory, next.item_name)) next.model = '';
    return next;
};

// When the item changes, drop a brand that came from the old item's list but
// isn't offered for the new one.
export const reconcileOnItemChange = (form, nextItem) => {
    const next = { ...form, item_name: nextItem };
    const oldList = brandsFor(form.category, form.item_name);
    const newList = brandsFor(form.category, nextItem);
    if (!hasBrand(form.category, nextItem)) {
        // e.g. House key -> Classroom key: the brand field disappears, so drop what was picked from a list.
        if (isListed(form.brand, oldList) || !form.item_name) { next.brand = ''; next.model = ''; }
    }
    else if (isListed(form.brand, oldList) && !isListed(form.brand, newList)) { next.brand = ''; next.model = ''; }
    // A model picked from the old item's list doesn't belong to the new item (Galaxy A15 -> Galaxy Tab).
    else if (isListed(form.model, modelsFor(form.category, form.brand, form.item_name)) && !isListed(form.model, modelsFor(form.category, form.brand, nextItem))) next.model = '';
    if (!hasModel(form.category, nextItem) && isListed(form.model, modelsFor(form.category, form.brand, form.item_name))) next.model = '';
    // Keep only the spec values that still apply to the new item.
    const keep = new Set(attributesFor(form.category, nextItem).map((x) => x.key));
    next.details = Object.fromEntries(Object.entries(form.details || {}).filter(([k]) => keep.has(k)));
    return next;
};

// When the brand changes, drop a model that belonged to the previous brand.
export const reconcileOnBrandChange = (form, nextBrand) => {
    const next = { ...form, brand: nextBrand };
    if (isListed(form.model, modelsFor(form.category, form.brand, form.item_name)) && !isListed(form.model, modelsFor(form.category, nextBrand, form.item_name))) next.model = '';
    return next;
};
