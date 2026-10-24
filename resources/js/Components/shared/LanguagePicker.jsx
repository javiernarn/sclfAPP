import React from "react";
import { Globe, Check } from "../icons";
import { LANGUAGES } from "../../i18n";

/**
 * LanguagePicker — "Language" row + flyout for the student/instructor account
 * menus (header avatar dropdown and sidebar avatar menu). Mirrors the Theme
 * picker right next to it: same row look, same flyout, stays open after a
 * pick so the person can see the interface change.
 *
 * `t` / `lang` come from the shell's own (role-gated) translator.
 */
export function LanguagePicker({ open, onToggle, t, lang, onPick, side = "right", align = "top" }) {
    const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
    return (
        <div className="ds-theme-row-wrap">
            <button
                type="button"
                className="ds-menu-item"
                onClick={onToggle}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={open}
            >
                <Globe size={16} />
                {t("shell.language")}
                <span className="ds-theme-pill">{current.short}</span>
            </button>
            {open && (
                <div
                    className={`ds-theme-popover ds-lang-popover ds-theme-popover-side-${side} ds-theme-popover-align-${align}`}
                    role="menu"
                >
                    <div className="ds-theme-popover-head">
                        <div className="ds-theme-popover-title">{t("shell.chooseLanguage")}</div>
                    </div>
                    {LANGUAGES.map((l) => (
                        <button
                            key={l.code}
                            type="button"
                            className="ds-theme-option"
                            onClick={() => onPick(l.code)}
                            role="menuitemradio"
                            aria-checked={lang === l.code}
                        >
                            <span className="ds-lang-chip">{l.short}</span>
                            {l.label}
                            {lang === l.code && <Check size={15} className="ds-theme-check" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default LanguagePicker;
