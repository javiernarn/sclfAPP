import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Printer } from '../icons';

// Admin-only switch: lets students use "Print / Save as PDF" on their
// dashboard report. Turn it ON when clearance signing opens and OFF again
// when it is not ready. While OFF the server sends the student no report
// data at all (see PrintReportController). Instructors are never restricted.
//
// The message box is LOCKED until "Edit message" is pressed, and it only
// saves on "Save message" - clicking around can never change anything.
export default function PrintAccessCard() {
    const toast = useToast();
    const confirm = useConfirm();
    const [loaded, setLoaded] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState('');
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get('/print-access', { silent: true })
            .then((res) => { setEnabled(!!res.data.enabled); setMessage(res.data.message || ''); })
            .catch(() => {})
            .finally(() => setLoaded(true));
    }, []);

    const send = (payload, onOk) => {
        setSaving(true);
        axios.put('/admin/print-access', payload)
            .then((res) => {
                setEnabled(!!res.data.enabled);
                setMessage(res.data.message || '');
                onOk(res.data);
            })
            .catch(() => toast.error('Could not save. Please try again.'))
            .finally(() => setSaving(false));
    };

    const toggle = async () => {
        const next = !enabled;
        const ok = await confirm(next ? {
            title: 'Enable printing for students?',
            message: 'Students will be able to Print / Save as PDF their dashboard, and every student will get a notification that printing is open.',
            confirmLabel: 'Enable printing',
            cancelLabel: 'Cancel',
        } : {
            title: 'Disable printing for students?',
            message: 'Students will no longer be able to open, print or save their dashboard report. Instructors are not affected.',
            confirmLabel: 'Disable printing',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!ok) return;
        send({ enabled: next, message }, (d) => toast.success(
            d.enabled
                ? (d.notified ? 'Printing ENABLED. Students were notified.' : 'Printing ENABLED.')
                : 'Printing DISABLED for students.',
        ));
    };

    const notifyAgain = async () => {
        const ok = await confirm({
            title: 'Notify all students again?',
            message: 'Every student will get the "Printing is now open" notification (bell + push).',
            confirmLabel: 'Send notification',
            cancelLabel: 'Cancel',
        });
        if (!ok) return;
        setSaving(true);
        axios.post('/admin/print-access/notify')
            .then(() => toast.success('Notification is being sent to all students.'))
            .catch((err) => toast.error(err?.response?.data?.message || 'Could not send the notification.'))
            .finally(() => setSaving(false));
    };

    const startEdit = () => { setDraft(message); setEditing(true); };
    const cancelEdit = () => { setEditing(false); setDraft(''); };
    const saveMessage = () => {
        send({ enabled, message: draft }, () => { setEditing(false); toast.success('Message saved.'); });
    };

    if (!loaded) return null;

    return (
        <section
            style={{
                border: '1px solid var(--ch-border, rgba(128,128,128,.3))',
                borderRadius: 14, padding: 16, margin: '0 0 16px',
                display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
            }}
        >
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Printer size={16} /> Student printing (clearance signing)
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.75 }}>
                    {enabled
                        ? 'ON - students can Print / Save as PDF their dashboard. (Instructors are never restricted.)'
                        : 'OFF - students cannot open, print or save their dashboard report. Turn it on when clearance signing is ready.'}
                </p>
            </div>
            <button
                type="button"
                className="ds-btn ds-btn-secondary"
                disabled={saving || editing}
                onClick={toggle}
                aria-pressed={enabled}
            >
                {enabled ? 'Disable printing' : 'Enable printing'}
            </button>
            {enabled && (
                <button type="button" className="ds-btn ds-btn-secondary" disabled={saving || editing} onClick={notifyAgain}>
                    Notify students again
                </button>
            )}

            <div style={{ flex: '1 1 100%', fontSize: 12.5 }}>
                <label htmlFor="print-access-message">Message students see while printing is disabled</label>
                <textarea
                    id="print-access-message"
                    value={editing ? draft : message}
                    readOnly={!editing}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{
                        width: '100%', marginTop: 4, padding: 8, borderRadius: 8, font: 'inherit',
                        opacity: editing ? 1 : 0.65, cursor: editing ? 'text' : 'default', resize: 'none',
                    }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {!editing ? (
                        <button type="button" className="ds-btn ds-btn-secondary" onClick={startEdit} disabled={saving}>
                            Edit message
                        </button>
                    ) : (
                        <>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={saveMessage} disabled={saving || !draft.trim()}>
                                {saving ? 'Saving…' : 'Save message'}
                            </button>
                            <button type="button" className="ds-btn ds-btn-secondary" onClick={cancelEdit} disabled={saving}>
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
