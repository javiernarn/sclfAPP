import { useCallback, useEffect } from 'react';
import { useDiscardConfirm } from '../context/ConfirmContext';

/**
 * useUnsavedChangesGuard(isDirty)
 *
 * - While `isDirty` is true, closing/refreshing the browser tab shows the
 *   browser's own native "leave site?" prompt (the only thing a page is
 *   allowed to trigger for that — browsers block custom dialogs there).
 * - Returns `guardedAction(fn)` — wrap any "close/cancel/navigate away"
 *   handler with it. If the form is dirty it shows the app's own styled
 *   "Discard changes?" dialog first (Discard / Continue editing); if the
 *   person confirms (or there was nothing unsaved), `fn` runs.
 *
 * Usage:
 *   const { guardedAction } = useUnsavedChangesGuard(isDirty);
 *   <button onClick={() => guardedAction(() => navigate('/lost-items'))}>
 *       Cancel
 *   </button>
 */
export function useUnsavedChangesGuard(isDirty, options = {}) {
    const discardConfirm = useDiscardConfirm();

    useEffect(() => {
        if (!isDirty) return;
        const handler = (e) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const guardedAction = useCallback(async (action) => {
        const ok = await discardConfirm(isDirty, options);
        if (ok) action();
        return ok;
    }, [isDirty, discardConfirm, options]);

    return { guardedAction };
}

export default useUnsavedChangesGuard;
