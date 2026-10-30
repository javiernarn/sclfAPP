import { useCallback, useEffect, useState } from 'react';
import axios from '../config/axiosConfig';

// Reads the admin's "student printing" switch (GET /print-access).
// Re-checks when the tab regains focus, so a student sees the button
// unlock after the admin turns it on - no reload needed.
export default function usePrintAccess() {
    const [state, setState] = useState({ loaded: false, enabled: false, message: '' });

    const load = useCallback(() => {
        axios.get('/print-access', { silent: true })
            .then((res) => setState({ loaded: true, enabled: !!res.data.enabled, message: res.data.message || '' }))
            .catch(() => setState((s) => ({ ...s, loaded: true })));
    }, []);

    useEffect(() => {
        load();
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        const timer = window.setInterval(load, 30000);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.clearInterval(timer);
        };
    }, [load]);

    return { ...state, reload: load };
}
