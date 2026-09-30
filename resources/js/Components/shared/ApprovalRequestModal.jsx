import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';
import { approvalBus } from '../../utils/eventBus';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Staff accounts can look at everything but need the admin's approval to
 * change anything. When a write comes back "approval_required" (see
 * axiosConfig.js) this dialog asks for a reason and files the request.
 * Once the admin approves it, the staff member simply repeats the action.
 */
export default function ApprovalRequestModal() {
    const { roles } = useAuth();
    const toast = useToast();
    const [pending, setPending] = useState(null); // { method, path, payload }
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    const isStaff = Array.isArray(roles) && roles.includes('staff') && !roles.includes('admin');

    useEffect(() => approvalBus.subscribe((info) => {
        if (!isStaff) return;
        setPending(info);
        setReason('');
        setSent(false);
    }), [isStaff]);

    if (!pending) return null;

    const close = () => setPending(null);

    const send = async (e) => {
        e.preventDefault();
        if (reason.trim().length < 3) {
            toast.warning('Please tell the admin why you need this.');
            return;
        }
        setBusy(true);
        try {
            await axios.post('/action-requests', {
                method: pending.method,
                path: pending.path,
                reason: reason.trim(),
                payload: pending.payload || undefined,
            });
            setSent(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="sclf-confirm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className="sclf-confirm-card" role="dialog" aria-modal="true" aria-labelledby="approval-title" style={{ maxWidth: 440 }}>
                {!sent ? (
                    <form onSubmit={send}>
                        <h3 id="approval-title" className="sclf-confirm-title">Admin approval needed</h3>
                        <p className="sclf-confirm-message">
                            Staff accounts can't make changes on their own. Send a request to the admin —
                            once it's approved, come back and do this again.
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder="Why do you need this change?"
                            autoFocus
                            style={{ width: '100%', borderRadius: 10, padding: 10, marginBottom: 14, font: 'inherit' }}
                        />
                        <div className="sclf-confirm-actions">
                            <button type="button" className="sclf-confirm-btn sclf-confirm-btn-ghost" onClick={close} disabled={busy}>Cancel</button>
                            <button type="submit" className="sclf-confirm-btn" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
                        </div>
                    </form>
                ) : (
                    <>
                        <h3 id="approval-title" className="sclf-confirm-title">Request sent</h3>
                        <p className="sclf-confirm-message">
                            The admin has been asked. Track it under <Link to="/app/admin/requests" onClick={close}>My Requests</Link>;
                            when it shows Approved, repeat the action.
                        </p>
                        <div className="sclf-confirm-actions">
                            <button type="button" className="sclf-confirm-btn" onClick={close} autoFocus>Got it</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
