import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Report forms open a "read this first" notice. Its "Check my violations" link
// takes the person to their print dashboard (in the same tab); the Back button
// there returns with `state.reopenNotice`, and this hook shows the notice again
// so they land exactly where they left off instead of on the dashboard.
export default function useReopenNotice(openNotice) {
    const location = useLocation();
    const navigate = useNavigate();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current || !location.state?.reopenNotice) return;
        handled.current = true;
        // Clear the flag so a refresh or later visit doesn't pop the notice again.
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
        openNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);
}
