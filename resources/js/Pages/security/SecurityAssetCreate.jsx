import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import FormSkeleton from '../../Components/shared/FormSkeleton';
import { useToast } from '../../context/ToastContext';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

const CATEGORY_OPTIONS = [
    { value: 'electronics', label: 'Electronics' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
    building_id: '',
    category: '',
    name: '',
    description: '',
    brand: '',
    model: '',
    serial_number: '',
    location_text: '',
    acquired_at: '',
    value: '',
    notes: '',
};

export default function SecurityAssetCreate() {
    const [form, setForm] = useState(EMPTY_FORM);
    const [buildings, setBuildings] = useState([]);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();

    const isDirty = Object.entries(form).some(([key, value]) => value !== EMPTY_FORM[key]);
    const { guardedAction } = useUnsavedChangesGuard(isDirty, {
        message: "You've started registering this asset. If you leave now, what you've entered will be discarded.",
    });

    useEffect(() => {
        document.title = "Register an Asset | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        axios.get('/buildings')
            .then((res) => setBuildings(res.data || []))
            .catch(() => setBuildings([]))
            .finally(() => setPageLoading(false));
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (fieldErrors[e.target.name]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[e.target.name]; return next; });
        }
    };

    const handleCancel = () => guardedAction(() => navigate('/app/security/assets'));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        setLoading(true);
        try {
            const payload = {
                ...form,
                building_id: form.building_id || null,
                acquired_at: form.acquired_at || null,
                value: form.value || null,
            };
            const res = await axios.post('/assets', payload, { silent: true });
            toast.success(`${res.data.data.name} registered as ${res.data.data.asset_tag}.`, { title: 'Asset registered' });
            navigate(`/app/security/assets/${res.data.data.id}`);
        } catch (err) {
            const errors = err?.response?.data?.errors;
            const message = errors
                ? Object.values(errors).flat().join('\n')
                : (err?.response?.data?.message || 'Failed to register. Please check your inputs.');
            setError(message);
            setFieldErrors(errors ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])) : {});
            toast.error(message, { title: 'Could not register asset' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardShell
            eyebrow="Assets"
            title="Register an Asset"
            subtitle="Add a laptop, projector, or other campus asset to the registry. It gets an asset tag automatically."
        >
            {pageLoading ? (
                <FormSkeleton />
            ) : (
                <form className="ds-card" onSubmit={handleSubmit}>
                    {error && <div className="ds-error">{error}</div>}

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Name</label>
                            <input name="name" value={form.name} onChange={handleChange} required maxLength={150}
                                placeholder="e.g. Dell Latitude 5420" aria-invalid={!!fieldErrors.name} />
                            {fieldErrors.name && <p className="ds-field-error">{fieldErrors.name}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Category</label>
                            <select name="category" value={form.category} onChange={handleChange} required aria-invalid={!!fieldErrors.category}>
                                <option value="">Choose…</option>
                                {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {fieldErrors.category && <p className="ds-field-error">{fieldErrors.category}</p>}
                        </div>
                    </div>

                    <div className="ds-field">
                        <label>Description (optional)</label>
                        <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                            placeholder="Any details worth noting about this asset." />
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Brand</label>
                            <input name="brand" value={form.brand} onChange={handleChange} maxLength={100} />
                        </div>
                        <div className="ds-field">
                            <label>Model</label>
                            <input name="model" value={form.model} onChange={handleChange} maxLength={100} />
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Serial number</label>
                            <input name="serial_number" value={form.serial_number} onChange={handleChange} maxLength={100} />
                        </div>
                        <div className="ds-field">
                            <label>Building</label>
                            <select name="building_id" value={form.building_id} onChange={handleChange}>
                                <option value="">Unspecified</option>
                                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Location (optional)</label>
                            <input name="location_text" value={form.location_text} onChange={handleChange} maxLength={255}
                                placeholder="e.g. Room 204, IT storage cabinet" />
                        </div>
                        <div className="ds-field">
                            <label>Date acquired (optional)</label>
                            <input type="date" name="acquired_at" value={form.acquired_at} onChange={handleChange}
                                max={new Date().toISOString().slice(0, 10)} aria-invalid={!!fieldErrors.acquired_at} />
                            {fieldErrors.acquired_at && <p className="ds-field-error">{fieldErrors.acquired_at}</p>}
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label>Value (optional)</label>
                            <input type="number" step="0.01" min="0" name="value" value={form.value} onChange={handleChange}
                                placeholder="0.00" aria-invalid={!!fieldErrors.value} />
                            {fieldErrors.value && <p className="ds-field-error">{fieldErrors.value}</p>}
                        </div>
                        <div className="ds-field">
                            <label>Notes (optional)</label>
                            <input name="notes" value={form.notes} onChange={handleChange} maxLength={1000} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={handleCancel} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="ds-btn ds-btn-primary ds-btn-block" disabled={loading}>
                            {loading ? 'Registering…' : 'Register Asset'}
                        </button>
                    </div>
                </form>
            )}
        </DashboardShell>
    );
}
