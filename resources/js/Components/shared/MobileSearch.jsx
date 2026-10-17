import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Search, X, Loader2 } from '../icons';
import useGlobalSearch from '../../search/useGlobalSearch';
import SearchPanelBody from './SearchPanelBody';
import './GlobalSearchBar.css';
import './MobileSearch.css';

const CLOSE_MS = 220;

// Phone search: a magnifier button in the header. Tapping it fades in a
// blurred backdrop over everything BELOW the header (the header itself stays
// put and tappable) and slides the search panel down from the header's
// bottom edge. The panel is the same one the desktop box drops down, so
// phones get identical suggestions, page shortcuts and results.
//
// The overlay is portaled into the .ds-shell (not the header): the header has
// a backdrop-filter, which would otherwise trap a fixed-position child inside
// the header's own box. Portaling into .ds-shell keeps the theme classes
// (light/dark/maroon...) working for the overlay's colors.
export default function MobileSearch() {
    const [mounted, setMounted] = useState(false);   // in the DOM
    const [shown, setShown] = useState(false);       // "open" class (drives the transition)
    const [top, setTop] = useState(0);
    const [host, setHost] = useState(null);
    const triggerRef = useRef(null);
    const inputRef = useRef(null);
    const closeTimer = useRef(null);
    const location = useLocation();

    const close = useCallback(() => {
        setShown(false);
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setMounted(false), CLOSE_MS);
    }, []);

    const search = useGlobalSearch({ onNavigate: close, enabled: mounted });
    const { query, setQuery, trimmed, loading, reset, rememberIfFound, hasAnyResults } = search;

    const open = () => {
        const trigger = triggerRef.current;
        const shell = trigger?.closest('.ds-shell');
        const header = trigger?.closest('.ds-topbar');
        if (!shell || !header) return;
        clearTimeout(closeTimer.current);
        setHost(shell);
        setTop(header.getBoundingClientRect().bottom);
        setMounted(true);
        // Next frame, so the closed -> open change actually transitions.
        requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    };

    // Focus after the panel starts sliding in (focusing during the
    // transition makes some mobile browsers jump the page).
    useEffect(() => {
        if (!shown) return undefined;
        const t = setTimeout(() => inputRef.current?.focus(), 120);
        return () => clearTimeout(t);
    }, [shown]);

    // A route change (or rotating the phone / the keyboard resizing the
    // header position) shouldn't leave a stale overlay behind.
    useEffect(() => { if (mounted) close(); /* eslint-disable-next-line */ }, [location.pathname]);

    useEffect(() => {
        if (!mounted) return undefined;
        const reposition = () => {
            const header = triggerRef.current?.closest('.ds-topbar');
            if (header) setTop(header.getBoundingClientRect().bottom);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('resize', reposition);
        window.addEventListener('orientationchange', reposition);
        document.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('orientationchange', reposition);
            document.removeEventListener('keydown', onKey);
        };
    }, [mounted, close]);

    useEffect(() => () => clearTimeout(closeTimer.current), []);

    const dismiss = () => {
        reset();
        close();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            rememberIfFound(trimmed, hasAnyResults);
            e.currentTarget.blur(); // hide the keyboard so results are visible
        }
    };

    return (
        <>
            <button
                type="button"
                ref={triggerRef}
                className="ds-icon-btn ds-mobile-search-btn"
                onClick={open}
                aria-label="Search"
                aria-haspopup="dialog"
                aria-expanded={mounted}
            >
                <Search size={18} />
            </button>

            {mounted && host && createPortal(
                <div
                    className={`ds-msearch ${shown ? 'is-open' : ''}`}
                    style={{ top }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Search"
                >
                    <div className="ds-msearch-backdrop" onClick={dismiss} />
                    <div className="ds-msearch-panel">
                        <div className="ds-global-search-input-wrap ds-msearch-input-wrap">
                            <Search size={16} className="ds-global-search-icon" />
                            <input
                                ref={inputRef}
                                type="search"
                                enterKeyHint="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder="Search everything…"
                                aria-label="Search"
                                autoComplete="off"
                                autoCorrect="off"
                                className="ds-global-search-input"
                            />
                            {loading && <Loader2 size={14} className="ds-global-search-spinner" />}
                            {!loading && query && (
                                <button type="button" className="ds-global-search-clear" onClick={() => { reset(); inputRef.current?.focus(); }} aria-label="Clear search">
                                    <X size={15} />
                                </button>
                            )}
                            <button type="button" className="ds-msearch-cancel" onClick={dismiss}>Cancel</button>
                        </div>
                        <div className="ds-msearch-scroll">
                            <SearchPanelBody search={search} />
                        </div>
                    </div>
                </div>,
                host
            )}
        </>
    );
}
