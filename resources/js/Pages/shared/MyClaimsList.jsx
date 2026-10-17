import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Package, ChevronRight, Eye, Trash2 } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { ClaimListSkeleton } from '../../Components/shared/ClaimSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { CLAIM_STATUS, claimStatusLabel, claimStatusBadgeClass } from '../../utils/claimStatus';
import { itemChannelLabel, itemChannelBadgeClass, itemChannelIcon } from '../../utils/itemChannel';
import { initialsOf } from '../../utils/initials';

const FILTERS = [
    { key: '', label: 'All' },
    ...Object.keys(CLAIM_STATUS).map((key) => ({ key, label: CLAIM_STATUS[key].label })),
];

// Place in the hand-over line (first come, first served). Only staff get a
// position from the API, and only for claims that are Ready for Release.
const QueueBadge = ({ claim }) => (claim.queue_position && claim.status === 'release_pending' ? (
    <span className={`ds-badge ${claim.queue_position === 1 ? 'ds-badge-found' : 'ds-badge-claimed'}`} title="Place in the release line, first come first served">
        {claim.queue_position === 1 ? 'Serve first' : `#${claim.queue_position} in line`}
    </span>
) : null);

export default function MyClaimsList() {
    const { roles } = useAuth();
    const isStaff = roles?.includes('security_officer') || roles?.includes('admin') || roles?.includes('staff');
    const isAdmin = roles?.includes('admin') || roles?.includes('staff');
    const toast = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // ?status=release_pending lets the Security dashboard deep-link straight
    // into the hand-over queue.
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState(() => (CLAIM_STATUS[searchParams.get('status')] ? searchParams.get('status') : ''));
    const [busyId, setBusyId] = useState(null);
    const [view, setView] = useViewMode('claims');

    useEffect(() => {
        document.title = "Claims | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        setError('');
        axios.get('/claims', { params: status ? { status } : {} })
            .then(res => setClaims(res.data.data))
            .catch(() => setError('Could not load claims.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [status]);

    const handleDelete = async (e, claim) => {
        e.preventDefault();
        e.stopPropagation();

        const ok = await confirm({
            title: 'Delete this claim?',
            message: `This will permanently remove the claim from ${claim.claimant?.name || 'this claimant'} for "${claim.found_item?.item_name || 'this item'}" (currently ${claimStatusLabel(claim.status)}). This can't be undone from the claims list.`,
            confirmLabel: 'Delete claim',
            cancelLabel: 'Keep it',
            tone: 'danger',
            typeToConfirm: { phrase: initialsOf(claim.claimant?.name), label: `Type the claimant's initials (${claim.claimant?.name || 'unknown'}) to confirm:` },
        });
        if (!ok) return;

        setBusyId(claim.id);
        try {
            await axios.delete(`/claims/${claim.id}`);
            setClaims((prev) => prev.filter((c) => c.id !== claim.id));
            toast.success('Claim deleted.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete this claim.', { title: 'Delete failed' });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <DashboardShell onRefresh={() => load()} refreshing={loading}
            eyebrow="Lost & Found"
            title={isStaff ? 'All Claims' : 'My Claims'}
            subtitle={isStaff ? 'Every claim submitted campus-wide.' : 'Track the status of items you\'ve claimed.'}
        >
            <div className="ds-card">
                {loading ? (
                    <ClaimListSkeleton />
                ) : (
                    <>
                        <div className="ds-list-head-row">
                            <div className="ds-filter-row" style={{ marginBottom: 0 }}>
                                {FILTERS.map((f) => (
                                    <button
                                        key={f.key || 'all'}
                                        type="button"
                                        className={`ds-filter-chip ${status === f.key ? 'is-active' : ''}`}
                                        onClick={() => setStatus(f.key)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <ViewToggle mode={view} onChange={setView} />
                        </div>

                        {isStaff && status === 'release_pending' && claims.length > 0 && (
                            <p className="ds-card-desc" style={{ margin: '10px 0' }}>
                                Release line — oldest claim first. Hand over in this order (first come, first served).
                            </p>
                        )}

                        {error && <div className="ds-error">{error}</div>}

                        {!error && claims.length === 0 && (
                            <div className="ds-empty">
                                {status ? `No ${claimStatusLabel(status).toLowerCase()} claims.` : 'No claims yet.'}
                            </div>
                        )}

                        {!error && claims.length > 0 && view === 'table' && (
                            <div className="ds-table-wrap">
                                <table className="ds-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>{isStaff ? 'Claimant' : 'Claim #'}</th>
                                            <th>Category</th>
                                            <th>Source</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {claims.map(c => {
                                            const ChannelIcon = itemChannelIcon(c.found_item?.intake_channel);
                                            return (
                                            <tr key={c.id} className="is-clickable" onClick={() => navigate(`/app/claims/${c.id}`)}>
                                                <td>
                                                    <div className="ds-table-cell-main">
                                                        <span className="ds-thumb">
                                                            {c.found_item?.image_url
                                                                ? <img src={c.found_item.image_url} alt="" />
                                                                : <Package size={17} />}
                                                        </span>
                                                        <span className="ds-table-title">{c.found_item?.item_name || 'Item'}</span>
                                                    </div>
                                                </td>
                                                <td className="ds-table-nowrap">{isStaff ? (c.claimant?.name || '—') : `#${c.id}`}</td>
                                                <td className="ds-table-nowrap">{c.found_item?.category || '—'}</td>
                                                <td className="ds-table-nowrap">
                                                    <span className={`${itemChannelBadgeClass(c.found_item?.intake_channel)} ds-badge-icon`}>
                                                        <ChannelIcon size={13} />
                                                        {itemChannelLabel(c.found_item?.intake_channel)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={claimStatusBadgeClass(c.status)}>{claimStatusLabel(c.status)}</span>
                                                    {isStaff && <> <QueueBadge claim={c} /></>}
                                                </td>
                                                <td>
                                                    <div className="ds-table-actions">
                                                        <span className="ds-btn ds-btn-view ds-btn-sm">
                                                            <Eye size={13} /> View
                                                        </span>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                className="ds-btn ds-btn-danger ds-btn-sm"
                                                                disabled={busyId === c.id}
                                                                onClick={(e) => handleDelete(e, c)}
                                                                title="Delete this claim"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!error && claims.length > 0 && view === 'cards' && (
                            <ul className="ds-list">
                                {claims.map(c => {
                                    const ChannelIcon = itemChannelIcon(c.found_item?.intake_channel);
                                    return (
                                    <li key={c.id} className="ds-list-item">
                                        <Link
                                            to={`/app/claims/${c.id}`}
                                            className="ds-list-item-link"
                                        >
                                            <div className="ds-list-item-main">
                                                <span className="ds-thumb">
                                                    {c.found_item?.image_url
                                                        ? <img src={c.found_item.image_url} alt="" />
                                                        : <Package size={19} />}
                                                </span>
                                                <div style={{ minWidth: 0 }}>
                                                    <p className="ds-list-item-title">{c.found_item?.item_name || 'Item'}</p>
                                                    <p className="ds-list-item-meta">
                                                        {isStaff ? `Claimant: ${c.claimant?.name}` : `Claim #${c.id}`}
                                                        {c.found_item?.category ? ` · ${c.found_item.category}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="ds-list-item-side">
                                                <span className={`${itemChannelBadgeClass(c.found_item?.intake_channel)} ds-badge-icon`}>
                                                    <ChannelIcon size={13} />
                                                    {itemChannelLabel(c.found_item?.intake_channel)}
                                                </span>
                                                {isStaff && <QueueBadge claim={c} />}
                                                <span className={claimStatusBadgeClass(c.status)}>{claimStatusLabel(c.status)}</span>
                                                <span className="ds-btn ds-btn-view ds-btn-sm">
                                                    <Eye size={13} /> View Details <ChevronRight size={13} />
                                                </span>
                                            </div>
                                        </Link>
                                        {isAdmin && (
                                            <button
                                                type="button"
                                                className="ds-btn ds-btn-danger ds-btn-sm ds-claim-delete-btn"
                                                style={{ marginLeft: 8, flexShrink: 0 }}
                                                disabled={busyId === c.id}
                                                onClick={(e) => handleDelete(e, c)}
                                                title="Delete this claim"
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        )}
                                    </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
