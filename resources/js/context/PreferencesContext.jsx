import React, { createContext, useCallback, useContext, useMemo } from 'react';
import axios from '../config/axiosConfig';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { clearAllDrafts } from '../utils/autosave';

/**
 * Account-wide switches from the avatar menu. Today: Auto Save.
 *
 * Stored on the account (users.auto_save), so it is the same on every
 * device, and off by default — every form behaves exactly as it always did
 * until a person turns it on. Turning it off also deletes saved drafts
 * (server side in ProfileController::updatePreferences, and on this device).
 */
const PreferencesContext = createContext({
    autoSave: false,
    setAutoSave: async () => {},
});

export function PreferencesProvider({ children }) {
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const uid = user?.id ?? null;
    const autoSave = !!uid && user?.auto_save === true;

    const setAutoSave = useCallback(async (on) => {
        const next = !!on;
        updateUser({ auto_save: next }); // optimistic — the switch moves at once
        if (!next) clearAllDrafts(uid);
        try {
            await axios.patch('/profile/preferences', { auto_save: next }, { silent: true });
            toast.info(next
                ? 'Auto Save is on. Your report drafts are kept while you type, on any device.'
                : 'Auto Save is off. Saved drafts were removed.');
        } catch {
            updateUser({ auto_save: !next }); // put it back
            toast.error("Couldn't save that change. Check your connection and try again.");
        }
    }, [uid, updateUser, toast]);

    const value = useMemo(() => ({ autoSave, setAutoSave }), [autoSave, setAutoSave]);

    return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);
