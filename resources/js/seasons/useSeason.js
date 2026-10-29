import { useMemo } from 'react';
import { getSeason } from './season';

// The season never changes while the app is open (it is set by .env), so
// this is a plain read — no listeners needed.
export default function useSeason() {
    return useMemo(() => getSeason(), []);
}
