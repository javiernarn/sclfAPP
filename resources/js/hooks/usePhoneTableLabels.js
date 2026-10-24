import { useEffect } from "react";

// Admin / Staff / Security pages are full of wide data tables. On a phone
// they are shown as stacked cards instead (see MobileStaffApp.css), and a
// card needs each cell to know its column name. Rather than touching every
// page, this copies each <th> text onto the matching <td> as `data-label`.
//
// It only runs when `enabled` (phone + staff roles), and re-labels whenever a
// page swaps its rows (filters, polling, pagination).
export default function usePhoneTableLabels(enabled) {
    useEffect(() => {
        if (!enabled || typeof document === "undefined") return undefined;
        const root = document.querySelector(".ds-shell .ds-main");
        if (!root) return undefined;

        const label = () => {
            root.querySelectorAll("table.ds-table").forEach((table) => {
                const heads = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
                table.querySelectorAll("tbody tr").forEach((tr) => {
                    Array.from(tr.children).forEach((td, i) => {
                        if (td.tagName !== "TD" || td.hasAttribute("data-label")) return;
                        td.setAttribute("data-label", td.colSpan > 1 ? "" : (heads[i] || ""));
                    });
                });
            });
        };

        let frame = 0;
        const schedule = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => { frame = 0; label(); });
        };

        label();
        // childList only: setting an attribute never re-triggers this.
        const mo = new MutationObserver(schedule);
        mo.observe(root, { childList: true, subtree: true });
        return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
    }, [enabled]);
}
