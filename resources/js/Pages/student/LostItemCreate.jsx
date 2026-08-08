import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert } from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { useConfirm } from '../../context/ConfirmContext';

const EMPTY_FORM = { item_name: '', description: '', category: '', brand: '', color: '', model: '', location_lost: '', date_lost: '' };

const LEGITIMACY_NOTICE =
    "Before you continue: only file a report for an item you genuinely lost. Descriptions you enter here are cross-checked " +
    "against found-item records and used to verify claims, so please be accurate and honest rather than guessing or " +
    "filling this in as a test. Reports that turn out to be fake, exaggerated, or submitted as a joke are treated as " +
    "misuse of the Lost & Found system, and accounts that repeatedly do this may be suspended or disabled. By clicking " +
    "\"I Agree, Unlock Form\" you're confirming this report is genuine.";

export default function LostItemCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [unlocked, setUnlocked] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();

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

    const handleCancel = () => guardedAction(() => navigate('/app/lost-items'));

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
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            await axios.post('/lost-items', form, { silent: true });
            toast.success('Your lost item report has been submitted.', { title: 'Report filed' });
            navigate('/app/lost-items');
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

                {!unlocked && (
                    <div className="ds-lock-banner">
                        <div className="ds-lock-banner-icon"><Lock size={18} /></div>
                        <div className="ds-lock-banner-text">
                            <strong>Fields are locked.</strong> Tap <em>Add Report</em> and confirm the notice to fill this in.
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} autoComplete="off">
                    <fieldset disabled={!unlocked} className="ds-fieldset">
                    <div className="ds-field">
                        <label htmlFor="item_name">Item Name <span className="ds-required">*</span></label>
                        <input
                            id="item_name"
                            name="item_name"
                            value={form.item_name}
                            onChange={handleChange}
                            placeholder="e.g. Black umbrella"
                            aria-invalid={!!fieldErrors.item_name}
                            autoComplete="off"
                            required
                        />
                        <p className="ds-field-hint">A short, specific name — this is what shows up in search and in match results.</p>
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
                            autoComplete="off"
                            required
                        />
                        <p className="ds-field-hint">The more specific you are here, the better our matching engine — and Security — can confirm it's really yours.</p>
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
                                autoComplete="off"
                            />
                            <p className="ds-field-hint">General type — e.g. Electronics, Bag, ID/Documents, Clothing, Accessories.</p>
                        </div>
                        <div className="ds-field">
                            <label htmlFor="brand">Brand</label>
                            <input id="brand" name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Samsung" autoComplete="off" />
                            <p className="ds-field-hint">Leave blank if unbranded or you're not sure.</p>
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="color">Color</label>
                            <input id="color" name="color" value={form.color} onChange={handleChange} placeholder="e.g. Navy blue" autoComplete="off" />
                            <p className="ds-field-hint">Main color — the single biggest clue for matching.</p>
                        </div>
                        <div className="ds-field">
                            <label htmlFor="model">Model</label>
                            <input id="model" name="model" value={form.model} onChange={handleChange} placeholder="e.g. iPhone 13, Model XR-200" autoComplete="off" />
                            <p className="ds-field-hint">Only if it's printed on the item or its packaging — optional.</p>
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
                                autoComplete="off"
                            />
                            <p className="ds-field-hint">Be specific — building, room, or a nearby landmark works best.</p>
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
                            <p className="ds-field-hint">An approximate date is fine if you're not sure of the exact day.</p>
                        </div>
                    </div>
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
            </div>
            )}
        </DashboardShell>
    );
}