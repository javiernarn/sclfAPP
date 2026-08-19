import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';
import {
    Camera, Keyboard, Upload, CheckCircle2, XCircle, PackageCheck, User, IdCard,
    Tag, Hash, RotateCcw, Loader2,
} from '../../Components/icons';
import './SecurityQrScanner.css';

// Force the JS/WASM decoder path instead of the browser's native
// BarcodeDetector API. BarcodeDetector is much stricter about module
// shape/contrast — it chokes on our styled QR (rounded dot modules,
// rounded finder eyes, center logo) even though the same code scans
// fine with the JS decoder our live camera view already uses. This is
// the exact cause of "Could not find a QR code" on Upload QR Image
// even for a QR that scans perfectly with a camera.
QrScanner._disableBarcodeDetector = true;

// A decoded code doesn't get shown to the officer instantly — it steps
// through these as a visible "working on it" sequence for at least
// MIN_SCAN_MS before the release result appears, whether the release
// itself came back a moment ago or is still in flight. Real backend work
// (server verification) runs underneath this the whole time; the stages
// are just how that wait is narrated rather than fake busywork on top of
// an already-slow request.
const SCAN_STAGES = [
    'Reading QR pattern…',
    'Matching release code…',
    'Checking claim status…',
    'Confirming with server…',
];
const MIN_SCAN_MS = 4000;
const STAGE_MS = MIN_SCAN_MS / SCAN_STAGES.length;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ScanningPanel({ stage }) {
    return (
        <div className="sclf-scan-progress">
            <div className="sclf-scan-progress-icon">
                <Loader2 size={20} className="sclf-scan-spin" />
            </div>
            <p className="sclf-scan-progress-text">{SCAN_STAGES[stage]}</p>
            <div className="sclf-scan-progress-track">
                <div className="sclf-scan-progress-fill" />
            </div>
        </div>
    );
}

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
    const [scanStage, setScanStage] = useState(0);
    const toast = useToast();

    const videoRef = useRef(null);
    const scannerRef = useRef(null);
    const fileInputRef = useRef(null);
    const busyRef = useRef(false); // avoids stale-closure double-submits from the decode loop
    const resultRef = useRef(null); // same, for the "already have a result" guard
    const stageTimerRef = useRef(null);

    useEffect(() => {
        document.title = "QR Release Scanner | SCLF - Opol Community College";
    }, []);

    useEffect(() => { resultRef.current = result; }, [result]);

    useEffect(() => () => clearInterval(stageTimerRef.current), []);

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
        setScanStage(0);
        // Freeze the live camera view immediately so the officer sees the
        // "working on it" panel over the code that was just read, instead
        // of the feed continuing to hunt for the next code underneath it.
        scannerRef.current?.stop();

        // Step through the stage labels once every STAGE_MS, purely for
        // display — the actual verification below runs independently of
        // this timer.
        let stage = 0;
        stageTimerRef.current = setInterval(() => {
            stage = Math.min(stage + 1, SCAN_STAGES.length - 1);
            setScanStage(stage);
        }, STAGE_MS);

        const startedAt = Date.now();
        try {
            // Whichever takes longer wins: a fast server response still
            // waits out the minimum stage sequence, and a slow one is
            // never cut short by it.
            const [res] = await Promise.all([
                axios.post('/qr/scan', { payload }),
                sleep(MIN_SCAN_MS),
            ]);
            setResult(res.data.data);
            toast.success(res.data?.message || 'Item released successfully.', { title: 'Release confirmed' });
        } catch (err) {
            // A rejected request resolves as soon as the server responds,
            // so top up the remaining time ourselves — an error shouldn't
            // flash past the scanning panel any faster than a success would.
            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_SCAN_MS) await sleep(MIN_SCAN_MS - elapsed);
            const message = err?.response?.data?.message || Object.values(err?.response?.data?.errors || {}).flat().join(' ') || 'Could not release item.';
            setError(message);
            toast.error(message, { title: 'Could not release item' });
        } finally {
            clearInterval(stageTimerRef.current);
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

        // Revoke any previous preview's blob: URL before creating a new
        // one — picking a second image (e.g. after a failed decode) used
        // to leave the first preview's URL permanently pinned in memory,
        // since only unmounting/leaving upload mode ever revoked it.
        if (uploadPreview) URL.revokeObjectURL(uploadPreview);
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

    // Clears a failed-scan error and resumes the live camera feed. Used
    // when a QR was read but the release itself failed (wrong/expired
    // code, already released, etc.) — releaseByPayload() froze the video
    // by calling scanner.stop() the moment it decoded something, and
    // without this the officer had no way back to a live feed short of
    // switching tabs away from Camera and back again.
    const retryCamera = () => {
        setError('');
        setCameraError('');
        scannerRef.current?.start().catch(() => setCameraError('Could not restart the camera.'));
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
                            {busy && (
                                <div className="sclf-scan-overlay">
                                    <ScanningPanel stage={scanStage} />
                                </div>
                            )}
                            {!busy && error && (
                                <div className="sclf-scan-overlay sclf-scan-retry-overlay">
                                    <XCircle size={28} />
                                    <p className="sclf-scan-progress-text">{error}</p>
                                    <button type="button" className="ds-btn ds-btn-primary" onClick={retryCamera}>
                                        <RotateCcw size={16} /> Try Again
                                    </button>
                                </div>
                            )}
                        </div>
                        {cameraError && <div className="ds-error" style={{ marginTop: 12 }}>{cameraError}</div>}
                        {!cameraError && !busy && !error && (
                            <p className="ds-list-item-meta" style={{ textAlign: 'center', marginTop: 10 }}>
                                Point the camera at the student's release QR.
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
                        <div className={`sclf-scan-video-wrap sclf-scan-upload-wrap ${busy ? 'is-busy' : ''}`} onClick={!busy ? handlePickImage : undefined} role="button" tabIndex={0}>
                            {uploadPreview ? (
                                <img src={uploadPreview} alt="Uploaded QR" className="sclf-scan-video" style={{ objectFit: 'contain', background: '#0d1024' }} />
                            ) : (
                                <div className="sclf-scan-upload-empty">
                                    <Upload size={28} />
                                    <span>Click to choose a QR code image</span>
                                </div>
                            )}
                            {busy && (
                                <div className="sclf-scan-overlay">
                                    <ScanningPanel stage={scanStage} />
                                </div>
                            )}
                        </div>
                        <p className="ds-list-item-meta" style={{ textAlign: 'center', marginTop: 10 }}>
                            {decoding
                                ? 'Reading the QR code…'
                                : busy
                                    ? ' '
                                    : "Best for a laptop with no camera — upload a screenshot or saved photo of the student's release QR. On the phone at deployment, use \"Scan with Camera\" instead."}
                        </p>
                        {uploadError && <div className="ds-error" style={{ marginTop: 12 }}>{uploadError}</div>}
                        {uploadPreview && !decoding && !busy && (
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

                {error && !result && mode !== 'camera' && <div className="ds-error" style={{ marginTop: 14 }}>{error}</div>}

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
// the lightweight JS decoder. Throws on failure so the caller's catch
// block (which shows "Could not find a QR code in that image.") actually
// runs — this used to swallow the error silently instead, which meant a
// failed server decode still fell through to releaseByPayload(undefined),
// sending a blank payload to /qr/scan and surfacing a confusing generic
// 422 instead of the correct "couldn't read this image" message.
async function decodeImageServerSide(file) {
    const form = new FormData();
    form.append('image', file);
    // Don't set Content-Type manually — axios/the browser needs to add
    // the multipart boundary itself. Setting 'multipart/form-data'
    // by hand strips that boundary, so Laravel can't parse the upload
    // at all and just sees a missing "image" field -> 422.
    const res = await axios.post('/qr/decode-image', form, { silent: true });
    return res.data.payload;
}

// Redraws an image file onto a canvas at N× its natural size. Used as a
// second-pass fallback when a straight decode fails — small/blurry
// screenshots can leave individual QR modules too tiny for the decoder
// to binarize cleanly, and a scaled-up canvas gives it more pixels per
// module to work with.
//
// Every call creates a blob: URL via URL.createObjectURL() to feed the
// <img> element. That URL has to be revoked once the image has loaded —
// otherwise the browser keeps the full decoded image bitmap pinned in
// memory for the rest of the page's life, not just for this one decode
// attempt. On a scanner page a security officer might use for dozens of
// uploads in one shift, that's a steadily growing memory leak (this is
// almost certainly the "possible memory leak" from scanning/uploading
// QR images). Revoke it in both the success and error paths.
function upscaleImageFile(file, factor) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth * factor;
            canvas.height = img.naturalHeight * factor;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
        img.src = objectUrl;
    });
}
