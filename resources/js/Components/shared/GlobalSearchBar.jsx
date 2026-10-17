import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from '../icons';
import useGlobalSearch from '../../search/useGlobalSearch';
import SearchPanelBody from './SearchPanelBody';
import './GlobalSearchBar.css';

// Header search box (desktop/laptop/tablet). Click it and, before typing,
// you get suggestions for your role, recent searches and page shortcuts;
// type and you get completions plus a handful of matches per category —
// each already scoped server-side to what this user may see (see
// SearchService). Phones use <MobileSearch>, which renders the exact same
// panel (SearchPanelBody) inside a full-width overlay.
//
// Non-staff (student/instructor) search everything their own account can
// already reach, but never the "People" category: looking someone up by
// student/staff ID is staff-only. Security officers and admins can search
// People by name or ID, scoped to their campus unless they're an admin.
// No pagination on purpose — each section's own list page has its filters.
export default function GlobalSearchBar() {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);
    const search = useGlobalSearch({ onNavigate: () => setOpen(false), enabled: open });
    const { query, setQuery, trimmed, loading, reset, rememberIfFound, hasAnyResults } = search;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const clear = () => {
        reset();
        inputRef.current?.focus();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
        } else if (e.key === 'Enter') {
            rememberIfFound(trimmed, hasAnyResults);
        }
    };

    return (
        <div className="ds-global-search" ref={wrapRef}>
            <div className="ds-global-search-input-wrap">
                <Search size={16} className="ds-global-search-icon" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder="Search everything…"
                    aria-label="Search"
                    aria-expanded={open}
                    autoComplete="off"
                    className="ds-global-search-input"
                />
                {loading && <Loader2 size={14} className="ds-global-search-spinner" />}
                {!loading && query && (
                    <button type="button" className="ds-global-search-clear" onClick={clear} aria-label="Clear search">
                        <X size={14} />
                    </button>
                )}
            </div>

            {open && (
                <div className="ds-global-search-panel">
                    <SearchPanelBody search={search} showPages={false} />
                </div>
            )}
        </div>
    );
}
