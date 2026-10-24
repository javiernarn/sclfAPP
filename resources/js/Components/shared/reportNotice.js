// The short "read this first" notice shown before a report form unlocks
// (incident report, service request, found item, lost item). One place so all
// four stay in sync. Pass the result straight to `confirm()`.
//
//   const agreed = await confirm(reportNotice({ kind: 'incident', printHref, clearance: isStudent }));
//
// `clearance` — only STUDENTS have a clearance to be signed. Instructors, Staff,
// Security and Admin get the same notice without any clearance wording.
//
// `printHref` is the person's own print dashboard (/app/print/{token}) — it
// lists their confirmed violations, so they can check BEFORE filing anything.

const KINDS = {
    incident: { noun: 'incident report', rule: 'Only report what really happened.', uploads: true },
    service:  { noun: 'service request', rule: 'Only request help for a real problem.', uploads: true },
    found:    { noun: 'found item report', rule: 'Only report an item you really found.', uploads: true },
    lost:     { noun: 'lost item report', rule: 'Only report an item you really lost.', uploads: false },
};

export const NOTICE_SECONDS = 8;

export function reportNotice({ kind, printHref, clearance = false }) {
    const k = KINDS[kind] || KINDS.incident;

    const points = [
        { icon: 'check', tone: 'info', lead: 'Be genuine.', text: `${k.rule} Fake or joke reports are misuse.` },
    ];
    if (clearance) {
        points.push({
            icon: 'shield', tone: 'danger', lead: 'Violations affect your clearance.',
            text: 'If you have a violation, your clearance will not be signed.',
        });
    }
    if (k.uploads) {
        points.push({
            icon: 'camera', tone: 'warn', lead: 'Careful with photos and videos.',
            text: 'Security, Admin and Staff can see them. Never upload private or sensitive images or videos.',
        });
    }

    const details =
        `This ${k.noun} is kept as an official campus record and is used by Security, Admin and Staff to take action. ` +
        'Reports that turn out to be false, exaggerated, or submitted as a joke are treated as misuse of the system, and ' +
        'accounts that repeatedly do this may be suspended or disabled. Confirmed violations are recorded on your account ' +
        'and shown on your print dashboard' + (clearance ? '; while you have one, your clearance will not be signed. ' : '. ') +
        (k.uploads ? 'Do not attach sensitive, private, or inappropriate photos or videos — doing so can itself count as a violation. ' : '') +
        'By clicking "I Agree, Unlock Form" you confirm this report is genuine.';

    return {
        title: 'Before you continue',
        points,
        details,
        link: printHref
            ? { href: printHref, label: 'Check my violations', hint: 'Opens your print dashboard — Back returns you here' }
            : null,
        confirmLabel: 'I Agree, Unlock Form',
        cancelLabel: 'Cancel',
        tone: 'danger',
        delaySeconds: NOTICE_SECONDS,
    };
}
