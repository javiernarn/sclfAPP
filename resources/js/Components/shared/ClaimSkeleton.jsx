import React from 'react';

/**
 * ClaimListSkeleton
 * ------------------
 * Loading placeholder shaped like the redesigned Claims list: a row of
 * filter-chip bones, then N thumbnail + text + badge rows matching the
 * real .ds-list-item markup — so nothing jumps once claims arrive.
 */
export function ClaimListSkeleton({ rows = 4 }) {
    return (
        <div aria-hidden="true" aria-busy="true">
            <div className="ds-filter-row">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="ds-skel" style={{ width: 74 + (i % 3) * 14, height: 30, borderRadius: 999 }} />
                ))}
            </div>
            <div className="ds-list">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="ds-list-item" style={{ gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                            <div className="ds-skel" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="ds-skel" style={{ width: '46%', height: 14, borderRadius: 4, marginBottom: 7 }} />
                                <div className="ds-skel" style={{ width: '30%', height: 11, borderRadius: 4 }} />
                            </div>
                        </div>
                        <div className="ds-skel" style={{ width: 96, height: 22, borderRadius: 999 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * ClaimDetailSkeleton
 * --------------------
 * Loading placeholder shaped like the redesigned Claim detail page: an
 * "Item" card with a hero row + info-grid, an "Evidence" card with a
 * couple of evidence-row bones, and a "Security Review" card — the same
 * three .ds-card blocks the real page renders for staff mid-review.
 */
export function ClaimDetailSkeleton() {
    return (
        <div aria-hidden="true" aria-busy="true">
            <div className="ds-card">
                <div className="ds-skel ds-skel-title" style={{ width: '20%' }} />
                <div className="ds-item-hero">
                    <div className="ds-skel" style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="ds-skel" style={{ width: '40%', height: 16, borderRadius: 4, marginBottom: 8 }} />
                        <div className="ds-skel" style={{ width: '26%', height: 11, borderRadius: 4 }} />
                    </div>
                </div>
                <div className="ds-info-grid">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div className="ds-skel" style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div className="ds-skel" style={{ width: '55%', height: 9, borderRadius: 4, marginBottom: 6 }} />
                                <div className="ds-skel" style={{ width: '80%', height: 13, borderRadius: 4 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ds-card">
                <div className="ds-skel ds-skel-title" style={{ width: '26%' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="ds-evidence-row">
                            <div className="ds-skel" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <div className="ds-skel" style={{ width: '32%', height: 12, borderRadius: 4, marginBottom: 6 }} />
                                <div className="ds-skel" style={{ width: '70%', height: 11, borderRadius: 4 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ds-card">
                <div className="ds-skel ds-skel-title" style={{ width: '32%' }} />
                <div className="ds-skel ds-skel-textarea" />
                <div style={{ display: 'flex', gap: 8 }}>
                    <div className="ds-skel ds-skel-btn" style={{ width: 130 }} />
                    <div className="ds-skel ds-skel-btn" style={{ width: 100 }} />
                </div>
            </div>
        </div>
    );
}

export default ClaimListSkeleton;
