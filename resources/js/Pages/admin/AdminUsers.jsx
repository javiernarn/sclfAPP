import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import Tooltip from '../../Components/shared/Tooltip';
import ViewToggle from '../../Components/shared/ViewToggle';
import useViewMode from '../../hooks/useViewMode';
import { useToast } from '../../context/ToastContext';
import { useConfirm, useDiscardConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { Info, RotateCcw, UserCircle, Upload, Pencil, X, KeyRound, Eye, EyeOff, IdCard } from 'lucide-react';
import {
    filterPhoneInput,
    filterNameInput,
    normalizeEmailInput,
    isValidPhone,
    FORMAT_HINTS,
    FORMAT_ERRORS,
} from '../../utils/validators';
import { checkAvailability } from '../../utils/availability';

// Role -> label + the prefix used for that role's system-generated ID
// number (see User::generateStaffId() on the backend). Shown next to the
// Role dropdown so the admin knows what ID format the new account will
// get before they even submit.
const ROLE_META = {
    student: { label: 'Student', idPrefix: null },
    instructor: { label: 'Instructor', idPrefix: 'INS' },
    security_officer: { label: 'Security Officer', idPrefix: 'SEC' },
    admin: { label: 'Administrator', idPrefix: 'ADM' },
};

const emptyForm = {
    first_name: '', last_name: '', email: '', password: '',
    role: 'instructor', phone_number: '', gender: '',
};

const emptyEditForm = {
    first_name: '', last_name: '', email: '', password: '',
    role: 'instructor', phone_number: '', gender: '',
};

export default function AdminUsers() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [photo, setPhoto] = useState(null); // File | null
    const [photoPreview, setPhotoPreview] = useState(null); // object URL
    const fileInputRef = useRef(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);
    const [showDisabled, setShowDisabled] = useState(false);
    const [view, setView] = useViewMode('admin-users');
    const toast = useToast();
    const confirm = useConfirm();
    const discardConfirm = useDiscardConfirm();

    // ---- Edit User modal ----
    // Lets an admin fix/recover an existing account: name, email, phone,
    // gender, role, and — the key "forgot password / lost access to their
    // email" recovery path — set a brand-new password directly.
    const [editingUser, setEditingUser] = useState(null); // full user object, or null when closed
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [editErrors, setEditErrors] = useState({});
    const [editBusy, setEditBusy] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [editPhoto, setEditPhoto] = useState(null); // File | null — newly chosen replacement photo
    const [editPhotoPreview, setEditPhotoPreview] = useState(null); // object URL for that file
    const editFileInputRef = useRef(null);

    useEffect(() => () => { if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview); }, [editPhotoPreview]);

    const handleEditPhotoChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.warning('Please choose an image file for the profile picture.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.warning('Profile picture must be smaller than 5MB.');
            return;
        }
        if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
        setEditPhoto(file);
        setEditPhotoPreview(URL.createObjectURL(file));
    };

    const clearEditPhoto = () => {
        if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
        setEditPhoto(null);
        setEditPhotoPreview(null);
        if (editFileInputRef.current) editFileInputRef.current.value = '';
    };

    const editRole = (editingUser?.roles || [])[0]?.name || 'student';
    const isEditingSelf = currentUser?.id === editingUser?.id;
    const isEditDirty = editingUser
        ? !!editPhoto || Object.keys(emptyEditForm).some((k) => k === 'role' ? editForm.role !== editRole : editForm[k] !== (
            k === 'first_name' ? (editingUser.first_name || '')
                : k === 'last_name' ? (editingUser.last_name || '')
                : k === 'email' ? (editingUser.email || '')
                : k === 'phone_number' ? (editingUser.phone_number || '')
                : k === 'gender' ? (editingUser.gender || '')
                : ''
        ))
        : false;

    const openEdit = (u) => {
        setEditingUser(u);
        setEditForm({
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            email: u.email || '',
            password: '',
            role: (u.roles || [])[0]?.name || 'student',
            phone_number: u.phone_number || '',
            gender: u.gender || '',
        });
        setEditErrors({});
        setShowEditPassword(false);
        clearEditPhoto();
    };

    const closeEdit = async () => {
        const ok = await discardConfirm(isEditDirty, {
            title: 'Discard these changes?',
            message: "You've made changes to this account that haven't been saved.",
            confirmLabel: 'Discard changes',
        });
        if (ok) {
            setEditingUser(null);
            setEditForm(emptyEditForm);
            setEditErrors({});
            clearEditPhoto();
        }
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        let next = value;
        if (name === 'first_name' || name === 'last_name') next = filterNameInput(value);
        if (name === 'phone_number') next = filterPhoneInput(value);
        if (name === 'email') next = normalizeEmailInput(value);
        setEditForm((f) => ({ ...f, [name]: next }));
        setEditErrors((f) => ({ ...f, [name]: undefined }));
    };

    const validateEdit = () => {
        const errs = {};
        if (editForm.phone_number && !isValidPhone(editForm.phone_number)) errs.phone_number = FORMAT_ERRORS.phone;
        if (editForm.password && editForm.password.length < 8) errs.password = 'Password must be at least 8 characters.';
        setEditErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editingUser) return;
        if (!validateEdit()) {
            toast.warning('Please fix the highlighted fields before saving.');
            return;
        }
        setEditBusy(true);
        try {
            const payload = new FormData();
            payload.append('_method', 'PUT'); // spoofed — PHP doesn't parse multipart bodies on native PUT requests
            payload.append('first_name', editForm.first_name);
            payload.append('last_name', editForm.last_name);
            payload.append('email', editForm.email);
            payload.append('phone_number', editForm.phone_number || '');
            payload.append('gender', editForm.gender || '');
            if (editForm.role !== editRole) payload.append('role', editForm.role);
            if (editForm.password) payload.append('password', editForm.password);
            if (editPhoto) payload.append('profile_picture', editPhoto);

            await axios.post(`/admin/users/${editingUser.id}`, payload, {
                silent: true,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(
                editForm.password
                    ? `${editForm.first_name} ${editForm.last_name}'s account was updated and the password was reset.`
                    : `${editForm.first_name} ${editForm.last_name}'s account was updated.`,
                { title: 'Account updated' }
            );
            setEditingUser(null);
            setEditForm(emptyEditForm);
            setEditErrors({});
            clearEditPhoto();
            load();
        } catch (err) {
            const errors = err?.response?.data?.errors;
            if (errors) {
                setEditErrors(Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]])));
                const dupField = ['email', 'phone_number'].find((f) => errors[f]);
                if (dupField) {
                    const label = dupField === 'email' ? 'email address' : 'phone number';
                    toast.error(`This ${label} is already in use by another account.`, { title: 'Already in use' });
                } else {
                    toast.error(Object.values(errors).flat().join('\n'), { title: 'Please check the form' });
                }
            } else {
                toast.error(err?.response?.data?.message || 'Could not update account.');
            }
        } finally {
            setEditBusy(false);
        }
    };

    const isDirty = Object.values(form).some((v, i) => v !== Object.values(emptyForm)[i]) || !!photo;

    // Release the preview's object URL when it's replaced/unmounted.
    useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.warning('Please choose an image file for the profile picture.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.warning('Profile picture must be smaller than 5MB.');
            return;
        }
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const clearPhoto = () => {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhoto(null);
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

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
            const payload = new FormData();
            Object.entries(form).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) payload.append(key, value);
            });
            if (photo) payload.append('profile_picture', photo);

            const res = await axios.post('/admin/users', payload, {
                silent: true,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const staffId = res.data?.data?.user?.staff_id;
            toast.success(
                `Account created for ${form.first_name} ${form.last_name}` + (staffId ? ` — ID ${staffId}.` : '.'),
                { title: 'Account created' }
            );
            setForm(emptyForm);
            clearPhoto();
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
            clearPhoto();
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <span
                            className="ds-avatar"
                            style={{
                                width: 56, height: 56, fontSize: 20, borderRadius: 16, flexShrink: 0,
                                backgroundImage: photoPreview ? `url(${photoPreview})` : undefined,
                                backgroundSize: 'cover', backgroundPosition: 'center',
                            }}
                        >
                            {!photoPreview && <UserCircle size={26} />}
                        </span>
                        <div>
                            <input
                                ref={fileInputRef}
                                id="profile_picture"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                style={{ display: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" className="ds-btn ds-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                    <Upload size={14} /> {photo ? 'Change photo' : 'Upload photo'}
                                </button>
                                {photo && (
                                    <button type="button" className="ds-btn ds-btn-secondary" onClick={clearPhoto}>Remove</button>
                                )}
                            </div>
                            <p className="ds-card-desc" style={{ margin: '6px 0 0' }}>Optional — helps security staff verify people at a glance. JPG/PNG, up to 5MB.</p>
                        </div>
                    </div>

                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="first_name">First Name <span className="ds-required">*</span></label>
                            <input id="first_name" name="first_name" placeholder="e.g. Jessa" value={form.first_name} onChange={handleChange} required />
                        </div>
                        <div className="ds-field">
                            <label htmlFor="last_name">Last Name <span className="ds-required">*</span></label>
                            <input id="last_name" name="last_name" placeholder="e.g. Ramirez" value={form.last_name} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="email">Email <span className="ds-required">*</span></label>
                            <input type="email" id="email" name="email" placeholder="name@opol-cc.edu.ph" value={form.email} onChange={handleChange} onBlur={() => handleBlurCheck('email')} required
                                aria-invalid={!!fieldErrors.email} />
                            <p className="ds-field-hint">Must be unique across the whole system — this is also their login and where password resets are sent.</p>
                            {fieldErrors.email && <div className="ds-field-error">{fieldErrors.email}</div>}
                        </div>
                        <div className="ds-field">
                            <label htmlFor="password">Temporary Password <span className="ds-required">*</span></label>
                            <input type="text" id="password" name="password" placeholder="8+ characters" value={form.password} onChange={handleChange} minLength={8} required
                                aria-invalid={!!fieldErrors.password} />
                            <p className="ds-field-hint">Share this with them directly — they can change it themselves afterward from their Profile page.</p>
                            {fieldErrors.password && <div className="ds-field-error">{fieldErrors.password}</div>}
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
                        <div className="ds-field">
                            <label htmlFor="role">Role</label>
                            <select id="role" name="role" value={form.role} onChange={handleChange}>
                                <option value="instructor">Instructor</option>
                                <option value="security_officer">Security Officer</option>
                                <option value="admin">Administrator</option>
                            </select>
                            <p className="ds-field-hint">
                                Gets an auto-generated ID like <strong>{ROLE_META[form.role]?.idPrefix}-{new Date().getFullYear()}-0001</strong>
                            </p>
                        </div>
                        <div className="ds-field">
                            <label htmlFor="gender">Gender (optional)</label>
                            <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
                                <option value="">Prefer not to say</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                                <option value="prefer_not_to_say">Prefer not to say</option>
                            </select>
                        </div>
                    </div>
                    <div className="ds-form-row ds-form-row-2">
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
                            <p className="ds-field-hint">Philippine mobile format, 11 digits starting with 09 — optional, but useful for urgent contact.</p>
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
                <div className="ds-list-item-headrow" style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: 0 }}>All Users</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                            <input type="checkbox" checked={showDisabled} onChange={(e) => setShowDisabled(e.target.checked)} />
                            Show disabled accounts only
                        </label>
                        <ViewToggle mode={view} onChange={setView} />
                    </div>
                </div>
                {loading && <div className="ds-skeleton" />}

                {!loading && view === 'table' && (
                    <div className="ds-table-wrap">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>ID</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => {
                                    const isSelf = currentUser?.id === u.id;
                                    const initials = (u.name || '?')
                                        .split(' ').filter(Boolean).slice(0, 2)
                                        .map((p) => p[0]?.toUpperCase()).join('');
                                    return (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="ds-table-cell-main">
                                                    <span
                                                        className="ds-avatar"
                                                        style={{
                                                            width: 32, height: 32, fontSize: 12, borderRadius: 10, flexShrink: 0,
                                                            backgroundImage: u.profile_picture_url ? `url(${u.profile_picture_url})` : undefined,
                                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                                        }}
                                                    >
                                                        {!u.profile_picture_url && initials}
                                                    </span>
                                                    <span className="ds-table-title">
                                                        {u.name}
                                                        {isSelf && <span className="ds-badge ds-badge-default" style={{ marginLeft: 8 }}>You</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="ds-table-nowrap">{u.email}</td>
                                            <td className="ds-table-nowrap">{u.roles?.map(r => r.name).join(', ') || 'no role'}</td>
                                            <td className="ds-table-nowrap">{u.display_id || '—'}</td>
                                            <td>
                                                {!u.is_active
                                                    ? <span className="ds-badge ds-badge-default">Disabled</span>
                                                    : u.deleted_at
                                                        ? <span className="ds-badge ds-badge-default">Archived</span>
                                                        : <span className="ds-badge ds-badge-found">Active</span>}
                                            </td>
                                            <td>
                                                <div className="ds-table-actions">
                                                    <Tooltip label="View this account's full profile and login/logout history">
                                                        <button
                                                            type="button"
                                                            className="ds-btn ds-btn-secondary ds-btn-sm"
                                                            onClick={() => navigate(`/app/admin/users/${u.id}`)}
                                                        >
                                                            <IdCard size={13} />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip label="Edit name, email, phone, role, or reset the password">
                                                        <button
                                                            type="button"
                                                            className="ds-btn ds-btn-edit ds-btn-sm"
                                                            onClick={() => openEdit(u)}
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    </Tooltip>
                                                    {isSelf ? (
                                                        <Tooltip label="You can't disable your own account — ask another admin if you need this account disabled">
                                                            <span className="ds-badge ds-badge-default">This is you</span>
                                                        </Tooltip>
                                                    ) : u.is_active ? (
                                                        <Tooltip label="Signs them out and blocks login; their history is kept">
                                                            <button className="ds-btn ds-btn-danger ds-btn-sm" disabled={busyUserId === u.id} onClick={() => disable(u.id, u.name)}>Disable</button>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip label="Restores login access immediately">
                                                            <button className="ds-btn ds-btn-success ds-btn-sm" disabled={busyUserId === u.id} onClick={() => enable(u.id, u.name)}>Enable</button>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && view === 'cards' && (
                    <ul className="ds-list">
                        {users.map(u => {
                            const isSelf = currentUser?.id === u.id;
                            const initials = (u.name || '?')
                                .split(' ').filter(Boolean).slice(0, 2)
                                .map((p) => p[0]?.toUpperCase()).join('');
                            return (
                                <li key={u.id} className="ds-list-item">
                                    <div className="ds-list-item-main">
                                        <span
                                            className="ds-avatar"
                                            style={{
                                                width: 40, height: 40, fontSize: 14, borderRadius: 12, flexShrink: 0,
                                                backgroundImage: u.profile_picture_url ? `url(${u.profile_picture_url})` : undefined,
                                                backgroundSize: 'cover', backgroundPosition: 'center',
                                            }}
                                        >
                                            {!u.profile_picture_url && initials}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <p className="ds-list-item-title">
                                                {u.name}
                                                {isSelf && <span className="ds-badge ds-badge-default" style={{ marginLeft: 8 }}>You</span>}
                                                {!u.is_active && <span className="ds-badge ds-badge-default" style={{ marginLeft: 8 }}>Disabled</span>}
                                                {u.deleted_at && <span className="ds-badge ds-badge-default" style={{ marginLeft: 8 }}>Archived</span>}
                                            </p>
                                            <p className="ds-list-item-meta">
                                                {u.email} · {u.roles?.map(r => r.name).join(', ') || 'no role'}
                                                {u.display_id && <> · ID: {u.display_id}</>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="ds-list-item-actions">
                                        <Tooltip label="View this account's full profile and login/logout history">
                                            <button
                                                type="button"
                                                className="ds-btn ds-btn-secondary ds-btn-sm"
                                                onClick={() => navigate(`/app/admin/users/${u.id}`)}
                                            >
                                                <IdCard size={13} /> View Details
                                            </button>
                                        </Tooltip>
                                        <Tooltip label="Edit name, email, phone, role, or reset the password">
                                            <button
                                                type="button"
                                                className="ds-btn ds-btn-edit ds-btn-sm"
                                                onClick={() => openEdit(u)}
                                            >
                                                <Pencil size={13} /> Edit
                                            </button>
                                        </Tooltip>
                                        {isSelf ? (
                                            <Tooltip label="You can't disable your own account — ask another admin if you need this account disabled">
                                                <span className="ds-badge ds-badge-default">This is you</span>
                                            </Tooltip>
                                        ) : u.is_active ? (
                                            <Tooltip label="Signs them out and blocks login; their history is kept">
                                                <button className="ds-btn ds-btn-danger ds-btn-sm" disabled={busyUserId === u.id} onClick={() => disable(u.id, u.name)}>Disable</button>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip label="Restores login access immediately">
                                                <button className="ds-btn ds-btn-success ds-btn-sm" disabled={busyUserId === u.id} onClick={() => enable(u.id, u.name)}>Enable</button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {editingUser && (
                <div className="ds-edit-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}>
                    <div className="ds-card ds-edit-card" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                            <div>
                                <h3 id="edit-user-title" style={{ margin: 0 }}>Edit Account</h3>
                                <p className="ds-card-desc" style={{ margin: '4px 0 0' }}>
                                    Update {editingUser.name}'s details, or set a new password if they've lost access.
                                </p>
                            </div>
                            <button type="button" className="ds-icon-btn" aria-label="Close" onClick={closeEdit}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} noValidate>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0' }}>
                                <span
                                    className="ds-avatar"
                                    style={{
                                        width: 56, height: 56, fontSize: 20, borderRadius: 16, flexShrink: 0,
                                        backgroundImage: editPhotoPreview
                                            ? `url(${editPhotoPreview})`
                                            : editingUser.profile_picture_url ? `url(${editingUser.profile_picture_url})` : undefined,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                    }}
                                >
                                    {!editPhotoPreview && !editingUser.profile_picture_url && <UserCircle size={26} />}
                                </span>
                                <div>
                                    <input
                                        ref={editFileInputRef}
                                        id="edit_profile_picture"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEditPhotoChange}
                                        style={{ display: 'none' }}
                                    />
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button type="button" className="ds-btn ds-btn-secondary" onClick={() => editFileInputRef.current?.click()}>
                                            <Upload size={14} /> {editPhoto ? 'Change photo' : 'Replace photo'}
                                        </button>
                                        {editPhoto && (
                                            <button type="button" className="ds-btn ds-btn-secondary" onClick={clearEditPhoto}>Undo</button>
                                        )}
                                    </div>
                                    <p className="ds-card-desc" style={{ margin: '6px 0 0' }}>JPG/PNG, up to 5MB. Leave unchanged to keep their current photo.</p>
                                </div>
                            </div>

                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label htmlFor="edit_first_name">First Name <span className="ds-required">*</span></label>
                                    <input id="edit_first_name" name="first_name" value={editForm.first_name} onChange={handleEditChange} required />
                                </div>
                                <div className="ds-field">
                                    <label htmlFor="edit_last_name">Last Name <span className="ds-required">*</span></label>
                                    <input id="edit_last_name" name="last_name" value={editForm.last_name} onChange={handleEditChange} required />
                                </div>
                            </div>

                            <div className="ds-field">
                                <label htmlFor="edit_email">Email <span className="ds-required">*</span></label>
                                <input type="email" id="edit_email" name="email" value={editForm.email} onChange={handleEditChange} required
                                    aria-invalid={!!editErrors.email} />
                                {editErrors.email && <div className="ds-field-error">{editErrors.email}</div>}
                                <p className="ds-field-hint">This is also where their "Forgot password" reset link is sent — correct it here if they've lost access to the old one.</p>
                            </div>

                            <div className="ds-field">
                                <label htmlFor="edit_password">
                                    <KeyRound size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
                                    New Password (optional)
                                </label>
                                <div className="ds-pwd-wrap">
                                    <input
                                        type={showEditPassword ? 'text' : 'password'}
                                        id="edit_password"
                                        name="password"
                                        value={editForm.password}
                                        onChange={handleEditChange}
                                        minLength={8}
                                        placeholder="Leave blank to keep their current password"
                                        aria-invalid={!!editErrors.password}
                                    />
                                    <button
                                        type="button"
                                        className="ds-pwd-toggle"
                                        onClick={() => setShowEditPassword((v) => !v)}
                                        aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                                        tabIndex={-1}
                                    >
                                        {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {editErrors.password && <div className="ds-field-error">{editErrors.password}</div>}
                                <p className="ds-field-hint">Setting a password here signs the account out everywhere else, so share the new one with them directly.</p>
                            </div>

                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label htmlFor="edit_role">Role</label>
                                    <select
                                        id="edit_role"
                                        name="role"
                                        value={editForm.role}
                                        onChange={handleEditChange}
                                        disabled={isEditingSelf && editRole === 'admin'}
                                    >
                                        <option value="student">Student</option>
                                        <option value="instructor">Instructor</option>
                                        <option value="security_officer">Security Officer</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                    {isEditingSelf && editRole === 'admin' && (
                                        <p className="ds-field-hint">You can't change your own admin role — ask another admin.</p>
                                    )}
                                </div>
                                <div className="ds-field">
                                    <label htmlFor="edit_gender">Gender (optional)</label>
                                    <select id="edit_gender" name="gender" value={editForm.gender} onChange={handleEditChange}>
                                        <option value="">Prefer not to say</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                        <option value="prefer_not_to_say">Prefer not to say</option>
                                    </select>
                                </div>
                            </div>

                            <div className="ds-field">
                                <label htmlFor="edit_phone_number">Phone (optional)</label>
                                <input
                                    id="edit_phone_number"
                                    name="phone_number"
                                    inputMode="numeric"
                                    placeholder="09XXXXXXXXX"
                                    value={editForm.phone_number}
                                    onChange={handleEditChange}
                                    aria-invalid={!!editErrors.phone_number}
                                    title={FORMAT_HINTS.phone}
                                />
                                {editErrors.phone_number && <div className="ds-field-error">{editErrors.phone_number}</div>}
                            </div>

                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                                <button className="ds-btn ds-btn-primary" disabled={editBusy}>{editBusy ? 'Saving…' : 'Save Changes'}</button>
                                <button type="button" className="ds-btn ds-btn-secondary" onClick={closeEdit} disabled={editBusy}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}