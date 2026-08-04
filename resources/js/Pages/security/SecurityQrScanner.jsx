import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';
import {
    Camera, Keyboard, Upload, CheckCircle2, XCircle, PackageCheck, User, IdCard,
    Tag, Hash, RotateCcw,
} from 'lucide-react';
import './SecurityQrScanner.css';

// Force the JS/WASM decoder path instead of the browser's native
// BarcodeDetector API. BarcodeDetector is much stricter about module
// shape/contrast — it chokes on our styled QR (rounded dot modules,
// rounded finder eyes, center logo) even though the same code scans
// fine with the JS decoder our live camera view already uses. This is
// the exact cause of "Could not find a QR code" on Upload QR Image
// even for a QR that scans perfectly with a camera.
QrScanner._disableBarcodeDetector = true;

export default function SecurityQrScanner() {
    const [mode, setMode] = useState('camera'); // 'camera' | 'upload' | 'manual'
    const [publicCode, setPublicCode] = useState('');
    const [token, setToken] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [uploadPreview, setUploadPreview] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const [decoding, setDecoding] = useState(false);
    const toast = useToast();

    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const fileInputRef = useRef(null);
    const busyRef = useRef(false); // avoids stale-closure double-submits from the decode loop
    const resultRef = useRef(null); // same, for the "already have a result" guard

    useEffect(() => {
        document.title = "QR Release Scanner | SCLF - Opol Community College";
    }, []);

    useEffect(() => { resultRef.current = result; }, [result]);

    // ---- Camera lifecycle ----
    useEffect(() => {
        if (mode !== 'camera') {
            scannerRef.current?.stop();
            return;
        }

        let cancelled = false;
        setCameraError('');

        QrScanner.hasCamera().then((has) => {
            if (cancelled) return;
            if (!has) {
                setCameraError('No camera was found on this device. Use manual entry instead.');
                return;
            }

            const scanner = new QrScanner(
                videoRef.current,
                (res) => handleDecoded(res.data),
                {
                    preferredCamera: 'environment',
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    maxScansPerSecond: 5,
                },
            );
            scannerRef.current = scanner;
            scanner.start().catch(() => {
                if (!cancelled) setCameraError("Could not access the camera. Check permissions, or use manual entry.");
            });
        });

        return () => {
            cancelled = true;
            scannerRef.current?.stop();
            scannerRef.current?.destroy();
            scannerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const releaseByPayload = async (payload) => {
        setError(''); setBusy(true); busyRef.current = true;
        try {
            const res = await axios.post('/qr/scan', { payload });
            setResult(res.data.data);
            toast.success(res.data?.message || 'Item released successfully.', { title: 'Release confirmed' });
            scannerRef.current?.stop();
        } catch (err) {
            const message = err?.response?.data?.message || Object.values(err?.response?.data?.errors || {}).flat().join(' ') || 'Could not release item.';
            setError(message);
            toast.error(message, { title: 'Could not release item' });
        } finally {
            setBusy(false); busyRef.current = false;
        }
    };

    const handleDecoded = (data) => {
        if (busyRef.current || resultRef.current) return; // one release per scan, until "Scan Next"
        releaseByPayload(data);
    };

    // ---- Upload-a-QR-image mode (handy on a laptop with no camera —
    // e.g. during development; on an actual phone deployment "Scan with
    // Camera" is the one people will use). Decodes entirely client-side
    // via the same qr-scanner library, then feeds the result through the
    // same releaseByPayload() path as a live camera scan. ----
    const handlePickImage = () => fileInputRef.current?.click();

    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadError('');
        setError('');

        if (!file.type.startsWith('image/')) {
            setUploadError('Please choose an image file (PNG or JPG).');
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setUploadPreview(previewUrl);
        setDecoding(true);

        try {
            let payload;
            try {
                payload = await decodeImageClientSide(file);
            } catch (clientErr) {
                // Both in-browser attempts (straight decode, then 2x
                // upscale) failed. The browser's decoder (jsQR, via
                // qr-scanner) is noticeably pickier than a full decoder
                // about screenshots, re-saved/recompressed images, and
                // our styled dot-pattern QR — so hand the raw file to the
                // server, where a ZXing-ported PHP decoder (same class of
                // robustness as zbar) gets a second, more tolerant pass.
                payload = await decodeImageServerSide(file);
            }
            releaseByPayload(payload);
        } catch (err) {
            setUploadError('Could not find a QR code in that image. Try a clearer, uncropped photo or screenshot.');
        } finally {
            setDecoding(false);
            // Let the same file be re-selected again (e.g. retrying after
            // a failed decode) — without this, choosing the same path
            // twice in a row silently no-ops.
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const resetUpload = () => {
        if (uploadPreview) URL.revokeObjectURL(uploadPreview);
        setUploadPreview(null);
        setUploadError('');
    };

    useEffect(() => {
        if (mode !== 'upload') resetUpload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const submitManual = async (e) => {
        e.preventDefault();
        setError(''); setResult(null); setBusy(true);
        try {
            const res = await axios.post('/qr/scan', { public_code: publicCode, token });
            setResult(res.data.data);
            setPublicCode(''); setToken('');
            toast.success(res.data?.message || 'Item released successfully.', { title: 'Release confirmed' });
        } catch (err) {
            const message = err?.response?.data?.message || Object.values(err?.response?.data?.errors || {}).flat().join(' ') || 'Could not release item.';
            setError(message);
            toast.error(message, { title: 'Could not release item' });
        } finally {
            setBusy(false);
        }
    };

    const scanNext = () => {
        setResult(null);
        setError('');
        resetUpload();
        if (mode === 'camera') {
            scannerRef.current?.start().catch(() => setCameraError('Could not restart the camera.'));
        }
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="QR Release Scanner"
            subtitle="Scan a student's release pass — or enter it by hand if the camera's unavailable. Every check happens server-side, in real time."
        >
            <div className="ds-card">
                <div className="sclf-scan-tabs">
                    <button
                        type="button"
                        className={`sclf-scan-tab ${mode === 'camera' ? 'is-active' : ''}`}
                        onClick={() => { setMode('camera'); setResult(null); setError(''); }}
                    >
                        <Camera size={15} /> Scan with Camera
                    </button>
                    <button
                        type="button"
                        className={`sclf-scan-tab ${mode === 'upload' ? 'is-active' : ''}`}
                        onClick={() => { setMode('upload'); setResult(null); setError(''); }}
                    >
                        <Upload size={15} /> Upload QR Image
                    </button>
                    <button
                        type="button"
                        className={`sclf-scan-tab ${mode === 'manual' ? 'is-active' : ''}`}
                        onClick={() => { setMode('manual'); setResult(null); setError(''); }}
                    >
                        <Keyboard size={15} /> Manual Entry
                    </button>
                </div>

                {mode === 'camera' && !result && (
                    <div className="sclf-scan-camera">
                        <div className="sclf-scan-video-wrap">
                            <video ref={videoRef} className="sclf-scan-video" muted playsInline />
                        </div>
                        {cameraError && <div className="ds-error" style={{ marginTop: 12 }}>{cameraError}</div>}
                        {!cameraError && (
                            <p className="ds-list-item-meta" style={{ textAlign: 'center', marginTop: 10 }}>
                                {busy ? 'Verifying…' : "Point the camera at the student's release QR."}
                            </p>
                        )}
                    </div>
                )}

                {mode === 'upload' && !result && (
                    <div className="sclf-scan-camera">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ display: 'none' }}
                        />
                        <div className="sclf-scan-video-wrap sclf-scan-upload-wrap" onClick={handlePickImage} role="button" tabIndex={0}>
                            {uploadPreview ? (
                                <img src={uploadPreview} alt="Uploaded QR" className="sclf-scan-video" style={{ objectFit: 'contain', background: '#0d1024' }} />
                            ) : (
                                <div className="sclf-scan-upload-empty">
                                    <Upload size={28} />
                                    <span>Click to choose a QR code image</span>
                                </div>
                            )}
                        </div>
                        <p className="ds-list-item-meta" style={{ textAlign: 'center', marginTop: 10 }}>
                            {decoding
                                ? 'Reading the QR code…'
                                : busy
                                    ? 'Verifying…'
                                    : "Best for a laptop with no camera — upload a screenshot or saved photo of the student's release QR. On the phone at deployment, use \"Scan with Camera\" instead."}
                        </p>
                        {uploadError && <div className="ds-error" style={{ marginTop: 12 }}>{uploadError}</div>}
                        {uploadPreview && !decoding && (
                            <button type="button" className="ds-btn ds-btn-secondary" style={{ marginTop: 10 }} onClick={handlePickImage}>
                                Choose a different image
                            </button>
                        )}
                    </div>
                )}

                {mode === 'manual' && !result && (
                    <form onSubmit={submitManual}>
                        <p className="ds-list-item-meta" style={{ marginBottom: 16 }}>
                            Use this when the camera isn't available. With the claimant present and ID
                            checked, generate (or regenerate) a code on their approved claim and type it
                            in here yourself.
                        </p>
                        <div className="ds-field">
                            <label>Public Code <span className="ds-required">*</span></label>
                            <input value={publicCode} onChange={(e) => setPublicCode(e.target.value)} placeholder="SCLF-ITEM-000245" aria-invalid={!!error} required />
                        </div>
                        <div className="ds-field">
                            <label>Token <span className="ds-required">*</span></label>
                            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token shown on the claim's release step" aria-invalid={!!error} required />
                        </div>
                        <button className="ds-btn ds-btn-primary ds-btn-block" disabled={busy}>
                            {busy ? 'Verifying…' : 'Release Item'}
                        </button>
                    </form>
                )}

                {error && !result && <div className="ds-error" style={{ marginTop: 14 }}>{error}</div>}

                {result && (
                    <div className="sclf-scan-result">
                        <div className="sclf-scan-result-head">
                            <CheckCircle2 size={22} />
                            <div>
                                <p className="sclf-scan-result-title">Case closed</p>
                                <p className="sclf-scan-result-sub">Item released and case marked closed.</p>
                            </div>
                        </div>

                        <div className="sclf-scan-result-grid">
                            <ResultRow icon={Hash} label="Release code" value={result.public_code} />
                            <ResultRow icon={Tag} label="Item" value={result.found_item?.item_name} />
                            <ResultRow icon={Tag} label="Category" value={result.found_item?.category} />
                            <ResultRow icon={User} label="Released to" value={result.claim?.claimant?.name} />
                            <ResultRow icon={IdCard} label="Student ID" value={result.claim?.claimant?.student_id} />
                            <ResultRow icon={PackageCheck} label="Scanned at" value={result.scanned_at ? new Date(result.scanned_at).toLocaleString() : null} />
                        </div>

                        <button className="ds-btn ds-btn-primary ds-btn-block" onClick={scanNext} style={{ marginTop: 16 }}>
                            <RotateCcw size={16} /> Scan Next
                        </button>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}

function ResultRow({ icon: Icon, label, value }) {
    return (
        <div className="ds-info-item">
            <span className="ds-info-icon"><Icon size={16} /></span>
            <div className="ds-info-text">
                <div className="ds-info-label">{label}</div>
                <div className="ds-info-value">{value || '—'}</div>
            </div>
        </div>
    );
}

// Tries the in-browser decoder (qr-scanner, jsQR under the hood): a
// straight decode first, then once more on a 2x-upscaled copy for
// small/blurry screenshots. Throws if neither pass reads a code.
async function decodeImageClientSide(file) {
    try {
        const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
        return res.data;
    } catch (firstPassErr) {
        const upscaled = await upscaleImageFile(file, 2);
        const res = await QrScanner.scanImage(upscaled, { returnDetailedScanResult: true });
        return res.data;
    }
}

// Fallback for when the browser decoder gives up: sends the raw file to
// the server, which reads it with a full ZXing-ported PHP decoder — far
// more tolerant of screenshots, recompression, and our styled dots than
// the lightweight JS decoder. Throws (via axios) if the server also
// can't find a code, which the caller treats the same as a client-side
// failure.
async function decodeImageServerSide(file) {
    const form = new FormData();
    form.append('image', file);
    // Don't set Content-Type manually — axios/the browser needs to add
    // the multipart boundary itself. Setting 'multipart/form-data'
    // by hand strips that boundary, so Laravel can't parse the upload
    // at all and just sees a missing "image" field -> 422.
    try {
        const res = await axios.post('/qr/decode-image', form, { silent: true });
        return res.data.payload;
    } catch (err) {
        // TEMP DEBUG — remove once the 422 is diagnosed. Logs exactly
        // which validation rule the server rejected, instead of just
        // the bare "422" the browser's own network error shows.
        // eslint-disable-next-line no-console
        console.error('[decode-image failure]', err.response?.status, err.response?.data);
        throw err;
    }
}

// Redraws an image file onto a canvas at N× its natural size. Used as a
// second-pass fallback when a straight decode fails — small/blurry
// screenshots can leave individual QR modules too tiny for the decoder
// to binarize cleanly, and a scaled-up canvas gives it more pixels per
// module to work with.
function upscaleImageFile(file, factor) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth * factor;
            canvas.height = img.naturalHeight * factor;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}
