import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
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

export default function ServiceRequestCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();

    const isDirty = Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key]);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            const payload = { ...form, department_id: form.department_id || null };
            const res = await axios.post('/service-requests', payload, { silent: true });
            toast.success('Your service request has been submitted.', { title: 'Request filed' });
            navigate(`/app/service-requests/${res.data.data.id}`);
        } catch (err) {
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

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={loading}>
                            {loading ? 'Submitting…' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            )}
        </DashboardShell>
    );
}
