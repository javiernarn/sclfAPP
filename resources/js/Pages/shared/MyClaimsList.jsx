import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Eye } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import { ClaimListSkeleton } from '../../Components/shared/ClaimSkeleton';
import { useAuth } from '../../context/AuthContext';
import { CLAIM_STATUS, claimStatusLabel, claimStatusBadgeClass } from '../../utils/claimStatus';

const FILTERS = [
    { key: '', label: 'All' },
    ...Object.keys(CLAIM_STATUS).map((key) => ({ key, label: CLAIM_STATUS[key].label })),
];

export default function MyClaimsList() {
    const { roles } = useAuth();
    const isStaff = roles?.includes('security_officer') || roles?.includes('admin');
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

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
                        <div className="ds-filter-row">
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

                        {error && <div className="ds-error">{error}</div>}

                        {!error && claims.length === 0 && (
                            <div className="ds-empty">
                                {status ? `No ${claimStatusLabel(status).toLowerCase()} claims.` : 'No claims yet.'}
                            </div>
                        )}

                        {!error && claims.length > 0 && (
                            <ul className="ds-list">
                                {claims.map(c => (
                                    <li key={c.id} className="ds-list-item">
                                        <Link
                                            to={`/claims/${c.id}`}
                                            style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                <span className={claimStatusBadgeClass(c.status)}>{claimStatusLabel(c.status)}</span>
                                                <span className="ds-btn ds-btn-view ds-btn-sm">
                                                    <Eye size={13} /> View Details <ChevronRight size={13} />
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
