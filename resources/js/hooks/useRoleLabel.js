import { useAuth } from '../context/AuthContext';

/**
 * Single source of truth for "is this person the Admin or a Staff account".
 * Staff open the same pages as the admin, so any wording that names the
 * signed-in person's role must come from here instead of being hard-coded.
 */
export default function useRoleLabel() {
    const { roles } = useAuth();
    const list = Array.isArray(roles) ? roles : [];
    const isAdmin = list.includes('admin');
    const isStaff = list.includes('staff') && !isAdmin;
    return { isAdmin, isStaff, label: isAdmin ? 'Admin' : isStaff ? 'Staff' : '' };
}
