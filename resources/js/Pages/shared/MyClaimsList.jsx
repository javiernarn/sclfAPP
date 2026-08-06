import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Eye, Trash2 } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { ClaimListSkeleton } from '../../Components/shared/ClaimSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { CLAIM_STATUS, claimStatusLabel, claimStatusBadgeClass } from '../../utils/claimStatus';
import { itemChannelLabel, itemChannelBadgeClass, itemChannelIcon } from '../../utils/itemChannel';

const FILTERS = [
    { key: '', label: 'All' },
    ...Object.keys(CLAIM_STATUS).map((key) => ({ key, label: CLAIM_STATUS[key].label })),
];

export default function MyClaimsList() {
    const { roles } = useAuth();
    const isStaff = roles?.includes('security_officer') || roles?.includes('admin');
    const isAdmin = roles?.includes('admin');
    const toast = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [view, setView] = useViewMode('claims');

    useEffect(() => {
        document.title = "Claims | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        setLoading(true);
        setError('');
        axios.get('/claims', { params: status ? { status } : {} })
            .then(res => setClaims(res.data.data))
            .catch(() => setError('Could not load claims.'))
            .finally(() => setLoading(false));
    }, [status]);

    const handleDelete = async (e, claim) => {
        e.preventDefault();
        e.stopPropagation();

        const ok = await confirm({
            title: 'Delete this claim?',
            message: `This will permanently remove the claim from ${claim.claimant?.name || 'this claimant'} for "${claim.found_item?.item_name || 'this item'}" (currently ${claimStatusLabel(claim.status)}). This can't be undone from the claims list.`,
            confirmLabel: 'Delete claim',
            cancelLabel: 'Keep it',
            tone: 'danger',
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
        <DashboardShell
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
                                            <tr key={c.id} className="is-clickable" onClick={() => navigate(`/claims/${c.id}`)}>
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
                                                <td><span className={claimStatusBadgeClass(c.status)}>{claimStatusLabel(c.status)}</span></td>
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
                                            to={`/claims/${c.id}`}
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
