import React from 'react';

/**
 * ProfileSkeleton
 * ---------------
 * Loading placeholder shaped like the redesigned Profile page: avatar +
 * name/email hero card, an "Account details" card with a grid of small
 * bone blocks (matching .ds-info-grid), a "Security" card, and an
 * "Appearance" card — same four .ds-card blocks the real page renders,
 * so nothing jumps when it swaps in.
 */
export default function ProfileSkeleton() {
    return (
        <div aria-hidden="true" aria-busy="true">
            <div className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div className="ds-skel ds-skel-avatar" style={{ width: 64, height: 64, borderRadius: 16 }} />
                <div style={{ minWidth: 0 }}>
                    <div className="ds-skel ds-skel-name-lg" />
                    <div className="ds-skel ds-skel-email-lg" style={{ marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <div className="ds-skel" style={{ width: 70, height: 20, borderRadius: 999 }} />
                        <div className="ds-skel" style={{ width: 90, height: 20, borderRadius: 999 }} />
                    </div>
                </div>
            </div>

            <div className="ds-card">
                <div className="ds-skel ds-skel-title" style={{ width: '32%' }} />
                <div className="ds-skel ds-skel-desc-sm" style={{ width: '55%' }} />
                <div className="ds-info-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div className="ds-skel" style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div className="ds-skel" style={{ width: '60%', height: 9, borderRadius: 4, marginBottom: 6 }} />
                                <div className="ds-skel" style={{ width: '85%', height: 13, borderRadius: 4 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ds-card">
                <div className="ds-skel ds-skel-title" style={{ width: '22%' }} />
                <div className="ds-skel ds-skel-desc-sm" style={{ width: '60%' }} />
                <div className="ds-skel ds-skel-btn" style={{ width: 190, height: 40 }} />
            </div>

            <div className="ds-card">
                <div className="ds-skel ds-skel-title" style={{ width: '28%' }} />
                <div className="ds-skel ds-skel-desc-sm" style={{ width: '55%' }} />
                <div className="ds-skel ds-skel-btn" style={{ width: 200 }} />
            </div>
        </div>
    );
}
