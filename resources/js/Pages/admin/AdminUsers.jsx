import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import Tooltip from '../../Components/shared/Tooltip';
import { useToast } from '../../context/ToastContext';
import { useConfirm, useDiscardConfirm } from '../../context/ConfirmContext';
import { Info, RotateCcw } from 'lucide-react';
import {
    filterPhoneInput,
    filterNameInput,
    normalizeEmailInput,
    isValidPhone,
    FORMAT_HINTS,
    FORMAT_ERRORS,
} from '../../utils/validators';
import { checkAvailability } from '../../utils/availability';

const emptyForm = { first_name: '', last_name: '', email: '', password: '', role: 'faculty', phone_number: '' };

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);
    const [showDisabled, setShowDisabled] = useState(true);
    const toast = useToast();
    const confirm = useConfirm();
    const discardConfirm = useDiscardConfirm();

    const isDirty = Object.values(form).some((v, i) => v !== Object.values(emptyForm)[i]);

    useEffect(() => {
        document.title = "User Management | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/admin/users', { params: showDisabled ? { include_disabled: 1 } : {} })
            .then(res => setUsers(res.data.data))
            .finally(() => setLoading(false));
    };

    useEffect(load, [showDisabled]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let next = value;
        if (name === 'first_name' || name === 'last_name') next = filterNameInput(value);
        if (name === 'phone_number') next = filterPhoneInput(value);
        if (name === 'email') next = normalizeEmailInput(value);
        setForm((f) => ({ ...f, [name]: next }));
        setFieldErrors((f) => ({ ...f, [name]: undefined }));
    };

    const validate = () => {
        const errs = {};
        if (form.phone_number && !isValidPhone(form.phone_number)) errs.phone_number = FORMAT_ERRORS.phone;
        if (form.password && form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // Checks uniqueness the moment they leave the field, instead of only
    // finding out about a collision after "Create Account" is clicked.
    const handleBlurCheck = async (field) => {
        const value = form[field];
        if (!value) return;
        if (field === 'phone_number' && !isValidPhone(value)) return; // format error already shown
        const available = await checkAvailability(field, value);
        if (!available) {
            const label = field === 'email' ? 'email address' : 'phone number';
            setFieldErrors((f) => ({ ...f, [field]: `This ${label} is already in use by another account.` }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            toast.warning('Please fix the highlighted fields before submitting.');
            return;
        }
        setBusy(true);
        try {
            await axios.post('/admin/users', form, { silent: true });
            toast.success(`Account created for ${form.first_name} ${form.last_name}.`, { title: 'Account created' });
            setForm(emptyForm);
            setFieldErrors({});
            load();
        } catch (err) {
            const errors = err?.response?.data?.errors;
            if (errors) {
                setFieldErrors(Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])));
                const dupField = ['email', 'phone_number'].find((f) => errors[f]);
                if (dupField) {
                    const label = dupField === 'email' ? 'email address' : 'phone number';
                    toast.error(`This ${label} is already in use by another account. Please use a different ${label}.`, { title: 'Already in use' });
                } else {
                    toast.error(Object.values(errors).flat().join('\n'), { title: 'Please check the form' });
                }
            } else {
                toast.error(err?.response?.data?.message || 'Could not create account.');
            }
        } finally {
            setBusy(false);
        }
    };

    const handleClear = async () => {
        const ok = await discardConfirm(isDirty, {
            title: 'Clear this form?',
            message: "You've started filling this out. Clearing it will discard everything you've entered.",
            confirmLabel: 'Clear form',
        });
        if (ok) {
            setForm(emptyForm);
            setFieldErrors({});
        }
    };

    const disable = async (id, name) => {
        const ok = await confirm({
            title: 'Disable this account?',
            message: `${name} will be immediately signed out and blocked from logging in. Their existing reports and claims are kept intact — this is reversible.`,
            confirmLabel: 'Disable account',
            cancelLabel: 'Keep active',
            tone: 'danger',
        });
        if (!ok) return;
        setBusyUserId(id);
        try {
            await axios.delete(`/admin/users/${id}`);
            toast.success(`${name}'s account has been disabled.`);
            load();
        } finally {
            setBusyUserId(null);
        }
    };

    const enable = async (id, name) => {
        setBusyUserId(id);
        try {
            await axios.post(`/admin/users/${id}/restore`);
            toast.success(`${name}'s account has been re-enabled.`);
            load();
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <DashboardShell
            eyebrow="Admin"
            title="User Management"
            subtitle="Public registration only ever creates Students. Staff and admin accounts are created here."
        >
            <div className="ds-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0 }}>Create Account</h3>
                    <Tooltip label="Staff/admin emails and phone numbers must be unique across the whole system — if one is already registered, you'll be told which field collided.">
                        <span tabIndex={0} style={{ display: 'inline-flex', opacity: 0.55, cursor: 'help' }} aria-label="Help: account uniqueness">
                            <Info size={14} />
                        </span>
                    </Tooltip>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="first_name">First Name</label>
                            <input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} required />
                        </div>
                        <div className="ds-field">
                            <label htmlFor="last_name">Last Name</label>
                            <input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" name="email" value={form.email} onChange={handleChange} onBlur={() => handleBlurCheck('email')} required
                                aria-invalid={!!fieldErrors.email} />
                            {fieldErrors.email && <div className="ds-field-error">{fieldErrors.email}</div>}
                        </div>
                        <div className="ds-field">
                            <label htmlFor="password">Temporary Password</label>
                            <input type="text" id="password" name="password" value={form.password} onChange={handleChange} minLength={8} required
                                aria-invalid={!!fieldErrors.password} />
                            {fieldErrors.password && <div className="ds-field-error">{fieldErrors.password}</div>}
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="role">Role</label>
                            <select id="role" name="role" value={form.role} onChange={handleChange}>
                                <option value="faculty">Faculty</option>
                                <option value="security_officer">Security Officer</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                        <div className="ds-field">
                            <label htmlFor="phone_number">Phone (optional)</label>
                            <input
                                id="phone_number"
                                name="phone_number"
                                inputMode="numeric"
                                placeholder="09XXXXXXXXX"
                                value={form.phone_number}
                                onChange={handleChange}
                                onBlur={() => handleBlurCheck('phone_number')}
                                aria-invalid={!!fieldErrors.phone_number}
                                title={FORMAT_HINTS.phone}
                            />
                            {fieldErrors.phone_number && <div className="ds-field-error">{fieldErrors.phone_number}</div>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="ds-btn ds-btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
                        <Tooltip label="Discards anything you've typed in this form">
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={handleClear} disabled={busy}>
                                <RotateCcw size={14} /> Clear
                            </button>
                        </Tooltip>
                    </div>
                </form>
            </div>

            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>All Users</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} />
                        Show disabled accounts
                    </label>
                </div>
                {loading && <div className="ds-skeleton" />}
                {!loading && (
                    <ul className="ds-list">
                        {users.map(u => (
                            <li key={u.id} className="ds-list-item">
                                <div>
                                    <p className="ds-list-item-title">
                                        {u.name}
                                        {!u.is_active && <span className="ds-badge ds-badge-default" style={{ marginLeft: 8 }}>Disabled</span>}
                                        {u.deleted_at && <span className="ds-badge ds-badge-default" style={{ marginLeft: 8 }}>Archived</span>}
                                    </p>
                                    <p className="ds-list-item-meta">{u.email} · {u.roles?.map(r => r.name).join(', ') || 'no role'}</p>
                                </div>
                                {u.is_active ? (
                                    <Tooltip label="Signs them out and blocks login; their history is kept">
                                        <button className="ds-btn" disabled={busyUserId === u.id} onClick={() => disable(u.id, u.name)}>Disable</button>
                                    </Tooltip>
                                ) : (
                                    <Tooltip label="Restores login access immediately">
                                        <button className="ds-btn ds-btn-primary" disabled={busyUserId === u.id} onClick={() => enable(u.id, u.name)}>Enable</button>
                                    </Tooltip>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
