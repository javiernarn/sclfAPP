// ============================================================================
// Per-ITEM rules for the Lost & Found pick-lists.
//
// lostFoundCatalog.js knows each CATEGORY. This file narrows things down to the
// exact ITEM the person picked, so the next dropdowns only offer values that
// make sense for that item:
//
//   Keys ─ House key        -> brands: lock makers (Yale, Union, Solex…)  no model
//        ─ Motorcycle key   -> brands: Honda, Yamaha…  -> models: Click 125i, Aerox…
//        ─ Car key / Remote -> brands: Toyota, Mitsubishi… -> models: Vios, Xpander…
//        ─ Classroom key    -> NO brand / model field at all
//
// A rule can contain:
//   brands:      brand suggestions for this item (replaces the category list)
//   noBrand:     true  -> hide the Brand + Model fields (nothing sensible to pick)
//   brandLabel:  wording for the Brand field ("Bank", "Courier", "Vehicle brand")
//   noModel:     true  -> hide only the Model field
//   modelLabel / modelHint: wording for the Model field
//   models:      { Brand: [model, …] } model suggestions per brand
//   traits:      tap-to-add "unique characteristics" for this item (shown first)
//   places:      where this item usually turns up on campus (shown first)
//   attrs:       structured spec fields ({ key, label, options, hint }) that the
//                matching engine compares field by field
//
// Everything stays free-text — lists only SUGGEST. Brand names are written the
// way people write them; MatchVocabulary::BRAND_ALIASES folds the spelling
// variants together on the server.
// ============================================================================

export const NO_BRAND = 'No brand / Unbranded';

export const opt = (key, label, options, hint) => ({ key, label, options, hint });

const NB = NO_BRAND;
const SIZE_LMS = ['Small', 'Medium', 'Large'];
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

// --- Shared brand lists -----------------------------------------------------
const LOCK_BRANDS = ['Yale', 'Union', 'Solex', 'Master Lock', 'ABUS', 'Kwikset', 'Schlage', 'Mul-T-Lock', 'Hafele', NB];
const MOTORCYCLE_BRANDS = ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Kymco', 'SYM', 'Rusi', 'Skygo', 'Motorstar', 'TVS', 'Bajaj', 'KTM', 'Bristol', 'Royal Enfield', 'Vespa', 'Piaggio', 'Keeway', 'CFMoto', 'Benelli', 'Triumph', 'Ducati', 'Harley-Davidson', 'Other / local brand'];
const CAR_BRANDS = ['Toyota', 'Mitsubishi', 'Honda', 'Nissan', 'Ford', 'Isuzu', 'Suzuki', 'Hyundai', 'Kia', 'Mazda', 'Chevrolet', 'Subaru', 'MG', 'Geely', 'Chery', 'BYD', 'Foton', 'Changan', 'GAC', 'Mercedes-Benz', 'BMW', 'Other / local brand'];
const SPORTS_BRANDS = ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Fila', 'Mizuno', 'Reebok', 'Decathlon', NB];
const FASHION_BRANDS = ['Bench', 'Penshoppe', 'Uniqlo', 'Giordano', 'Oxgn', 'Human', 'Cotton On', 'H&M', 'Zara', 'Hanes', 'Nike', 'Adidas', 'Puma', 'Fila', 'Champion', 'Under Armour', NB];
const BANKS = ['BDO', 'BPI', 'Landbank', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'RCBC', 'China Bank', 'EastWest', 'DBP', 'PSBank', 'CIMB', 'GoTyme', 'Maya', 'GCash Mastercard', 'Maybank', 'Cooperative / Rural bank'];
const MOTO_HELMET_BRANDS = ['Spyder', 'MT', 'LS2', 'HJC', 'Shoei', 'KYT', 'Index', 'Zeus', 'Andes', 'Takachi', 'Givi', 'Arai', 'AGV', 'Scorpion', 'Nolan', 'SMK', 'Bell', NB];
const PUBLISHERS = ['Rex Book Store', 'Vibal', 'Phoenix', 'Diwa', 'Abiva', 'National Book Store', 'Pearson', 'McGraw-Hill', 'Cengage', 'Oxford', 'Cambridge', 'Wiley', 'Penguin', 'HarperCollins', 'Scholastic', 'Anvil Publishing', 'Psicom', 'Precious Pages', 'Summit Books'];

// --- Models (vehicles, calculators, drones) ---------------------------------
const MOTORCYCLE_MODELS = {
    Honda: ['Click 125i', 'Click 160', 'ADV160', 'ADV 350', 'Beat', 'Genio', 'Giorno', 'Navi', 'PCX160', 'TMX 125 Alpha', 'TMX 155', 'TMX Supremo', 'XRM 125', 'Wave 125', 'RS125', 'CRF150L', 'CB150X', 'CBR150R', 'Rebel 500'],
    Yamaha: ['Mio Sporty', 'Mio i 125', 'Mio Gear', 'Mio Gravis', 'Mio Soul i 125', 'Mio Fazzio', 'Lexi 155', 'Aerox 155', 'Sniper 155', 'NMAX 155', 'XMAX 300', 'YTX 125', 'XTZ 125', 'TFX 150', 'MT-15', 'R15', 'MT-03', 'R3'],
    Suzuki: ['Raider R150 Fi', 'Raider J Crossover 115', 'Smash 115', 'Skydrive Crossover', 'Burgman Street 125', 'Access 125', 'Gixxer 150', 'Gixxer SF 150', 'GSX-R150', 'GSX-S150', 'Address 110', 'Avenis 125'],
    Kawasaki: ['Barako 175', 'CT100', 'CT150', 'Fury 125', 'Rouser NS160', 'Rouser NS200', 'Dominar 400', 'Ninja 400', 'Z400', 'Ninja 650', 'Z650', 'W175', 'KLX 150'],
    Kymco: ['Like 150i', 'Skytown 150', 'Dink S 150', 'Dollar 150', 'Xciting S 400i', 'AK550'],
    TVS: ['XL100', 'Apache RTR 160', 'Apache RTR 200'],
    'Royal Enfield': ['Classic 350', 'Meteor 350', 'Hunter 350', 'Himalayan', 'Classic 650'],
};
const TRICYCLE_MODELS = {
    Honda: ['TMX 125 Alpha', 'TMX 155', 'TMX Supremo', 'XRM 125'],
    Kawasaki: ['Barako 175', 'CT100', 'CT150'],
    Yamaha: ['YTX 125'],
    Suzuki: ['Smash 115', 'Raider J Crossover 115'],
    TVS: ['XL100'],
};
const CAR_MODELS = {
    Toyota: ['Wigo', 'Vios', 'Raize', 'Avanza', 'Veloz', 'Rush', 'Innova', 'Fortuner', 'Hilux', 'Corolla Cross', 'Corolla Altis', 'Yaris Cross', 'Hiace', 'Lite Ace', 'Camry', 'Land Cruiser'],
    Mitsubishi: ['Mirage', 'Mirage G4', 'Xpander', 'Xpander Cross', 'Montero Sport', 'Strada', 'L300', 'Outlander', 'Triton'],
    Honda: ['Brio', 'City', 'Civic', 'BR-V', 'HR-V', 'CR-V', 'Jazz', 'Accord'],
    Nissan: ['Almera', 'Terra', 'Navara', 'Kicks e-Power', 'Urvan', 'Patrol'],
    Ford: ['Ranger', 'Ranger Raptor', 'Everest', 'Territory'],
    Isuzu: ['D-Max', 'mu-X', 'Traviz', 'N-Series', 'Crosswind'],
    Suzuki: ['Dzire', 'Celerio', 'Ertiga', 'XL7', 'Jimny', 'S-Presso', 'Swift', 'Carry', 'APV'],
    Hyundai: ['Accent', 'Reina', 'Stargazer', 'Tucson', 'Creta', 'Staria', 'H-100'],
    Kia: ['Soluto', 'Stonic', 'Seltos', 'Sonet', 'Sportage', 'Carnival'],
    Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-5', 'BT-50'],
    Chevrolet: ['Spark', 'Trailblazer', 'Colorado'],
    MG: ['MG 3', 'MG 5', 'ZS', 'HS'],
    Geely: ['Coolray', 'Okavango', 'Emgrand'],
    BYD: ['Dolphin', 'Atto 3', 'Seal'],
    Foton: ['Gratour', 'Tornado', 'Thunder'],
};
const CASIO_CALCULATORS = ['fx-82ES Plus', 'fx-82MS', 'fx-82EX', 'fx-95ES Plus', 'fx-350ES Plus', 'fx-570ES Plus', 'fx-570EX', 'fx-991ES Plus', 'fx-991MS', 'fx-991EX', 'fx-115ES Plus', 'fx-CG50 (graphing)'];

// --- Spec fields reused below ----------------------------------------------
const KEY_COUNT = opt('key_count', 'Number of keys', ['1', '2', '3', '4', '5 or more']);
const KEY_COVER = opt('key_cover', 'Key head / cover', ['Plain metal (no cover)', 'Black plastic head', 'Colored plastic head', 'Rubber cover', 'Metal with a hole only']);
const KEY_TAG = opt('key_tag', 'Tag / label', ['No tag', 'Number tag', 'Name tag', 'Room / locker label']);
const KEY_RING = opt('key_ring', 'Attached to', ['Loose (no ring)', 'Plain key ring', 'Keychain / charm', 'Carabiner', 'Lanyard']);

// ============================================================================
// ITEM_RULES[category][item]
// ============================================================================
export const ITEM_RULES = {
    // ------------------------------------------------------------------ Keys
    Keys: {
        'House key': {
            brands: LOCK_BRANDS, brandLabel: 'Brand stamped on the key', noModel: true,
            traits: ['Number or letters stamped on the key', 'Rubber / plastic key cover (color)', 'Worn or bent key', 'Colored tape on the key', 'Attached to a keychain / charm', 'Spare key included'],
            places: ['Classroom', 'Guard house / Gate', 'Hallway / Corridor', 'Canteen / Cafeteria', 'Parking area'],
            attrs: [KEY_COUNT, KEY_COVER, KEY_TAG, KEY_RING],
        },
        'Boarding house / Dorm key': {
            brands: LOCK_BRANDS, brandLabel: 'Brand stamped on the key', noModel: true,
            traits: ['Room number written on it', 'Rubber / plastic key cover (color)', 'Gate key attached', 'Attached to a keychain / charm', 'Spare key included'],
            places: ['Hallway / Corridor', 'Classroom', 'Canteen / Cafeteria', 'Waiting shed', 'Guard house / Gate'],
            attrs: [KEY_COUNT, KEY_COVER, KEY_TAG, KEY_RING],
        },
        'Locker key': {
            brands: LOCK_BRANDS, brandLabel: 'Lock brand (on the key or lock)', noModel: true,
            traits: ['Locker number on the key or tag', 'Small flat / tubular key', 'Rubber ring or colored band', 'Attached to a bracelet / elastic band'],
            places: ['Locker area', 'Covered court / Gym', 'Hallway / Corridor', 'Student lounge', 'Library'],
            attrs: [KEY_COUNT, KEY_TAG, opt('key_shape', 'Key shape', ['Flat key', 'Tubular / round key', 'Combination (no key)', 'Small key with a hole'])],
        },
        'Cabinet / Drawer key': {
            brands: LOCK_BRANDS, brandLabel: 'Brand stamped on the key', noModel: true,
            traits: ['Label of the cabinet or room', 'Small flat key', 'Colored tape / tag', 'Several tiny keys together'],
            places: ['Faculty room', 'Administration building', 'Classroom', 'Registrar\'s Office', 'Library'],
            attrs: [KEY_COUNT, KEY_TAG],
        },
        'Classroom / Office key': {
            noBrand: true,
            traits: ['Room name or number on the tag', 'Department label', 'Colored tag or cover', 'Master / duplicate key marking', 'Attached to a lanyard'],
            places: ['Faculty room', 'Classroom', 'Administration building', 'Computer laboratory', 'Hallway / Corridor'],
            attrs: [KEY_COUNT, KEY_TAG, KEY_RING],
        },
        'Motorcycle key': {
            brands: MOTORCYCLE_BRANDS, brandLabel: 'Motorcycle brand', modelLabel: 'Motorcycle model', modelHint: 'e.g. Click 125i, Mio i 125, Raider R150',
            models: MOTORCYCLE_MODELS,
            traits: ['Plastic key head (color)', 'Remote / keyless fob attached', 'Plate number on the tag', 'Spare key included', 'OR/CR or license attached', 'Keychain / charm attached'],
            places: ['Parking area', 'Guard house / Gate', 'Covered court / Gym', 'Waiting shed', 'Habal-habal / Tricycle waiting area'],
            attrs: [
                opt('ignition', 'Key type', ['Standard metal key', 'Remote / keyless fob', 'Smart key (push button)']),
                opt('key_head', 'Key head', ['Black plastic head', 'Colored plastic head', 'Rubber cover', 'Metal only']),
                KEY_COUNT, KEY_RING,
            ],
        },
        'Tricycle key': {
            brands: ['Honda', 'Kawasaki', 'Yamaha', 'Suzuki', 'TVS', 'Rusi', 'Skygo', 'Motorstar', 'Kymco', 'Other / local brand'],
            brandLabel: 'Motorcycle brand (the engine)', modelLabel: 'Motorcycle model', modelHint: 'e.g. TMX 155, Barako 175',
            models: TRICYCLE_MODELS,
            traits: ['Body / franchise number on the tag', 'Plastic key head (color)', 'Spare key included', 'Keychain attached'],
            places: ['Parking area', 'Habal-habal / Tricycle waiting area', 'Guard house / Gate', 'Waiting shed', 'Covered court / Gym'],
            attrs: [opt('key_head', 'Key head', ['Black plastic head', 'Colored plastic head', 'Rubber cover', 'Metal only']), KEY_COUNT, KEY_RING],
        },
        'Car key / Remote': {
            brands: CAR_BRANDS, brandLabel: 'Car brand', modelLabel: 'Car model', modelHint: 'e.g. Vios, Xpander, Hilux',
            models: CAR_MODELS,
            traits: ['Brand logo on the fob', 'Remote buttons (lock / unlock / trunk)', 'Fob cover or leather case', 'Plate number on the tag', 'Spare key / emergency key blade inside', 'Keychain attached'],
            places: ['Parking area', 'Guard house / Gate', 'Faculty room', 'Administration building', 'Classroom'],
            attrs: [
                opt('car_key_type', 'Key type', ['Plain metal key', 'Remote key', 'Flip key', 'Smart key (push-start)']),
                opt('buttons', 'Remote buttons', ['No buttons', '2 buttons', '3 buttons', '4 or more buttons']),
                KEY_COUNT, KEY_RING,
            ],
        },
        'Padlock with key': {
            brands: LOCK_BRANDS, brandLabel: 'Padlock brand', noModel: true,
            traits: ['Brand printed on the body', 'Color of the lock (brass / silver / black)', 'Number on the key', 'Rust or scratches', 'Short or long shackle', 'Key still inside'],
            places: ['Locker area', 'Covered court / Gym', 'Hallway / Corridor', 'Parking area', 'Classroom'],
            attrs: [
                opt('lock_type', 'Lock type', ['Key padlock', 'Combination padlock', 'Cable / bike lock', 'Disc / U-lock']),
                opt('lock_size', 'Lock size', ['Small', 'Medium', 'Large']),
                KEY_COUNT,
            ],
        },
        'Bicycle / E-bike lock key': {
            brands: ['Master Lock', 'ABUS', 'Kryptonite', 'Rockbros', 'West Biking', 'Giant', 'Trek', 'Decathlon', 'Yadea', 'Niu', NB], brandLabel: 'Lock or bike brand', noModel: true,
            traits: ['Key shape (round / flat)', 'Colored plastic head', 'Number on the key', 'Spare key included'],
            places: ['Parking area', 'Guard house / Gate', 'Covered court / Gym', 'Waiting shed'],
            attrs: [KEY_COUNT, opt('key_head', 'Key head', ['Black plastic head', 'Colored plastic head', 'Metal only'])],
        },
        'Bunch of keys': {
            noBrand: true,
            traits: ['Number of keys', 'Types of keys on it (house / motorcycle / locker)', 'Keychain or charm (describe)', 'Colored key covers', 'Remote fob attached', 'ID or card attached', 'Bottle opener / small tool attached'],
            attrs: [opt('key_count', 'Number of keys', ['2', '3', '4', '5', '6', '7 or more']), KEY_RING, opt('has_remote', 'Remote / fob', ['Yes', 'No']), opt('has_vehicle_key', 'Includes a vehicle key', ['Motorcycle', 'Car', 'Both', 'No'])],
        },
        Keychain: {
            noBrand: true,
            traits: ['Character or design (describe)', 'Material (metal / rubber / plush / acrylic)', 'Name or initials on it', 'Bottle opener / flashlight', 'Photo inside', 'Bell or small accessory'],
            attrs: [opt('material', 'Material', ['Metal', 'Rubber / silicone', 'Plush / fabric', 'Acrylic / plastic', 'Leather']), opt('has_keys', 'Keys attached', ['With keys', 'No keys'])],
        },
        'Key fob / RFID access card': {
            brands: ['HID', 'ZKTeco', 'Hikvision', 'Dahua', 'Samsung', 'Yale', 'Philips', NB], brandLabel: 'Brand (if printed)', noModel: true,
            traits: ['Building / dorm name', 'Number printed on it', 'Colored plastic', 'Keychain attached'],
            places: ['Hallway / Corridor', 'Administration building', 'Guard house / Gate', 'Computer laboratory'],
            attrs: [opt('fob_type', 'Type', ['Key fob', 'Card', 'Wristband / tag']), KEY_RING],
        },
    },

    // -------------------------------------------------------- Phones & Gadgets
    'Phones & Gadgets': {
        'Phone case': {
            brands: ['Spigen', 'Ringke', 'UAG', 'OtterBox', 'Casetify', 'Rhinoshield', 'Nillkin', 'Baseus', 'Anker', 'Miniso', NB],
            brandLabel: 'Case brand', noModel: true,
            traits: ['Fits which phone model', 'Design or print (describe)', 'Card slot / flip cover', 'Ring or strap attached', 'Cracked corner', 'Sticker or photo inside'],
            attrs: [
                opt('fits_phone', 'Fits phone', ['Samsung', 'iPhone', 'Oppo', 'Vivo', 'Realme', 'Xiaomi / Redmi / Poco', 'Infinix / Tecno', 'Huawei / Honor', 'Other']),
                opt('case_type', 'Case type', ['Clear', 'Solid color', 'Printed / designed', 'Wallet / flip', 'Rugged / armor', 'Silicone', 'Leather']),
            ],
        },
        'Selfie stick / Tripod': {
            brands: ['Yunteng', 'Ulanzi', 'Baseus', 'Xiaomi', 'Joby', 'Manfrotto', 'Benro', 'Ugreen', NB], noModel: true,
            traits: ['Extendable length', 'Bluetooth remote attached', 'Bag or pouch', 'Color of the grip'],
            attrs: [opt('kind', 'Type', ['Selfie stick', 'Mini tripod', 'Full tripod', 'Ring light with tripod'])],
        },
    },

    // ---------------------------------------- Laptops & Computer Accessories
    'Laptops & Computer Accessories': {
        Webcam: { brands: ['Logitech', 'A4Tech', 'Razer', 'Elgato', 'Rapoo', 'Fantech', 'ASUS', NB], noModel: false, modelHint: 'e.g. C270, C920', models: { Logitech: ['C270', 'C505', 'C920', 'C922', 'Brio 100', 'Brio 300', 'Brio 500', 'StreamCam'] } },
        'Graphics tablet': { brands: ['Wacom', 'Huion', 'XP-Pen', 'Gaomon', 'Veikk', 'Parblo'], modelHint: 'e.g. One by Wacom, Inspiroy H640P', models: { Wacom: ['One by Wacom Small', 'One by Wacom Medium', 'Intuos Small', 'Intuos Medium', 'Cintiq 16'], Huion: ['H430P', 'H640P', 'H950P', 'Inspiroy H610 Pro', 'Kamvas 13', 'Kamvas Pro 16'], 'XP-Pen': ['Deco 01 V2', 'Deco Fun S', 'Deco 03', 'Star G640', 'Artist 12', 'Artist 15.6 Pro'] } },
        'USB hub / adapter': { brands: ['Anker', 'Ugreen', 'Baseus', 'Orico', 'Satechi', 'Targus', 'Belkin', 'HP', 'Dell', 'Apple', NB], noModel: true },
        'Laptop sleeve': { brands: ['Targus', 'Lenovo', 'HP', 'Dell', 'Acer', 'ASUS', 'Samsonite', 'Tomtoc', 'Case Logic', 'Incase', 'Miniso', NB], noModel: true },
    },

    // ------------------------------------------------------------------ Bags
    Bags: {
        Backpack: { brands: ['Jansport', 'Hawk', 'Adidas', 'Nike', 'Puma', 'Fila', 'Eastpak', 'Northface', 'Herschel', 'Samsonite', 'American Tourister', 'Targus', 'Bench', 'Penshoppe', 'Oxgn', 'Lacoste', 'Kipling', 'Under Armour', 'Deuter', 'Osprey', 'Converse', 'Sanrio', 'Miniso', NB] },
        'Sling bag': { brands: ['Bench', 'Penshoppe', 'Nike', 'Adidas', 'Puma', 'Fila', 'Herschel', 'Oxgn', 'Hawk', 'Eastpak', 'Lacoste', 'Northface', 'Miniso', NB] },
        'Shoulder bag': { brands: ['Charles & Keith', 'Pedro', 'Guess', 'Michael Kors', 'Coach', 'Kate Spade', 'Fossil', 'Longchamp', 'Kipling', 'Bench', 'Penshoppe', 'Miniso', NB] },
        Handbag: { brands: ['Charles & Keith', 'Pedro', 'Guess', 'Michael Kors', 'Coach', 'Kate Spade', 'Fossil', 'Longchamp', 'Kipling', 'Bench', 'Penshoppe', 'Miniso', NB] },
        'Tote bag': { brands: ['Miniso', 'Uniqlo', 'Muji', 'Bench', 'Penshoppe', 'Longchamp', 'Kate Spade', 'Custom / printed', NB] },
        'Drawstring bag': { brands: ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Fila', 'Penshoppe', 'Bench', 'Miniso', 'Custom / school print', NB] },
        'Laptop bag': { brands: ['Targus', 'Samsonite', 'Case Logic', 'Lenovo', 'HP', 'Dell', 'ASUS', 'Acer', 'Tomtoc', 'Hawk', 'Jansport', NB] },
        'Gym bag': { brands: ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Reebok', 'Fila', 'Mizuno', 'Decathlon', NB] },
        'Messenger bag': { brands: ['Herschel', 'Timbuk2', 'Fossil', 'Targus', 'Bench', 'Penshoppe', 'Hawk', NB] },
        'Eco bag': { brands: ['Miniso', 'Uniqlo', 'Muji', 'Custom / printed', NB], noModel: true },
        'Trolley bag': { brands: ['Samsonite', 'American Tourister', 'Delsey', 'Hawk', NB], noModel: true },
        Pouch: { brands: ['Miniso', 'Bench', 'Penshoppe', 'Hello Kitty', 'Sanrio', 'Daiso', NB] },
        'Pencil case': { brands: ['Faber-Castell', 'Sterling', 'Hello Kitty', 'Sanrio', 'Disney', 'Miniso', 'Best Buy', 'Daiso', NB] },
        'Lunch bag': { brands: ['Tupperware', 'Miniso', 'Thermos', 'Hello Kitty', 'Disney', 'Lock&Lock', NB] },
    },

    // -------------------------------------------------- Wallets, Money & Cards
    'Wallets, Money & Cards': {
        Wallet: { brands: ['Bench', 'Penshoppe', 'Nike', 'Adidas', 'Levi\'s', 'Fossil', 'Michael Kors', 'Folded & Hung', 'Fila', 'Puma', 'Hush Puppies', 'Charles & Keith', 'Pedro', 'Guess', 'Coach', NB] },
        'Coin purse': { brands: ['Miniso', 'Sanrio', 'Bench', 'Penshoppe', 'Daiso', 'Kate Spade', NB] },
        'Card holder': { brands: ['Fossil', 'Bench', 'Penshoppe', 'Michael Kors', 'Pedro', 'Charles & Keith', 'Miniso', 'Muji', NB] },
        'ATM / Debit card': { brands: BANKS, brandLabel: 'Bank', noModel: true, traits: ['Card color / design', 'Bank logo (visible side)', 'Chip or magnetic stripe', 'Bent or cracked corner', 'Inside a card holder / sleeve'], attrs: [opt('card_network', 'Card network', ['Visa', 'Mastercard', 'JCB', 'UnionPay', 'Bank-only (no network)']), opt('card_color', 'Card design', ['Blue', 'Red', 'Green', 'Gold / yellow', 'Black', 'White / silver', 'Multicolor'])] },
        'Credit card': { brands: BANKS, brandLabel: 'Bank', noModel: true, traits: ['Card color / design', 'Bank logo (visible side)', 'Contactless symbol', 'Bent corner'], attrs: [opt('card_network', 'Card network', ['Visa', 'Mastercard', 'JCB', 'American Express']), opt('card_color', 'Card design', ['Blue', 'Red', 'Green', 'Gold / yellow', 'Black', 'White / silver', 'Multicolor'])] },
        Passbook: { brands: [...BANKS, 'Coop bank / Credit union'], brandLabel: 'Bank', noModel: true },
        'Cash (money)': { noBrand: true, traits: ['Bill denominations (no exact total)', 'Folded or rolled', 'Rubber band / paper clip', 'Inside an envelope', 'Coins included'], attrs: [opt('cash_form', 'How it was kept', ['Loose bills', 'Folded bills', 'In an envelope', 'In a wallet', 'Coins only']), opt('cash_range', 'Rough amount', ['Under ₱100', '₱100–₱500', '₱500–₱1,000', '₱1,000–₱5,000', 'Over ₱5,000'], 'A range only — never the exact amount.')] },
        'Allowance envelope': { noBrand: true, traits: ['Name written on it', 'Envelope color', 'Rubber band', 'Receipts inside'] },
        'Money clip': { brands: ['Fossil', 'Montblanc', 'Bench', NB], noModel: true },
    },

    // ----------------------------------------------------- IDs & Documents
    'IDs & Documents': {},

    // ------------------------------------------------------- School Supplies
    'School Supplies': {
        'T-square': { noBrand: true },
        'Pencil case': { brands: ['Faber-Castell', 'Sterling', 'Hello Kitty', 'Sanrio', 'Disney', 'Miniso', 'Best Buy', 'Daiso', NB], noModel: true },
        'Drawing tubes / Plan holder': { brands: ['Staedtler', 'Faber-Castell', 'Joyko', NB], noModel: true },
        'Clear book / Long folder': { brands: ['Joyko', 'Best Buy', 'Sterling', 'HBW', 'Deli', 'Cambridge', NB], noModel: true },
        'Stapler / Hole puncher': { brands: ['Max', 'Kangaro', 'Deli', 'Joyko', 'Maped', 'Bostitch', NB], noModel: true },
        'Index cards / Pad paper': { brands: ['Cambridge', 'Sterling', 'Best Buy', 'Orions', 'Joyko', NB], noModel: true },
        'Scientific calculator': {
            brands: ['Casio', 'Citizen', 'Sharp', 'Texas Instruments', 'Deli', 'Joyko', 'Canon', NB], modelHint: 'e.g. fx-991ES Plus, fx-82MS',
            models: { Casio: CASIO_CALCULATORS, Citizen: ['SR-270X', 'SR-260N'], 'Texas Instruments': ['TI-30XIIS', 'TI-36X Pro', 'TI-84 Plus', 'TI-Nspire CX'] },
            traits: ['Hard slide cover (color)', 'Name written on the back', 'Sticker or label', 'Worn keys', 'Spare battery inside', 'Pouch / case'],
        },
        'Graphing calculator': { brands: ['Casio', 'Texas Instruments', 'HP', NB], models: { Casio: ['fx-CG50', 'fx-9860GII'], 'Texas Instruments': ['TI-84 Plus', 'TI-84 Plus CE', 'TI-Nspire CX'] }, attrs: [opt('cover', 'Cover', ['With slide cover', 'No cover', 'Has pouch'])] },
        'Engineering / Architect scale ruler': { brands: ['Staedtler', 'Faber-Castell', 'Maped', 'Joyko', NB], noModel: true, traits: ['Triangular or flat', 'Scale markings (1:100, 1:200…)', 'Name written on it'] },
        'Rapidograph / Technical pen set': { brands: ['Rotring', 'Staedtler', 'Faber-Castell', 'Koh-i-Noor', 'Pilot', NB], noModel: true, traits: ['Number of pens in the set', 'Case color', 'Name written on it'] },
        'Lab goggles / Face shield': { brands: ['3M', 'Uvex', 'Honeywell', NB], noModel: true, traits: ['Strap color', 'Name written on it', 'Clear / tinted lens', 'Scratches'] },
    },

    // ----------------------------------------------------- Books & Notebooks
    'Books & Notebooks': {
        'Reviewer / Module': { noBrand: true, traits: ['Subject or course name on the cover', 'Instructor / department name', 'Bound with plastic / spiral', 'Highlighted pages', 'Name written inside'] },
        Workbook: { brands: PUBLISHERS, brandLabel: 'Publisher', noModel: true },
        'Planner / Journal': { brands: ['Moleskine', 'Leuchtturm1917', 'Muji', 'Miniso', 'Sterling', 'Best Buy', 'National Book Store', 'Hobonichi', NB], noModel: true },
        Sketchpad: { brands: ['Canson', 'Strathmore', 'Fabriano', 'Faber-Castell', 'Joyko', 'Sterling', 'Best Buy', NB], noModel: true },
        'Novel / Storybook': { brands: PUBLISHERS, brandLabel: 'Publisher', noModel: true },
        Dictionary: { brands: ['Merriam-Webster', 'Oxford', 'Cambridge', 'Collins', 'Webster\'s', NB], brandLabel: 'Publisher', noModel: true },
        'Laboratory manual': { noBrand: true, traits: ['Subject / course on the cover', 'Instructor name', 'Spiral or bound', 'Filled-in pages'] },
        'Printed handouts / Papers': { noBrand: true },
        'Board exam reviewer': { brands: ['Rex Book Store', 'Vibal', 'Phoenix', 'Mc Graw-Hill', 'Wiley', 'Pearson', 'Review center handout', NB], brandLabel: 'Publisher / Review center', noModel: true, traits: ['Exam name (CE / LET / Nursing…)', 'Highlighted pages', 'Sticky tabs', 'Name written inside'] },
    },

    // ------------------------------------------------------ Uniforms & Clothing
    'Uniforms & Clothing': {
        'School uniform (polo / blouse)': { noBrand: true },
        'School uniform (pants / skirt)': { noBrand: true },
        'PE uniform (T-shirt)': { noBrand: true },
        'PE uniform (jogging pants)': { noBrand: true },
        'Jacket / Hoodie': { brands: FASHION_BRANDS.concat(['Northface']) },
        'Lab gown / Apron': { noBrand: true },
        'Organization / Department shirt': { noBrand: true },
        Jersey: { brands: ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Mizuno', 'Fila', 'Jordan', 'Custom / sublimation', NB], noModel: true },
        'Cap / Hat': { brands: ['New Era', 'Nike', 'Adidas', 'Puma', 'Fila', 'Bench', 'Penshoppe', 'Champion', 'Under Armour', 'Uniqlo', 'Cotton On', NB], noModel: true },
        'Scarf / Bandana': { brands: ['Uniqlo', 'Miniso', 'Buff', NB], noModel: true },
        'Raincoat / Poncho': { brands: ['Totes', 'Decathlon', 'Miniso', NB], noModel: true },
        'Necktie / Neckerchief': { noBrand: true },
        Belt: { brands: ['Levi\'s', 'Bench', 'Penshoppe', 'Giordano', 'Hush Puppies', 'Nike', 'Adidas', 'Fossil', 'Lacoste', NB], noModel: true },
        Socks: { brands: ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Uniqlo', 'Hanes', 'Bench', 'Fila', 'Champion', NB], noModel: true },
        Gloves: { brands: ['Nike', 'Adidas', 'Under Armour', 'Decathlon', NB], noModel: true },
        Malong: { noBrand: true, traits: ['Pattern / design (describe)', 'Main colors', 'Hand-woven or printed', 'Stitched edge'] },
    },

    // ---------------------------------------------------------------- Footwear
    Footwear: {
        'Heels / Flats': { brands: ['Charles & Keith', 'Pedro', 'Vincci', 'Aldo', 'Parisian', 'Nine West', 'Hush Puppies', 'Clarks', 'Bata', 'Payless', 'Havaianas', NB] },
        Boots: { brands: ['Timberland', 'Dr. Martens', 'Caterpillar', 'Bata', 'Clarks', 'Hush Puppies', 'Vans', 'Converse', NB] },
        'Rain boots': { brands: ['Crocs', 'Hunter', 'Bata', 'Totes', NB], noModel: true },
        'Black school shoes': { brands: ['Bata', 'Hush Puppies', 'Clarks', 'Payless', 'Parisian', NB] },
    },

    // -------------------------------------------- Water Bottles & Food Containers
    'Water Bottles & Food Containers': {
        'Water bottle / Tumbler': { brands: ['Aquaflask', 'Hydro Flask', 'Stanley', 'Owala', 'Contigo', 'Nalgene', 'Thermos', 'Tupperware', 'Lock&Lock', 'Miniso', 'Yeti', 'CamelBak', 'Decathlon', NB], noModel: true, modelHint: '' },
        'Thermos / Insulated flask': { brands: ['Thermos', 'Zojirushi', 'Tiger', 'Stanley', 'Aquaflask', 'Hydro Flask', 'Cuckoo', 'Lock&Lock', NB], noModel: true },
        'Lunch box / Baon container': { brands: ['Tupperware', 'Lock&Lock', 'Rubbermaid', 'Miniso', 'Sistema', 'Thermos', 'Zojirushi', 'Hello Kitty', 'Disney', NB], noModel: true },
        'Food container': { brands: ['Tupperware', 'Lock&Lock', 'Rubbermaid', 'Sistema', 'Pyrex', 'Miniso', 'IKEA', NB], noModel: true },
        'Drinking cup / Mug': { brands: ['Starbucks', 'Coffee Bean & Tea Leaf', 'Miniso', 'IKEA', 'Corelle', 'Tupperware', 'Stanley', NB], noModel: true },
        'Utensil set (spoon & fork)': { brands: ['Miniso', 'Tupperware', 'Lock&Lock', 'Sistema', NB], noModel: true },
        'Snack box': { brands: ['Tupperware', 'Lock&Lock', 'Miniso', NB], noModel: true },
    },

    // --------------------------------------------------- Umbrellas & Rain Gear
    'Umbrellas & Rain Gear': {
        'Umbrella (folding)': { brands: ['Totes', 'Fibrella', 'Miniso', 'Muji', 'Uniqlo', NB] },
        'Umbrella (long / stick)': { brands: ['Totes', 'Fibrella', 'Miniso', 'Muji', NB] },
        Raincoat: { brands: ['Totes', 'Decathlon', 'Miniso', NB], noModel: true },
        Poncho: { brands: ['Totes', 'Decathlon', 'Miniso', NB], noModel: true },
        'Rain boots': { brands: ['Crocs', 'Hunter', 'Bata', 'Totes', NB], noModel: true },
        'Waterproof bag cover': { brands: ['Decathlon', 'Hawk', 'Jansport', 'Deuter', NB], noModel: true },
    },

    // ---------------------------------------------------- Accessories & Jewelry
    'Accessories & Jewelry': {
        'Eyeglasses case': { brands: ['Ray-Ban', 'Oakley', 'Owndays', 'Eyemaster', 'Optical Center', 'Miniso', NB], noModel: true },
        Bracelet: { brands: ['Pandora', 'Swarovski', 'Daniel Wellington', 'Fossil', 'Miniso', 'Bench', 'Penshoppe', 'Handmade / Local', NB], noModel: true },
        Necklace: { brands: ['Pandora', 'Swarovski', 'Daniel Wellington', 'Fossil', 'Miniso', 'Bench', 'Penshoppe', 'Handmade / Local', NB], noModel: true },
        Ring: { brands: ['Pandora', 'Swarovski', 'Daniel Wellington', 'Fossil', 'Miniso', 'Handmade / Local', NB], noModel: true },
        Earrings: { brands: ['Pandora', 'Swarovski', 'Miniso', 'Bench', 'Penshoppe', 'Handmade / Local', NB], noModel: true },
        'Hair clip / Hair tie / Headband': { brands: ['Miniso', 'Daiso', 'Scunci', 'Bench', NB], noModel: true },
        Handkerchief: { brands: ['Uniqlo', 'Bench', 'Miniso', 'Muji', NB], noModel: true },
        Lanyard: { noBrand: true, traits: ['School / event name printed', 'Color', 'ID holder attached', 'Clip or hook type'] },
        'Pin / Brooch': { noBrand: true },
        'Retainer / Dental device': { noBrand: true, traits: ['Color of the case', 'Upper or lower', 'Wire or clear plastic', 'Name written on the case'] },
    },

    // ----------------------------------------------------------- Sports & PE Gear
    'Sports & PE Gear': {
        'Shuttlecock set': { brands: ['Yonex', 'Li-Ning', 'Victor', 'Apacs', 'Carlton', 'Decathlon', NB], noModel: true },
        'Table tennis paddle': { brands: ['Butterfly', 'DHS', 'Stiga', 'Joola', 'Yasaka', 'Nittaku', 'Decathlon', NB], noModel: true },
        'Pickleball paddle': { brands: ['Selkirk', 'Joola', 'Paddletek', 'Franklin', 'Head', 'Onix', 'Decathlon', NB], noModel: true, traits: ['Paddle color / design', 'Grip tape color', 'Name written on it', 'Cover included'] },
        'Football / Soccer ball': { brands: ['Adidas', 'Nike', 'Puma', 'Mikasa', 'Molten', 'Select', 'Umbro', 'Decathlon', NB], noModel: true },
        'Jump rope': { brands: ['Nike', 'Adidas', 'Decathlon', 'Everlast', 'Fila', 'Puma', NB], noModel: true },
        'Yoga mat': { brands: ['Decathlon', 'Nike', 'Adidas', 'Manduka', 'Gaiam', 'Liforme', 'Reebok', NB], noModel: true },
        'Shin guards': { brands: ['Nike', 'Adidas', 'Puma', 'Mitre', 'Select', 'Decathlon', NB], noModel: true },
        'Knee / Ankle support': { brands: ['McDavid', 'Mueller', 'Nike', 'Adidas', 'Under Armour', 'Mizuno', 'Decathlon', NB], noModel: true },
        'Sports jersey set': { brands: ['Nike', 'Adidas', 'Puma', 'Under Armour', 'Mizuno', 'Fila', 'Custom / sublimation', NB], noModel: true },
        Whistle: { brands: ['Fox 40', 'Acme', 'Molten', 'Decathlon', NB], noModel: true },
        'Dumbbell / Gym gear': { brands: ['Decathlon', 'Everlast', 'Gold\'s Gym', 'Bowflex', 'Adidas', 'Nike', NB], noModel: true },
        'Swimwear / Goggles': { brands: ['Speedo', 'Arena', 'Decathlon', 'TYR', 'Nike', 'Adidas', 'Zoggs', NB], noModel: true },
    },

    // ------------------------------------------------ Personal Care & Medical
    'Personal Care & Medical': {
        'Towel / Face towel': { brands: ['Uniqlo', 'Miniso', 'Bench', 'Muji', 'Nike', 'Adidas', 'Decathlon', NB], noModel: true },
        'Makeup pouch': { brands: ['Miniso', 'Daiso', 'Bench', 'Penshoppe', 'Sanrio', NB], noModel: true },
        'Perfume / Cologne': { brands: ['Bench', 'Penshoppe', 'Zara', 'Calvin Klein', 'Victoria\'s Secret', 'Bath & Body Works', 'Avon', 'Pabango (refill / unbranded)', NB], noModel: true },
        'Lotion / Sunscreen': { brands: ['Nivea', 'Vaseline', 'Dove', 'Cetaphil', 'Eucerin', 'Neutrogena', 'Banana Boat', 'Skin Aqua', 'Biore', 'Olay', 'Garnier', 'Careline', 'Belo', 'Silka', 'Block & White', 'Watsons', 'Johnson\'s', NB], noModel: true },
        'Comb / Hairbrush': { brands: ['Tangle Teezer', 'Wet Brush', 'Conair', 'Miniso', 'Daiso', 'Watsons', NB], noModel: true },
        'Alcohol / Sanitizer bottle': { brands: ['Green Cross', 'Dettol', 'Lysol', 'Purell', 'Safeguard', 'Watsons', NB], noModel: true },
        'Face mask case': { brands: ['Miniso', 'Daiso', NB], noModel: true },
        Inhaler: { brands: ['Ventolin', 'Combivent', 'Symbicort', 'Seretide', 'Berodual', NB], brandLabel: 'Brand (on the label)', noModel: true },
        'Medicine / Vitamins': { brands: ['Biogesic', 'Medicol', 'Neozep', 'Bioflu', 'Enervon', 'Centrum', 'Berocca', 'Cecon', 'Poten-Cee', 'Ceelin', 'Watsons', 'Generic / Prescription', NB], brandLabel: 'Brand (on the label)', noModel: true },
        'Toothbrush kit': { brands: ['Colgate', 'Oral-B', 'Hapee', 'Close-Up', 'Sensodyne', 'Listerine', 'Miniso', NB], noModel: true },
        'Menstrual kit': { brands: ['Modess', 'Whisper', 'Sofy', 'Laurier', 'Kotex', 'Carefree', NB], noModel: true },
        'Facial wipes / Tissue pouch': { brands: ['Kleenex', 'Wet Ones', 'Nivea', 'Watsons', 'Miniso', 'Muji', NB], noModel: true },
        'Contact lens case': { brands: ['Bausch + Lomb', 'Acuvue', 'Air Optix', 'Biotrue', 'Opti-Free', 'Miniso', NB], noModel: true },
        'Hijab / Veil': { noBrand: true, traits: ['Color and pattern', 'Fabric (chiffon / cotton / jersey)', 'Pin or brooch attached', 'Inner cap included'] },
    },

    // ------------------------------------------------- Gaming & Entertainment
    'Gaming & Entertainment': {
        'Game cartridge / disc': { brands: ['Nintendo', 'PlayStation', 'Xbox'], brandLabel: 'Platform', noModel: true, traits: ['Game title (visible on the label)', 'Case color', 'Name written on it', 'Scratches'] },
        'Trading cards': { brands: ['Pokemon', 'Yu-Gi-Oh!', 'Magic: The Gathering', 'One Piece', 'Digimon', 'Cardfight!! Vanguard', 'Panini', 'Topps', 'Match Attax'], brandLabel: 'Card game', noModel: true, traits: ['Deck box color', 'Sleeves color', 'Binder / album', 'Name written on the box', 'Rare / holo cards'] },
        'Board game / Cards': { brands: ['Uno (Mattel)', 'Mattel', 'Hasbro', 'Bicycle', 'Exploding Kittens', 'Ravensburger', 'Handmade / Local', NB], noModel: true },
        'Fidget / Rubik\'s cube': { brands: ['Rubik\'s', 'GAN', 'MoYu', 'QiYi', 'YJ', 'Dayan', 'Miniso', NB], noModel: true },
        Drone: { brands: ['DJI', 'Holy Stone', 'Potensic', 'Syma', 'Parrot', 'Autel', 'Hubsan', NB], modelHint: 'e.g. Mini 3, Tello', models: { DJI: ['Mini 2', 'Mini 2 SE', 'Mini 3', 'Mini 3 Pro', 'Mini 4 Pro', 'Air 2S', 'Air 3', 'Mavic 3', 'Neo', 'Avata 2', 'Flip', 'Tello'] }, attrs: [opt('with_remote', 'Controller', ['Drone only', 'Drone + controller', 'Controller only']), opt('with_bag', 'Carry bag', ['With case / bag', 'No case'])] },
    },

    // ----------------------------------------------- Helmets & Riding Gear
    'Helmets & Riding Gear': {
        'Motorcycle helmet': {
            brands: MOTO_HELMET_BRANDS, modelHint: 'e.g. MT Thunder, LS2 Rapid',
            attrs: [opt('size', 'Size', ['S', 'M', 'L', 'XL', 'Free size']), opt('style', 'Style', ['Half face', 'Full face', 'Open face / 3-4', 'Modular / flip-up']), opt('visor', 'Visor', ['Clear', 'Tinted / smoked', 'Mirror / iridium', 'Dual visor', 'No visor'])],
        },
        'Bicycle helmet': {
            brands: ['Giro', 'Bell', 'Specialized', 'Trek', 'Rockbros', 'West Biking', 'Decathlon', 'Lazer', 'Cannondale', 'Oakley', NB], noModel: true,
            traits: ['Sticker or decal on it', 'Name written inside', 'Visor (detachable)', 'Light attached', 'Chin strap color'],
            attrs: [opt('size', 'Size', ['S', 'M', 'L', 'Free size']), opt('style', 'Style', ['Road', 'Mountain (MTB)', 'Urban / Commuter', 'Kids'])],
        },
        'Riding gloves': { brands: ['Alpinestars', 'Dainese', 'Komine', 'Rev\'it', 'Rockbros', 'Scoyco', 'Spyder', 'Fox', 'Decathlon', NB], noModel: true, attrs: [opt('size', 'Size', ['S', 'M', 'L', 'XL']), opt('finger', 'Fingers', ['Full finger', 'Half finger'])] },
        'Face shield / Visor': { brands: ['Shoei', 'HJC', 'LS2', 'KYT', 'Index', 'Spyder', 'Zeus', 'MT', 'Universal', NB], brandLabel: 'Helmet brand it fits', noModel: true, attrs: [opt('lens', 'Lens', ['Clear', 'Tinted / smoked', 'Mirror / iridium', 'Photochromic'])] },
        'Riding jacket': { brands: ['Alpinestars', 'Dainese', 'Komine', 'Spyder', 'Scoyco', 'Rev\'it', 'Decathlon', 'Givi', NB], noModel: true, attrs: [opt('size', 'Size', SHIRT_SIZES), opt('kind', 'Type', ['Mesh', 'Leather', 'Textile / waterproof', 'Reflective vest'])] },
        'Face mask / Balaclava': { brands: ['Buff', 'Rockbros', 'Decathlon', 'Nike', 'Under Armour', NB], noModel: true },
        'Phone holder (bike/motor)': { brands: ['Quad Lock', 'Givi', 'Rockbros', 'Baseus', 'Ugreen', 'Spigen', 'RAM Mounts', NB], noModel: true, attrs: [opt('mount', 'Mount type', ['Handlebar', 'Mirror mount', 'Dashboard', 'Helmet'])] },
    },

    // ----------------------------------------------------------------- Other
    Other: {
        'Toy / Plush': { brands: ['Sanrio', 'Disney', 'San-X', 'Squishmallows', 'Build-A-Bear', 'Miniso', 'Pokemon', 'Jellycat', NB], noModel: true },
        'Musical instrument': { brands: ['Yamaha', 'Fender', 'Ibanez', 'Epiphone', 'Cort', 'Squier', 'Gibson', 'Takamine', 'Kala', 'Lanikai', 'Casio', 'Roland', 'Korg', 'Kawai', 'Pearl', 'Mapex', 'Zildjian', 'Local / handmade', NB], attrs: [opt('kind', 'Instrument', ['Guitar', 'Ukulele', 'Keyboard', 'Violin', 'Flute / Recorder', 'Drumsticks / Percussion', 'Kulintang / Native instrument', 'Other'])] },
        'Musical instrument case': { brands: ['Yamaha', 'Fender', 'Gator', 'Ibanez', 'Epiphone', 'SKB', 'Cort', NB], noModel: true },
        'Art / Project in progress': { noBrand: true, traits: ['Subject / course', 'Group or student name on it', 'Size', 'Materials used (cardboard / canvas / wood)'] },
        'Tool / Equipment': { brands: ['Stanley', 'Bosch', 'Makita', 'DeWalt', 'Black+Decker', 'Total', 'Ingco', 'Fluke', 'UNI-T', 'Topcon', 'Sokkia', 'Leica', NB] },
        'Gift item': { noBrand: true },
        'Package / Parcel': { brands: ['J&T Express', 'LBC', 'SPX Express (Shopee)', 'Flash Express', 'Ninja Van', 'JRS Express', '2GO', 'Lazada Express (LEX)', 'Entrego', 'Grab / Lalamove rider'], brandLabel: 'Courier', noModel: true, traits: ['Waybill / tracking sticker (don\'t type the number)', 'Box or plastic mailer', 'Size (small / medium / large)', 'Name on the label (initials only)'] },
        'Unknown item': { noBrand: true },
    },
};

// Items to add to a category's item list (kept separate so the original lists stay readable).
export const EXTRA_ITEMS = {
    Keys: ['Boarding house / Dorm key', 'Tricycle key', 'Cabinet / Drawer key', 'Bicycle / E-bike lock key', 'Key fob / RFID access card'],
    'Wallets, Money & Cards': ['Credit card'],
    'IDs & Documents': ['PWD ID', 'Senior Citizen ID', 'PRC ID', 'TIN ID', 'Postal ID', 'SSS / GSIS ID', 'PhilHealth ID', 'Library card', 'Exam permit', 'Student discount card'],
    'School Supplies': ['Graphing calculator', 'Engineering / Architect scale ruler', 'Rapidograph / Technical pen set', 'Lab goggles / Face shield'],
    'Books & Notebooks': ['Board exam reviewer'],
    'Uniforms & Clothing': ['Malong'],
    'Sports & PE Gear': ['Pickleball paddle'],
};
