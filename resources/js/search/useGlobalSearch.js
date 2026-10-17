import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { filterQuickLinks, quickLinksFor } from './searchConfig';

const DEBOUNCE_MS = 250;

// Everything the search UI needs, shared by the desktop header box and the
// phone overlay so the two can never drift apart:
//   - `results`     grouped matches from GET /search (2+ characters)
//   - `suggestions` type-ahead completions (1+ character) or, with nothing
//                   typed, the role-aware "suggested for you" list
//   - `pageLinks`   role-based shortcuts to pages (filtered as you type)
//   - `recent`      this account's successful searches, [{id, term}], stored
//                   in the recent_searches table (private to the account)
// Server-side scoping (what each role may see) lives in SearchService; this
// hook only asks and displays. `enabled` keeps it silent until the search UI
// is actually opened — every page mounts its own shell, so without it each
// page load would fire requests for a box nobody touched.
export default function useGlobalSearch({ onNavigate, enabled = true } = {}) {
    const { user, roles } = useAuth();
    const navigate = useNavigate();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recent, setRecent] = useState([]);
    // true = the panel shows the full recent-searches list instead of suggestions
    const [showRecent, setShowRecent] = useState(false);

    // Latest-request-wins guards, so a slow earlier response can't overwrite
    // a newer one when someone types quickly.
    const searchSeq = useRef(0);
    const suggestSeq = useRef(0);

    const trimmed = query.trim();
    const links = useMemo(() => quickLinksFor(roles, user), [roles, user]);
    const pageLinks = useMemo(() => filterQuickLinks(links, trimmed), [links, trimmed]);

    // Load this account's saved searches whenever the search UI opens.
    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        axios.get('/search/recent', { silent: true })
            .then((res) => { if (!cancelled) setRecent(res.data.data || []); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [enabled, user?.id]);

    // Full results — 2+ characters, debounced.
    useEffect(() => {
        if (!enabled || trimmed.length < 2) {
            searchSeq.current += 1;
            setResults(null);
            setLoading(false);
            return undefined;
        }

        setLoading(true);
        const seq = ++searchSeq.current;
        const t = setTimeout(() => {
            axios.get('/search', { params: { q: trimmed }, silent: true })
                .then((res) => { if (seq === searchSeq.current) setResults(res.data.data); })
                .catch(() => { if (seq === searchSeq.current) setResults(null); })
                .finally(() => { if (seq === searchSeq.current) setLoading(false); });
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [trimmed, enabled]);

    // Suggestions — immediately useful, so they're fetched for an empty box
    // too (that's the "suggested for you" list).
    useEffect(() => {
        const seq = ++suggestSeq.current;
        if (!enabled) return undefined;
        const t = setTimeout(() => {
            axios.get('/search/suggestions', { params: { q: trimmed }, silent: true })
                .then((res) => { if (seq === suggestSeq.current) setSuggestions(res.data.data || []); })
                .catch(() => { if (seq === suggestSeq.current) setSuggestions([]); });
        }, trimmed ? 150 : 0);
        return () => clearTimeout(t);
    }, [trimmed, enabled]);

    // Saved on the server. The list updates instantly (moved to the top) and
    // is then replaced by the server's copy, which carries the row ids.
    const remember = useCallback((term) => {
        const t = term.trim();
        if (t.length < 2) return;
        setRecent((list) => [{ id: null, term: t }, ...list.filter((r) => r.term.toLowerCase() !== t.toLowerCase())].slice(0, 20));
        axios.post('/search/recent', { term: t }, { silent: true })
            .then((res) => setRecent(res.data.data || []))
            .catch(() => {});
    }, []);

    const reset = useCallback(() => {
        setQuery('');
        setResults(null);
        setShowRecent(false);
    }, []);

    // Leaving the search (panel closed) always returns to the default view.
    useEffect(() => { if (!enabled) setShowRecent(false); }, [enabled]);

    // Open a result or page. The typed term is remembered only when it led
    // somewhere — that's what makes it worth showing again.
    const goTo = useCallback((url, { remember: term } = {}) => {
        if (term) remember(term);
        reset();
        onNavigate?.();
        navigate(url);
    }, [navigate, onNavigate, remember, reset]);

    const pickSuggestion = useCallback((text) => {
        setShowRecent(false);
        setQuery(text);
    }, []);

    // A search is only "successful" (worth remembering) when something in it
    // can actually be opened. Rows without a url — e.g. the People rows an
    // officer can see for ID checks but has no page to open — don't count, so
    // a search that ends in a restricted/non-clickable result isn't saved.
    const categories = results ? Object.entries(results).filter(([, items]) => items.length > 0) : [];
    const hasAnyResults = categories.length > 0;
    const hasOpenableResults = categories.some(([, items]) => items.some((item) => item.url));

    // Enter: remember only if the search found something openable.
    const rememberIfFound = useCallback((term) => {
        if (hasOpenableResults && term.trim().length >= 2) remember(term);
    }, [remember, hasOpenableResults]);

    // The "x" on one entry.
    const dropRecent = useCallback((item) => {
        setRecent((list) => list.filter((r) => r.term !== item.term));
        if (item.id == null) return;
        axios.delete(`/search/recent/${item.id}`, { silent: true })
            .then((res) => setRecent(res.data.data || []))
            .catch(() => {});
    }, []);

    // "Clear all".
    const wipeRecent = useCallback(() => {
        setRecent([]);
        axios.delete('/search/recent', { silent: true }).catch(() => {});
    }, []);

    return {
        showRecent, setShowRecent, rememberIfFound,
        query, setQuery, trimmed,
        results, categories, hasAnyResults,
        suggestions, pageLinks, recent,
        loading,
        goTo, remember, reset, pickSuggestion, dropRecent, wipeRecent,
    };
}
