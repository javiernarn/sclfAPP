import React from 'react';
import './roles.css';

// Role words -> css class. Longest phrases first so "Security Officer" is
// one pill instead of "Security" + "Officer".
const ROLE_WORDS = [
    ['security officers', 'security'], ['security officer', 'security'],
    ['administrators', 'admin'], ['administrator', 'admin'],
    ['instructors', 'instructor'], ['instructor', 'instructor'],
    ['students', 'student'], ['student', 'student'],
    ['security', 'security'], ['admins', 'admin'], ['admin', 'admin'],
    ['staff', 'staff'],
];
// Other important words, coloured by meaning.
const KEY_WORDS = [
    ['approved', 'good'], ['claimed', 'good'], ['released', 'good'], ['resolved', 'good'], ['found', 'good'],
    ['pending', 'warn'], ['unclaimed', 'warn'], ['overdue', 'warn'], ['urgent', 'warn'],
    ['rejected', 'bad'], ['denied', 'bad'], ['expired', 'bad'], ['lost', 'bad'],
    ['verified', 'info'], ['matched', 'info'], ['assigned', 'info'],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lookup = new Map([
    ...ROLE_WORDS.map(([w, c]) => [w, { kind: 'role', cls: c }]),
    ...KEY_WORDS.map(([w, c]) => [w, { kind: 'key', cls: c }]),
]);

const buildRe = (words) =>
    new RegExp(`\\b(${[...words].sort((a, b) => b.length - a.length).map(esc).join('|')})\\b`, 'gi');
const ROLES_ONLY = buildRe(ROLE_WORDS.map(([w]) => w));
const ROLES_AND_KEYS = buildRe([...ROLE_WORDS, ...KEY_WORDS].map(([w]) => w));

/** One role pill: <RoleBadge role="security_officer" /> or <RoleBadge>Admin</RoleBadge> */
export function RoleBadge({ role, children, className = '' }) {
    const text = children ?? String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const key = String(role || text).toLowerCase();
    const cls = (lookup.get(key.replace(/_/g, ' '))?.cls) || (key.includes('security') ? 'security' : key);
    return <span className={`sclf-role sclf-role-${cls} ${className}`}>{text}</span>;
}

/**
 * Wraps role words (and, with `keys`, status words) inside a string in
 * coloured pills. Plain strings only; anything else is returned untouched.
 *   <RoleText text="Assigned to Security Officer Jonee John" />
 */
export default function RoleText({ text, keys = false }) {
    if (typeof text !== 'string' || !text) return text ?? null;
    const re = keys ? ROLES_AND_KEYS : ROLES_ONLY;
    re.lastIndex = 0;
    const out = [];
    let last = 0; let m; let i = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const hit = lookup.get(m[0].toLowerCase());
        out.push(hit.kind === 'role'
            ? <span key={i++} className={`sclf-role sclf-role-${hit.cls}`}>{m[0]}</span>
            : <span key={i++} className={`sclf-key sclf-key-${hit.cls}`}>{m[0]}</span>);
        last = m.index + m[0].length;
    }
    if (!out.length) return text;
    if (last < text.length) out.push(text.slice(last));
    return <>{out}</>;
}
