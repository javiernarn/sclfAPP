import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import ImageViewer from './ImageViewer';
import { PlayCircle } from '../icons';
import './Attachments.css';

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

function PhotoTile({ item }) {
    const { url, loading, error } = useProtectedBlobUrl(item.id);

    return (
        <div className="att-tile">
            {url
                ? <ImageViewer src={url} alt={item.original_name} className="att-tile-media" />
                : <div className="att-tile-media att-tile-placeholder">{loading ? 'Loading…' : error ? 'Could not load' : ''}</div>}
            <div className="att-tile-name" title={item.original_name}>{item.original_name}</div>
            <div className="att-tile-size">{formatSize(item.size)}</div>
        </div>
    );
}

// Videos can be large, so they're only downloaded when someone presses play.
function VideoTile({ item }) {
    const [requested, setRequested] = useState(false);
    const { url, loading, error } = useProtectedBlobUrl(item.id, requested);

    return (
        <div className="att-tile">
            <div className="att-tile-media att-tile-video">
                {url ? (
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
        </div>
    );
}

/**
 * Read-only grid of a report's photos/videos. Renders nothing when there
 * are none, so callers can drop it in unconditionally.
 */
export default function AttachmentGallery({ attachments, title = 'Photos & Videos' }) {
    if (!attachments?.length) return null;

    return (
        <div className="ds-card att-gallery">
            <h3>{title}</h3>
            <p className="ds-card-desc">
                {attachments.length} file{attachments.length === 1 ? '' : 's'} attached by the reporter.
            </p>
            <div className="att-grid">
                {attachments.map((a) => (
                    a.kind === 'video'
                        ? <VideoTile key={a.id} item={a} />
                        : <PhotoTile key={a.id} item={a} />
                ))}
            </div>
        </div>
    );
}
