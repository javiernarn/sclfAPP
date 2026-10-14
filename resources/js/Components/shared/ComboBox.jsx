import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import './ComboBox.css';

/**
 * Pick from a list OR type your own.
 *
 * - Suggestions open on focus / click / typing and filter as you type.
 * - Whatever is in the box IS the value: if the list has nothing suitable,
 *   just type it (shown as «Use "…"»). Nothing is ever forced into the list.
 * - Options: strings, or { value, group?, swatch? } (group → section header,
 *   swatch → a small color dot).
 * - Keyboard: ↑/↓ move, Enter picks, Esc closes, Tab keeps what was typed.
 */
export default function ComboBox({
    id, name, value, onChange, options = [], placeholder, disabled = false, required = false,
    invalid = false, emptyText = 'No suggestions — just type it.', maxLength = 100, autoComplete = 'off',
}) {
    const uid = useId();
    const listId = `${id || uid}-list`;
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [typed, setTyped] = useState(false); // filter only after the person typed
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const norm = (s) => String(s || '').trim().toLowerCase();
    const opts = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o } : o)), [options]);

    const shown = useMemo(() => {
        const q = norm(value);
        if (!typed || !q) return opts;
        const starts = opts.filter((o) => norm(o.value).startsWith(q));
        const contains = opts.filter((o) => !norm(o.value).startsWith(q) && norm(o.value).includes(q));
        return [...starts, ...contains];
    }, [opts, value, typed]);

    const exact = opts.some((o) => norm(o.value) === norm(value));
    const showCustom = !!norm(value) && !exact;

    useEffect(() => {
        const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => { setActive(-1); }, [shown.length, open]);

    useEffect(() => {
        if (active < 0 || !listRef.current) return;
        listRef.current.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const choose = (v) => {
        onChange(v);
        setTyped(false);
        setOpen(false);
    };

    const onKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) { setOpen(true); return; }
            setActive((i) => Math.min(shown.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(-1, i - 1));
        } else if (e.key === 'Enter') {
            if (open && active >= 0 && shown[active]) { e.preventDefault(); choose(shown[active].value); }
            else if (open) { e.preventDefault(); setOpen(false); }
        } else if (e.key === 'Escape') {
            if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        }
    };

    let lastGroup;
    return (
        <div className="cbx" ref={rootRef}>
            <div className="cbx-control">
                <input
                    ref={inputRef}
                    id={id}
                    name={name}
                    value={value}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    aria-invalid={invalid}
                    autoComplete={autoComplete}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    onChange={(e) => { setTyped(true); setOpen(true); onChange(e.target.value); }}
                    onFocus={() => { setTyped(false); setOpen(true); }}
                    onClick={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />
                <button type="button" className="cbx-toggle" tabIndex={-1} disabled={disabled}
                    aria-label="Show suggestions"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setTyped(false); setOpen((o) => !o); inputRef.current?.focus(); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
            </div>

            {open && !disabled && (
                <ul className="cbx-list" id={listId} role="listbox" ref={listRef}>
                    {shown.map((o, i) => {
                        const header = o.group && o.group !== lastGroup ? o.group : null;
                        if (o.group) lastGroup = o.group;
                        return (
                            <React.Fragment key={`${o.group || ''}-${o.value}`}>
                                {header && <li className="cbx-group" role="presentation">{header}</li>}
                                <li id={`${listId}-${i}`} data-idx={i} role="option"
                                    aria-selected={norm(o.value) === norm(value)}
                                    className={`cbx-option${i === active ? ' is-active' : ''}${norm(o.value) === norm(value) ? ' is-selected' : ''}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => choose(o.value)}>
                                    {o.swatch && <span className="cbx-swatch" style={{ background: o.swatch }} aria-hidden="true" />}
                                    <span>{o.value}</span>
                                </li>
                            </React.Fragment>
                        );
                    })}
                    {showCustom && (
                        <li className="cbx-option cbx-custom" role="option" aria-selected="false"
                            onMouseDown={(e) => e.preventDefault()} onClick={() => choose(String(value).trim())}>
                            Use “{String(value).trim()}”
                        </li>
                    )}
                    {shown.length === 0 && !showCustom && <li className="cbx-empty" role="presentation">{emptyText}</li>}
                </ul>
            )}
        </div>
    );
}
