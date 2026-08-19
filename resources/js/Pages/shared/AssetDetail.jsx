import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams } from 'react-router-dom';
import {
    Tag, MapPin, Calendar, UserCircle, Building2, DollarSign,
    Wrench, PackageCheck, PackageX, Lock, History,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="ds-info-item">
        <span className="ds-info-icon"><Icon size={16} /></span>
        <div className="ds-info-text">
            <div className="ds-info-label">{label}</div>
            <div className="ds-info-value">{value || '—'}</div>
        </div>
    </div>
);

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

const movementLabel = (action) => ({
    registered: 'Registered',
    assigned: 'Assigned',
    unassigned: 'Returned to storage',
    sent_for_repair: 'Sent for repair',
    returned_from_repair: 'Returned from repair',
    retired: 'Retired',
    reported_lost: 'Reported lost',
}[action] || action);

export default function AssetDetail() {
    const { id } = useParams();
    const { roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin'].includes(r));
    const toast = useToast();

    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [assignEmail, setAssignEmail] = useState('');
    const [actionNotes, setActionNotes] = useState('');

    useEffect(() => {
        document.title = "Asset Details | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get(`/assets/${id}`)
            .then((res) => setAsset(res.data.data))
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load this asset.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, [id]);

    const runAction = async (fn, successMessage, successTitle) => {
        setBusy(true);
        try {
            const res = await fn();
            toast.success(successMessage, { title: successTitle });
            setAsset(res.data.data);
            setActionNotes('');
        } catch (err) {
            const message = err?.response?.data?.errors
                ? Object.values(err.response.data.errors).flat().join('\n')
                : (err?.response?.data?.message || 'That action could not be completed.');
            toast.error(message, { title: 'Action failed' });
        } finally {
            setBusy(false);
        }
    };

    const assignByEmail = async () => {
        if (!assignEmail.trim()) {
            toast.error('Enter the custodian\'s email first.', { title: 'Email required' });
            return;
        }
        setBusy(true);
        try {
            const lookup = await axios.get('/users/lookup', { params: { email: assignEmail.trim() }, silent: true });
            const custodian = lookup.data.data;
            const res = await axios.post(`/assets/${id}/assign`, { user_id: custodian.id, notes: actionNotes || undefined });
            toast.success(`Checked out to ${custodian.name}.`, { title: 'Assigned' });
            setAsset(res.data.data);
            setAssignEmail('');
            setActionNotes('');
        } catch (err) {
            const message = err?.response?.status === 404
                ? 'No user found with that email.'
                : (err?.response?.data?.message || 'Could not assign this asset.');
            toast.error(message, { title: 'Could not assign' });
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell eyebrow="Assets" title="Asset Details">
                <div className="ds-card"><div className="ds-skeleton" /></div>
            </DashboardShell>
        );
    }

    if (!asset) {
        return (
            <DashboardShell eyebrow="Assets" title="Asset Details">
                <div className="ds-card">
                    <div className="ds-empty">
                        <Lock size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        This asset couldn't be found, or you don't have access to it.
                    </div>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell
            eyebrow="Assets"
            title={asset.name}
            subtitle={`${asset.asset_tag} · Registered ${new Date(asset.created_at).toLocaleDateString()}`}
            actions={<span className={statusBadgeClass(asset.status)}>{asset.status.replace(/_/g, ' ')}</span>}
        >
            <div className="ds-card">
                <h3>Details</h3>
                <div className="ds-info-grid">
                    <InfoItem icon={Tag} label="Category" value={asset.category?.replace(/_/g, ' ')} />
                    <InfoItem icon={Building2} label="Building" value={asset.building?.name} />
                    <InfoItem icon={MapPin} label="Location" value={asset.location_text} />
                    <InfoItem icon={UserCircle} label="Checked out to" value={asset.assignee?.name} />
                    <InfoItem icon={Calendar} label="Acquired" value={asset.acquired_at ? new Date(asset.acquired_at).toLocaleDateString() : null} />
                    <InfoItem icon={DollarSign} label="Value" value={asset.value ? `₱${Number(asset.value).toLocaleString()}` : null} />
                </div>
                {(asset.brand || asset.model || asset.serial_number) && (
                    <div className="ds-info-grid" style={{ marginTop: 8 }}>
                        <InfoItem icon={Tag} label="Brand / Model" value={[asset.brand, asset.model].filter(Boolean).join(' / ') || null} />
                        <InfoItem icon={Tag} label="Serial number" value={asset.serial_number} />
                    </div>
                )}
                {asset.description && (
                    <div className="ds-field" style={{ marginTop: 12 }}>
                        <label>Description</label>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{asset.description}</p>
                    </div>
                )}
                {asset.condition_notes && (
                    <div className="ds-field" style={{ marginTop: 12 }}>
                        <label>Condition notes</label>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{asset.condition_notes}</p>
                    </div>
                )}
            </div>

            {isStaff && !['retired', 'lost'].includes(asset.status) && (
                <div className="ds-card">
                    <h3>Manage This Asset</h3>

                    {asset.status !== 'assigned' && (
                        <div className="ds-form-row" style={{ marginBottom: 16 }}>
                            <div className="ds-field">
                                <label>Check out to (email)</label>
                                <input
                                    type="email"
                                    value={assignEmail}
                                    onChange={(e) => setAssignEmail(e.target.value)}
                                    placeholder="custodian@school.edu"
                                />
                            </div>
                            <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={assignByEmail}>
                                <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Assign
                            </button>
                        </div>
                    )}

                    <div className="ds-field">
                        <label>Notes (optional, applies to the action below)</label>
                        <input value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} maxLength={500} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                        {asset.status === 'assigned' && (
                            <button
                                className="ds-btn ds-btn-secondary"
                                disabled={busy}
                                onClick={() => runAction(
                                    () => axios.post(`/assets/${id}/unassign`, { notes: actionNotes || undefined }),
                                    'Returned to storage.',
                                    'Unassigned',
                                )}
                            >
                                <PackageX size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Return to Storage
                            </button>
                        )}

                        {asset.status !== 'in_repair' ? (
                            <button
                                className="ds-btn ds-btn-secondary"
                                disabled={busy}
                                onClick={() => runAction(
                                    () => axios.post(`/assets/${id}/send-for-repair`, { notes: actionNotes || undefined }),
                                    'Sent for repair.',
                                    'In Repair',
                                )}
                            >
                                <Wrench size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Send for Repair
                            </button>
                        ) : (
                            <button
                                className="ds-btn ds-btn-secondary"
                                disabled={busy}
                                onClick={() => runAction(
                                    () => axios.post(`/assets/${id}/return-from-repair`, { notes: actionNotes || undefined }),
                                    'Returned from repair.',
                                    'Back in Storage',
                                )}
                            >
                                <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Return from Repair
                            </button>
                        )}

                        <button
                            className="ds-btn ds-btn-secondary"
                            disabled={busy}
                            onClick={() => runAction(
                                () => axios.post(`/assets/${id}/report-lost`, { notes: actionNotes || undefined }),
                                'Asset reported lost.',
                                'Reported Lost',
                            )}
                        >
                            Report Lost
                        </button>

                        <button
                            className="ds-btn ds-btn-secondary"
                            disabled={busy}
                            onClick={() => runAction(
                                () => axios.post(`/assets/${id}/retire`, { notes: actionNotes || undefined }),
                                'Asset retired.',
                                'Retired',
                            )}
                        >
                            Retire Asset
                        </button>
                    </div>
                </div>
            )}

            {isStaff && asset.movements?.length > 0 && (
                <div className="ds-card">
                    <h3><History size={16} style={{ verticalAlign: -3, marginRight: 6 }} />History</h3>
                    <ul className="ds-list">
                        {asset.movements.map((m) => (
                            <li key={m.id} className="ds-list-item">
                                <div className="ds-list-item-main" style={{ minWidth: 0 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <p className="ds-list-item-title">{movementLabel(m.action)}</p>
                                        <p className="ds-list-item-meta">
                                            {m.to_user?.name ? `To ${m.to_user.name}` : ''}
                                            {m.from_user?.name ? `${m.to_user?.name ? ' · ' : ''}From ${m.from_user.name}` : ''}
                                            {m.mover?.name ? ` · By ${m.mover.name}` : ''}
                                        </p>
                                        <p className="ds-list-item-meta">{new Date(m.created_at).toLocaleString()}</p>
                                        {m.notes && <p className="ds-list-item-meta">{m.notes}</p>}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </DashboardShell>
    );
}
