import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

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
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();

    const isDirty = Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key]);
    const { guardedAction } = useUnsavedChangesGuard(isDirty, {
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

    const handleCancel = () => guardedAction(() => navigate('/app/incidents'));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            const payload = { ...form, occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : null };
            const res = await axios.post('/security-incidents', payload, { silent: true });
            toast.success('Your incident report has been submitted.', { title: 'Report filed' });
            navigate(`/app/incidents/${res.data.data.id}`);
        } catch (err) {
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
                    {error && <div className="ds-error">{error}</div>}

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

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={loading}>
                            {loading ? 'Submitting…' : 'Submit Report'}
                        </button>
                    </div>
                </form>
            )}
        </DashboardShell>
    );
}
