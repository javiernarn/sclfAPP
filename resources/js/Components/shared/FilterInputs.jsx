import React, { useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import './FilterInputs.css';

/**
 * Number box with up / down arrows that are ALWAYS visible.
 * (The dashboard's input styling strips the browser's own spinner arrows, and the
 * native ones only appear on hover anyway.) Keeps the value a string so an empty
 * box still means "no filter". Arrow keys on the keyboard work too.
 */
export function NumberStepper({ value, onChange, min = 0, max = 100, step = 1, className = '', style, 'aria-label': ariaLabel, ...rest }) {
    const n = parseInt(value, 10);
    const empty = Number.isNaN(n);
    const clamp = (v) => Math.min(max, Math.max(min, v));
    const bump = (dir) => onChange(String(clamp(empty ? (dir > 0 ? min + step : min) : n + dir * step)));
    const label = ariaLabel || 'Number';
    return (
        <div className={`fi-num ${className}`.trim()} style={style}>
            <input {...rest} type="number" inputMode="numeric" min={min} max={max} step={step} value={value} aria-label={label}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => { if (!empty && (n < min || n > max)) onChange(String(clamp(n))); }} />
            <div className="fi-num-btns">
                <button type="button" tabIndex={-1} aria-label={`Increase ${label.toLowerCase()}`} title="Increase"
                    disabled={!empty && n >= max} onClick={() => bump(1)}><ChevronUp size={13} strokeWidth={2.6} /></button>
                <button type="button" tabIndex={-1} aria-label={`Decrease ${label.toLowerCase()}`} title="Decrease"
                    disabled={!empty && n <= min} onClick={() => bump(-1)}><ChevronDown size={13} strokeWidth={2.6} /></button>
            </div>
        </div>
    );
}

/**
 * Search box that shows a clear (x) button as soon as there is text.
 * Click the x, or press Escape, to empty it; focus stays in the box.
 * (The browser's own cancel button is hidden so there is never a double x.)
 */
export function ClearableSearch({ value, onChange, className = '', style, placeholder, 'aria-label': ariaLabel, ...rest }) {
    const ref = useRef(null);
    const clear = () => { onChange(''); ref.current?.focus(); };
    return (
        <div className={`fi-search ${className}`.trim()} style={style}>
            <input {...rest} ref={ref} type="search" value={value} placeholder={placeholder} aria-label={ariaLabel}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); clear(); } }} />
            {value ? (
                <button type="button" className="fi-clear" aria-label="Clear search" title="Clear" onClick={clear}>
                    <X size={14} strokeWidth={2.6} />
                </button>
            ) : null}
        </div>
    );
}
