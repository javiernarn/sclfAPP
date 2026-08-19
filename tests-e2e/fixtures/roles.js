// Mirrors database/seeders/E2ETestSeeder.php — keep these two files in sync.
const PASSWORD = 'E2ePassword!23';

const ROLES = {
    student: {
        email: 'e2e.student@example.test',
        password: PASSWORD,
        dashboard: '/app/dashboard',
    },
    instructor: {
        email: 'e2e.instructor@example.test',
        password: PASSWORD,
        dashboard: '/app/dashboard',
    },
    security_officer: {
        email: 'e2e.security@example.test',
        password: PASSWORD,
        dashboard: '/app/security/dashboard',
    },
    admin: {
        email: 'e2e.admin@example.test',
        password: PASSWORD,
        dashboard: '/app/admin/dashboard',
    },
};

export { ROLES };
