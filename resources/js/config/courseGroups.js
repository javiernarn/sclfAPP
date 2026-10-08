// Single source of truth for the college/course list.
// Used by RegisterPage (Course dropdown) and SecurityVisitors (Host's department dropdown).
export const COURSE_GROUPS = [
    {
        college: 'College of Teacher Education (CTE)',
        courses: [
            'BEED — Bachelor of Elementary Education',
            'BSEd — Bachelor of Secondary Education (Major in English)',
        ],
    },
    {
        college: 'College of Information Technology (CIT)',
        courses: [
            'BSIT — Bachelor of Science in Information Technology',
        ],
    },
    {
        college: 'College of Business Administration (CBA)',
        courses: [
            'BSBA — Bachelor of Science in Business Administration (Major in Marketing Management)',
            'BSBA — Bachelor of Science in Business Administration (Major in Financial Management)',
        ],
    },
];
