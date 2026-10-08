import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, X } from '../icons';
import './Attachments.css';

export const ATTACH_MAX_FILES = 5;
export const ATTACH_MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
export const ATTACH_MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50 MB
export const ATTACH_MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB per submission

const formatSize = (bytes) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const kindOf = (file) =>
    file.type?.startsWith('video/') ? 'video' : file.type?.startsWith('image/') ? 'image' : null;

/**
 * Optional photo/video picker for report forms (incident reports, service
 * requests). Fully controlled: the parent owns `files` (File[]) and appends
 * them to its FormData as `attachments[]`.
 *
 * On phones the native file sheet offers "Take Photo / Record Video" as well
 * as the gallery, so reporters can capture evidence on the spot.
 */
export default function AttachmentPicker({ files, onChange, disabled = false, label = 'Photos or videos (optional)', hint }) {
    const inputRef = useRef(null);
    const [problem, setProblem] = useState('');

    // Object URLs for local previews — created per file and revoked on change/unmount.
    const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f), kind: kindOf(f) })), [files]);
    useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

    const addFiles = (picked) => {
        const next = [...files];
        const rejected = [];
        let total = next.reduce((n, f) => n + f.size, 0);

        for (const f of picked) {
            const kind = kindOf(f);
            if (!kind) { rejected.push(`${f.name}: only photos and videos can be attached.`); continue; }
            if (kind === 'image' && f.size > ATTACH_MAX_IMAGE_BYTES) { rejected.push(`${f.name}: photos must be 10 MB or smaller.`); continue; }
            if (kind === 'video' && f.size > ATTACH_MAX_VIDEO_BYTES) { rejected.push(`${f.name}: videos must be 50 MB or smaller.`); continue; }
            if (next.length >= ATTACH_MAX_FILES) { rejected.push(`You can attach up to ${ATTACH_MAX_FILES} files.`); break; }
            if (total + f.size > ATTACH_MAX_TOTAL_BYTES) { rejected.push(`${f.name}: total upload size is limited to 100 MB.`); continue; }
            if (next.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) continue; // same file picked twice
            next.push(f);
            total += f.size;
        }

        setProblem([...new Set(rejected)].join(' '));
        onChange(next);
    };

    const handlePick = (e) => {
        addFiles(Array.from(e.target.files || []));
        e.target.value = ''; // allow re-picking the same file after removing it
    };

    const remove = (index) => {
        setProblem('');
        onChange(files.filter((_, i) => i !== index));
    };

    return (
        <div className="ds-field att-picker">
            <label>{label}</label>

            <button
                type="button"
                className="att-drop"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || files.length >= ATTACH_MAX_FILES}
            >
                <Camera size={20} />
                <span className="att-drop-title">
                    {files.length ? 'Add more photos or videos' : 'Add photos or videos'}
                </span>
                <span className="att-drop-hint">
                    {hint || `Helps Security and Staff see what you're referring to. Up to ${ATTACH_MAX_FILES} files · photos 10 MB · videos 50 MB`}
                </span>
            </button>

            <input
                ref={inputRef}
                className="att-file-input"
                type="file"
                multiple
                accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v,video/3gpp"
                onChange={handlePick}
                tabIndex={-1}
                aria-hidden="true"
            />

            {problem && <p className="ds-field-error" role="alert">{problem}</p>}

            {previews.length > 0 && (
                <ul className="att-previews">
                    {previews.map((p, i) => (
                        <li key={`${p.file.name}-${p.file.size}-${i}`} className="att-preview">
                            <div className="att-preview-media">
                                {p.kind === 'video'
                                    ? <video src={p.url} muted playsInline preload="metadata" />
                                    : <img src={p.url} alt={p.file.name} />}
                                {p.kind === 'video' && <span className="att-badge">VIDEO</span>}
                                <button type="button" className="att-remove" onClick={() => remove(i)} disabled={disabled}
                                    aria-label={`Remove ${p.file.name}`}>
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="att-preview-name" title={p.file.name}>{p.file.name}</div>
                            <div className="att-preview-size">{formatSize(p.file.size)}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
