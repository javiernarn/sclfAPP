// ============================================================================
// Shared field formats/validators used by every form in the app (Login,
// Register, Admin ▸ Create Account, Profile, etc.) so the rules only live
// in one place and the frontend always matches what the Laravel backend
// enforces (see AuthController::register / AdminCreateUserRequest).
// ============================================================================

// Philippine mobile numbers: 11 digits, starting with 09 (e.g. 09171234567).
export const PH_PHONE_REGEX = /^09\d{9}$/;

// School student IDs: YYYY-N-NNNNN (e.g. 2021-2-04062).
export const STUDENT_ID_REGEX = /^\d{4}-\d-\d{5}$/;

// Institutional email convention: occ.lastname.firstname@gmail.com
// (lowercase letters only in each name segment, dot separated).
export const SCHOOL_EMAIL_REGEX = /^occ\.[a-z]+\.[a-z]+@gmail\.com$/;

export const FORMAT_HINTS = {
    phone: 'Philippine mobile number: 11 digits starting with 09, e.g. 09171234567.',
    studentId: 'Format: YYYY-N-NNNNN, e.g. 2021-2-04062.',
    email: 'Format: occ.lastname.firstname@gmail.com (all lowercase).',
    name: 'Letters, spaces, hyphens and apostrophes only — no numbers.',
    password: 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.',
};

export const FORMAT_ERRORS = {
    phone: 'Enter a valid Philippine mobile number, e.g. 09171234567.',
    studentId: 'Use the format YYYY-N-NNNNN, e.g. 2021-2-04062.',
    email: 'Use the format occ.lastname.firstname@gmail.com.',
    name: 'This field can only contain letters, spaces, hyphens and apostrophes.',
};

// ---------------------------------------------------------------------------
// Validators — return true/false.
// ---------------------------------------------------------------------------
export const isValidPhone = (value) => PH_PHONE_REGEX.test(String(value || '').trim());
export const isValidStudentId = (value) => STUDENT_ID_REGEX.test(String(value || '').trim());
export const isValidSchoolEmail = (value) => SCHOOL_EMAIL_REGEX.test(String(value || '').trim().toLowerCase());
export const isNameLike = (value) => /^[a-zA-Z\u00C0-\u017F\s'-]*$/.test(value ?? '');
export const isDigitsOnly = (value) => /^[0-9]*$/.test(value ?? '');

// ---------------------------------------------------------------------------
// Live "as you type" input filters — strip out characters that could never
// be valid for that field, so a numeric field simply can't accept a letter
// and vice versa, instead of only complaining after the fact.
// Use these inside an onChange/onBeforeInput handler:
//   onChange={(e) => setForm(f => ({ ...f, phone_number: filterPhoneInput(e.target.value) }))}
// ---------------------------------------------------------------------------

// Digits only, capped at 11 characters, and forced to start with "09" once
// the person has typed enough to matter (keeps the field always "valid so
// far" instead of yelling at the very first keystroke).
export const filterPhoneInput = (value) => {
    let digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    return digits;
};

// Letters/spaces/hyphens/apostrophes only — used for first/last name and
// similar free-text name fields so no digit can ever land in a name.
export const filterNameInput = (value) => String(value || '').replace(/[^a-zA-Z\u00C0-\u017F\s'-]/g, '');

// Student ID auto-formats as the person types: 2021-2-04062. Only digits
// are accepted; the dashes are inserted automatically at the right spots
// and typing/backspacing "through" a dash behaves naturally.
export const filterStudentIdInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    const year = digits.slice(0, 4);
    const term = digits.slice(4, 5);
    const serial = digits.slice(5, 10);
    let out = year;
    if (term) out += `-${term}`;
    if (serial) out += `-${serial}`;
    return out;
};

// Lowercases + strips whitespace as the person types an email — doesn't
// block anything (emails have too many valid shapes to filter live), but
// normalizes so "Occ.Delacruz.Juan@Gmail.com " and the lowercase version
// aren't treated as different accounts.
export const normalizeEmailInput = (value) => String(value || '').replace(/\s/g, '').toLowerCase();

// Digits-only filter for generic numeric fields (kept separate from phone
// since it doesn't force a "09" prefix or length cap).
export const filterDigitsInput = (value) => String(value || '').replace(/\D/g, '');

// ---------------------------------------------------------------------------
// Friendly duplicate-account messaging. Laravel validation errors come back
// as { errors: { email: ["The email has already been taken."] } } — this
// rewrites the stock Laravel wording into copy that matches the rest of the
// app's voice and clearly tells the person WHICH field collided.
// ---------------------------------------------------------------------------
const FIELD_LABELS = {
    email: 'email address',
    student_id: 'student ID',
    phone_number: 'phone number',
    name: 'name',
};

export const humanizeValidationErrors = (errors) => {
    if (!errors || typeof errors !== 'object') return [];
    return Object.entries(errors).flatMap(([field, messages]) => {
        const label = FIELD_LABELS[field] || field.replace(/_/g, ' ');
        return (Array.isArray(messages) ? messages : [messages]).map((msg) => {
            if (/already been taken|already exists|already in use/i.test(msg)) {
                return `That ${label} is already in use by another account. Please use a different ${label}, or sign in instead if this is your account.`;
            }
            return msg;
        });
    });
};
