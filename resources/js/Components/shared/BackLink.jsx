import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '../icons';
import { useAuth } from '../../context/AuthContext';
import { getCameFrom, labelForPath, parentPathFor, isHomePath } from '../../utils/navHistory';

/**
 * Path trail + back button, rendered once by DashboardShell so every role
 * (admin, staff, security, instructor, student) gets it on every page:
 *
 *   ← Back   Dashboard \ Users \ User Details
 *
 * Every part except the last is clickable. The middle is the page the person
 * actually came from (see utils/navHistory.js) plus the page's parent list.
 * Role home dashboards show nothing.
 */
export default function BackLink() {
    const location = useLocation();
    const navigate = useNavigate();
    const { roles } = useAuth();

    if (isHomePath(location.pathname)) return null;

    const home = roles?.includes('admin') || roles?.includes('staff')
        ? '/app/admin/dashboard'
        : roles?.includes('security_officer') ? '/app/security/dashboard' : '/app/dashboard';

    const came = getCameFrom(location.key);
    const parent = parentPathFor(location.pathname);
    const here = `${location.pathname}${location.search}`;
    const bare = (p) => String(p || '').split('?')[0];

    const crumbs = [{ label: 'Dashboard', to: home }];
    const add = (to) => {
        if (!to || bare(to) === location.pathname || isHomePath(bare(to))) return;
        if (crumbs.some((c) => bare(c.to) === bare(to))) return;
        crumbs.push({ label: labelForPath(to), to });
    };
    add(came?.path);
    add(parent);
    const currentLabel = labelForPath(location.pathname);

    const target = came?.path || parent || home;
    if (target === here) return null;
    const go = () => {
        // Direct one-step origin = a true back (history unwinds, no ping-pong).
        if (came?.direct) navigate(-1);
        else navigate(target, { replace: !!came });
    };

    return (
        <nav className="ds-crumbs" aria-label="Breadcrumb" data-testid="back-link">
            <button type="button" className="ds-back-link ds-back-btn" onClick={go}>
                <ArrowLeft size={14} /> Back
            </button>
            <ol className="ds-crumb-list">
                {crumbs.map((c) => (
                    <li key={c.to}>
                        <Link to={c.to}>{c.label}</Link>
                        <span className="ds-crumb-sep" aria-hidden="true">\</span>
                    </li>
                ))}
                <li aria-current="page"><strong>{currentLabel === 'previous page' ? 'This page' : currentLabel}</strong></li>
            </ol>
        </nav>
    );
}
