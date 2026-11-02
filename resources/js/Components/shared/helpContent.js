import {
    LayoutDashboard, PackageSearch, PackageCheck, ClipboardCheck, QrCode, Boxes, ShieldCheck, Bell,
    AlertTriangle, Wrench, Handshake, ListOrdered, History, UserCheck, UserCircle, Activity,
} from '../icons';

// ---------------------------------------------------------------------------
// "How this works" — one guide per role, written from what each role really
// sees in the menu and what the server really enforces (daily report limit,
// counter intake, release pass, staff-needs-approval ...). Edit wording here;
// the panel (HelpHints.jsx) just renders it.
//
//   todo   ordered steps, in the order the person should do them. `lane` blocks
//          group steps when a role has more than one process.
//          step = { title, text, to?, go? }   `to` makes a "go" button.
//   pages  what each menu entry is for (labels match the real menu)
//   notes  short good-to-know lines at the bottom
// ---------------------------------------------------------------------------

const PHONE_NOTE = 'On a phone, the bar at the bottom has your most-used pages. “Menu” opens every page, and the round button in the middle starts a new report.';

const PAGES_COMMON = {
    notifications: { icon: Bell, label: 'Notifications', text: 'Everything that needs you: matches, claim updates, approvals. A dot on the bell means something is new.', to: '/app/notifications' },
    incidents: { icon: AlertTriangle, label: 'Incidents', text: 'Theft, vandalism, fights, safety hazards or anything else Security should know about.', to: '/app/incidents' },
    service: { icon: Wrench, label: 'Service Requests', text: 'A broken fixture, an IT problem, a cleaning need: anything Facilities or IT should handle.', to: '/app/service-requests' },
};

const studentLike = (isInstructor) => ({
    title: 'How SCLF works for you',
    role: isInstructor ? 'Instructor' : 'Student',
    intro: isInstructor
        ? 'You use the same lost-and-found tools as students: report what you lost, report what you found, and claim what is yours.'
        : 'SCLF is the campus lost-and-found. Report what you lost, report what you found, and claim what is yours.',
    todo: [{
        steps: [
            { title: 'Lost something? Report it', text: 'Add a clear photo, what it looks like, and where and when you last had it. More detail means better matches.', to: '/app/lost-items/create', go: 'Report a lost item' },
            { title: 'Wait for a match', text: 'When Security verifies a found item that fits your report, you get a notification. A match is a suggestion; the owner is confirmed through a claim.', to: '/app/notifications', go: 'Open notifications' },
            { title: 'Claim your item', text: 'Open the found item, press Claim, and add proof it is yours (photos, receipt, unique details). Track the status in My Claims.', to: '/app/claims', go: 'Open My Claims' },
            { title: 'Pick it up', text: 'Once your claim is approved, show your release pass (QR code) and your school ID to the Security Officer at the desk.' },
            { title: 'Found something? Report that too', text: 'Report it and hand it in. Security checks every found report first; only approved items go into inventory and matching.', to: '/app/found-items/create', go: 'Report a found item' },
        ],
    }],
    pages: [
        { icon: LayoutDashboard, label: 'Dashboard', text: 'A snapshot of your reports, pending items, recovered items and active claims.' },
        { icon: PackageSearch, label: 'Lost Items', text: 'Your lost reports and their status. Start a new one here.', to: '/app/lost-items' },
        { icon: PackageSearch, label: 'Found Items', text: 'Browse items people turned in, or report one you found.', to: '/app/found-items' },
        { icon: ClipboardCheck, label: 'My Claims', text: 'Every claim you made, from pending review to ready for pickup.', to: '/app/claims' },
        PAGES_COMMON.incidents,
        PAGES_COMMON.service,
        PAGES_COMMON.notifications,
        { icon: UserCircle, label: 'Profile (your photo menu)', text: 'Your details, photo, password and two-step sign-in.', to: '/app/profile' },
    ],
    notes: [
        'Keep your phone number and email correct in your Profile. It is how Security reaches you about a match.',
        'To keep reports genuine, each type (lost, found, incident, service) has a daily limit per account. It resets at midnight.',
        isInstructor
            ? 'If a student asks for help, you can show them these same steps on their own account.'
            : 'Printing your report is available when the office opens it. You will be notified.',
        PHONE_NOTE,
    ],
});

const GUIDES = {
    student: studentLike(false),
    instructor: studentLike(true),

    security_officer: {
        title: 'How SCLF works for you',
        role: 'Security Officer',
        intro: 'You check items in, review reports and matches, approve claims, and hand items over. Pick the process that fits the situation.',
        todo: [
            {
                lane: 'The owner is at your desk',
                steps: [
                    { title: 'Call the next person', text: 'Call the next ticket, then mark it Serving when they reach you.', to: '/app/security/counter-dashboard', go: 'Counter Dashboard' },
                    { title: 'Confirm who they are', text: 'Search by school ID or name. Check that the face matches the photo on file before you select them.', to: '/app/security/counter', go: 'Open Counter' },
                    { title: 'Link their lost report', text: 'Pick the lost report that is this item. If none fits, choose “No lost report” on purpose; do not force a link.' },
                    { title: 'Log the item and check in', text: 'Enter the item name, choose where it will be kept, add the condition. Press Check In once. The claim is approved right away and the owner is notified.' },
                    { title: 'Release when they come back', text: 'Open their claim, generate the release code, then scan it.', to: '/app/security/qr-scanner', go: 'QR Release Scanner' },
                ],
            },
            {
                lane: 'A finder turned an item in online',
                steps: [
                    { title: 'Verify the found report', text: 'Check the photo and description, then approve or reject with a reason. Only approved items enter inventory and matching.', to: '/app/found-items', go: 'Found Items' },
                    { title: 'Store it and record where', text: 'Assign a storage location so anyone can find it later. Every move is logged.', to: '/app/security/inventory', go: 'Inventory' },
                    { title: 'Review matches', text: 'Open “Compare details” to see the lost report and found item side by side. Notify the owner only when the key details agree.', to: '/app/security/matches', go: 'Matches' },
                    { title: 'Review the claim and its proof', text: 'Compare the evidence to the item on file, then approve, ask for more, or reject. Watch for the suspicious-claim flag.', to: '/app/security/claims', go: 'Claims' },
                    { title: 'Hand over and close', text: 'Generate the release code on the approved claim and scan it at hand-over. Manual release needs a written reason.' },
                ],
            },
        ],
        pages: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'What is waiting, what needs verifying, and what is ready to hand over. Open the Step-by-step guide here any time.', to: '/app/security/dashboard' },
            { icon: PackageCheck, label: 'Counter', text: 'For an item handed to you by its own owner. Use Inventory instead when the owner is not known.', to: '/app/security/counter' },
            { icon: ListOrdered, label: 'Counter Dashboard', text: 'Who is on shift, today’s activity, and the walk-in queue.', to: '/app/security/counter-dashboard' },
            { icon: PackageSearch, label: 'Lost Items / Found Items', text: 'Review pending reports on the “Pending review” tab.', to: '/app/found-items' },
            { icon: Handshake, label: 'Matches', text: 'Live-scored pairings of lost reports and found items.', to: '/app/security/matches' },
            { icon: ClipboardCheck, label: 'Claims', text: 'Review proof, approve or reject, and generate release codes.', to: '/app/security/claims' },
            { icon: Boxes, label: 'Inventory', text: 'Everything held at the desk, where it is stored, and its verification status.', to: '/app/security/inventory' },
            { icon: AlertTriangle, label: 'Unclaimed Items', text: 'Items whose retention period ran out. Dispose of them, or restore one if the owner turns up.', to: '/app/security/unclaimed-items' },
            { icon: ShieldCheck, label: 'Incidents', text: 'Reports of theft, vandalism and safety problems for Security to handle.', to: '/app/incidents' },
            { icon: Wrench, label: 'Service Requests', text: 'Facilities and IT requests from the campus.', to: '/app/service-requests' },
            { icon: UserCheck, label: 'Visitors', text: 'Log visitors in and out and see who is on campus now.', to: '/app/security/visitors' },
            { icon: QrCode, label: 'QR Release Scanner', text: 'Scan a release pass, or type the code if the camera is unavailable. Every check happens on the server.', to: '/app/security/qr-scanner' },
            { icon: History, label: 'History', text: 'A record of check-ins and releases.', to: '/app/security/history' },
            PAGES_COMMON.notifications,
        ],
        notes: [
            'At the Counter, always confirm the face matches the photo on file before logging an item to someone’s account.',
            'A match is only a suggestion. Ownership is decided on the claim, not on the match.',
            PHONE_NOTE,
        ],
    },

    admin: {
        title: 'How SCLF works for you',
        role: 'Admin',
        intro: 'You oversee the whole system: accounts, approvals, and the full activity trail. Staff can look but not change anything without your approval.',
        todo: [{
            steps: [
                { title: 'Check the Dashboard', text: 'See reports filed, claims in progress and items awaiting verification across the campus.', to: '/app/admin/dashboard', go: 'Dashboard' },
                { title: 'Answer Staff Requests', text: 'When staff want to change a record they send you a request with a reason. Approve or reject it. An approval works once, for that exact action.', to: '/app/admin/requests', go: 'Staff Requests' },
                { title: 'Manage accounts', text: 'Create Instructor, Security Officer, Staff and Admin accounts. Students register themselves, so you never create those. Accounts you create finish their own setup at first sign-in.', to: '/app/admin/users', go: 'Users' },
                { title: 'Review what happened', text: 'Audit Log is the trail of actions (approvals, edits, account changes). User Activity shows every request with device and IP, flagged when it looks like spam.', to: '/app/admin/audit-log', go: 'Audit Log' },
            ],
        }],
        pages: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'System-wide activity and what needs attention.', to: '/app/admin/dashboard' },
            { icon: PackageSearch, label: 'Lost Items / Found Items', text: 'Every report on campus, with full edit and override access.', to: '/app/lost-items' },
            { icon: Handshake, label: 'Matches', text: 'The same match queue Security works.', to: '/app/security/matches' },
            { icon: ClipboardCheck, label: 'Claims', text: 'Every claim submitted campus-wide.', to: '/app/claims' },
            { icon: UserCircle, label: 'Users', text: 'Create, edit, disable or restore accounts and open a person’s profile and sign-in history.', to: '/app/admin/users' },
            { icon: ClipboardCheck, label: 'Staff Requests', text: 'Approve, hold or reject changes staff asked to make.', to: '/app/admin/requests' },
            { icon: ShieldCheck, label: 'Audit Log', text: 'A read-only trail of who did what and when.', to: '/app/admin/audit-log' },
            { icon: Activity, label: 'User Activity', text: 'Raw request feed with device, IP and abuse flags.', to: '/app/admin/activity' },
            { icon: ListOrdered, label: 'Counter Dashboard', text: 'Counters, who is on shift and the walk-in queue.', to: '/app/security/counter-dashboard' },
            { icon: AlertTriangle, label: 'Unclaimed Items', text: 'Items past their retention period.', to: '/app/security/unclaimed-items' },
            { icon: ShieldCheck, label: 'Incidents', text: 'All security incident reports.', to: '/app/incidents' },
            { icon: Wrench, label: 'Service Requests', text: 'All Facilities and IT requests.', to: '/app/service-requests' },
            { icon: UserCheck, label: 'Visitors', text: 'The full visitor history.', to: '/app/security/visitors' },
            { icon: History, label: 'History', text: 'Check-ins and releases done by officers.', to: '/app/admin/history' },
            PAGES_COMMON.notifications,
        ],
        notes: [
            'Disabling an account signs the person out at once and blocks sign-in, but keeps their history. You can undo it from the same page.',
            'Only one device can use an account at a time. Signing in somewhere else signs the first device out.',
            PHONE_NOTE,
        ],
    },

    staff: {
        title: 'How SCLF works for you',
        role: 'Staff',
        intro: 'You can open and read everything an admin can, but any change needs the Admin’s approval first.',
        todo: [{
            steps: [
                { title: 'Find the page you need', text: 'Use the menu or the search button to open the report, claim or record.' },
                { title: 'Try the change you want', text: 'When a change needs approval, SCLF asks for a short reason and sends a request to the Admin.' },
                { title: 'Wait for the answer', text: 'You get a notification when the Admin approves or rejects your request.', to: '/app/notifications', go: 'Open notifications' },
                { title: 'Do it again after approval', text: 'Once approved, repeat the same action on the same record. The approval is used up when it succeeds, so a new change needs a new request.' },
            ],
        }],
        pages: [
            { icon: LayoutDashboard, label: 'Dashboard', text: 'System-wide activity (view only).', to: '/app/admin/dashboard' },
            { icon: PackageSearch, label: 'Lost Items / Found Items', text: 'Read every report. Edits need approval.', to: '/app/lost-items' },
            { icon: Handshake, label: 'Matches', text: 'See the match queue. Actions need approval.', to: '/app/security/matches' },
            { icon: ClipboardCheck, label: 'Claims', text: 'Every claim campus-wide.', to: '/app/claims' },
            { icon: UserCircle, label: 'Users', text: 'View accounts and profiles.', to: '/app/admin/users' },
            { icon: ListOrdered, label: 'Counter Dashboard', text: 'Counters and the walk-in queue.', to: '/app/security/counter-dashboard' },
            { icon: AlertTriangle, label: 'Unclaimed Items', text: 'Items past their retention period.', to: '/app/security/unclaimed-items' },
            { icon: ShieldCheck, label: 'Incidents', text: 'Security incident reports.', to: '/app/incidents' },
            { icon: Wrench, label: 'Service Requests', text: 'Facilities and IT requests.', to: '/app/service-requests' },
            { icon: UserCheck, label: 'Visitors', text: 'Visitor history (view only).', to: '/app/security/visitors' },
            { icon: History, label: 'History', text: 'Check-ins and releases.', to: '/app/admin/history' },
            PAGES_COMMON.notifications,
        ],
        notes: [
            'Staff Requests, Audit Log and User Activity are for the Admin only, so they are not in your menu.',
            'A request that fails validation does not use up the approval, so you can fix the form and try again.',
            PHONE_NOTE,
        ],
    },
};

// Highest authority wins when someone holds several roles.
export function guideKeyFor(roles) {
    const r = Array.isArray(roles) ? roles : [];
    if (r.includes('admin')) return 'admin';
    if (r.includes('staff')) return 'staff';
    if (r.includes('security_officer')) return 'security_officer';
    if (r.includes('instructor')) return 'instructor';
    return 'student';
}

export default GUIDES;
