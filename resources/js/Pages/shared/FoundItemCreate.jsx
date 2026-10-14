import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert } from '../../Components/icons';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { useConfirm } from '../../context/ConfirmContext';
import ItemReportFields from '../../Components/shared/ItemReportFields';

const EMPTY_FORM = {
    item_name: '', description: '', category: '', brand: '', color: '', model: '',
    unique_characteristics: '', location_found: '', date_found: '', details: {},
};

const LEGITIMACY_NOTICE =
    "Before you continue: only file a report for an item you actually found. What you enter here is what Security uses " +
    "to verify the rightful owner, so please describe it accurately and honestly rather than guessing or filling this " +
    "in as a test. Reports that turn out to be fake, exaggerated, or submitted as a joke are treated as misuse of the " +
    "Lost & Found system, and accounts that repeatedly do this may be suspended or disabled. By clicking " +
    "\"I Agree, Unlock Form\" you're confirming this report is genuine.";

export default function FoundItemCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [image, setImage] = useState(null);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [unlocked, setUnlocked] = useState(false);
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();

    const isDirty = Object.entries(form).some(([key, value]) => (key === 'details' ? Object.values(value || {}).some(Boolean) : value !== EMPTY_FORM[key])) || !!image;
    const { guardedAction } = useUnsavedChangesGuard(isDirty, {
        message: "You've started reporting this found item. If you leave now, what you've entered will be discarded.",
    });

    useEffect(() => {
        document.title = "Report a Found Item | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setPageLoading(false), 350);
        return () => clearTimeout(t);
    }, []);

    const clearFieldError = (name) => {
        setFieldErrors((prev) => {
            if (!prev[name]) return prev;
            const next = { ...prev }; delete next[name]; return next;
        });
    };

    const handleCancel = () => guardedAction(() => navigate('/app/found-items'));

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
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => {
                if (k === 'details') {
                    Object.entries(v || {}).filter(([, dv]) => dv).forEach(([dk, dv]) => data.append(`details[${dk}]`, dv));
                } else {
                    data.append(k, v ?? '');
                }
            });
            if (image) data.append('image', image);

            await axios.post('/found-items', data, { headers: { 'Content-Type': 'multipart/form-data' }, silent: true });
            toast.success('Thank you — your found item report has been submitted for verification.', { title: 'Report filed' });
            navigate('/app/found-items');
        } catch (err) {
            if (err?.approvalHandled) return; // approval dialog is showing
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Failed to submit. Please check your inputs.');
            setError(message);
            // Per-field errors drive the same red-outline-on-invalid treatment
            // used across the rest of the app (Admin Users, Register, etc).
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
            title="Report a Found Item"
            subtitle="Thank you for turning this in — Security will verify your report before it's stored."
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
                    <ItemReportFields kind="found" form={form} setForm={setForm}
                        fieldErrors={fieldErrors} clearError={clearFieldError} />

                    <div className="ds-field">
                        <label htmlFor="image">Photo (optional)</label>
                        <input id="image" type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
                        <p className="ds-field-hint">JPG or PNG. A clear photo speeds up verification — avoid showing serials or personal info clearly enough to fake a claim.</p>
                    </div>
                    </fieldset>

                    {unlocked ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                                Cancel
                            </button>
                            <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={loading}>
                                {loading ? 'Submitting…' : 'Submit Found Item Report'}
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