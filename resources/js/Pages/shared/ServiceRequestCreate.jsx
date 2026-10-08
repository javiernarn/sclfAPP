import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import AttachmentPicker from '../../Components/shared/AttachmentPicker';
import { useConfirm } from '../../context/ConfirmContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

const CATEGORY_OPTIONS = [
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'it_support', label: 'IT Support' },
    { value: 'facilities', label: 'Facilities' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];

const EMPTY_FORM = {
    category: '',
    priority: 'medium',
    title: '',
    description: '',
    location_text: '',
    department_id: '',
};

const LEGITIMACY_NOTICE =
    "Before you continue: only submit a service request for a problem that really exists. Facilities, IT and maintenance " +
    "staff are dispatched based on what you write here, so please describe it accurately and honestly rather than guessing, " +
    "exaggerating, or filling it in as a test. This request is kept as an official campus record, and any photos or videos " +
    "you attach can be viewed by Security, Admin and Staff. Requests that turn out to be false, exaggerated, or submitted as " +
    "a joke waste staff time, are treated as misuse of the system, and accounts that repeatedly do this may be suspended or " +
    "disabled. By clicking \"I Agree, Unlock Form\" you're confirming this request is genuine.";

export default function ServiceRequestCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [files, setFiles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();
    const [unlocked, setUnlocked] = useState(false);

    const isDirty = files.length > 0 || Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key]);
    const { guardedAction } = useUnsavedChangesGuard(isDirty, {
        message: "You've started filling out this service request. If you leave now, what you've entered will be discarded.",
    });

    useEffect(() => {
        document.title = "Submit a Service Request | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/departments')
            .then((res) => setDepartments(res.data || []))
            .catch(() => setDepartments([]))
            .finally(() => setPageLoading(false));
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (fieldErrors[e.target.name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[e.target.name]; return next; });
        }
    };

    const handleCancel = () => guardedAction(() => navigate('/app/service-requests'));

    const handleUnlockRequest = async () => {
        const agreed = await confirm({
            title: 'Make sure this report is genuine',
            message: LEGITIMACY_NOTICE,
            confirmLabel: 'I Agree, Unlock Form',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (agreed) setUnlocked(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!unlocked) return;
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            const payload = { ...form, department_id: form.department_id || null };
            // Multipart so optional photos/videos can ride along with the request.
            const data = new FormData();
            Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== '') data.append(k, v); });
            files.forEach((f) => data.append('attachments[]', f));
            const res = await axios.post('/service-requests', data, {
                silent: true,
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000, // videos can take a while on mobile data
            });
            if (res.data.attachment_error) {
                toast.warning(res.data.attachment_error, { title: 'Request filed' });
            } else {
                toast.success('Your service request has been submitted.', { title: 'Request filed' });
            }
            navigate(`/app/service-requests/${res.data.data.id}`);
        } catch (err) {
            if (err?.approvalHandled) return; // approval dialog is showing
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Failed to submit. Please check your inputs.');
            setError(message);
            setFieldErrors(errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {});
            toast.error(message, { title: 'Could not submit request' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardShell
            eyebrow="Facilities"
            title="Submit a Service Request"
            subtitle="A broken fixture, an IT problem, a cleaning need — anything Facilities or IT should handle."
        >
            {pageLoading ? (
                <FormSkeleton />
            ) : (
                <form className="ds-card" onSubmit={handleSubmit}>
                    {error && <div className="ds-error">{error}</div>}

                    {!unlocked && (
                        <div className="ds-lock-banner">
                            <div className="ds-lock-banner-icon"><Lock size={18} /></div>
                            <div className="ds-lock-banner-text">
                                <strong>Fields are locked.</strong> Tap <em>Add Request</em> and confirm the notice to fill this in.
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
                            <label>Priority</label>
                            <select name="priority" value={form.priority} onChange={handleChange} required>
                                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="ds-field">
                        <label>Title</label>
                        <input name="title" value={form.title} onChange={handleChange} required maxLength={150}
                            placeholder="Short summary, e.g. 'Aircon not cooling in Room 204'"
                            aria-invalid={!!fieldErrors.title} />
                        {fieldErrors.title && <p className="ds-field-error">{fieldErrors.title}</p>}
                    </div>

                    <div className="ds-field">
                        <label>Description</label>
                        <textarea name="description" value={form.description} onChange={handleChange} required rows={5}
                            placeholder="What's wrong, and anything staff should know before they head over."
                            aria-invalid={!!fieldErrors.description} />
                        {fieldErrors.description && <p className="ds-field-error">{fieldErrors.description}</p>}
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Where</label>
                            <input name="location_text" value={form.location_text} onChange={handleChange} maxLength={255}
                                placeholder="e.g. Room 204, 2nd floor" />
                        </div>
                        <div className="ds-field">
                            <label>Route to a department (optional)</label>
                            <select name="department_id" value={form.department_id} onChange={handleChange}>
                                <option value="">No preference</option>
                                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <AttachmentPicker files={files} onChange={setFiles} disabled={loading}
                        hint="A photo or short video of the problem helps staff know what to bring. Up to 5 files · photos 10 MB · videos 50 MB" />
                    {fieldErrors.attachments && <p className="ds-field-error">{fieldErrors.attachments}</p>}

                    </fieldset>

                    {unlocked ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                                Cancel
                            </button>
                            <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={loading}>
                                {loading ? 'Submitting…' : 'Submit Request'}
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="ds-btn ds-btn-primary ds-btn-block" onClick={handleUnlockRequest}>
                            <ShieldAlert size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                            Add Request
                        </button>
                    )}
                </form>
            )}
        </DashboardShell>
    );
}
