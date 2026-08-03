import React from 'react';

/**
 * DashboardSkeleton
 * ------------------
 * Grid-shaped loading placeholder for the student/admin dashboards. Mirrors
 * the exact markup shape of the real dashboard (.ds-stat-grid of N stat
 * cards + .ds-grid of N action cards) so there's no layout jump once the
 * real data swaps in — only the content inside each box changes.
 */
export default function DashboardSkeleton({ statCount = 3, cardCount = 2 }) {
    return (
        <div aria-hidden="true" aria-busy="true">
            <div className="ds-stat-grid">
                {Array.from({ length: statCount }).map((_, i) => (
                    <div key={i} className="ds-stat-card">
                        <div className="ds-skel ds-skel-icon" />
                        <div className="ds-skel ds-skel-value" />
                        <div className="ds-skel ds-skel-label" />
                    </div>
                ))}
            </div>

            <div className="ds-grid">
                {Array.from({ length: cardCount }).map((_, i) => (
                    <div key={i} className="ds-card">
                        <div className="ds-skel ds-skel-title" />
                        <div className="ds-skel ds-skel-desc" />
                        <div className="ds-skel ds-skel-desc-sm" />
                        <div className="ds-skel ds-skel-btn" />
                    </div>
                ))}
            </div>
        </div>
    );
}
