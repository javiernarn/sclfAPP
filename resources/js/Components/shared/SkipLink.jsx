import React from 'react';
import { useTranslation } from '../../i18n';
import './SkipLink.css';

export const MAIN_CONTENT_ID = 'main-content';

// Keyboard / screen-reader shortcut past the sidebar and header to the page.
// The target is the shell's <main id="main-content" tabIndex={-1}>.
//
// A script moves the focus instead of letting the link change the URL: the
// address would otherwise gain "#main-content" (and the router / back button
// would treat it as a navigation), and these pages scroll inside an inner
// container where a plain anchor jump is unreliable.
export default function SkipLink() {
    const { t } = useTranslation();

    const skip = (event) => {
        event.preventDefault();
        const main = document.getElementById(MAIN_CONTENT_ID);
        if (!main) return;
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: 'start' });
    };

    return (
        <a href={`#${MAIN_CONTENT_ID}`} className="sclf-skip-link" onClick={skip}>
            {t('shell.skipToContent')}
        </a>
    );
}
