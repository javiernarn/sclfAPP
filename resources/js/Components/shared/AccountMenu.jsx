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

            const rect = trigger.getBoundingClientRect();
            const hRect = alignRef?.current ? alignRef.current.getBoundingClientRect() : rect;

            // Vertical: `top` (dropup, sits fully above the trigger),
            // `bottom` (dropdown, sits fully below), or `level` (flush with
            // the trigger's own bottom edge — used for side flyouts so the
            // menu sits right beside the trigger at the same height/"ground"
            // instead of floating above it). `level` still grows upward like
            // the dropup, it just starts from the trigger's bottom instead
            // of its top, so it visually sits alongside rather than above.
            if (vSide === "top") {
                menu.style.top = "";
                menu.style.bottom = `${window.innerHeight - rect.top + offset}px`;
            } else if (vSide === "level") {
                menu.style.top = "";
                menu.style.bottom = `${Math.max(8, window.innerHeight - rect.bottom)}px`;
            } else {
                menu.style.bottom = "";
                menu.style.top = `${rect.bottom + offset}px`;
            }

            // Horizontal: "start" hugs hRect's left edge, "end" hugs hRect's
            // right edge (menu grows leftward from it), "after" places the
            // menu just past hRect's right edge (a flyout, e.g. off the
            // sidebar's own boundary). Always nudged back on-screen so it
            // never overflows the viewport.
            if (hSide === "end") {
                menu.style.left = "";
                menu.style.right = `${Math.max(8, window.innerWidth - hRect.right)}px`;
            } else {
                let left = hSide === "after" ? hRect.right + offset : hRect.left;
                left = Math.min(left, window.innerWidth - width - 8);
                left = Math.max(left, 8);
                menu.style.right = "";
                menu.style.left = `${left}px`;
            }
        };

        position();
        window.addEventListener("resize", position);
        window.addEventListener("scroll", position, true);
        return () => {
            window.removeEventListener("resize", position);
            window.removeEventListener("scroll", position, true);
        };
    }, [open, placement, offset, width, triggerRef, alignRef, resolvedMenuRef]);

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
