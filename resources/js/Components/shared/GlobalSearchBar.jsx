import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from '../icons';
import axios from '../../config/axiosConfig';
import './GlobalSearchBar.css';

const CATEGORY_LABELS = {
    found_items: 'Found Items',
    lost_items: 'Lost Items',
    claims: 'Claims',
    security_incidents: 'Incidents',
    service_requests: 'Service Requests',
    assets: 'Assets',
    visitors: 'Visitors',
};

// Header search box: type 2+ characters, get back a handful of matches
// per category (each already scoped server-side to what this user is
// allowed to see — see SearchService). This is a "jump to the thing I'm
// thinking of" box, not a full search experience — there's no pagination
// here on purpose, someone who needs to page through results already has
// each section's own list page with its own filters.
export default function GlobalSearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const debounceRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setResults(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        debounceRef.current = setTimeout(() => {
            axios.get('/search', { params: { q: trimmed }, silent: true })
                .then((res) => setResults(res.data.data))
                .catch(() => setResults(null))
                .finally(() => setLoading(false));
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const clear = () => {
        setQuery('');
        setResults(null);
        setOpen(false);
    };

    const goTo = (url) => {
        setOpen(false);
        setQuery('');
        setResults(null);
        navigate(url);
    };

    const categories = results ? Object.entries(results).filter(([, items]) => items.length > 0) : [];
    const hasAnyResults = categories.length > 0;

    return (
        <div className="ds-global-search" ref={wrapRef}>
            <div className="ds-global-search-input-wrap">
                <Search size={16} className="ds-global-search-icon" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search everything…"
                    aria-label="Search"
                    className="ds-global-search-input"
                />
                {loading && <Loader2 size={14} className="ds-global-search-spinner" />}
                {!loading && query && (
                    <button type="button" className="ds-global-search-clear" onClick={clear} aria-label="Clear search">
                        <X size={14} />
                    </button>
                )}
            </div>

            {open && query.trim().length >= 2 && (
                <div className="ds-global-search-panel">
                    {loading && !results && (
                        <div className="ds-global-search-empty">Searching…</div>
                    )}
                    {!loading && !hasAnyResults && (
                        <div className="ds-global-search-empty">No matches for "{query.trim()}".</div>
                    )}
                    {hasAnyResults && categories.map(([key, items]) => (
                        <div key={key} className="ds-global-search-group">
                            <div className="ds-global-search-group-label">{CATEGORY_LABELS[key] || key}</div>
                            {items.map((item) => (
                                <button
                                    type="button"
                                    key={`${key}-${item.id}`}
                                    className="ds-global-search-result"
                                    onClick={() => goTo(item.url)}
                                >
                                    <span className="ds-global-search-result-title">{item.title}</span>
                                    {item.subtitle && <span className="ds-global-search-result-subtitle">{item.subtitle}</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
