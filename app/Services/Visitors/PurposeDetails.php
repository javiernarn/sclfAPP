<?php

namespace App\Services\Visitors;

use App\Models\Visitor;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The extra questions the front desk must answer for each purpose of visit.
 *
 * This is the single source of truth: the check-in form is built from
 * definitions() (served by GET /api/visitors/purpose-fields), and validate()
 * enforces the same rules on the server, so a visitor with missing details is
 * refused even if someone bypasses the form.
 *
 * Field types: text, textarea, select (options = value => label), number,
 * boolean (a confirmation tick; when required it must be ticked).
 */
class PurposeDetails
{
    /** Same cut-off the visitors page uses to flag someone who stayed long. */
    public const OVERDUE_HOURS = 4;

    /** How long the visitor said they would stay (value => [label, minutes]). */
    public const DURATIONS = [
        'under_30' => ['Under 30 minutes', 30],
        'to_1h' => ['30 minutes – 1 hour', 60],
        'to_2h' => ['1 – 2 hours', 120],
        'half_day' => ['Half day (up to 4 hours)', 240],
        'whole_day' => ['Whole day (up to 9 hours)', 540],
    ];

    /** Extra minutes allowed past the stated stay before a visitor is flagged. */
    public const GRACE_MINUTES = 15;

    private static function durationField(): array
    {
        return ['label' => 'Expected length of stay', 'type' => 'select', 'required' => true,
            'options' => array_map(fn ($d) => $d[0], self::DURATIONS)];
    }

    /** Minutes allowed for this visit (stated stay + grace), or the default cut-off. */
    public static function allowedMinutes(?array $details): int
    {
        $key = $details['expected_duration'] ?? null;

        return isset(self::DURATIONS[$key])
            ? self::DURATIONS[$key][1] + self::GRACE_MINUTES
            : self::OVERDUE_HOURS * 60;
    }

    /** @return array<string,array{label:string,requires_host:bool,host_label:string,fields:array}> */
    public static function schema(): array
    {
        return [
            Visitor::PURPOSE_MEETING => [
                'label' => 'Meeting',
                'requires_host' => true,
                'host_label' => 'Person to meet',
                'fields' => [
                    'meeting_type' => ['label' => 'Kind of meeting', 'type' => 'select', 'required' => true, 'options' => [
                        'official' => 'Official / administrative', 'faculty' => 'Faculty or department',
                        'student_concern' => 'Student concern', 'parent_teacher' => 'Parent–teacher conference',
                        'business' => 'Business / vendor / partnership', 'procurement' => 'Procurement / contract / bidding',
                        'legal' => 'Legal / notarial', 'hr' => 'HR / employment', 'alumni' => 'Alumni affairs',
                        'organization' => 'Student organization / outside organization', 'government' => 'Government / inspection',
                        'other' => 'Other',
                    ]],
                    'appointment' => ['label' => 'Appointment', 'type' => 'select', 'required' => true, 'options' => [
                        'scheduled' => 'Scheduled appointment', 'walk_in' => 'Walk-in (no appointment)',
                    ]],
                    'agenda' => ['label' => 'What is the meeting about?', 'type' => 'textarea', 'required' => true,
                        'placeholder' => 'Short description of the agenda'],
                    'expected_duration' => self::durationField(),
                    'companions' => ['label' => 'Number of companions with the visitor', 'type' => 'number', 'required' => false, 'max' => 100],
                    'host_confirmed' => ['label' => 'The person to meet confirmed they will receive this visitor', 'type' => 'boolean', 'required' => true],
                ],
            ],

            Visitor::PURPOSE_DELIVERY => [
                'label' => 'Delivery',
                'requires_host' => false,
                'host_label' => 'Person / office receiving',
                'fields' => [
                    'company' => ['label' => 'Courier / supplier company', 'type' => 'text', 'required' => true],
                    'delivery_type' => ['label' => 'Kind of delivery', 'type' => 'select', 'required' => true, 'options' => [
                        'parcel' => 'Parcel / package', 'documents' => 'Documents / mail', 'food' => 'Food / catering',
                        'water' => 'Water / gallons', 'supplies' => 'Office or school supplies',
                        'books' => 'Books / printed materials', 'electronics' => 'Electronics / IT equipment',
                        'lab' => 'Laboratory / science supplies', 'cleaning' => 'Cleaning / janitorial supplies',
                        'medical' => 'Medicine / medical supplies', 'equipment' => 'Equipment / furniture',
                        'materials' => 'Construction materials', 'uniforms' => 'Uniforms / merchandise',
                        'other' => 'Other',
                    ]],
                    'items' => ['label' => 'Items being delivered', 'type' => 'textarea', 'required' => true,
                        'placeholder' => 'What exactly, e.g. bond paper, short, 5 reams'],
                    'quantity' => ['label' => 'Number of packages / items', 'type' => 'number', 'required' => true, 'max' => 10000],
                    'recipient' => ['label' => 'Recipient (person or office)', 'type' => 'text', 'required' => true],
                    'vehicle_type' => ['label' => 'How it arrived', 'type' => 'select', 'required' => false, 'options' => [
                        'on_foot' => 'On foot', 'motorcycle' => 'Motorcycle', 'car' => 'Car / van', 'truck' => 'Truck',
                    ]],
                    'vehicle_plate' => ['label' => 'Vehicle plate number', 'type' => 'text', 'required' => false],
                    'reference' => ['label' => 'Waybill / receipt / PO number', 'type' => 'text', 'required' => false],
                    'inspected' => ['label' => 'The items were inspected at the gate', 'type' => 'boolean', 'required' => true],
                    'recipient_confirmed' => ['label' => 'The recipient confirmed they are expecting this delivery', 'type' => 'boolean', 'required' => true],
                ],
            ],

            Visitor::PURPOSE_EVENT => [
                'label' => 'Event',
                'requires_host' => false,
                'host_label' => 'Contact person',
                'fields' => [
                    'event_name' => ['label' => 'Event name', 'type' => 'text', 'required' => true],
                    'event_type' => ['label' => 'Kind of event', 'type' => 'select', 'required' => true, 'options' => [
                        'seminar' => 'Seminar / training', 'ceremony' => 'Graduation / ceremony', 'sports' => 'Sports / competition',
                        'exhibit' => 'Exhibit / fair', 'orientation' => 'Orientation / enrollment', 'assembly' => 'Assembly / general meeting',
                        'outreach' => 'Outreach / medical mission', 'alumni' => 'Alumni homecoming', 'cultural' => 'Cultural / performance',
                        'other' => 'Other',
                    ]],
                    'organizer' => ['label' => 'Organizer / office in charge', 'type' => 'text', 'required' => true],
                    'approved_by' => ['label' => 'Event approved by (school official)', 'type' => 'text', 'required' => true],
                    'permit_ref' => ['label' => 'Permit / approval reference number', 'type' => 'text', 'required' => false],
                    'venue' => ['label' => 'Venue inside the campus', 'type' => 'text', 'required' => true],
                    'expected_duration' => self::durationField(),
                    'group_size' => ['label' => 'Number of people in the group', 'type' => 'number', 'required' => false, 'max' => 5000],
                ],
            ],

            Visitor::PURPOSE_INTERVIEW => [
                'label' => 'Interview',
                'requires_host' => true,
                'host_label' => 'Interviewer / person to see',
                'fields' => [
                    'interview_type' => ['label' => 'Kind of interview', 'type' => 'select', 'required' => true, 'options' => [
                        'job' => 'Job applicant', 'scholarship' => 'Scholarship', 'admission' => 'Admission / entrance',
                        'ojt' => 'Practicum / OJT', 'media' => 'Media / press', 'research' => 'Research / survey',
                        'audit' => 'Audit / accreditation', 'other' => 'Other',
                    ]],
                    'subject' => ['label' => 'Position / program / topic', 'type' => 'text', 'required' => true],
                    'schedule_ref' => ['label' => 'Appointment or reference number', 'type' => 'text', 'required' => false],
                    'expected_duration' => self::durationField(),
                    'host_confirmed' => ['label' => 'The interviewer confirmed this visitor is expected', 'type' => 'boolean', 'required' => true],
                ],
            ],

            Visitor::PURPOSE_MAINTENANCE => [
                'label' => 'Maintenance',
                'requires_host' => false,
                'host_label' => 'Office / contact person',
                'fields' => [
                    'company' => ['label' => 'Company / contractor', 'type' => 'text', 'required' => true],
                    'work_type' => ['label' => 'Kind of work', 'type' => 'select', 'required' => true, 'options' => [
                        'electrical' => 'Electrical', 'plumbing' => 'Plumbing / water supply', 'aircon' => 'Aircon / HVAC',
                        'it' => 'IT / network / telecom', 'cctv' => 'CCTV / security system', 'fire' => 'Fire safety / extinguishers',
                        'welding' => 'Welding / metalwork', 'painting' => 'Painting', 'roofing' => 'Roofing / ceiling',
                        'construction' => 'Construction / repair', 'generator' => 'Generator / power',
                        'grounds' => 'Landscaping / grounds', 'pest' => 'Pest control', 'cleaning' => 'Cleaning / janitorial',
                        'equipment' => 'Elevator / equipment', 'other' => 'Other',
                    ]],
                    'work_location' => ['label' => 'Where inside the campus', 'type' => 'text', 'required' => true],
                    'work_order' => ['label' => 'Work order / authorization number', 'type' => 'text', 'required' => true],
                    'authorized_by' => ['label' => 'Authorized by (school official)', 'type' => 'text', 'required' => true],
                    'hazard' => ['label' => 'Special hazard', 'type' => 'select', 'required' => true, 'options' => [
                        'none' => 'No special hazard', 'hot_work' => 'Hot work (welding / cutting)', 'height' => 'Work at height',
                        'live_electrical' => 'Live electrical work', 'chemicals' => 'Chemicals / fumes', 'heavy' => 'Heavy equipment',
                    ]],
                    'workers' => ['label' => 'Number of workers', 'type' => 'number', 'required' => true, 'max' => 200],
                    'worker_names' => ['label' => 'Names of all workers', 'type' => 'textarea', 'required' => true,
                        'placeholder' => 'One name per line'],
                    'tools' => ['label' => 'Tools / equipment brought in', 'type' => 'text', 'required' => true],
                    'expected_duration' => self::durationField(),
                    'ids_recorded' => ['label' => 'A valid ID of every worker was checked and recorded', 'type' => 'boolean', 'required' => true],
                ],
            ],

            Visitor::PURPOSE_PARENT_VISIT => [
                'label' => 'Parent / Guardian visit',
                'requires_host' => false,
                'host_label' => 'Teacher / office to see',
                'fields' => [
                    'reason' => ['label' => 'Reason for the visit', 'type' => 'select', 'required' => true, 'options' => [
                        'adviser' => 'Meet adviser / teacher', 'documents' => 'Submit or request documents',
                        'payment' => 'Registrar / cashier', 'enrollment' => 'Enrollment / admission inquiry',
                        'scholarship' => 'Scholarship / financial aid', 'guidance' => 'Guidance / discipline matter',
                        'program' => 'Attend school program / event', 'items' => 'Drop off items / allowance',
                        'pickup' => 'Pick up / drop off', 'clinic' => 'Clinic', 'conference' => 'Attend conference',
                        'medical' => 'Medical / emergency', 'other' => 'Other',
                    ]],
                    'expected_duration' => self::durationField(),
                    'relationship_verified' => ['label' => 'The relationship to the student was checked against a valid ID', 'type' => 'boolean', 'required' => true],
                ],
            ],

            Visitor::PURPOSE_OTHER => [
                'label' => 'Other',
                'requires_host' => false,
                'host_label' => 'Host / person visiting',
                'fields' => [
                    'details' => ['label' => 'Describe the purpose of the visit', 'type' => 'textarea', 'required' => true],
                    'authorized_by' => ['label' => 'Who authorized this visit?', 'type' => 'text', 'required' => true],
                    'expected_duration' => self::durationField(),
                ],
            ],
        ];
    }

    /**
     * Details safe to show on the public visitor page (anyone who opens the
     * badge QR and says "this is me" sees them). Names of workers, plate
     * numbers, reference / work-order numbers and the agenda stay private.
     */
    private const PUBLIC_KEYS = [
        'meeting_type', 'appointment', 'delivery_type', 'recipient', 'event_name', 'event_type', 'venue',
        'interview_type', 'work_type', 'work_location', 'hazard', 'reason', 'expected_duration',
    ];

    /** @return array<int,array{key:string,label:string,value:string}> */
    public static function publicRows(string $purpose, ?array $details): array
    {
        $fields = self::schema()[$purpose]['fields'] ?? [];
        $rows = [];
        foreach (self::PUBLIC_KEYS as $key) {
            if (! isset($fields[$key], $details[$key])) {
                continue;
            }
            $f = $fields[$key];
            $rows[] = [
                'key' => $key,
                'label' => $f['label'],
                'value' => $f['type'] === 'select' ? ($f['options'][$details[$key]] ?? (string) $details[$key]) : (string) $details[$key],
            ];
        }

        return $rows;
    }

    public static function purposeLabel(string $purpose): string
    {
        return self::schema()[$purpose]['label'] ?? ucfirst(str_replace('_', ' ', $purpose));
    }

    public static function durationLabel(?array $details): ?string
    {
        $key = $details['expected_duration'] ?? null;

        return isset(self::DURATIONS[$key]) ? self::DURATIONS[$key][0] : null;
    }

    /** Minutes the visitor said they would stay (without the grace), or null. */
    public static function statedMinutes(?array $details): ?int
    {
        $key = $details['expected_duration'] ?? null;

        return isset(self::DURATIONS[$key]) ? self::DURATIONS[$key][1] : null;
    }

    /**
     * What the visitor should do next, written for them, based on why they
     * came. Shown on the welcome page after they confirm "this is me".
     *
     * @return string[]
     */
    public static function guidance(string $purpose, ?array $details, ?string $host, ?string $department): array
    {
        $d = $details ?? [];
        $office = $department ?: 'their office';
        $who = $host ?: 'your host';
        $fields = self::schema()[$purpose]['fields'] ?? [];
        $opt = fn (string $key) => isset($d[$key]) ? ($fields[$key]['options'][$d[$key]] ?? $d[$key]) : null;

        $lines = match ($purpose) {
            Visitor::PURPOSE_MEETING => [
                "Please proceed to {$office} and wait to be received by {$who}. Your host has been told you are here.",
                'Stay in the areas related to your meeting. If you need directions, ask any Security Officer.',
            ],
            Visitor::PURPOSE_DELIVERY => [
                'Bring your delivery only to ' . ($d['recipient'] ?? $who) . '. Please do not leave items unattended anywhere on campus.',
                'Your items were checked at the gate. Please do not carry anything else in or out with them.',
            ],
            Visitor::PURPOSE_EVENT => [
                'Please go straight to ' . ($d['venue'] ?? 'the event venue') . ($d['event_name'] ?? null ? " for {$d['event_name']}" : '') . ' and stay within the event area.',
                'Follow the instructions of the event organizers and Security Officers.',
            ],
            Visitor::PURPOSE_INTERVIEW => [
                "Please report to {$office} and ask for {$who}. Keep your valid ID and your documents with you.",
                'Wait to be called. If you are running late or cannot stay, tell the nearest Security Officer.',
            ],
            Visitor::PURPOSE_MAINTENANCE => array_values(array_filter([
                'Work only at ' . ($d['work_location'] ?? 'the authorized work area') . '. Do not enter other areas without permission.',
                ($d['hazard'] ?? 'none') !== 'none' ? 'Special hazard: ' . $opt('hazard') . '. Follow safety rules and keep students and staff away from the work area.' : null,
                'Every worker must wear a visible badge. Tools and equipment brought in will be checked when you leave.',
            ])),
            Visitor::PURPOSE_PARENT_VISIT => [
                "Please go to {$office}" . ($host ? " and ask for {$host}" : '') . '. Your relationship to the student was checked at the gate.',
                'Students are released only after the school has verified the request. For any emergency, tell a Security Officer right away.',
            ],
            default => [
                "Please go to {$office} for your visit, and stay only in the areas related to it.",
            ],
        };

        $lines[] = 'When you are done, return this badge to Security before you leave the campus. Do not give it to anyone else.';

        return $lines;
    }

    /** Shape sent to the front end (fields as an ordered list). */
    public static function definitions(): array
    {
        $out = [];
        foreach (self::schema() as $value => $def) {
            $fields = [];
            foreach ($def['fields'] as $key => $f) {
                $fields[] = ['key' => $key] + $f;
            }
            $out[] = [
                'value' => $value,
                'label' => $def['label'],
                'requires_host' => $def['requires_host'],
                'host_label' => $def['host_label'],
                'fields' => $fields,
            ];
        }

        return $out;
    }

    /**
     * Check the details for one purpose and return only the known, cleaned
     * values. Throws a ValidationException (errors keyed purpose_details.*)
     * when anything required is missing or invalid.
     */
    public static function validate(string $purpose, ?array $input, ?string $hostName = null): array
    {
        $def = self::schema()[$purpose] ?? null;
        if (! $def) {
            throw ValidationException::withMessages(['purpose' => 'Invalid visit purpose.']);
        }

        $rules = [];
        $names = [];
        foreach ($def['fields'] as $key => $f) {
            $rule = [$f['required'] ? 'required' : 'nullable'];
            switch ($f['type']) {
                case 'select':
                    $rule[] = Rule::in(array_keys($f['options']));
                    break;
                case 'number':
                    array_push($rule, 'integer', 'min:1', 'max:' . ($f['max'] ?? 1000));
                    break;
                case 'boolean':
                    $rule[] = $f['required'] ? 'accepted' : 'boolean';
                    break;
                case 'textarea':
                    array_push($rule, 'string', 'max:500');
                    break;
                default:
                    array_push($rule, 'string', 'max:150');
            }
            $rules[$key] = $rule;
            $names[$key] = $f['label'];
        }

        $validator = Validator::make($input ?? [], $rules, [
            'required' => 'Fill in: :attribute.',
            'accepted' => 'Please confirm: :attribute.',
            'in' => 'Choose a valid option for: :attribute.',
        ], $names);

        $errors = [];
        foreach ($validator->errors()->messages() as $key => $messages) {
            $errors["purpose_details.{$key}"] = $messages;
        }
        if ($def['requires_host'] && trim((string) $hostName) === '') {
            $errors['host_name'] = ["Enter the {$def['host_label']}."];
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $clean = [];
        foreach ($def['fields'] as $key => $f) {
            $value = $validator->validated()[$key] ?? null;
            if ($value === null || $value === '' || $value === false) {
                continue;
            }
            $clean[$key] = match ($f['type']) {
                'number' => (int) $value,
                'boolean' => true,
                default => trim((string) $value),
            };
        }

        return $clean;
    }
}
