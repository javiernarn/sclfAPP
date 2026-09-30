import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Tag, MapPin, Calendar, UserCircle, Building2, DollarSign,
    Wrench, PackageCheck, PackageX, Lock, History, Pencil, Trash2,
    Check, X, ArrowLeft,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm, useDiscardConfirm } from '../../context/ConfirmContext';

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
    details_updated: 'Details edited',
    deleted: 'Deleted from registry',
}[action] || action);

const EDIT_FIELDS = ['name', 'description', 'brand', 'model', 'serial_number', 'location_text', 'acquired_at', 'value', 'condition_notes', 'notes'];

const toEditForm = (asset) => ({
    name: asset.name || '',
    description: asset.description || '',
    brand: asset.brand || '',
    model: asset.model || '',
    serial_number: asset.serial_number || '',
    location_text: asset.location_text || '',
    acquired_at: asset.acquired_at ? asset.acquired_at.slice(0, 10) : '',
    value: asset.value ?? '',
    condition_notes: asset.condition_notes || '',
    notes: asset.notes || '',
});

export default function AssetDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin', 'staff'].includes(r));
    const toast = useToast();
    const confirm = useConfirm();
    const discardConfirm = useDiscardConfirm();

    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [assignEmail, setAssignEmail] = useState('');
    const [actionNotes, setActionNotes] = useState('');

    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [editErrors, setEditErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

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

    const startEditing = () => {
        setEditForm(toEditForm(asset));
        setEditErrors({});
        setEditing(true);
    };

    const isEditDirty = editForm && JSON.stringify(editForm) !== JSON.stringify(toEditForm(asset || {}));

    const cancelEditing = async () => {
        if (!(await discardConfirm(isEditDirty))) return;
        setEditing(false);
        setEditForm(null);
        setEditErrors({});
    };

    const saveEdits = async () => {
        setSaving(true);
        setEditErrors({});
        try {
            const payload = { ...editForm, value: editForm.value === '' ? null : editForm.value };
            const res = await axios.patch(`/assets/${id}`, payload);
            setAsset(res.data.data);
            setEditing(false);
            setEditForm(null);
            toast.success('Asset details updated.', { title: 'Saved' });
        } catch (err) {
            if (err?.response?.status === 422 && err.response.data?.errors) {
                setEditErrors(err.response.data.errors);
            } else {
                toast.error(err?.response?.data?.message || 'Could not save changes.', { title: 'Save failed' });
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteAsset = async () => {
        const ok = await confirm({
            title: 'Delete this asset?',
            message: `This removes ${asset.asset_tag} · ${asset.name} from the registry. This cannot be undone.`,
            confirmLabel: 'Delete asset',
            tone: 'danger',
        });
        if (!ok) return;

        setDeleting(true);
        try {
            await axios.delete(`/assets/${id}`);
            toast.success('Asset deleted.', { title: 'Deleted' });
            navigate('/app/security/assets');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not delete this asset.', { title: 'Delete failed' });
        } finally {
            setDeleting(false);
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
            <Link to="/app/security/assets" className="ds-back-link">
                <ArrowLeft size={14} /> Back to Assets
            </Link>

            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Details</h3>
                    {isStaff && !editing && (
                        <button type="button" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={startEditing}>
                            <Pencil size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Edit Details
                        </button>
                    )}
                </div>

                {!editing && (
                    <>
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
                        {asset.notes && (
                            <div className="ds-field" style={{ marginTop: 12 }}>
                                <label>Notes</label>
                                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{asset.notes}</p>
                            </div>
                        )}
                    </>
                )}

                {editing && (
                    <div style={{ marginTop: 10 }}>
                        <div className="ds-form-row">
                            <div className="ds-field">
                                <label>Name</label>
                                <input value={editForm.name} maxLength={150} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                {editErrors.name && <span className="ds-field-error">{editErrors.name[0]}</span>}
                            </div>
                            <div className="ds-field">
                                <label>Location</label>
                                <input value={editForm.location_text} maxLength={255} onChange={(e) => setEditForm({ ...editForm, location_text: e.target.value })} />
                            </div>
                        </div>
                        <div className="ds-form-row">
                            <div className="ds-field">
                                <label>Brand</label>
                                <input value={editForm.brand} maxLength={100} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} />
                            </div>
                            <div className="ds-field">
                                <label>Model</label>
                                <input value={editForm.model} maxLength={100} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} />
                            </div>
                            <div className="ds-field">
                                <label>Serial number</label>
                                <input value={editForm.serial_number} maxLength={100} onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })} />
                            </div>
                        </div>
                        <div className="ds-form-row">
                            <div className="ds-field">
                                <label>Acquired on</label>
                                <input type="date" value={editForm.acquired_at} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEditForm({ ...editForm, acquired_at: e.target.value })} />
                            </div>
                            <div className="ds-field">
                                <label>Value (₱)</label>
                                <input type="number" min="0" step="0.01" value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} />
                            </div>
                        </div>
                        <div className="ds-field">
                            <label>Description</label>
                            <textarea rows={3} maxLength={2000} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                        </div>
                        <div className="ds-field">
                            <label>Condition notes</label>
                            <textarea rows={2} maxLength={1000} value={editForm.condition_notes} onChange={(e) => setEditForm({ ...editForm, condition_notes: e.target.value })} />
                        </div>
                        <div className="ds-field">
                            <label>Notes</label>
                            <textarea rows={2} maxLength={1000} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button type="button" className="ds-btn ds-btn-primary" disabled={saving} onClick={saveEdits}>
                                <Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                            <button type="button" className="ds-btn ds-btn-secondary" disabled={saving} onClick={cancelEditing}>
                                <X size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Cancel
                            </button>
                        </div>
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
            {isStaff && (
                <div className="ds-card">
                    <h3 style={{ color: '#dc2626' }}>Danger Zone</h3>
                    <p className="ds-card-desc">
                        Permanently remove this asset from the registry. This cannot be undone.
                        {asset.status === 'assigned' && ' It is currently checked out — return it to storage before deleting.'}
                    </p>
                    <button
                        type="button"
                        className="ds-btn ds-btn-danger"
                        disabled={deleting || asset.status === 'assigned'}
                        onClick={deleteAsset}
                    >
                        <Trash2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                        {deleting ? 'Deleting…' : 'Delete Asset'}
                    </button>
                </div>
            )}
        </DashboardShell>
    );
}
