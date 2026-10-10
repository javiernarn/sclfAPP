import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Tag, MapPin, Calendar, UserCircle, Building2, PhilippinePeso,
    Wrench, PackageCheck, PackageX, Lock, History, Pencil, Trash2,
    Check, X, ArrowLeft, Info,
} from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm, useDiscardConfirm } from '../../context/ConfirmContext';
import { roleAndName } from '../../utils/roleLabel';
import { formatPeso } from '../../utils/money';
import {
    assetStatusLabel, assetStatusBadgeClass, MOVEMENT_TITLES,
    movementToStatus, movementNote, describeMovement,
} from '../../utils/assetHistory';

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="ds-info-item">
        <span className="ds-info-icon"><Icon size={16} /></span>
        <div className="ds-info-text">
            <div className="ds-info-label">{label}</div>
            <div className="ds-info-value">{value || '—'}</div>
        </div>
    </div>
);

const toEditForm = (asset) => ({
    name: asset.name || '',
    description: asset.description || '',
    brand: asset.brand || '',
    model: asset.model || '',
    serial_number: asset.serial_number || '',
    building_name: asset.building_name || asset.building?.name || '',
    location_text: asset.location_text || '',
    acquired_at: asset.acquired_at ? asset.acquired_at.slice(0, 10) : '',
    value: asset.value ?? '',
    condition_notes: asset.condition_notes || '',
    notes: asset.notes || '',
});

// The status-changing actions in "Manage This Asset". `reason` actions need
// a typed reason (it becomes the history note); `confirm` ones are final.
const STATUS_ACTIONS = {
    unassign: {
        path: 'unassign', success: 'Returned to storage.', title: 'Returned', reason: false,
    },
    repair: {
        path: 'send-for-repair', success: 'Sent for repair.', title: 'In Repair', reason: true,
        reasonHint: 'Say what is wrong, e.g. "Screen cracked" or "Won\'t power on".',
    },
    repaired: {
        path: 'return-from-repair', success: 'Repair finished — back in storage.', title: 'Back in Storage', reason: false,
    },
    lost: {
        path: 'report-lost', success: 'Asset reported lost.', title: 'Reported Lost', reason: true,
        reasonHint: 'Say when and where it was last seen.',
        confirm: (a) => ({
            title: 'Report this asset as lost?',
            message: `${a.asset_tag} · ${a.name} will be marked Lost. This is final — it cannot be checked out or repaired afterwards.`,
            confirmLabel: 'Report lost',
        }),
    },
    retire: {
        path: 'retire', success: 'Asset retired.', title: 'Retired', reason: true,
        reasonHint: 'Say why it is being retired, e.g. "Beyond repair" or "Obsolete".',
        confirm: (a) => ({
            title: 'Retire this asset?',
            message: `${a.asset_tag} · ${a.name} will be retired and taken out of use. This is final — it cannot be checked out or repaired afterwards.`,
            confirmLabel: 'Retire asset',
        }),
    },
};

function HistoryTable({ movements }) {
    return (
        <div className="ds-table-wrap">
            <table className="ds-table ds-asset-history-table">
                <thead>
                    <tr>
                        <th>Date &amp; time</th>
                        <th>What happened</th>
                        <th>Status</th>
                        <th>Custodian</th>
                        <th>Done by</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    {movements.map((m) => {
                        const from = m.from_status;
                        const to = movementToStatus(m);
                        const note = movementNote(m);
                        return (
                            <tr key={m.id}>
                                <td className="ds-table-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                                <td>
                                    <div className="ds-table-title ds-wrap">{MOVEMENT_TITLES[m.action] || m.action}</div>
                                    <div className="ds-table-sub ds-wrap">{describeMovement(m)}</div>
                                </td>
                                <td className="ds-table-nowrap">
                                    <StatusChange from={from} to={to} action={m.action} />
                                </td>
                                <td>
                                    {m.from_user && <div className="ds-asset-person"><span>From</span> {roleAndName(m.from_user)}</div>}
                                    {m.to_user && <div className="ds-asset-person"><span>To</span> {roleAndName(m.to_user)}</div>}
                                    {!m.from_user && !m.to_user && '—'}
                                </td>
                                <td>{m.mover ? roleAndName(m.mover) : '—'}</td>
                                <td>{note ? <NoteLines note={note} /> : '—'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function HistoryCards({ movements }) {
    return (
        <div className="ds-asset-history-cards">
            {movements.map((m) => {
                const to = movementToStatus(m);
                const note = movementNote(m);
                return (
                    <div className="ds-history-card" key={m.id}>
                        <div className="ds-history-card-head">
                            <div style={{ minWidth: 0 }}>
                                <div className="ds-table-title ds-wrap">{MOVEMENT_TITLES[m.action] || m.action}</div>
                                <div className="ds-table-sub ds-wrap">{describeMovement(m)}</div>
                            </div>
                            <div className="ds-table-sub ds-asset-when">{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                        {to && (
                            <div className="ds-history-card-row">
                                <span className="ds-history-card-label">Status</span>
                                <span className="ds-history-card-value">
                                    <StatusChange from={m.from_status} to={to} action={m.action} />
                                </span>
                            </div>
                        )}
                        {m.from_user && (
                            <div className="ds-history-card-row">
                                <span className="ds-history-card-label">From</span>
                                <span className="ds-history-card-value">{roleAndName(m.from_user)}</span>
                            </div>
                        )}
                        {m.to_user && (
                            <div className="ds-history-card-row">
                                <span className="ds-history-card-label">To</span>
                                <span className="ds-history-card-value">{roleAndName(m.to_user)}</span>
                            </div>
                        )}
                        <div className="ds-history-card-row">
                            <span className="ds-history-card-label">Done by</span>
                            <span className="ds-history-card-value">{m.mover ? roleAndName(m.mover) : '—'}</span>
                        </div>
                        {note && (
                            <div className="ds-history-card-row">
                                <span className="ds-history-card-label">Details</span>
                                <span className="ds-history-card-value"><NoteLines note={note} /></span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// "In storage → Checked out" as two badges. When the status didn't change
// (an edit, a delete) it just shows the current status once.
function StatusChange({ from, to, action }) {
    if (!to) return '—';
    const unchanged = !from || from === to;
    if (unchanged) {
        return (
            <span className="ds-asset-status-change">
                <span className={assetStatusBadgeClass(to)}>{assetStatusLabel(to)}</span>
                {action === 'details_updated' && <span className="ds-table-sub">no change</span>}
            </span>
        );
    }
    return (
        <span className="ds-asset-status-change">
            <span className={assetStatusBadgeClass(from)}>{assetStatusLabel(from)}</span>
            <span aria-label="changed to">→</span>
            <span className={assetStatusBadgeClass(to)}>{assetStatusLabel(to)}</span>
        </span>
    );
}

// Edits are logged as "Location: A → B; Value: ₱1.00 → ₱2.00": one line each.
function NoteLines({ note }) {
    const lines = note.split('; ').filter(Boolean);
    if (lines.length <= 1) return <span className="ds-wrap" style={{ whiteSpace: 'pre-wrap' }}>{note}</span>;
    return (
        <ul className="ds-asset-note-list">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
    );
}

export default function AssetDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles } = useAuth();
    const isStaff = Array.isArray(roles) && roles.some((r) => ['security_officer', 'admin', 'staff'].includes(r));
    const toast = useToast();
    const confirm = useConfirm();
    const discardConfirm = useDiscardConfirm();
    const [historyView, setHistoryView] = useViewMode('asset-history');

    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [assignEmail, setAssignEmail] = useState('');
    const [actionNotes, setActionNotes] = useState('');
    const [reasonError, setReasonError] = useState('');

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

    // The action endpoints return the asset without its history, so reload
    // the full record afterwards — otherwise the new history row wouldn't
    // appear until a manual refresh.
    const reloadQuietly = () => axios.get(`/assets/${id}`).then((res) => setAsset(res.data.data)).catch(() => {});

    const runStatusAction = async (key) => {
        const action = STATUS_ACTIONS[key];
        const reason = actionNotes.trim();

        if (action.reason && !reason) {
            setReasonError(action.reasonHint);
            toast.error('Please write a reason first — it is saved in the asset history.', { title: 'Reason required' });
            return;
        }
        setReasonError('');

        if (action.confirm) {
            const ok = await confirm({ ...action.confirm(asset), tone: 'danger' });
            if (!ok) return;
        }

        setBusy(true);
        try {
            await axios.post(`/assets/${id}/${action.path}`, { notes: reason || undefined });
            toast.success(action.success, { title: action.title });
            setActionNotes('');
            await reloadQuietly();
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
            await axios.post(`/assets/${id}/assign`, { user_id: custodian.id, notes: actionNotes.trim() || undefined });
            toast.success(`Checked out to ${roleAndName(custodian)}.`, { title: 'Assigned' });
            setAssignEmail('');
            setActionNotes('');
            setReasonError('');
            await reloadQuietly();
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
            await axios.patch(`/assets/${id}`, payload);
            setEditing(false);
            setEditForm(null);
            toast.success('Asset details updated.', { title: 'Saved' });
            await reloadQuietly();
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

    const buildingText = asset.building_name || asset.building?.name;
    const isTerminal = ['retired', 'lost'].includes(asset.status);
    const lastRepair = [...(asset.movements || [])].find((m) => m.action === 'sent_for_repair');

    // One plain sentence on where the asset stands and what can be done next.
    const statusExplainer = (() => {
        switch (asset.status) {
            case 'in_storage':
                return 'Sitting in storage and available. You can check it out to someone, send it for repair, or retire it.';
            case 'assigned':
                return `Checked out to ${asset.assignee ? roleAndName(asset.assignee) : 'a custodian'}${asset.assigned_at ? ` since ${new Date(asset.assigned_at).toLocaleDateString()}` : ''}. Return it to storage when they hand it back, or transfer it to someone else.`;
            case 'in_repair':
                return `Out for repair${lastRepair ? ` since ${new Date(lastRepair.created_at).toLocaleDateString()}` : ''}. ${asset.condition_notes ? `Reason: ${asset.condition_notes}. ` : ''}When it is fixed, press “Repair finished” to put it back in storage.`;
            case 'retired':
                return 'Retired — taken out of use for good. The history below is kept for the record. To use the equipment again, register it as a new asset.';
            case 'lost':
                return 'Reported lost. The history below is kept for the record. If it turns up, register it again as a new asset.';
            default:
                return '';
        }
    })();

    const reasonLabel = asset.status === 'in_repair'
        ? 'Reason / notes (needed to report lost or retire)'
        : 'Reason / notes (needed to send for repair, report lost or retire)';

    return (
        <DashboardShell
            eyebrow="Assets"
            title={asset.name}
            subtitle={`${asset.asset_tag} · Registered ${new Date(asset.created_at).toLocaleDateString()}`}
            actions={<span className={assetStatusBadgeClass(asset.status)}>{assetStatusLabel(asset.status)}</span>}
        >
            <Link to="/app/security/assets" className="ds-back-link">
                <ArrowLeft size={14} /> Back to Assets
            </Link>

            <div className="ds-card">
                <div className="ds-card-head">
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
                            <InfoItem icon={Building2} label="Building" value={buildingText} />
                            <InfoItem icon={MapPin} label="Location" value={asset.location_text} />
                            <InfoItem icon={UserCircle} label="Checked out to" value={asset.assignee ? roleAndName(asset.assignee) : null} />
                            <InfoItem icon={Calendar} label="Acquired" value={asset.acquired_at ? new Date(asset.acquired_at).toLocaleDateString() : null} />
                            <InfoItem icon={PhilippinePeso} label="Value (PHP)" value={formatPeso(asset.value, null)} />
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
                        <div className="ds-form-row ds-form-row-2">
                            <div className="ds-field">
                                <label>Name</label>
                                <input value={editForm.name} maxLength={150} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                {editErrors.name && <span className="ds-field-error">{editErrors.name[0]}</span>}
                            </div>
                            <div className="ds-field">
                                <label>Building</label>
                                <input value={editForm.building_name} maxLength={150} placeholder="e.g. Main Building"
                                    onChange={(e) => setEditForm({ ...editForm, building_name: e.target.value })} />
                                {editErrors.building_name && <span className="ds-field-error">{editErrors.building_name[0]}</span>}
                            </div>
                        </div>
                        <div className="ds-form-row ds-form-row-2">
                            <div className="ds-field">
                                <label>Location</label>
                                <input value={editForm.location_text} maxLength={255} placeholder="e.g. Room 204, IT storage cabinet"
                                    onChange={(e) => setEditForm({ ...editForm, location_text: e.target.value })} />
                            </div>
                            <div className="ds-field">
                                <label>Value (₱ PHP)</label>
                                <div className="ds-peso-input">
                                    <span aria-hidden="true">₱</span>
                                    <input type="number" min="0" step="0.01" value={editForm.value} placeholder="0.00"
                                        onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} />
                                </div>
                                {editErrors.value && <span className="ds-field-error">{editErrors.value[0]}</span>}
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
                        <div className="ds-form-row ds-form-row-2">
                            <div className="ds-field">
                                <label>Acquired on</label>
                                <input type="date" value={editForm.acquired_at} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEditForm({ ...editForm, acquired_at: e.target.value })} />
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

                        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
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

            {isStaff && (
                <div className="ds-card">
                    <h3>Manage This Asset</h3>

                    <div className={`ds-asset-state ds-asset-state-${asset.status}`}>
                        <span className={assetStatusBadgeClass(asset.status)}>{assetStatusLabel(asset.status)}</span>
                        <p>{statusExplainer}</p>
                    </div>

                    {isTerminal ? null : (
                        <>
                            <div className="ds-asset-section">
                                <h4>Who has it</h4>
                                <p className="ds-card-desc">
                                    {asset.status === 'assigned'
                                        ? 'Transfer it straight to another person, or take it back into storage.'
                                        : 'Give it to a person by their school email. They will see it under “My Assets”.'}
                                </p>
                                <div className="ds-asset-inline">
                                    <div className="ds-field">
                                        <label>{asset.status === 'assigned' ? 'Transfer to (email)' : 'Check out to (email)'}</label>
                                        <input
                                            type="email"
                                            value={assignEmail}
                                            onChange={(e) => setAssignEmail(e.target.value)}
                                            placeholder="custodian@school.edu"
                                        />
                                    </div>
                                    <button type="button" className="ds-btn ds-btn-secondary" disabled={busy} onClick={assignByEmail}>
                                        <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                                        {asset.status === 'assigned' ? 'Transfer' : 'Check Out'}
                                    </button>
                                </div>
                                {asset.status === 'assigned' && (
                                    <button type="button" className="ds-btn ds-btn-secondary" disabled={busy} onClick={() => runStatusAction('unassign')}>
                                        <PackageX size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Return to Storage
                                    </button>
                                )}
                            </div>

                            <div className="ds-field">
                                <label>{reasonLabel}</label>
                                <input
                                    value={actionNotes}
                                    onChange={(e) => { setActionNotes(e.target.value); if (reasonError) setReasonError(''); }}
                                    maxLength={500}
                                    aria-invalid={!!reasonError}
                                    placeholder="Saved in the history for whichever action you press below"
                                />
                                {reasonError && <p className="ds-field-error">{reasonError}</p>}
                            </div>

                            <div className="ds-asset-section">
                                <h4>Repair</h4>
                                {asset.status !== 'in_repair' ? (
                                    <>
                                        <p className="ds-card-desc">Broken or needs servicing? Send it for repair — whoever has it is cleared, and the reason is recorded.</p>
                                        <button type="button" className="ds-btn ds-btn-secondary" disabled={busy} onClick={() => runStatusAction('repair')}>
                                            <Wrench size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Send for Repair
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="ds-card-desc">It has been fixed and is back? Mark the repair as finished — it goes back into storage, ready to be checked out again.</p>
                                        <button type="button" className="ds-btn ds-btn-secondary" disabled={busy} onClick={() => runStatusAction('repaired')}>
                                            <PackageCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Repair Finished
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="ds-asset-section ds-asset-section-final">
                                <h4>Final actions</h4>
                                <p className="ds-card-desc">These cannot be undone. The asset stays in the history for the record but can no longer be used.</p>
                                <div className="ds-asset-actions">
                                    <button type="button" className="ds-btn ds-btn-danger" disabled={busy} onClick={() => runStatusAction('lost')}>
                                        Report Lost
                                    </button>
                                    <button type="button" className="ds-btn ds-btn-danger" disabled={busy} onClick={() => runStatusAction('retire')}>
                                        Retire Asset
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {isStaff && (
                <details className="ds-card ds-asset-guide">
                    <summary><Info size={15} /> How asset handling works</summary>
                    <ol>
                        <li><strong>Register</strong> — a new asset gets a tag like AST-2026-0001 and starts <em>In storage</em>.</li>
                        <li><strong>Check out</strong> — give it to a person by email; it becomes <em>Checked out</em>. Transfer it to someone else at any time.</li>
                        <li><strong>Return to storage</strong> — when the person hands it back and it still works.</li>
                        <li><strong>Repair</strong> — if it breaks, send it for repair with a reason (any custodian is cleared). When it is fixed press <em>Repair finished</em> to put it back in storage.</li>
                        <li><strong>Report lost / Retire</strong> — final. A reason and a confirmation are required. It stays in the history, but to use the equipment again you register it as a new asset.</li>
                        <li><strong>Edit details</strong> — the History records exactly which fields changed. <strong>Delete</strong> is only for mistakes and is blocked while the asset is checked out.</li>
                    </ol>
                </details>
            )}

            {isStaff && asset.movements?.length > 0 && (
                <div className="ds-card">
                    <div className="ds-list-head-row">
                        <h3><History size={16} style={{ verticalAlign: -3, marginRight: 6 }} />History</h3>
                        <ViewToggle mode={historyView} onChange={setHistoryView} />
                    </div>
                    <p className="ds-card-desc">Newest first. Every change to this asset, who did it, and when.</p>
                    {historyView === 'table'
                        ? <HistoryTable movements={asset.movements} />
                        : <HistoryCards movements={asset.movements} />}
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
