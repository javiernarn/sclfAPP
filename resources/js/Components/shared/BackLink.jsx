import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '../icons';
import { getCameFrom, labelForPath, parentPathFor, isHomePath } from '../../utils/navHistory';

/**
 * "← Back to <the page you were just on>". Rendered once by DashboardShell, so
 * every role gets it on every page. Where the person came from is whatever
 * they actually clicked (see utils/navHistory.js); with no record (bookmark,
 * emailed link) it falls back to the page's parent list, e.g. a user's
 * details -> Users. Role home dashboards show nothing.
 */
export default function BackLink() {
    const location = useLocation();
    const navigate = useNavigate();

    if (isHomePath(location.pathname)) return null;

    const came = getCameFrom(location.key);
    const parent = parentPathFor(location.pathname);
    const target = came?.path || parent;
    if (!target) return null;

    const here = `${location.pathname}${location.search}`;
    if (target === here) return null;

    const go = () => {
        // A direct, one-step origin is a true "back": the history stack unwinds
        // instead of growing, so Back from Users doesn't offer to go forward again.
        if (came?.direct) navigate(-1);
        else navigate(target, { replace: !!came });
    };

    return (
        <button type="button" className="ds-back-link ds-back-btn" onClick={go} data-testid="back-link">
            <ArrowLeft size={14} /> Back to {labelForPath(target)}
        </button>
    );
}
