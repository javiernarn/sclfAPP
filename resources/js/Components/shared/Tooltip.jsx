import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

const GAP = 8;
const EDGE_PADDING = 8;

/**
 * Wrap any icon-only (or otherwise unlabeled) control so people can still
 * tell what it does — especially on the collapsed sidebar / topbar where
 * only an icon is visible, or on small phone screens where a text label
 * has been hidden to save space.
 *
 * Renders through a portal into <body> and positions itself with a real
 * getBoundingClientRect() measurement, clamped to stay inside the
 * viewport — so it can never get clipped by a sidebar's overflow:hidden
 * or hang off the edge of the screen the way a plain CSS-positioned
 * tooltip would.
 *
 * Desktop/mouse: shows on hover and on keyboard focus.
 * Touch/mobile (no hover capability): disabled entirely — tap-to-open
 * tooltips have no reliable "hover away" to dismiss them, so they just
 * hang open on screen until an unrelated tap elsewhere closes them,
 * which reads as a bug. The wrapped element renders as-is.
 *
 * <Tooltip label="Collapse sidebar">
 *     <button aria-label="Collapse sidebar">...</button>
 * </Tooltip>
 */
export default function Tooltip({ label, children, side = 'bottom', delay = 350 }) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState(null);
    // Computed synchronously (not in an effect) so there's no render where
    // a touch device briefly behaves like a mouse device.
    const [isTouch, setIsTouch] = useState(() =>
        typeof window !== 'undefined'
            ? window.matchMedia('(hover: none), (pointer: coarse)').matches
            : false
    );
    const wrapRef = useRef(null);
    const tooltipRef = useRef(null);
    const showTimer = useRef(null);
    const id = useId();

    // Keep in sync if the device's input capability changes (e.g. a
    // 2-in-1 laptop switching between tablet mode and mouse/keyboard).
    useEffect(() => {
        const mql = window.matchMedia('(hover: none), (pointer: coarse)');
        const onChange = () => setIsTouch(mql.matches);
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, []);

    const computePosition = () => {
        const trigger = wrapRef.current?.firstElementChild || wrapRef.current;
        if (!trigger) return null;
        const rect = trigger.getBoundingClientRect();

        let top, left, placement = side;

        if (side === 'left' || side === 'right') {
            top = rect.top + rect.height / 2;
            left = side === 'right' ? rect.right + GAP : rect.left - GAP;
        } else {
            top = side === 'top' ? rect.top - GAP : rect.bottom + GAP;
            left = rect.left + rect.width / 2;
        }

        return { top, left, placement, triggerRect: rect };
    };

    const show = () => {
        const pos = computePosition();
        if (pos) setCoords(pos);
        setOpen(true);
    };

    const scheduleShow = () => {
        clearTimeout(showTimer.current);
        showTimer.current = setTimeout(show, delay);
    };
    const hide = () => {
        clearTimeout(showTimer.current);
        setOpen(false);
    };

    // After the tooltip renders (and we know its real width), nudge it
    // back inside the viewport if it would otherwise overflow — this is
    // what actually fixes the "expand sidebar" label getting cut off at
    // the left edge of the screen.
    useEffect(() => {
        if (!open || !coords || !tooltipRef.current) return;
        const tip = tooltipRef.current.getBoundingClientRect();
        let adjustedLeft = coords.left;

        if (coords.placement === 'left' || coords.placement === 'right') {
            // horizontally anchored to trigger edge, vertically centered —
            // just clamp vertical overflow.
            return;
        }

        const halfWidth = tip.width / 2;
        const minLeft = EDGE_PADDING + halfWidth;
        const maxLeft = window.innerWidth - EDGE_PADDING - halfWidth;
        if (adjustedLeft < minLeft) adjustedLeft = minLeft;
        if (adjustedLeft > maxLeft) adjustedLeft = maxLeft;

        if (Math.abs(adjustedLeft - coords.left) > 0.5) {
            setCoords((c) => ({ ...c, left: adjustedLeft }));
        }
    }, [open, coords?.top]);

    // Close on scroll/resize so a stale position never lingers.
    useEffect(() => {
        if (!open) return;
        const close = () => hide();
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    // On touch/mobile there's no hover, so a tap-to-open tooltip just gets
    // "stuck" open until the user taps elsewhere on the screen — it isn't
    // useful and reads as a bug. Icon buttons on mobile should already be
    // self-explanatory (or have a visible label), so skip the tooltip
    // entirely rather than trying to make tap-to-dismiss feel right.
    if (!label || isTouch) return children;

    const handlers = {
        onMouseEnter: scheduleShow,
        onMouseLeave: hide,
        onFocus: scheduleShow,
        onBlur: hide,
    };

    const child = React.Children.only(children);
    const enhancedChild = React.cloneElement(child, {
        'aria-describedby': open ? id : undefined,
    });

    const transform =
        coords?.placement === 'right' ? 'translate(0, -50%)'
        : coords?.placement === 'left' ? 'translate(-100%, -50%)'
        : coords?.placement === 'top' ? 'translate(-50%, -100%)'
        : 'translate(-50%, 0)';

    return (
        <span className="sclf-tooltip-wrap" ref={wrapRef} {...handlers}>
            {enhancedChild}
            {open && coords && createPortal(
                <span
                    ref={tooltipRef}
                    role="tooltip"
                    id={id}
                    className={`sclf-tooltip sclf-tooltip-${coords.placement}`}
                    style={{ top: coords.top, left: coords.left, transform }}
                >
                    {label}
                </span>,
                document.body
            )}
        </span>
    );
}