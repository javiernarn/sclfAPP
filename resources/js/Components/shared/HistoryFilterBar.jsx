import React, { useRef } from 'react';
import { Search, Calendar, X } from '../icons';
import './HistoryFilterBar.css';

// Local YYYY-MM-DD (not toISOString, which is UTC and can be "yesterday" in Manila mornings).
function todayLocal() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Search box: themed, magnifier on the left, clear (x) on the right. Esc clears too. */
function SearchField({ value, onChange, placeholder, label }) {
    const ref = useRef(null);
    const clear = () => { onChange(''); ref.current?.focus(); };
    return (
        <div className="hf-field hf-search">
            <Search size={17} className="hf-icon" aria-hidden="true" />
            <input
                ref={ref}
                type="search"
                name="q"
                value={value}
                placeholder={placeholder}
                aria-label={label}
                autoComplete="off"
                enterKeyHint="search"
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); clear(); } }}
            />
            {value ? (
                <button type="button" className="hf-clear" aria-label="Clear search" onClick={clear}>
                    <X size={14} strokeWidth={2.6} />
                </button>
            ) : null}
        </div>
    );
}

/**
 * Themed date field. Still a native <input type="date"> underneath (so phones get
 * their real date wheel / calendar and the keyboard works), but drawn with the
 * app's theme tokens instead of the browser's white box.
 */
function DateField({ name, caption, value, onChange, min, max }) {
    const ref = useRef(null);
    const open = () => { try { ref.current?.showPicker?.(); } catch { /* not allowed / unsupported */ } };
    return (
        <div className="hf-dategroup">
            <span className="hf-cap">{caption}</span>
            <div className={`hf-field hf-date ${value ? 'has-value' : ''}`}>
                <Calendar size={16} className="hf-icon" aria-hidden="true" />
                <input
                    ref={ref}
                    type="date"
                    name={name}
                    value={value}
                    min={min || undefined}
                    max={max || undefined}
                    aria-label={caption}
                    onChange={(e) => onChange(e.target.value)}
                    onClick={open}
                />
                {!value && <span className="hf-placeholder" aria-hidden="true">Any date</span>}
                {value ? (
                    <button type="button" className="hf-clear" aria-label={`Clear ${caption.toLowerCase()} date`} onClick={() => onChange('')}>
                        <X size={14} strokeWidth={2.6} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

/**
 * Filter bar for the History tabs: search + optional status chips + date range.
 *
 * statusOptions: [{ value: '', label: 'All' }, ...]  (omit for no status filter)
 */
export default function HistoryFilterBar({
    q, onQ, searchPlaceholder, searchLabel = 'Search history',
    statusOptions, status, onStatus, statusLabel = 'Filter by status',
    dateFrom, dateTo, onDateFrom, onDateTo, fromCaption = 'From', toCaption = 'To',
    onReset,
}) {
    const today = todayLocal();
    const active = Boolean(q || status || dateFrom || dateTo);
    return (
        <div className="hf-bar">
            <SearchField value={q} onChange={onQ} placeholder={searchPlaceholder} label={searchLabel} />

            {statusOptions && (
                <div className="hf-chips" role="group" aria-label={statusLabel}>
                    {statusOptions.map(o => (
                        <button
                            key={o.value || 'all'}
                            type="button"
                            className={`ds-filter-chip ${status === o.value ? 'is-active' : ''}`}
                            aria-pressed={status === o.value}
                            onClick={() => onStatus(o.value)}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="hf-dates">
                <DateField name="date_from" caption={fromCaption} value={dateFrom} onChange={onDateFrom} max={dateTo || today} />
                <DateField name="date_to" caption={toCaption} value={dateTo} onChange={onDateTo} min={dateFrom} max={today} />
                {active && (
                    <button type="button" className="hf-reset" onClick={onReset}>
                        <X size={13} strokeWidth={2.6} /> Clear filters
                    </button>
                )}
            </div>
        </div>
    );
}
