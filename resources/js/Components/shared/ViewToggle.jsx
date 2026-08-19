import React from 'react';
import { LayoutList, Table2 } from '../icons';

// Small pill switch that flips a list page between its "cards" layout
// (one record per row, friendlier on mobile) and a flat "table" layout
// (every column visible at once, faster to scan on desktop). Purely
// presentational — the page owning `mode`/`onChange` decides what each
// view actually renders.
export default function ViewToggle({ mode, onChange, className = '' }) {
    return (
        <div className={`ds-view-toggle ${className}`} role="group" aria-label="Switch between cards and table view">
            <button
                type="button"
                className={`ds-view-toggle-btn ${mode === 'cards' ? 'is-active' : ''}`}
                aria-pressed={mode === 'cards'}
                onClick={() => onChange('cards')}
            >
                <LayoutList size={14} /> Cards
            </button>
            <button
                type="button"
                className={`ds-view-toggle-btn ${mode === 'table' ? 'is-active' : ''}`}
                aria-pressed={mode === 'table'}
                onClick={() => onChange('table')}
            >
                <Table2 size={14} /> Table
            </button>
        </div>
    );
}
