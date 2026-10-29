import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X } from '../icons';
import './StudentQrScanModal.css';

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
    // starting -> live (camera running) | off (no camera / blocked)
    const [camState, setCamState] = useState('starting');
    // true for a moment after a QR that isn't a dashboard code: the frame flashes red
    const [miss, setMiss] = useState(false);
    const missAt = useRef(0);

    const openStudent = (text) => {
        if (doneRef.current) return;
        const token = extractStudentToken(text);
        if (!token) {
            setError('That isn’t a dashboard QR code. Use the one printed at the bottom of a student’s dashboard report.');
            // The camera re-reads the same code several times a second; flash once per second at most.
            if (Date.now() - missAt.current > 1000) {
                missAt.current = Date.now();
                setMiss(true);
                setTimeout(() => setMiss(false), 700);
            }
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
        setCamState('starting');
        setMiss(false);

        let cancelled = false;
        let scanner = null;

        (async () => {
            const { default: QrScanner } = await import('qr-scanner');
            // The styled QR has rounded dots and a logo in the middle; the JS
            // decoder reads it reliably, the browser's BarcodeDetector often doesn't.
            QrScanner._disableBarcodeDetector = true;
            if (cancelled) return;
            if (!(await QrScanner.hasCamera())) {
                if (!cancelled) { setCameraError('No camera found on this device. Choose a photo of the QR, or paste the link below.'); setCamState('off'); }
                return;
            }
            if (cancelled || !videoRef.current) return;
            scanner = new QrScanner(
                videoRef.current,
                (res) => openStudent(res.data),
                // Our own frame (see the .css) replaces the library's default overlay.
                { preferredCamera: 'environment', highlightScanRegion: false, highlightCodeOutline: false, maxScansPerSecond: 5 },
            );
            await scanner.start();
            if (!cancelled) setCamState('live');
        })().catch(() => {
            if (!cancelled) { setCameraError('Could not open the camera. Allow camera access, or choose a photo / paste the link instead.'); setCamState('off'); }
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

    const status = camState === 'live'
        ? 'Looking for a QR code'
        : camState === 'starting' ? 'Starting the camera…' : 'Camera unavailable';

    return (
        <div className="sq-backdrop" role="dialog" aria-modal="true" aria-label="Scan student QR" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="sq-sheet">
                <div className={`sq-view is-${camState} ${miss ? 'is-miss' : ''}`}>
                    <video ref={videoRef} playsInline muted />
                    <div className="sq-frame" aria-hidden="true">
                        <i className="sq-c sq-c-tl" /><i className="sq-c sq-c-tr" /><i className="sq-c sq-c-bl" /><i className="sq-c sq-c-br" />
                        <span className="sq-sweep" />
                    </div>
                    {cameraError && <div className="sq-cam-err">{cameraError}</div>}
                    <button type="button" className="sq-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
                    <div className="sq-status" aria-live="polite">
                        <span className={`sq-dot sq-dot-${camState}`} />{status}
                    </div>
                </div>

                <div className="sq-body">
                    <h2 className="sq-title">Open a student’s report</h2>
                    <p className="sq-sub">Hold the QR from the bottom of their printed dashboard inside the frame. It opens automatically.</p>

                    <form className="sq-paste" onSubmit={(e) => { e.preventDefault(); openStudent(manual); }}>
                        <input name="manual_code"
                            type="text"
                            value={manual}
                            onChange={(e) => setManual(e.target.value)}
                            placeholder="Paste the link or code instead"
                            aria-label="Paste the dashboard link or code"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button type="submit" disabled={!manual.trim()}>Open</button>
                    </form>

                    {error && <p className="sq-error" role="alert">{error}</p>}

                    <button type="button" className="sq-upload" onClick={() => fileRef.current?.click()}>
                        <Upload size={15} /> Choose a photo of the QR
                    </button>
                    <input name="qr_image" ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
                </div>
            </div>
        </div>
    );
}
