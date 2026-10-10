// Valid identification documents commonly accepted at front desks in the
// Philippines, grouped the way people think about them. The visitor log
// stores the chosen label as plain text (id_presented), so adding or
// renaming an entry here never needs a migration. "Other" is handled by
// the select itself (it reveals a free-text box).
export const OTHER_ID_VALUE = '__other__';

export const PH_ID_GROUPS = [
    {
        label: 'Government-issued (primary)',
        ids: [
            'Philippine National ID (PhilSys)',
            'ePhilID (PhilSys digital ID)',
            'Philippine Passport',
            "Driver's License (LTO)",
            'UMID',
            'SSS ID',
            'GSIS ID',
            'PRC ID (Professional Regulation Commission)',
            "Voter's ID / Voter's Certification (COMELEC)",
            'Postal ID (PHLPost)',
            'PhilHealth ID',
            'TIN ID (BIR)',
        ],
    },
    {
        label: 'Special / sectoral IDs',
        ids: [
            'Senior Citizen ID',
            'PWD ID',
            'Solo Parent ID',
            'OFW ID / iDOLE (DMW)',
            'IBP ID (Integrated Bar of the Philippines)',
            'Firearms License (PNP)',
            'Barangay ID / Barangay Clearance',
        ],
    },
    {
        label: 'Clearances',
        ids: ['NBI Clearance', 'Police Clearance'],
    },
    {
        label: 'School / work',
        ids: ['School ID', 'Company / Employee ID'],
    },
];

export const PH_ID_OPTIONS = PH_ID_GROUPS.flatMap((g) => g.ids);
