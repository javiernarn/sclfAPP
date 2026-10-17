import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, X } from '../icons';
import './Popups.css';

/**
 * Reads the QR code printed at the bottom of a student's/instructor's
 * dashboard report and opens that person's report (/app/print/{token}).
 *
 * Three ways in, so it works on any device: live camera, a photo/screenshot
 * of the QR, or pasting the link / code. Only the user token is taken from
 * what was scanned — the app then asks the server whether the signed-in
 * account is allowed to open it.
 */
export function extractStudentToken(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const fromUrl = raw.match(/\/app\/(?:print|dashboard)\/([A-Za-z0-9_-]{16,64})(?:[/?#]|$)/);
    if (fromUrl) return fromUrl[1];
    if (/^[A-Za-z0-9_-]{16,64}$/.test(raw)) return raw;
    return null;
}

export default function StudentQrScanModal({ open, onClose }) {
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const fileRef = useRef(null);
    const doneRef = useRef(false);
    const [error, setError] = useState('');
    const [cameraError, setCameraError] = useState('');
    const [manual, setManual] = useState('');

    const openStudent = (text) => {
        if (doneRef.current) return;
        const token = extractStudentToken(text);
        if (!token) {
            setError('That is not a student dashboard QR code. Scan the code printed at the bottom of a dashboard report.');
            return;
        }
        doneRef.current = true;
        onClose();
        navigate(`/app/print/${token}`);
    };

    useEffect(() => {
        if (!open) return undefined;
        doneRef.current = false;
        setError('');
        setCameraError('');
        setManual('');

        let cancelled = false;
        let scanner = null;

        (async () => {
            const { default: QrScanner } = await import('qr-scanner');
            // The styled QR has rounded dots and a logo in the middle; the JS
            // decoder reads it reliably, the browser's BarcodeDetector often doesn't.
            QrScanner._disableBarcodeDetector = true;
            if (cancelled) return;
            if (!(await QrScanner.hasCamera())) {
                if (!cancelled) setCameraError('No camera found on this device. Upload a photo of the QR, or paste the link below.');
                return;
            }
            if (cancelled || !videoRef.current) return;
            scanner = new QrScanner(
                videoRef.current,
                (res) => openStudent(res.data),
                { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
            );
            await scanner.start();
        })().catch(() => {
            if (!cancelled) setCameraError('Could not open the camera. Check the permission, or upload a photo / paste the link instead.');
        });

        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);

        return () => {
            cancelled = true;
            document.removeEventListener('keydown', onKey);
            scanner?.stop();
            scanner?.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const onFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setError('');
        try {
            const { default: QrScanner } = await import('qr-scanner');
            QrScanner._disableBarcodeDetector = true;
            const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
            openStudent(res.data);
        } catch {
            setError('Could not read a QR code from that image. Try a clearer photo, or paste the link below.');
        }
    };

    if (!open) return null;

    return (
        <div className="pr-modal-backdrop" role="dialog" aria-modal="true" aria-label="Scan student QR" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="pr-modal">
                <div className="pr-modal-head">
                    <strong><Camera size={16} /> Scan student QR</strong>
                    <button type="button" className="pr-modal-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>

                <p className="pr-modal-hint">Point the camera at the QR code at the bottom of the printed dashboard.</p>

                <div className="pr-modal-video">
                    <video ref={videoRef} playsInline muted />
                    {cameraError && <div className="pr-modal-cam-err">{cameraError}</div>}
                </div>

                {error && <p className="pr-modal-error" role="alert">{error}</p>}

                <div className="pr-modal-actions">
                    <button type="button" className="pr-modal-btn" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload QR image</button>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                </div>

                <form className="pr-modal-manual" onSubmit={(e) => { e.preventDefault(); openStudent(manual); }}>
                    <label>
                        <span>Or paste the link / user token</span>
                        <input type="text" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="http://127.0.0.1:8000/app/print/…" autoComplete="off" spellCheck={false} />
                    </label>
                    <button type="submit" className="pr-modal-btn primary" disabled={!manual.trim()}>Open</button>
                </form>
            </div>
        </div>
    );
}
