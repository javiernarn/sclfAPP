// Human-readable role names, shared by every screen that shows "who" a
// record is assigned to. Showing just a name ("Jonee John") leaves other
// viewers guessing whether that's a guard, an instructor or an admin, so
// assignee text always carries the role: "Security Officer Jonee John".
export const ROLE_LABELS = {
    admin: 'Admin',
    staff: 'Staff',
    security_officer: 'Security Officer',
    instructor: 'Instructor',
    student: 'Student',
};

// Highest-authority role first, so someone holding several roles is
// described by the most relevant one.
const ROLE_PRIORITY = ['admin', 'staff', 'security_officer', 'instructor', 'student'];

// Accepts a user object whose `roles` is an array of strings or of
// `{ name }` objects (what the API returns). Returns '' when unknown.
export function primaryRoleLabel(user) {
    const names = (Array.isArray(user?.roles) ? user.roles : [])
        .map((r) => (typeof r === 'string' ? r : r?.name))
        .filter(Boolean);
    const top = ROLE_PRIORITY.find((r) => names.includes(r)) || names[0];
    if (!top) return '';
    return ROLE_LABELS[top] || top.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// "Security Officer Jonee John" — or just the name if no role came back,
// or `fallback` when there is no user at all.
export function roleAndName(user, fallback = '—') {
    if (!user?.name) return fallback;
    const role = primaryRoleLabel(user);
    return role ? `${role} ${user.name}` : user.name;
}

// "Admin Maria Santos · ID ADM-2026-0001" — role, name AND the account's ID,
// so two people with the same name can't be confused and nobody has to guess
// who actually handled a record. Falls back to the numeric user id when the
// account has no school/staff ID, or `fallback` when there is no user.
export function roleNameAndId(user, fallback = '—') {
    if (!user?.name) return fallback;
    const id = user.display_id || (user.id != null ? `#${user.id}` : '');
    return id ? `${roleAndName(user)} · ID ${id}` : roleAndName(user);
}
