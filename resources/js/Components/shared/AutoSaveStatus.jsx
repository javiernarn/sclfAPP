import React from 'react';
import { Save } from '../icons';

/**
 * Small line above a report form: shows that Auto Save is on and when the
 * draft was last stored. Renders nothing while Auto Save is off, so the form
 * looks exactly like it always did.
 */
export default function AutoSaveStatus({ autoSave, savedAt, synced, note }) {
    if (!autoSave) return null;
    const time = savedAt
        ? new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : null;
    return (
        <div className="ds-autosave-status" role="status" aria-live="polite">
            <Save size={14} />
            <span>
                Auto Save is on{time ? ` · Draft saved ${time}` : ' · Your draft is saved as you type'}
                {time ? (synced ? ' · synced to your account' : ' · saved on this device, syncing…') : ''}
                {note ? ` · ${note}` : ''}
            </span>
        </div>
    );
}
