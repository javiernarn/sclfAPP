import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';

// Translation for screens that both students/instructors AND staff can open
// (found items, claims, notifications...). Only student/instructor accounts get
// the language they picked; admin / staff / security stay on English.
// While auth is still loading (e.g. the public login page) there is no role to
// restrict, so the saved language applies.
export default function useRoleTranslation() {
    const { roles, user } = useAuth();
    const staffRole = Array.isArray(roles)
        && (roles.includes('admin') || roles.includes('staff') || roles.includes('security_officer'));
    return useTranslation(!(user && staffRole));
}
