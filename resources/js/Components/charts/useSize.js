import { useEffect, useRef, useState } from 'react';

// Tracks an element's width so SVG charts stay crisp and responsive.
export default function useSize(initial = 320) {
    const ref = useRef(null);
    const [width, setWidth] = useState(initial);
    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.max(120, Math.floor(entry.contentRect.width))));
        ro.observe(el);
        setWidth(Math.max(120, Math.floor(el.getBoundingClientRect().width)));
        return () => ro.disconnect();
    }, []);
    return [ref, width];
}
