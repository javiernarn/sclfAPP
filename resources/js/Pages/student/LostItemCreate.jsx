import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

const EMPTY_FORM = { item_name: '', description: '', category: '', brand: '', color: '', model: '', location_lost: '', date_lost: '' };

export default function LostItemCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();

    const isDirty = Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key]);
    const { guardedAction } = useUnsavedChangesGuard(isDirty, {
        message: "You've started reporting this lost item. If you leave now, what you've entered will be discarded.",
    });

    useEffect(() => {
        document.title = "Report a Lost Item | SCLF - Opol Community College";
    }, []);

    // Brief grid-shaped skeleton on first mount so the page never pops the
    // form in instantly — matches the same loading feel as the dashboard.
    useEffect(() => {
        const t = setTimeout(() => setPageLoading(false), 450);
        return () => clearTimeout(t);
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (fieldErrors[e.target.name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[e.target.name]; return next; });
        }
    };

    const handleCancel = () => guardedAction(() => navigate('/lost-items'));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            await axios.post('/lost-items', form, { silent: true });
            toast.success('Your lost item report has been submitted.', { title: 'Report filed' });
            navigate('/lost-items');
        } catch (err) {
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Failed to submit. Please check your inputs.');
            setError(message);
            // Per-field errors (see backend's `item_name`/`description` required
            // rules in LostItemController) drive the same red-outline-on-invalid
            // treatment the rest of the app already uses — not just the banner.
            setFieldErrors(
                errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {}
            );
            toast.error(message, { title: 'Could not submit report' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title="Report a Lost Item"
            subtitle="Give as much detail as you can — it helps the community find a match faster."
        >
            {pageLoading ? (
                <FormSkeleton />
            ) : (
            <div className="ds-card">
                {error && <div className="ds-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="ds-field">
                        <label htmlFor="item_name">Item Name <span className="ds-required">*</span></label>
                        <input
                            id="item_name"
                            name="item_name"
                            value={form.item_name}
                            onChange={handleChange}
                            placeholder="e.g. Black umbrella"
                            aria-invalid={!!fieldErrors.item_name}
                            required
                        />
                        {fieldErrors.item_name && <div className="ds-field-error">{fieldErrors.item_name}</div>}
                    </div>

                    <div className="ds-field">
                        <label htmlFor="description">Description <span className="ds-required">*</span></label>
                        <textarea
                            id="description"
                            name="description"
                            rows={4}
                            value={form.description}
                            onChange={handleChange}
                            placeholder="Color, brand, distinguishing marks, contents…"
                            aria-invalid={!!fieldErrors.description}
                            required
                        />
                        {fieldErrors.description && <div className="ds-field-error">{fieldErrors.description}</div>}
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="category">Category</label>
                            <input
                                id="category"
                                name="category"
                                value={form.category}
                                onChange={handleChange}
                                placeholder="e.g. Electronics"
                            />
                        </div>
                        <div className="ds-field">
                            <label htmlFor="brand">Brand</label>
                            <input id="brand" name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Samsung" />
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="color">Color</label>
                            <input id="color" name="color" value={form.color} onChange={handleChange} />
                        </div>
                        <div className="ds-field">
                            <label htmlFor="model">Model</label>
                            <input id="model" name="model" value={form.model} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="location_lost">Location Lost</label>
                            <input
                                id="location_lost"
                                name="location_lost"
                                value={form.location_lost}
                                onChange={handleChange}
                                placeholder="e.g. Library, 2nd floor"
                            />
                        </div>
                        <div className="ds-field">
                            <label htmlFor="date_lost">Date Lost</label>
                            <input
                                id="date_lost"
                                type="date"
                                name="date_lost"
                                value={form.date_lost}
                                onChange={handleChange}
                            />
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
            </div>
            )}
        </DashboardShell>
    );
}
