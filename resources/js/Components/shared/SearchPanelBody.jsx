import React from 'react';
import { Clock, Search, X, Sparkles, ChevronRight, ChevronLeft } from '../icons';
import { CATEGORY_LABELS, FEATURED_LINK_COUNT } from '../../search/searchConfig';

const initialsOf = (name) =>
    (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// The one renderer behind both the desktop dropdown and the phone overlay.
// It's purely presentational — everything comes from useGlobalSearch().
// Nothing typed: suggested-for-you, recent searches, page shortcuts.
// Typing: type-ahead completions, matching pages, then grouped results.
// `showPages={false}` hides the "Go to" / "Pages" shortcuts — the desktop
// dropdown does that because the sidebar is always on screen there.
export default function SearchPanelBody({ search, showPages = true }) {
    const {
        trimmed, loading, categories, hasAnyResults,
        suggestions, pageLinks, recent,
        showRecent, setShowRecent,
        goTo, pickSuggestion, dropRecent, wipeRecent,
    } = search;

    const typing = trimmed.length > 0;
    const searching = trimmed.length >= 2;
    const links = !showPages || (showRecent && !typing) ? [] : typing ? pageLinks.slice(0, 6) : pageLinks.slice(0, FEATURED_LINK_COUNT);
    const nothingFound = searching && !loading && !hasAnyResults && links.length === 0 && suggestions.length === 0;

    return (
        <div className="ds-sp-body">
            {/* Empty box, "recent" view: every successful search, newest first. */}
            {!typing && showRecent && (
                <div className="ds-global-search-group">
                    <div className="ds-global-search-group-label ds-sp-label-row">
                        <button type="button" className="ds-sp-link-btn ds-sp-back" onClick={() => setShowRecent(false)}>
                            <ChevronLeft size={13} /> Recent searches
                        </button>
                        {recent.length > 0 && (
                            <button type="button" className="ds-sp-clear-all" onClick={wipeRecent}><X size={12} /> Clear all</button>
                        )}
                    </div>
                    {recent.length === 0 && (
                        <div className="ds-global-search-empty">No successful searches yet. Searches that find something show up here.</div>
                    )}
                    {recent.map((item) => (
                        <div key={item.id ?? item.term} className="ds-sp-recent-row">
                            <button
                                type="button"
                                className="ds-global-search-result ds-sp-recent"
                                onClick={() => pickSuggestion(item.term)}
                            >
                                <Clock size={14} className="ds-sp-lead" />
                                <span className="ds-global-search-result-title">{item.term}</span>
                            </button>
                            <button
                                type="button"
                                className="ds-global-search-clear ds-sp-remove"
                                onClick={() => dropRecent(item)}
                                title="Remove"
                                aria-label={`Remove ${item.term} from recent searches`}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Suggestions. With nothing typed, the label row also carries the
                clock button that opens the recent-searches view above. */}
            {!(showRecent && !typing) && (typing ? suggestions.length > 0 : true) && (
                <div className="ds-global-search-group">
                    <div className="ds-global-search-group-label ds-sp-label-row">
                        <span>{typing ? 'Suggestions' : 'Suggested for you'}</span>
                        {!typing && (
                            <button
                                type="button"
                                className="ds-sp-recent-btn"
                                onClick={() => setShowRecent(true)}
                                aria-label="Show recent searches"
                                title="Recent searches"
                            >
                                <Clock size={14} />
                                {recent.length > 0 && <span className="ds-sp-recent-count">{recent.length}</span>}
                            </button>
                        )}
                    </div>
                    {suggestions.map((s) => (
                        <button
                            type="button"
                            key={`${s.hint}-${s.query}`}
                            className="ds-global-search-result ds-sp-suggestion"
                            onClick={() => pickSuggestion(s.query)}
                        >
                            {typing ? <Search size={14} className="ds-sp-lead" /> : <Sparkles size={14} className="ds-sp-lead" />}
                            <span className="ds-global-search-result-text">
                                <span className="ds-global-search-result-title">{s.label}</span>
                            </span>
                            {s.hint && <span className="ds-sp-hint">{s.hint}</span>}
                        </button>
                    ))}
                    {!typing && suggestions.length === 0 && (
                        <div className="ds-global-search-empty">Start typing to search.</div>
                    )}
                </div>
            )}

            {links.length > 0 && (
                <div className="ds-global-search-group">
                    <div className="ds-global-search-group-label">{typing ? 'Pages' : 'Go to'}</div>
                    {links.map((link) => {
                        const Icon = link.icon;
                        return (
                            <button
                                type="button"
                                key={link.to}
                                className="ds-global-search-result"
                                onClick={() => goTo(link.to)}
                            >
                                <span className="ds-sp-page-icon"><Icon size={15} /></span>
                                <span className="ds-global-search-result-text">
                                    <span className="ds-global-search-result-title">{link.label}</span>
                                </span>
                                <ChevronRight size={14} className="ds-sp-chevron" />
                            </button>
                        );
                    })}
                </div>
            )}

            {searching && loading && !hasAnyResults && (
                <div className="ds-global-search-empty">Searching…</div>
            )}
            {nothingFound && (
                <div className="ds-global-search-empty">No matches for "{trimmed}".</div>
            )}

            {hasAnyResults && categories.map(([key, items]) => (
                <div key={key} className="ds-global-search-group">
                    <div className="ds-global-search-group-label">{CATEGORY_LABELS[key] || key}</div>
                    {items.map((item) => (
                        <button
                            type="button"
                            key={`${key}-${item.id}`}
                            className="ds-global-search-result"
                            // Staff-only "People" rows can come back without a url — a
                            // security officer sees the match (name, ID, campus) for
                            // identity verification, but there's no user-detail page
                            // their role can open, so the row isn't clickable.
                            disabled={!item.url}
                            onClick={() => item.url && goTo(item.url, { remember: trimmed })}
                        >
                            {item.avatar !== undefined && (
                                <span
                                    className="ds-avatar ds-global-search-result-avatar"
                                    style={item.avatar ? { backgroundImage: `url(${item.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                                >
                                    {!item.avatar && initialsOf(item.title)}
                                </span>
                            )}
                            <span className="ds-global-search-result-text">
                                <span className="ds-global-search-result-title">{item.title}</span>
                                {item.subtitle && <span className="ds-global-search-result-subtitle">{item.subtitle}</span>}
                            </span>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}
