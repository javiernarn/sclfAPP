import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Lock, ShieldAlert } from '../../Components/icons';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { reportNotice } from '../../Components/shared/reportNotice';
import ItemReportFields from '../../Components/shared/ItemReportFields';
import useReopenNotice from '../../hooks/useReopenNotice';
import useAutoSaveDraft from '../../hooks/useAutoSaveDraft';
import AutoSaveStatus from '../../Components/shared/AutoSaveStatus';

const EMPTY_FORM = { item_name: '', description: '', category: '', brand: '', color: '', model: '', unique_characteristics: '', location_lost: '', date_lost: '', details: {} };


export default function LostItemForm({ onCancel, onCreated }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [unlocked, setUnlocked] = useState(false);
    const toast = useToast();
    const confirm = useConfirm();
    const { user, roles } = useAuth();

    const isDirty = Object.entries(form).some(([key, value]) => (key === 'details' ? Object.values(value || {}).some(Boolean) : value !== EMPTY_FORM[key]));
    const draft = useAutoSaveDraft({ formKey: 'lost-item', value: form, initial: EMPTY_FORM, isDirty, onRestore: setForm });
    // With Auto Save on, leaving is safe (the draft is kept), so no "discard?" prompts.
    const { guardedAction } = useUnsavedChangesGuard(isDirty && !draft.autoSave, {
        message: "You've started reporting this lost item. If you leave now, what you've entered will be discarded.",
    });

    // Brief grid-shaped skeleton on first mount so the page never pops the
    // form in instantly — matches the same loading feel as the dashboard.
    useEffect(() => {
        const t = setTimeout(() => setPageLoading(false), 450);
        return () => clearTimeout(t);
    }, []);

    const clearFieldError = (name) => {
        setFieldErrors((prev) => {
            if (!prev[name]) return prev;
            const next = { ...prev }; delete next[name]; return next;
        });
    };

    const handleCancel = () => guardedAction(() => { draft.clearDraft(); onCancel && onCancel(); });

    const handleUnlockRequest = async () => {
        const agreed = await confirm(reportNotice({
            kind: 'lost',
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
        const understood = await confirm({
            title: 'Submit this lost item report?',
            message: 'Once submitted, this lost item report can no longer be edited or deleted by you. Only the Administrator can edit or remove it. Please double-check everything before you continue.',
            confirmLabel: 'Yes, submit report',
            cancelLabel: 'Go back',
            tone: 'danger',
        });
        if (!understood) return;
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            await axios.post('/lost-items', { ...form, details: Object.fromEntries(Object.entries(form.details || {}).filter(([, v]) => v)) }, { silent: true });
            draft.clearDraft();
            toast.success('Your lost item report has been submitted.', { title: 'Report filed' });
            onCreated && onCreated();
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
        <>
            {pageLoading ? (
                <FormSkeleton />
            ) : (
            <div className="ds-card">
                <AutoSaveStatus autoSave={draft.autoSave} savedAt={draft.savedAt} synced={draft.synced} />
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
                    <ItemReportFields kind="lost" form={form} setForm={setForm}
                        fieldErrors={fieldErrors} clearError={clearFieldError} />

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
        </>
    );
}