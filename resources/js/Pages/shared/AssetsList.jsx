import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import { Boxes, Tag, Plus, ChevronRight } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'in_storage', label: 'In Storage' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_repair', label: 'In Repair' },
    { value: 'retired', label: 'Retired' },
    { value: 'lost', label: 'Lost' },
];

const statusBadgeClass = (status) => {
    switch (status) {
        case 'in_storage': return 'ds-badge ds-badge-default';
        case 'assigned': return 'ds-badge ds-badge-found';
        case 'in_repair': return 'ds-badge ds-badge-pending';
        case 'retired': return 'ds-badge ds-badge-default';
        case 'lost': return 'ds-badge ds-badge-rejected';
        default: return 'ds-badge ds-badge-default';
    }
};

const statusLabel = (status) => STATUS_OPTIONS.find((o) => o.value === status)?.label || status;

export default function AssetsList() {
    const { roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin'].includes(r));
    const toast = useToast();

    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        document.title = "Assets | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/assets', { params: { status: status || undefined, search: search || undefined } })
            .then((res) => setAssets(res.data.data?.data || []))
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load assets.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [status, search]);

    return (
        <DashboardShell
            eyebrow="Assets"
            title={isStaff ? 'Asset Registry' : 'My Assets'}
            subtitle={isStaff
                ? 'Every asset registered on your campus — register, assign, and track their condition here.'
                : 'Assets currently checked out to you.'}
            actions={isStaff && (
                <Link to="/app/security/assets/new" className="ds-btn ds-btn-primary">
                    <Plus size={16} style={{ verticalAlign: -3, marginRight: 4 }} /> Register Asset
                </Link>
            )}
        >
            {isStaff && (
                <div className="ds-card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className="ds-field" style={{ minWidth: 180 }}>
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="ds-field" style={{ minWidth: 220, flex: 1 }}>
                        <label>Search</label>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, tag, or serial number" />
                    </div>
                </div>
            )}

            <div className="ds-card">
                {loading && <div className="ds-skeleton" />}
                {!loading && assets.length === 0 && (
                    <div className="ds-empty">
                        <Boxes size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        {isStaff ? 'No assets match these filters.' : 'Nothing is currently checked out to you.'}
                    </div>
                )}
                {!loading && assets.length > 0 && (
                    <ul className="ds-list">
                        {assets.map((a) => (
                            <li key={a.id} className="ds-list-item">
                                <Link
                                    to={isStaff ? `/app/security/assets/${a.id}` : `/app/assets/${a.id}`}
                                    className="ds-list-item-main"
                                    style={{ minWidth: 0 }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <p className="ds-list-item-title">{a.name}</p>
                                        <p className="ds-list-item-meta">
                                            <Tag size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                            {a.asset_tag} · {a.category?.replace(/_/g, ' ')}
                                            {a.building?.name ? ` · ${a.building.name}` : ''}
                                        </p>
                                        {isStaff && a.assignee?.name && (
                                            <p className="ds-list-item-meta">Checked out to {a.assignee.name}</p>
                                        )}
                                    </div>
                                </Link>
                                <div className="ds-list-item-side" style={{ gap: 8 }}>
                                    <span className={statusBadgeClass(a.status)}>{statusLabel(a.status)}</span>
                                    <ChevronRight size={16} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
