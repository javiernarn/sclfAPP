import React from 'react';

/**
 * FormSkeleton
 * ------------
 * Loading placeholder shaped like the "Report a Lost Item" form: a label
 * bone above each field bone, matching each real .ds-field's rhythm
 * (single input, textarea, a 2-up row, another input, then the submit
 * button) so there's no layout jump once the real form mounts.
 */
export default function FormSkeleton() {
    return (
        <div className="ds-card" aria-hidden="true" aria-busy="true">
            <div className="ds-skel ds-skel-field-label" style={{ width: '28%' }} />
            <div className="ds-skel ds-skel-input" />

            <div className="ds-skel ds-skel-field-label" style={{ width: '34%' }} />
            <div className="ds-skel ds-skel-textarea" />

            <div className="ds-form-row ds-form-row-2">
                <div className="ds-field">
                    <div className="ds-skel ds-skel-field-label" style={{ width: '42%' }} />
                    <div className="ds-skel ds-skel-input" />
                </div>
                <div className="ds-field">
                    <div className="ds-skel ds-skel-field-label" style={{ width: '55%' }} />
                    <div className="ds-skel ds-skel-input" />
                </div>
            </div>

            <div className="ds-skel ds-skel-field-label" style={{ width: '30%' }} />
            <div className="ds-skel ds-skel-input" />

            <div className="ds-skel ds-skel-btn" />
        </div>
    );
}
