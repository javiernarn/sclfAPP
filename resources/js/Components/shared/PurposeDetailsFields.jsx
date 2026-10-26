import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';

/**
 * Extra questions for the chosen purpose of visit (delivery company + items,
 * meeting agenda, work order for maintenance, ...).
 *
 * The questions come from the server (GET /visitors/purpose-fields), which also
 * enforces them, so the form and the rules can never drift apart.
 */

let cache = null;
let inflight = null;

/** Loads the per-purpose definitions once and shares them between forms. */
export function usePurposeDefs() {
    const [defs, setDefs] = useState(cache || []);
    useEffect(() => {
        if (cache) return undefined;
        let live = true;
        inflight = inflight || axios.get('/visitors/purpose-fields', { silent: true })
            .then((res) => { cache = res.data?.data || []; return cache; })
            .catch(() => { inflight = null; return []; });
        inflight.then((d) => { if (live) setDefs(d); });
        return () => { live = false; };
    }, []);
    return defs;
}

// Mirrors PurposeDetails::allowedMinutes() on the server.
const DURATION_MINUTES = { under_30: 30, to_1h: 60, to_2h: 120, half_day: 240, whole_day: 540 };
const GRACE_MINUTES = 15;
const DEFAULT_LIMIT_MINUTES = 240;

/** Minutes a visitor may stay inside: what they declared + a short grace, else 4 h. */
export function allowedMinutes(details) {
    const m = DURATION_MINUTES[details?.expected_duration];
    return m ? m + GRACE_MINUTES : DEFAULT_LIMIT_MINUTES;
}

export const defFor = (defs, purpose) => defs.find((d) => d.value === purpose) || null;

/** Label for a stored value, e.g. delivery_type "parcel" -> "Parcel / package". */
export function optionLabel(field, value) {
    return field?.options?.[value] || String(value ?? '').replace(/_/g, ' ');
}

/** Client-side mirror of the server rules, so the officer sees what is missing instantly. */
export function missingDetails(def, details = {}, hostName = '') {
    const errors = {};
    if (!def) return errors;
    def.fields.forEach((f) => {
        const v = details[f.key];
        const empty = v === undefined || v === null || String(v).trim() === '' || v === false;
        if (f.required && empty) {
            errors[`purpose_details.${f.key}`] = f.type === 'boolean' ? `Please confirm: ${f.label}.` : `Fill in: ${f.label}.`;
        }
    });
    if (def.requires_host && !String(hostName || '').trim()) {
        errors.host_name = `Enter the ${def.host_label}.`;
    }
    return errors;
}

/** Readable list of the saved details, for the visitor row and the details modal. */
export function detailRows(def, details = {}) {
    if (!def || !details) return [];
    return def.fields
        .filter((f) => details[f.key] !== undefined && details[f.key] !== null && details[f.key] !== '')
        .map((f) => ({
            key: f.key,
            label: f.label,
            value: f.type === 'select' ? optionLabel(f, details[f.key])
                : f.type === 'boolean' ? 'Yes' : String(details[f.key]),
        }));
}

export default function PurposeDetailsFields({ def, values = {}, errors = {}, onChange }) {
    if (!def || def.fields.length === 0) return null;

    const set = (key, value) => onChange({ ...values, [key]: value });

    return (
        <fieldset className="ds-purpose-fields" aria-label={`${def.label} details`}>
            <legend>{def.label} details <span className="ds-purpose-required">All fields marked * are required to enter</span></legend>
            <div className="ds-purpose-grid">
                {def.fields.map((f) => {
                    const err = errors[`purpose_details.${f.key}`];
                    const id = `pd-${def.value}-${f.key}`;
                    const val = values[f.key];
                    const label = <label htmlFor={id}>{f.label}{f.required ? ' *' : ''}</label>;

                    if (f.type === 'boolean') {
                        return (
                            <div key={f.key} className="ds-field ds-purpose-wide">
                                <label className="ds-purpose-check" htmlFor={id}>
                                    <input id={id} type="checkbox" checked={!!val} aria-invalid={!!err}
                                        onChange={(e) => set(f.key, e.target.checked)} />
                                    <span>{f.label}{f.required ? ' *' : ''}</span>
                                </label>
                                {err && <p className="ds-field-error">{err}</p>}
                            </div>
                        );
                    }

                    return (
                        <div key={f.key} className={`ds-field ${f.type === 'textarea' ? 'ds-purpose-wide' : ''}`}>
                            {label}
                            {f.type === 'select' ? (
                                <select id={id} value={val || ''} aria-invalid={!!err} onChange={(e) => set(f.key, e.target.value)}>
                                    <option value="">Select…</option>
                                    {Object.entries(f.options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            ) : f.type === 'textarea' ? (
                                <textarea id={id} rows={2} maxLength={500} value={val || ''} placeholder={f.placeholder || ''}
                                    aria-invalid={!!err} onChange={(e) => set(f.key, e.target.value)} />
                            ) : f.type === 'number' ? (
                                <input id={id} type="number" min={1} max={f.max || 1000} inputMode="numeric" value={val ?? ''}
                                    aria-invalid={!!err} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
                            ) : (
                                <input id={id} type="text" maxLength={150} value={val || ''} placeholder={f.placeholder || ''}
                                    aria-invalid={!!err} onChange={(e) => set(f.key, e.target.value)} />
                            )}
                            {err && <p className="ds-field-error">{err}</p>}
                        </div>
                    );
                })}
            </div>
        </fieldset>
    );
}
