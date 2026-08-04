import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams } from 'react-router-dom';
import {
    Package, Tag, UserCircle, Mail, IdCard, Calendar, ShieldAlert, AlertTriangle,
    MessageSquare, Hash, Receipt, Image as ImageIcon, FileText, HelpCircle,
    ExternalLink, Copy, Check, PlayCircle, CheckCircle2, XCircle, Clock as ClockIcon,
    QrCode, KeyRound, RefreshCw, Ban, PackageCheck,
} from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import StyledQrCode from '../../Components/shared/StyledQrCode';
import { ClaimDetailSkeleton } from '../../Components/shared/ClaimSkeleton';
import { useAuth } from '../../context/AuthContext';
import { claimStatusLabel, claimStatusBadgeClass } from '../../utils/claimStatus';

const EVIDENCE_ICON = {
    description: MessageSquare,
    serial_number: Hash,
    purchase_info: Receipt,
    photo: ImageIcon,
    document: FileText,
    other: HelpCircle,
};

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="ds-info-item">
        <span className="ds-info-icon"><Icon size={16} /></span>
        <div className="ds-info-text">
            <div className="ds-info-label">{label}</div>
            <div className="ds-info-value">{value || '—'}</div>
        </div>
    </div>
);

// One-time public code / token box with a copy-to-clipboard button — used
// by both the "Generate Release Code" and "Regenerate Release Token" cards.
const CodeBox = ({ label, value }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            // clipboard unavailable — silently ignore
        }
    };
    return (
        <div className="ds-code-box">
            <div className="ds-code-box-text">
                <div className="ds-code-box-label">{label}</div>
                <div className="ds-code-box-value">{value}</div>
            </div>
            <button type="button" className={`ds-code-copy ${copied ? 'is-copied' : ''}`} onClick={copy} aria-label={`Copy ${label}`}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
        </div>
    );
};

// Claimant's own downloadable release pass — a styled QR they can save now
// and bring up offline at pickup. Requesting a new one instantly retires
// any previously downloaded copy, so a lost/leaked screenshot can't be
// reused after a fresh one is issued.
function ReleasePassCard({ claimId, fallbackCode }) {
    const [pass, setPass] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const issue = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await axios.post(`/claims/${claimId}/download-release`);
            setPass(res.data.data);
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not generate your release QR.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ds-card">
            <div className="ds-card-title">
                <span className="ds-card-title-icon"><PackageCheck size={17} /> Ready for pickup</span>
            </div>
            <p className="ds-card-desc">
                Get your release QR now — it's saved as an image, so it still works even with no
                signal at the counter. Show it to Security and they'll scan it to release your item.
            </p>

            {!pass ? (
                <button className="ds-btn ds-btn-primary" disabled={busy} onClick={issue}>
                    <QrCode size={16} /> {busy ? 'Generating…' : 'Get My Release QR'}
                </button>
            ) : (
                <>
                    <StyledQrCode
                        value={pass.qr_payload}
                        title="SCLF - Opol Community College"
                        subtitle="Lost & Found Release Pass"
                        downloadName={`${pass.public_code}-release.png`}
                    />
                    <p className="ds-list-item-meta" style={{ textAlign: 'center', marginTop: 4 }}>
                        <ClockIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Valid until {new Date(pass.expires_at).toLocaleString()}
                    </p>
                    <hr className="ds-divider" />
                    <p className="ds-list-item-meta">
                        Case reference: <strong>{pass.public_code}</strong> — treat this QR like a ticket;
                        don't share it with anyone but Security. Lost it, or the camera's down at the
                        counter? Just tap the button again for a fresh one — the old image stops working
                        the moment you do.
                    </p>
                    <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={issue} style={{ marginTop: 10 }}>
                        <RefreshCw size={16} /> {busy ? 'Generating…' : 'Get a New QR'}
                    </button>
                </>
            )}
            {error && <div className="ds-error">{error}</div>}
            {!pass && fallbackCode && (
                <p className="ds-list-item-meta" style={{ marginTop: 10 }}>Release code on file: {fallbackCode}</p>
            )}
        </div>
    );
}

export default function ClaimDetail() {
    const { id } = useParams();
    const { roles } = useAuth();
    const isStaff = roles?.includes('security_officer') || roles?.includes('admin');

    const [claim, setClaim] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [release, setRelease] = useState(null);

    // evidence form
    const [evType, setEvType] = useState('description');
    const [evContent, setEvContent] = useState('');
    const [evFile, setEvFile] = useState(null);

    useEffect(() => {
        document.title = "Claim Details | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get(`/claims/${id}`)
            .then(res => setClaim(res.data))
            .catch(() => setError('Could not load this claim.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, [id]);

    const transition = async (status) => {
        setBusy(true);
        setError('');
        try {
            await axios.patch(`/claims/${id}/review`, { status, notes });
            setNotes('');
            load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not update claim status.');
        } finally {
            setBusy(false);
        }
    };

    const submitEvidence = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const data = new FormData();
            data.append('type', evType);
            if (evContent) data.append('content', evContent);
            if (evFile) data.append('file', evFile);
            await axios.post(`/claims/${id}/evidence`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            setEvContent(''); setEvFile(null);
            load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not submit evidence.');
        } finally {
            setBusy(false);
        }
    };

    const generateRelease = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await axios.post(`/claims/${id}/generate-release`);
            setRelease(res.data.data);
            load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not generate release code.');
        } finally {
            setBusy(false);
        }
    };

    const regenerateRelease = async () => {
        setBusy(true);
        setError('');
        try {
            const res = await axios.post(`/claims/${id}/regenerate-release`);
            setRelease(res.data.data);
            load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not regenerate release token.');
        } finally {
            setBusy(false);
        }
    };

    const cancelClaim = async () => {
        setBusy(true);
        setError('');
        try {
            await axios.post(`/claims/${id}/cancel`);
            load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not cancel claim.');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell eyebrow="Claims" title="Claim">
                <ClaimDetailSkeleton />
            </DashboardShell>
        );
    }
    if (!claim) {
        return (
            <DashboardShell eyebrow="Claims" title="Claim">
                <div className="ds-card"><div className="ds-error">{error || 'Claim not found.'}</div></div>
            </DashboardShell>
        );
    }

    const submittedAt = claim.created_at ? new Date(claim.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
    const isHighRisk = (claim.risk_score || 0) >= 50;

    return (
        <DashboardShell
            eyebrow="Claims"
            title={`Claim #${claim.id}`}
            actions={<span className={claimStatusBadgeClass(claim.status)}>{claimStatusLabel(claim.status)}</span>}
        >
            {error && <div className="ds-error">{error}</div>}

            {/* ---------- Item ---------- */}
            <div className="ds-card">
                <div className="ds-card-title">Item</div>
                <p className="ds-card-desc">The found item this claim is for.</p>

                <div className="ds-item-hero">
                    <span className="ds-thumb ds-thumb-lg">
                        {claim.found_item?.image_url
                            ? <img src={claim.found_item.image_url} alt="" />
                            : <Package size={26} />}
                    </span>
                    <div>
                        <p className="ds-item-hero-name">{claim.found_item?.item_name || 'Item'}</p>
                        <p className="ds-item-hero-meta">{claim.found_item?.category || 'Uncategorized'}</p>
                    </div>
                </div>

                <div className="ds-info-grid">
                    <InfoItem icon={Tag} label="Category" value={claim.found_item?.category} />
                    <InfoItem icon={Calendar} label="Submitted" value={submittedAt} />
                    {isStaff && <InfoItem icon={UserCircle} label="Claimant" value={claim.claimant?.name} />}
                    {isStaff && <InfoItem icon={Mail} label="Claimant Email" value={claim.claimant?.email} />}
                    {isStaff && claim.claimant?.student_id && <InfoItem icon={IdCard} label="Student ID" value={claim.claimant.student_id} />}
                    {isStaff && claim.reviewer?.name && <InfoItem icon={ShieldAlert} label="Reviewed by" value={claim.reviewer.name} />}
                </div>

                {isStaff && claim.risk_score > 0 && (
                    <div className={`ds-risk-banner ${isHighRisk ? 'is-high' : ''}`}>
                        <div className="ds-risk-banner-head">
                            <span className="ds-risk-banner-title"><ShieldAlert size={15} /> Risk Indicators</span>
                            <span className="ds-risk-score">{claim.risk_score}/100</span>
                        </div>
                        {claim.risk_flags?.length > 0 && (
                            <ul className="ds-risk-flags">
                                {claim.risk_flags.map((f, i) => (
                                    <li key={i}><AlertTriangle size={13} /> {f}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {claim.review_notes && (
                    <div className="ds-info-item" style={{ marginTop: 14 }}>
                        <span className="ds-info-icon"><MessageSquare size={16} /></span>
                        <div className="ds-info-text">
                            <div className="ds-info-label">Review notes</div>
                            <div className="ds-info-value" style={{ fontWeight: 500 }}>{claim.review_notes}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* ---------- Evidence ---------- */}
            <div className="ds-card">
                <div className="ds-card-title">Evidence</div>
                <p className="ds-card-desc">
                    {claim.evidence?.length > 0
                        ? `${claim.evidence.length} item${claim.evidence.length === 1 ? '' : 's'} submitted in support of this claim.`
                        : 'Proof of ownership submitted for this claim.'}
                </p>

                {claim.evidence?.length === 0 && <div className="ds-empty">No evidence submitted yet.</div>}

                {claim.evidence?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {claim.evidence.map(ev => {
                            const Icon = EVIDENCE_ICON[ev.type] || HelpCircle;
                            return (
                                <div key={ev.id} className="ds-evidence-row">
                                    <span className="ds-evidence-icon"><Icon size={16} /></span>
                                    <div className="ds-evidence-body">
                                        <p className="ds-evidence-type">{ev.type.replace(/_/g, ' ')}</p>
                                        {ev.content && <p className="ds-evidence-content">{ev.content}</p>}
                                        {ev.submitter?.name && (
                                            <p className="ds-evidence-meta">Submitted by {ev.submitter.name}</p>
                                        )}
                                        {ev.file_url && (
                                            <a className="ds-evidence-file" href={ev.file_url} target="_blank" rel="noreferrer">
                                                <ExternalLink size={12} /> View file
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!isStaff && !['rejected', 'cancelled', 'released'].includes(claim.status) && (
                    <>
                        <hr className="ds-divider" />
                        <p className="ds-section-label">Add evidence</p>
                        <form onSubmit={submitEvidence}>
                            <div className="ds-form-row ds-form-row-2">
                                <div className="ds-field">
                                    <label>Evidence type</label>
                                    <select value={evType} onChange={(e) => setEvType(e.target.value)}>
                                        <option value="description">Description of unique markings</option>
                                        <option value="serial_number">Serial number</option>
                                        <option value="purchase_info">Purchase information</option>
                                        <option value="photo">Photo</option>
                                        <option value="document">Supporting document</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                {(evType === 'photo' || evType === 'document') ? (
                                    <div className="ds-field">
                                        <label>File</label>
                                        <input type="file" onChange={(e) => setEvFile(e.target.files?.[0] || null)} />
                                    </div>
                                ) : (
                                    <div className="ds-field">
                                        <label>Details</label>
                                        <input value={evContent} onChange={(e) => setEvContent(e.target.value)} />
                                    </div>
                                )}
                            </div>
                            <button className="ds-btn ds-btn-primary" disabled={busy}>Submit Evidence</button>
                        </form>
                    </>
                )}
            </div>

            {/* ---------- Security Review ---------- */}
            {isStaff && !['approved', 'rejected', 'cancelled', 'release_pending', 'released'].includes(claim.status) && (
                <div className="ds-card">
                    <div className="ds-card-title">Security Review</div>
                    <p className="ds-card-desc">Weigh the evidence above, then move this claim forward.</p>
                    <div className="ds-field">
                        <label>Notes</label>
                        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {claim.status === 'pending' && (
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={() => transition('under_review')}>
                                <PlayCircle size={16} /> Start Review
                            </button>
                        )}
                        {(claim.status === 'under_review' || claim.status === 'more_evidence_required') && (
                            <>
                                <button className="ds-btn ds-btn-success" disabled={busy} onClick={() => transition('approved')}>
                                    <CheckCircle2 size={16} /> Approve
                                </button>
                                <button className="ds-btn ds-btn-danger" disabled={busy} onClick={() => transition('rejected')}>
                                    <XCircle size={16} /> Reject
                                </button>
                                <button className="ds-btn ds-btn-warning" disabled={busy} onClick={() => transition('more_evidence_required')}>
                                    <AlertTriangle size={16} /> Request More Evidence
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ---------- Release (staff, approved) ---------- */}
            {isStaff && claim.status === 'approved' && (
                <div className="ds-card">
                    <div className="ds-card-title">Release</div>
                    {!release ? (
                        <>
                            <p className="ds-card-desc">Generate a one-time code and token to release this item to the claimant.</p>
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={generateRelease}>
                                <QrCode size={16} /> Generate Release Code
                            </button>
                        </>
                    ) : (
                        <div>
                            <p className="ds-success">
                                <CheckCircle2 size={16} />
                                Release code generated — it will not be shown again. Keep it here: once the
                                claimant is at the counter with ID, go to QR Release Scanner and enter this
                                public code and token yourself to complete the release.
                            </p>
                            <CodeBox label="Public code" value={release.public_code} />
                            <CodeBox label="Token" value={release.token} />
                            <p className="ds-list-item-meta">
                                <ClockIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                Expires {new Date(release.expires_at).toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ---------- Release (staff, already generated) ---------- */}
            {isStaff && claim.status === 'release_pending' && (
                <div className="ds-card">
                    <div className="ds-card-title">Release</div>
                    {!release ? (
                        <>
                            <p className="ds-card-desc">
                                A release code was already generated for this claim. The token is only ever
                                shown once — if it was lost before you could use it at the scanner, generate
                                a new one below. The old token will stop working immediately.
                            </p>
                            <button className="ds-btn ds-btn-primary" disabled={busy} onClick={regenerateRelease}>
                                <RefreshCw size={16} /> Regenerate Release Token
                            </button>
                        </>
                    ) : (
                        <div>
                            <p className="ds-success">
                                <CheckCircle2 size={16} />
                                New token generated — it will not be shown again. Go to QR Release Scanner and
                                enter this public code and token yourself to complete the release.
                            </p>
                            <CodeBox label="Public code" value={release.public_code} />
                            <CodeBox label="Token" value={release.token} />
                            <p className="ds-list-item-meta">
                                <ClockIcon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                                Expires {new Date(release.expires_at).toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ---------- Release (claimant view) ---------- */}
            {claim.status === 'release_pending' && !isStaff && (
                <>
                    <ReleasePassCard claimId={claim.id} fallbackCode={claim.qr_release?.public_code} />
                    <p className="ds-list-item-meta" style={{ marginTop: -6, marginBottom: 16 }}>
                        <KeyRound size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Also bring a valid ID — Security verifies your identity in person before scanning.
                    </p>
                </>
            )}

            {!isStaff && ['pending', 'under_review'].includes(claim.status) && (
                <button className="ds-btn ds-btn-secondary" onClick={cancelClaim} disabled={busy}>
                    <Ban size={16} /> Cancel Claim
                </button>
            )}
        </DashboardShell>
    );
}
