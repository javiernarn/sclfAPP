import React, { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * AccountMenu
 * -----------
 * A dropdown menu that renders through a React portal straight into
 * <body>, positioned with `position: fixed` from the trigger button's real
 * on-screen coordinates (via getBoundingClientRect).
 *
 * Why this exists: the old account dropdown was `position: absolute`
 * inside the sidebar, which has `overflow: hidden` (needed so the sidebar
 * itself never grows a scrollbar). Any ancestor's `overflow: hidden` clips
 * or otherwise misplaces an absolutely-positioned child once it needs to
 * escape that ancestor's box — which is exactly what a dropup menu anchored
 * to a button near the bottom of the sidebar needs to do. Portaling the
 * menu out to <body> and positioning it in JS sidesteps that entirely: it
 * no longer matters what overflow/transform rules its trigger sits inside.
 *
 * Usage:
 *   const triggerRef = useRef(null);
 *   <button ref={triggerRef} onClick={() => setOpen(v => !v)}>Account</button>
 *   <AccountMenu
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     triggerRef={triggerRef}
 *     menuRef={menuRef}       // pass this to your outside-click check too
 *     placement="top-start"   // "top"|"bottom" (vertical) + "start"|"end"|"after" (horizontal)
 *     width={232}
 *     className="ds-sidebar-menu"
 *   >
 *     ...menu content...
 *   </AccountMenu>
 *
 * `alignRef` (optional): use a *different* element than the trigger for the
 * horizontal anchor. The sidebar's account menu uses this so the menu is a
 * flyout pinned to the sidebar's own right edge (placement="top-after")
 * rather than to wherever the trigger button happens to sit — which keeps
 * it landing in the same spot whether the sidebar is collapsed or expanded.
 */
export default function AccountMenu({
    open,
    onClose,
    triggerRef,
    alignRef,
    menuRef,
    placement = "bottom-end",
    offset = 10,
    width = 220,
    className = "",
    theme, // "light" | "dark" — the portal renders outside .ds-shell, so it
           // can't inherit theming from it and needs its own theme class.
    flyoutOpen = false, // true while a child popover (e.g. the Theme
    // picker) is open and needs to render *outside* this menu's own box.
    // See the overflow note below — while this is true we deliberately
    // skip forcing overflow on the menu itself so the flyout isn't clipped.
    children,
}) {
    const fallbackMenuRef = useRef(null);
    const resolvedMenuRef = menuRef || fallbackMenuRef;

    useLayoutEffect(() => {
        if (!open || !triggerRef.current || !resolvedMenuRef.current) return;

        const [vSide, hSide] = placement.split("-");

        const position = () => {
            const trigger = triggerRef.current;
            const menu = resolvedMenuRef.current;
            if (!trigger || !menu) return;

            // Real mobile browsers (notably iOS Safari) can report a `100vw`
            // that's wider than the actual visible viewport, which is why a
            // CSS-only `max-width: calc(100vw - Npx)` on the menu class isn't
            // reliable for clipping prevention there. Using
            // `document.documentElement.clientWidth`/`innerHeight` (falls
            // back to `window.inner*`) matches what's actually visible, so
            // width/height are computed here in JS instead of trusting vw/vh.
            const viewportWidth = document.documentElement?.clientWidth || window.innerWidth;
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const edgeGap = 16; // keep a small margin off every screen edge

            const rect = trigger.getBoundingClientRect();
            const hRect = alignRef?.current ? alignRef.current.getBoundingClientRect() : rect;

            // Vertical: `top` (dropup, sits fully above the trigger),
            // `bottom` (dropdown, sits fully below), or `level` (flush with
            // the trigger's own bottom edge — used for side flyouts so the
            // menu sits right beside the trigger at the same height/"ground"
            // instead of floating above it). `level` still grows upward like
            // the dropup, it just starts from the trigger's bottom instead
            // of its top, so it visually sits alongside rather than above.
            // Whichever direction it grows, `availableHeight` is how much
            // room actually exists on screen in that direction — the panel's
            // maxHeight is capped to it below so nothing (e.g. a "View all
            // notifications" footer) can ever end up past the visible edge,
            // in portrait OR landscape.
            let availableHeight;
            if (vSide === "top") {
                menu.style.top = "";
                menu.style.bottom = `${viewportHeight - rect.top + offset}px`;
                availableHeight = rect.top - offset - edgeGap;
            } else if (vSide === "level") {
                const bottomPx = Math.max(8, viewportHeight - rect.bottom);
                menu.style.top = "";
                menu.style.bottom = `${bottomPx}px`;
                availableHeight = viewportHeight - bottomPx - edgeGap;
            } else {
                const topPx = rect.bottom + offset;
                menu.style.bottom = "";
                menu.style.top = `${topPx}px`;
                availableHeight = viewportHeight - topPx - edgeGap;
            }
            menu.style.maxHeight = `${Math.max(120, availableHeight)}px`;
            // Belt-and-suspenders: if content still can't fit (very short
            // landscape viewports), the whole panel scrolls as one unit
            // rather than letting anything render past the screen edge.
            //
            // Two things have to be true at once for this to be safe:
            //
            // 1. `overflowY: auto` alone is what caused the regression QA
            //    caught on video: per the CSS spec, an axis left at its
            //    default `visible` gets computed up to `auto` as soon as
            //    the *other* axis is anything but `visible`. So this was
            //    silently turning overflow-x on too, and because the
            //    portaled box's absolutely-positioned children (like the
            //    Theme flyout) can contribute to scrollable overflow, that
            //    surfaced as a stray horizontal scrollbar and a
            //    ghosted/duplicated flyout. Pinning overflowX explicitly
            //    is the actual fix for that half.
            //
            // 2. Even with overflowX pinned, *any* overflow value other
            //    than `visible` clips absolutely-positioned children that
            //    are meant to escape this box — which is exactly what the
            //    Theme flyout does. So this fallback only engages while no
            //    such flyout is currently open; the CSS for `.ds-menu` /
            //    `.ds-sidebar-menu` intentionally has no overflow rule of
            //    its own so those can pop out normally the rest of the
            //    time.
            if (flyoutOpen) {
                menu.style.overflowY = "visible";
                menu.style.overflowX = "visible";
            } else {
                menu.style.overflowY = "auto";
                menu.style.overflowX = "hidden";
            }

            // Horizontal: "start" hugs hRect's left edge, "end" hugs hRect's
            // right edge (menu grows leftward from it), "after" places the
            // menu just past hRect's right edge (a flyout, e.g. off the
            // sidebar's own boundary). Width is clamped against whichever
            // side is actually anchored so the *other* edge can never run
            // off-screen — e.g. for "end", the box is pinned by its right
            // edge, so its max width is however much room exists between
            // that anchor point and the screen's left edge, not just a flat
            // viewport-wide margin (that mismatch was the bug: a wide fixed
            // width plus a small right-offset let the left edge go negative
            // and run off the left of the screen on real phones).
            if (hSide === "end") {
                const rightPx = Math.max(edgeGap, viewportWidth - hRect.right);
                const effectiveWidth = Math.min(width, viewportWidth - rightPx - edgeGap);
                menu.style.width = `${effectiveWidth}px`;
                menu.style.left = "";
                menu.style.right = `${rightPx}px`;
            } else {
                const effectiveWidth = Math.min(width, viewportWidth - edgeGap * 2);
                menu.style.width = `${effectiveWidth}px`;
                let left = hSide === "after" ? hRect.right + offset : hRect.left;
                left = Math.min(left, viewportWidth - effectiveWidth - edgeGap);
                left = Math.max(left, edgeGap);
                menu.style.right = "";
                menu.style.left = `${left}px`;
            }
        };

        position();
        window.addEventListener("resize", position);
        window.addEventListener("scroll", position, true);
        // iOS Safari (and some Android browsers) resize the *visual*
        // viewport when the address bar/keyboard shows or hides without
        // always firing `window.resize` — this is the actual "cuts off the
        // right edge on a real phone" case QA sees but desktop/devtools
        // emulation never triggers. `visualViewport` catches those too.
        window.visualViewport?.addEventListener("resize", position);
        return () => {
            window.removeEventListener("resize", position);
            window.removeEventListener("scroll", position, true);
            window.visualViewport?.removeEventListener("resize", position);
        };
    }, [open, placement, offset, width, triggerRef, alignRef, resolvedMenuRef, flyoutOpen]);

    if (!open) return null;

    return createPortal(
        <div
            ref={resolvedMenuRef}
            className={`${className} ${theme || ""}`.trim()}
            style={{ position: "fixed", width, zIndex: 1000 }}
            role="menu"
        >
            {children}
        </div>,
        document.body
    );
}
