import React, { useEffect, useRef, useState } from 'react';

/**
 * Profile photo drawn as a real <img> on top of an avatar bubble.
 *
 * Why not CSS `background-image` (what the app used before)?
 *   - iOS Safari / installed PWAs silently paint NOTHING when a CSS background
 *     fails to load or decode, and give no way to notice - so the bubble stayed
 *     blank (no photo AND no initials).
 *   - A real <img> reports failures (onError), so we can retry and then fall
 *     back to the initials that sit underneath.
 *
 * Usage: put it inside the avatar element and ALWAYS keep the initials as the
 * element's other content. The photo covers them once it has loaded.
 *   <span className="ds-avatar">{initials}<AvatarPhoto src={user.profile_picture_url} /></span>
 */
export default function AvatarPhoto({ src }) {
    const [url, setUrl] = useState(src || '');
    const [failed, setFailed] = useState(false);
    const [shown, setShown] = useState(false);
    const retried = useRef(false);
    const blobRef = useRef(null);

    const dropBlob = () => {
        if (blobRef.current) {
            URL.revokeObjectURL(blobRef.current);
            blobRef.current = null;
        }
    };

    useEffect(() => {
        dropBlob();
        retried.current = false;
        setUrl(src || '');
        setFailed(false);
        setShown(false);
        return dropBlob;
    }, [src]);

    if (!src || failed) return null;

    const onError = () => {
        // First failure: fetch the bytes ourselves and show them from memory.
        // This sidesteps iOS image-loader quirks (cache, range, decode) that
        // plain <img src> / CSS backgrounds can hit.
        if (retried.current) {
            setFailed(true);
            return;
        }
        retried.current = true;
        fetch(src, { credentials: 'same-origin', cache: 'reload' })
            .then((res) => {
                if (!res.ok) throw new Error('bad status');
                return res.blob();
            })
            .then((blob) => {
                if (!blob || !blob.size) throw new Error('empty');
                dropBlob();
                blobRef.current = URL.createObjectURL(blob);
                setUrl(blobRef.current);
            })
            .catch(() => setFailed(true));
    };

    return (
        <img
            className="sclf-avatar-img"
            src={url}
            alt=""
            decoding="async"
            draggable={false}
            onLoad={() => setShown(true)}
            onError={onError}
            style={{ opacity: shown ? 1 : 0 }}
        />
    );
}
