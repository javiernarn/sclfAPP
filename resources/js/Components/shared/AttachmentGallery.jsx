import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import ImageViewer from './ImageViewer';
import { PlayCircle, ShieldAlert, Eye } from '../icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { VIOLATION_REASONS, DISMISS_REASONS } from '../../config/violationReasons';
import './Attachments.css';

const REVIEWER_ROLES = ['admin', 'staff', 'security_officer'];

const formatSize = (bytes) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`;

// Attachments live on the private disk, so a bare <img src> / <video src>
// can't carry the Authorization header. Fetch the bytes through axios and
// hand the element a local object URL instead (same approach as claim evidence).
function useProtectedBlobUrl(id, enabled = true) {
    const [state, setState] = useState({ url: null, loading: false, error: false });
    const urlRef = useRef(null);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        setState({ url: null, loading: true, error: false });

        axios.get(`/report-attachments/${id}`, { responseType: 'blob', timeout: 180000, silent: true })
            .then((res) => {
                if (cancelled) return;
                urlRef.current = window.URL.createObjectURL(res.data);
                setState({ url: urlRef.current, loading: false, error: false });
            })
            .catch(() => { if (!cancelled) setState({ url: null, loading: false, error: true }); });

        return () => {
            cancelled = true;
            if (urlRef.current) window.URL.revokeObjectURL(urlRef.current);
            urlRef.current = null;
        };
    }, [id, enabled]);

    return state;
}

// Overlay shown over a held-back file until a reviewer chooses to look at it.
function RevealCover({ onReveal }) {
    return (
        <button type="button" className="att-cover" onClick={onReveal}>
            <Eye size={22} />
            <span>Sensitive content</span>
            <small>Tap to reveal</small>
        </button>
    );
}

function PhotoTile({ item, blurred, onReveal, footer }) {
    const { url, loading, error } = useProtectedBlobUrl(item.id);

    return (
        <div className="att-tile">
            {url ? (
                blurred ? (
                    <div className="att-tile-media att-blurred">
                        <img src={url} alt="" draggable={false} />
                        <RevealCover onReveal={onReveal} />
                    </div>
                ) : (
                    <ImageViewer src={url} alt={item.original_name} className="att-tile-media" />
                )
            ) : (
                <div className="att-tile-media att-tile-placeholder">{loading ? 'Loading…' : error ? 'Could not load' : ''}</div>
            )}
            <div className="att-tile-name" title={item.original_name}>{item.original_name}</div>
            <div className="att-tile-size">{formatSize(item.size)}</div>
            {footer}
        </div>
    );
}

// Videos can be large, so they're only downloaded when someone presses play.
function VideoTile({ item, blurred, onReveal, footer }) {
    const [requested, setRequested] = useState(false);
    const { url, loading, error } = useProtectedBlobUrl(item.id, requested && !blurred);

    return (
        <div className="att-tile">
            <div className={`att-tile-media att-tile-video${blurred ? ' att-blurred' : ''}`}>
                {blurred ? (
                    <RevealCover onReveal={() => { setRequested(true); onReveal(); }} />
                ) : url ? (
                    <video src={url} controls autoPlay playsInline preload="metadata" />
                ) : (
                    <button type="button" className="att-play" onClick={() => setRequested(true)} disabled={loading}>
                        <PlayCircle size={34} />
                        <span>{loading ? 'Loading video…' : error ? 'Could not load — tap to retry' : 'Play video'}</span>
                    </button>
                )}
                <span className="att-badge">VIDEO</span>
            </div>
            <div className="att-tile-name" title={item.original_name}>{item.original_name}</div>
            <div className="att-tile-size">{formatSize(item.size)}</div>
            {footer}
        </div>
    );
}

const STATE_LABEL = {
    pending_review: 'Flagged — waiting for review',
    confirmed: 'Violation confirmed',
    dismissed: 'Reviewed — not a violation',
};

// Placeholder for people who may see the report but not the held-back file.
function RemovedTile({ item }) {
    return (
        <div className="att-tile">
            <div className="att-tile-media att-removed">
                <ShieldAlert size={26} />
                <span>File removed</span>
                <small>It may break the system rules.</small>
            </div>
            <div className="att-tile-name">{item.kind === 'video' ? 'Video' : 'Photo'}</div>
        </div>
    );
}

/**
 * Grid of a report's photos/videos. Renders nothing when there are none, so
 * callers can drop it in unconditionally.
 *
 * Reviewers (admin / staff / security) also get the violation controls here:
 * files that are flagged or confirmed are blurred until revealed, and each
 * file has "Mark as violation" / "Confirm violation" / "Not a violation".
 * Everyone else sees a "File removed" placeholder for held-back files.
 */
export default function AttachmentGallery({ attachments, title = 'Photos & Videos', onChanged }) {
    const { roles } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

    const isReviewer = Array.isArray(roles) && roles.some((r) => REVIEWER_ROLES.includes(r));
    const isAdmin = Array.isArray(roles) && roles.includes('admin');

    const [items, setItems] = useState(attachments || []);
    const [revealed, setRevealed] = useState({});
    const [busyId, setBusyId] = useState(null);

    useEffect(() => { setItems(attachments || []); }, [attachments]);

    if (!items.length) return null;

    const setViolation = (attachmentId, violation) => {
        setItems((prev) => prev.map((a) => (a.id === attachmentId
            ? { ...a, moderation: { ...a.moderation, hidden: !!violation && violation.status !== 'dismissed', violation } }
            : a)));
        if (onChanged) onChanged();
    };

    const run = async (item, { title: t, message, confirmLabel, tone, select, request, success }) => {
        // With a `select`, confirm() resolves the chosen reason code (or false).
        const answer = await confirm({ title: t, message, confirmLabel, cancelLabel: 'Go back', tone, select });
        if (!answer) return;
        setBusyId(item.id);
        try {
            const res = await request(typeof answer === 'string' ? answer : undefined);
            setViolation(item.id, res.data.violation);
            toast.success(success, { title: 'Done' });
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.', { title: 'Could not save' });
        } finally {
            setBusyId(null);
        }
    };

    const markViolation = (item) => run(item, {
        title: 'Mark this file as a violation?',
        message: 'The file is hidden from everyone except admin, staff and security, and the violation is recorded against the person who uploaded it.',
        confirmLabel: 'Yes, mark violation',
        tone: 'danger',
        select: { label: 'Reason (printed on the dashboard)', placeholder: 'Choose a reason…', required: true, options: VIOLATION_REASONS },
        request: (reason) => axios.post(`/report-attachments/${item.id}/violation`, { reason }),
        success: 'Marked as a violation. It will show on the uploader’s printed dashboard.',
    });

    const confirmViolation = (item) => run(item, {
        title: 'Confirm this violation?',
        message: 'It will be recorded against the uploader and show on their printed dashboard.',
        confirmLabel: 'Yes, confirm violation',
        tone: 'danger',
        select: { label: 'Reason (optional — leave blank to keep the automatic scan result)', placeholder: 'Keep automatic result', required: false, options: VIOLATION_REASONS },
        request: (reason) => axios.post(`/violations/${item.moderation.violation.id}/confirm`, reason ? { reason } : {}),
        success: 'Violation confirmed.',
    });

    const dismissViolation = (item) => run(item, {
        title: 'Not a violation?',
        message: 'Use this for things like blood or an accident photo that is not nudity or sensitive content. The file becomes visible again and nothing is recorded against the uploader.',
        confirmLabel: 'Yes, not a violation',
        select: { label: 'Why is it not a violation?', placeholder: 'Choose a reason…', required: true, options: DISMISS_REASONS },
        request: (reason) => axios.post(`/violations/${item.moderation.violation.id}/dismiss`, { reason }),
        success: 'Marked as not a violation.',
    });

    const reviewerFooter = (item) => {
        const v = item.moderation?.violation;
        const status = v?.status;
        const busy = busyId === item.id;
        const labels = (item.moderation?.scan_labels || []).slice(0, 4);

        return (
            <div className="att-review">
                {status && <div className={`att-state att-state-${status}`}>{STATE_LABEL[status]}</div>}
                {labels.length > 0 && (
                    <div className="att-labels">
                        {labels.map((l) => <span key={l} className="att-label">{l}</span>)}
                    </div>
                )}
                <div className="att-review-actions">
                    {!status && (
                        <button type="button" className="att-btn att-btn-danger" disabled={busy} onClick={() => markViolation(item)}>
                            Mark as violation
                        </button>
                    )}
                    {status === 'pending_review' && (
                        <>
                            <button type="button" className="att-btn att-btn-danger" disabled={busy} onClick={() => confirmViolation(item)}>
                                Confirm violation
                            </button>
                            <button type="button" className="att-btn" disabled={busy} onClick={() => dismissViolation(item)}>
                                Not a violation
                            </button>
                        </>
                    )}
                    {status === 'confirmed' && isAdmin && (
                        <button type="button" className="att-btn" disabled={busy} onClick={() => dismissViolation(item)}>
                            Undo — not a violation
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="ds-card att-gallery">
            <h3>{title}</h3>
            <p className="ds-card-desc">
                {items.length} file{items.length === 1 ? '' : 's'} attached by the reporter.
                {isReviewer && ' Files flagged as sensitive are blurred until you reveal them.'}
            </p>
            <div className="att-grid">
                {items.map((a) => {
                    if (a.moderation?.hidden && !isReviewer) return <RemovedTile key={a.id} item={a} />;

                    const blurred = !!a.moderation?.hidden && !revealed[a.id];
                    const common = {
                        item: a,
                        blurred,
                        onReveal: () => setRevealed((r) => ({ ...r, [a.id]: true })),
                        footer: isReviewer ? reviewerFooter(a) : null,
                    };

                    return a.kind === 'video'
                        ? <VideoTile key={a.id} {...common} />
                        : <PhotoTile key={a.id} {...common} />;
                })}
            </div>
        </div>
    );
}
