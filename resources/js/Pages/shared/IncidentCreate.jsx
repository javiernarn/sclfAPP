import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import AttachmentPicker from '../../Components/shared/AttachmentPicker';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { reportNotice } from '../../Components/shared/reportNotice';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import useReopenNotice from '../../hooks/useReopenNotice';
import useAutoSaveDraft from '../../hooks/useAutoSaveDraft';
import AutoSaveStatus from '../../Components/shared/AutoSaveStatus';

const CATEGORY_OPTIONS = [
    { value: 'theft', label: 'Theft' },
    { value: 'vandalism', label: 'Vandalism' },
    { value: 'trespassing', label: 'Trespassing' },
    { value: 'altercation', label: 'Altercation / Dispute' },
    { value: 'suspicious_activity', label: 'Suspicious Activity' },
    { value: 'safety_hazard', label: 'Safety Hazard' },
    { value: 'lost_item_dispute', label: 'Lost Item Dispute' },
    { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
];

// Local datetime-input value ("YYYY-MM-DDTHH:mm") for "now", used as the
// default so most reports (filed shortly after something happens) don't
// need the date picker touched at all.
const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

const EMPTY_FORM = {
    category: '',
    severity: 'medium',
    title: '',
    description: '',
    location_text: '',
    occurred_at: nowLocal(),
};


export default function IncidentCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [files, setFiles] = useState([]);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();
    const { user, roles } = useAuth();
    const [unlocked, setUnlocked] = useState(false);

    const fieldsDirty = Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key]);
    const isDirty = files.length > 0 || fieldsDirty;
    const draft = useAutoSaveDraft({ formKey: 'incident', value: form, initial: EMPTY_FORM, isDirty: fieldsDirty, onRestore: setForm });
    // With Auto Save on, leaving is safe (the draft is kept), so no "discard?" prompts.
    const { guardedAction } = useUnsavedChangesGuard(isDirty && !draft.autoSave, {
        message: "You've started filling out this incident report. If you leave now, what you've entered will be discarded.",
    });

    useEffect(() => {
        document.title = "Report a Security Incident | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setPageLoading(false), 350);
        return () => clearTimeout(t);
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (fieldErrors[e.target.name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[e.target.name]; return next; });
        }
    };

    const handleCancel = () => guardedAction(() => { draft.clearDraft(); navigate('/app/incidents'); });

    const handleUnlockRequest = async () => {
        const agreed = await confirm(reportNotice({
            kind: 'incident',
            printHref: user?.public_token ? `/app/print/${user.public_token}` : null,
            // Only students have a clearance that violations can block.
            clearance: Array.isArray(roles) && roles.includes('student'),
        }));
        if (agreed) setUnlocked(true);
    };

    // Back from "Check my violations" → show this notice again.
    useReopenNotice(handleUnlockRequest);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!unlocked) return;

        const understood = await confirm({
            title: 'Submit this incident report?',
            message: 'Once submitted, this incident report can no longer be edited or deleted by you. Only the Administrator can edit or remove it. Please double-check everything before you continue.',
            confirmLabel: 'Yes, submit report',
            cancelLabel: 'Go back',
            tone: 'danger',
        });
        if (!understood) return;
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            const payload = { ...form, occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : null };
            // Multipart so optional photos/videos can ride along with the report.
            const data = new FormData();
            Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== '') data.append(k, v); });
            files.forEach((f) => data.append('attachments[]', f));
            const res = await axios.post('/security-incidents', data, {
                silent: true,
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000, // videos can take a while on mobile data
            });
            draft.clearDraft();
            if (res.data.attachment_error) {
                toast.warning(res.data.attachment_error, { title: 'Report filed' });
            } else {
                toast.success('Your incident report has been submitted.', { title: 'Report filed' });
            }
            navigate(`/app/incidents/${res.data.data.id}`);
        } catch (err) {
            if (err?.approvalHandled) return; // approval dialog is showing
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Failed to submit. Please check your inputs.');
            setError(message);
            setFieldErrors(errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {});
            toast.error(message, { title: 'Could not submit report' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="Report a Security Incident"
            subtitle="Theft, vandalism, altercations, safety hazards, or anything else Security should know about."
        >
            {pageLoading ? (
                <FormSkeleton />
            ) : (
                <form className="ds-card" onSubmit={handleSubmit}>
                    <AutoSaveStatus autoSave={draft.autoSave} savedAt={draft.savedAt} synced={draft.synced} note="photos and videos aren't saved, re-attach them after a reload" />
                    {error && <div className="ds-error">{error}</div>}

                    {!unlocked && (
                        <div className="ds-lock-banner">
                            <div className="ds-lock-banner-icon"><Lock size={18} /></div>
                            <div className="ds-lock-banner-text">
                                <strong>Fields are locked.</strong> Tap <em>Add Report</em> and confirm the notice to fill this in.
                            </div>
                        </div>
                    )}

                    <fieldset disabled={!unlocked} className="ds-fieldset">

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Category</label>
                            <select name="category" value={form.category} onChange={handleChange} required aria-invalid={!!fieldErrors.category}>
                                <option value="">Choose…</option>
                                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {fieldErrors.category && <p className="ds-field-error">{fieldErrors.category}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Severity</label>
                            <select name="severity" value={form.severity} onChange={handleChange} required aria-invalid={!!fieldErrors.severity}>
                                {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {fieldErrors.severity && <p className="ds-field-error">{fieldErrors.severity}</p>}
                        </div>
                    </div>

                    <div className="ds-field">
                        <label>Title</label>
                        <input name="title" value={form.title} onChange={handleChange} required maxLength={150}
                            placeholder="Short summary, e.g. 'Bicycle stolen from rack near Gate 2'"
                            aria-invalid={!!fieldErrors.title} />
                        {fieldErrors.title && <p className="ds-field-error">{fieldErrors.title}</p>}
                    </div>

                    <div className="ds-field">
                        <label>Description</label>
                        <textarea name="description" value={form.description} onChange={handleChange} required rows={5}
                            placeholder="What happened, who was involved, and anything else Security should know."
                            aria-invalid={!!fieldErrors.description} />
                        {fieldErrors.description && <p className="ds-field-error">{fieldErrors.description}</p>}
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Where it happened</label>
                            <input name="location_text" value={form.location_text} onChange={handleChange} maxLength={255}
                                placeholder="e.g. Gate 2 bike rack, 3rd floor hallway" />
                        </div>
                        <div className="ds-field">
                            <label>When it happened</label>
                            <input type="datetime-local" name="occurred_at" value={form.occurred_at} onChange={handleChange}
                                max={nowLocal()} required aria-invalid={!!fieldErrors.occurred_at} />
                            {fieldErrors.occurred_at && <p className="ds-field-error">{fieldErrors.occurred_at}</p>}
                        </div>
                    </div>

                    <AttachmentPicker files={files} onChange={setFiles} disabled={loading}
                        hint={`Photos or a short video of the scene help Security understand what happened. Up to 5 files · photos 10 MB · videos 50 MB`} />
                    {fieldErrors.attachments && <p className="ds-field-error">{fieldErrors.attachments}</p>}

                    </fieldset>

                    {unlocked ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                                Cancel
                            </button>
                            <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={loading}>
                                {loading ? 'Submitting…' : 'Submit Report'}
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="ds-btn ds-btn-primary ds-btn-block" onClick={handleUnlockRequest}>
                            <ShieldAlert size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                            Add Report
                        </button>
                    )}
                </form>
            )}
        </DashboardShell>
    );
}
