import React, { useState } from 'react';
import { RefreshCw } from '../icons';
import { useToast } from '../../context/ToastContext';
import useRoleTranslation from '../../hooks/useRoleTranslation';

/**
 * Manual "reload the data" button for pages whose data can lag behind the
 * server. `onRefresh` may return a promise; the icon spins until it settles.
 * Pass `loading` too if the page tracks its own loading flag.
 */
export default function RefreshButton({ onRefresh, loading = false, label }) {
    const toast = useToast();
    const { t } = useRoleTranslation();
    const text = label || t('common.refresh');
    const [busy, setBusy] = useState(false);
    const spinning = busy || loading;

    const handle = async () => {
        if (spinning || !onRefresh) return;
        setBusy(true);
        try {
            const result = onRefresh();
            // Pages that pass a plain loader (no promise) show progress through
            // the `loading` prop instead, so only toast when we can await it.
            if (result && typeof result.then === 'function') {
                await result;
                toast.success(t('common.upToDate'), { title: t('common.refreshedTitle') });
            }
        } catch {
            // axios interceptor already surfaces real errors
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            className="ds-btn ds-btn-secondary"
            onClick={handle}
            disabled={spinning}
            aria-label={text}
            title={t('common.reloadTip')}
        >
            <RefreshCw size={16} className={spinning ? 'ds-spin' : ''} style={{ verticalAlign: -3, marginRight: 6 }} />
            {spinning ? t('common.refreshing') : text}
        </button>
    );
}
