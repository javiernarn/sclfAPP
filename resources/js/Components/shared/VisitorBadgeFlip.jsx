import React, { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import siteLogo from '../../assets/images/site-logo.png';
import './VisitorBadgeFlip.css';

// Same palette / names the badge picker uses, so the grid, the preview and the
// printed badges (docs/visitor-badges) all agree on the day colour.
export const DAY_COLORS = { M: '#2563eb', T: '#db2777', W: '#16a34a', H: '#ea580c', F: '#7c3aed', S: '#0891b2', U: '#dc2626' };
export const DAY_NAMES = { M: 'MONDAY', T: 'TUESDAY', W: 'WEDNESDAY', H: 'THURSDAY', F: 'FRIDAY', S: 'SATURDAY', U: 'SUNDAY' };
export const dayColorFor = (label) => DAY_COLORS[String(label || '')[0]] || '#4f46e5';

const SITE_URL = 'https://sclf.occph.com';
const FONT = 'Arial, Helvetica, sans-serif';

// Styled QR (round dots, rounded finder eyes, logo roundel) as inline SVG so it
// stays crisp at any badge size.
function QrSvg({ value, x, y, size, color }) {
    const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'H' }), [value]);
    const n = qr.modules.size;
    const cell = size / n;
    const inEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const logoR = Math.floor(n * 0.2); // clear the middle for the logo
    const mid = n / 2;
    const dots = [];
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!qr.modules.get(r, c) || inEye(r, c)) continue;
            if (Math.abs(r + 0.5 - mid) < logoR / 1.6 + 1 && Math.abs(c + 0.5 - mid) < logoR / 1.6 + 1) continue;
            dots.push(<circle key={`${r}-${c}`} cx={x + (c + 0.5) * cell} cy={y + (r + 0.5) * cell} r={cell * 0.42} />);
        }
    }
    const eye = (r0, c0) => {
        const ex = x + c0 * cell; const ey = y + r0 * cell;
        return (
            <g key={`e${r0}-${c0}`}>
                <rect x={ex + cell / 2} y={ey + cell / 2} width={6 * cell} height={6 * cell} rx={cell * 1.6} fill="none" stroke={color} strokeWidth={cell} />
                <rect x={ex + 2 * cell} y={ey + 2 * cell} width={3 * cell} height={3 * cell} rx={cell * 0.8} />
            </g>
        );
    };
    const lw = size * 0.2;
    return (
        <g fill={color}>
            {dots}
            {eye(0, 0)}{eye(0, n - 7)}{eye(n - 7, 0)}
            <circle cx={x + size / 2} cy={y + size / 2} r={lw * 0.62} fill="#fff" />
            <image href={siteLogo} x={x + size / 2 - lw / 2} y={y + size / 2 - lw / 2} width={lw} height={lw} preserveAspectRatio="xMidYMid meet" />
        </g>
    );
}

function Front({ label, color, dayName }) {
    return (
        <svg viewBox="0 0 540 860" role="img" aria-label={`Visitor badge ${label} front`}>
            <defs><clipPath id="vbf-clip-f"><rect width="540" height="860" rx="40" /></clipPath></defs>
            <rect className="vbf-tint" x="3" y="3" width="534" height="854" rx="40" fill="#fff" stroke={color} strokeWidth="6" />
            <g clipPath="url(#vbf-clip-f)"><rect className="vbf-tint" width="540" height="220" fill={color} /></g>
            <rect x="200" y="40" width="140" height="30" rx="15" fill="#fff" />
            <text x="270" y="170" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="56" fill="#fff">VISITOR</text>
            <image href={siteLogo} x="130" y="250" width="280" height="280" preserveAspectRatio="xMidYMid meet" />
            <text x="270" y="565" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="30" fill="#1e1b4b">Opol Community College</text>
            <text key={label} className="vbf-num vbf-tint" x="270" y="700" textAnchor="middle" fontFamily={FONT} fontWeight="800" fontSize="130" fill={color}>{label}</text>
            <text x="270" y="765" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="28" fill="#475569">{dayName}</text>
            <text x="270" y="820" textAnchor="middle" fontFamily={FONT} fontSize="22" fill="#64748b">Return to Security before leaving campus</text>
        </svg>
    );
}

function Back({ label, color, qrValue }) {
    const terms = [
        [40, 511, '1. Valid only for the date and campus shown. Wear it'], [62, 530, 'visibly at all times while on campus.'],
        [40, 553, '2. Non-transferable. Return it to Security before'], [62, 572, 'leaving; report a lost badge right away.'],
        [40, 595, '3. Your details are collected for campus security under'], [62, 614, 'the Data Privacy Act of 2012 (RA 10173) and used'],
        [62, 633, 'only for that purpose.'],
    ];
    return (
        <svg viewBox="0 0 540 860" role="img" aria-label={`Visitor badge ${label} back`}>
            <defs><clipPath id="vbf-clip-b"><rect width="540" height="860" rx="40" /></clipPath></defs>
            <rect className="vbf-tint" x="3" y="3" width="534" height="854" rx="40" fill="#fff" stroke={color} strokeWidth="6" />
            <g clipPath="url(#vbf-clip-b)"><rect className="vbf-tint" width="540" height="180" fill={color} /></g>
            <rect x="200" y="40" width="140" height="30" rx="15" fill="#fff" />
            <text x="270" y="124" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="50" fill="#fff">SCLF</text>
            <text x="270" y="158" textAnchor="middle" fontFamily={FONT} fontSize="20" fill="#fff">Opol Community College</text>
            <QrSvg value={qrValue || SITE_URL} x={160} y={195} size={220} color="#1B1F3B" />
            <text x="270" y="443" textAnchor="middle" fontFamily={FONT} fontWeight="700" fontSize="23" fill="#1B1F3B">{qrValue ? 'Scan to open your visitor page' : 'Scan to open SCLF'}</text>
            <text x="40" y="486" fontFamily={FONT} fontWeight="700" fontSize="19" fill="#1e1b4b">TERMS OF SERVICE &amp; PRIVACY</text>
            {terms.map(([tx, ty, t]) => <text key={ty} x={tx} y={ty} fontFamily={FONT} fontSize="16" fill="#334155">{t}</text>)}
            <line x1="60" y1="768" x2="480" y2="768" stroke="#334155" strokeWidth="3" />
            <text x="270" y="800" textAnchor="middle" fontFamily={FONT} fontSize="19" fill="#475569">College President, Opol Community College</text>
        </svg>
    );
}

/**
 * Full visitor badge, front + back. Click (or Enter/Space) to flip it.
 * `label` is the badge number (e.g. "S-23"); the day colour/name come from its
 * first letter. `preview` dims the front when nothing is selected yet.
 */
export default function VisitorBadgeFlip({ label, preview = false, width = 230, hint = true, qrValue = '' }) {
    const [flipped, setFlipped] = useState(false);
    const letter = String(label || '')[0];
    const color = dayColorFor(label);
    const dayName = DAY_NAMES[letter] || '';
    return (
        <div className="vbf" style={{ '--vbf-color': color }}>
            <button type="button"
                className={`vbf-card${flipped ? ' is-flipped' : ''}${preview ? ' is-preview' : ''}`}
                style={{ '--vbf-w': `${width}px` }}
                aria-pressed={flipped}
                aria-label={`Badge ${label || ''}, showing ${flipped ? 'back' : 'front'}. Click to flip.`}
                onClick={() => setFlipped((f) => !f)}>
                <div className="vbf-inner">
                    <div className="vbf-face vbf-front"><Front label={label || '—'} color={color} dayName={dayName} /></div>
                    <div className="vbf-face vbf-back"><Back label={label} color={color} qrValue={qrValue} /></div>
                </div>
            </button>
            {dayName && <span className="vbf-tag">{dayName} · {label}</span>}
            {hint && <span className="vbf-hint">Click the badge to flip it ({flipped ? 'back' : 'front'} shown)</span>}
        </div>
    );
}
