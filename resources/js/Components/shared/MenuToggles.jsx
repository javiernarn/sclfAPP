import React, { useState } from 'react';
import axios from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useToast } from '../../context/ToastContext';
import usePushNotifications from '../../hooks/usePushNotifications';
import { Bell, Mail, Save } from '../icons';

/**
 * One row of the avatar menu: icon, label, small hint and an ON/OFF switch.
 * Clicking it flips the switch and leaves the menu open (same as the theme
 * picker), so a person can check all of them in one visit.
 */
function SwitchRow({ icon: Icon, label, hint, checked, busy = false, onToggle }) {
    return (
        <button
            type="button"
            className="ds-menu-item ds-menu-switch-row"
            role="menuitemcheckbox"
            aria-checked={checked}
            aria-busy={busy}
            disabled={busy}
            onClick={onToggle}
        >
            <Icon size={16} />
            <span className="ds-menu-switch-text">
                <span className="ds-menu-switch-label">{label}</span>
                {hint && <span className="ds-menu-switch-hint">{hint}</span>}
            </span>
            <span className={`ds-switch ${checked ? 'is-on' : ''} ${busy ? 'is-busy' : ''}`} aria-hidden="true">
                <span className="ds-switch-knob" />
            </span>
        </button>
    );
}

/**
 * The three switches that live in the avatar dropdown (header and sidebar):
 *
 *  - Push notifications — this device (desktop, laptop or installed PWA).
 *    Moved here from the Profile page; same enable/disable flow.
 *  - Email notifications — students and instructors only; saved on the
 *    account, so it follows them to every device.
 *  - Auto Save — keeps report drafts safe while typing (see
 *    useAutoSaveDraft). Saved on the account, so it follows them to every device.
 */
export default function MenuToggles({ t }) {
    const { roles, user, updateUser } = useAuth();
    const { autoSave, setAutoSave } = usePreferences();
    const toast = useToast();
    const push = usePushNotifications();
    const [emailBusy, setEmailBusy] = useState(false);

    const canEmail = Array.isArray(roles) && (roles.includes('student') || roles.includes('instructor'));
    const emailOn = user?.email_notifications !== false;

    const handlePush = async () => {
        if (!push.supported) {
            toast.error("This browser doesn't support push notifications.");
            return;
        }
        if (push.subscribed) {
            await push.disable();
            toast.info('Push notifications turned off for this device.');
            return;
        }
        const result = await push.enable();
        if (result.status === 'subscribed') {
            toast.success('Push notifications are on for this device.');
        } else if (result.status === 'denied') {
            toast.warning('Notifications are blocked in your browser settings. Allow them for this site to turn this on.');
        } else if (result.status === 'unconfigured') {
            toast.error("Push notifications aren't set up on the server yet.");
        } else if (result.status === 'unsupported') {
            toast.error("This browser doesn't support push notifications.");
        }
    };

    const handleEmail = async () => {
        const next = !emailOn;
        setEmailBusy(true);
        updateUser({ email_notifications: next }); // optimistic
        try {
            await axios.patch('/profile/preferences', { email_notifications: next }, { silent: true });
            toast.info(next ? 'Email notifications are on.' : 'Email notifications are off. You will still see everything in the bell.');
        } catch {
            updateUser({ email_notifications: !next }); // put it back
            toast.error("Couldn't save that change. Check your connection and try again.");
        } finally {
            setEmailBusy(false);
        }
    };

    const handleAutoSave = () => setAutoSave(!autoSave);

    return (
        <>
            <div className="ds-menu-divider" />
            <SwitchRow
                icon={Bell}
                label={t('shell.pushNotifications')}
                hint={push.supported ? t('shell.pushHint') : t('shell.pushUnsupported')}
                checked={push.supported && push.subscribed}
                busy={push.supported && (push.loading || push.busy)}
                onToggle={handlePush}
            />
            {canEmail && (
                <SwitchRow
                    icon={Mail}
                    label={t('shell.emailNotifications')}
                    hint={t('shell.emailHint')}
                    checked={emailOn}
                    busy={emailBusy}
                    onToggle={handleEmail}
                />
            )}
            <SwitchRow
                icon={Save}
                label={t('shell.autoSave')}
                hint={t('shell.autoSaveHint')}
                checked={autoSave}
                onToggle={handleAutoSave}
            />
        </>
    );
}
