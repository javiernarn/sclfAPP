import React, { useEffect, useRef, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Package, Tag, MapPin, Calendar, Boxes, UserCircle,
    HelpCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import DashboardShell from '../../Components/shared/DashboardShell';
import ImageViewer from '../../Components/shared/ImageViewer';
import { useAuth } from '../../context/AuthContext';

const badgeClass = (status) => {
    const key = (status || '').toLowerCase();
    if (key === 'pending_review') return 'ds-badge ds-badge-pending';
    if (key === 'stored' || key === 'accepted') return 'ds-badge ds-badge-found';
    if (key === 'claimed' || key === 'release_pending') return 'ds-badge ds-badge-claimed';
    if (key === 'rejected') return 'ds-badge ds-badge-default';
    return 'ds-badge ds-badge-default';
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

export default function FoundItemDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles, user } = useAuth();
    const [item, setItem] = useState(null);
    const [myLostItems, setMyLostItems] = useState([]);
    const [selectedLostItem, setSelectedLostItem] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    // `submitting` (state) drives the disabled look of the button, but a
    // state update doesn't take effect until the next render — a fast
    // double-click/double-tap can fire handleClaim twice before that
    // re-render happens, spamming the security team with duplicate
    // claims. This ref is checked synchronously, so the very first call
    // locks it immediately, before React even re-renders.
    const claimLockRef = useRef(false);

    const isStaff = roles?.includes('security_officer') || roles?.includes('admin');

    useEffect(() => {
        document.title = "Found Item | SCLF - Opol Community College";
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            axios.get(`/found-items/${id}`),
            axios.get('/lost-items', { params: { mine: true } }).catch(() => ({ data: { data: [] } })),
        ])
            .then(([itemRes, mineRes]) => {
                setItem(itemRes.data);
                setMyLostItems((mineRes.data.data || []).filter(li => li.status !== 'closed'));
            })
            .catch(() => setError('Could not load this item.'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleClaim = async () => {
        // Synchronous guard against double-click/double-tap spam — see
        // claimLockRef's comment above. Also blocks a re-submit once a
        // claim already succeeded, in case the success button is somehow
        // reached again before the page re-renders.
        if (claimLockRef.current || success) return;
        claimLockRef.current = true;

        setSubmitting(true);
        setError('');
        try {
            await axios.post(`/found-items/${id}/claims`, {
                lost_item_id: selectedLostItem || null,
            });
            setSuccess('Claim submitted. Security will review it and you\'ll be notified.');
        } catch (err) {
            const fieldErrors = err?.response?.data?.errors;
            const message = fieldErrors
                ? Object.values(fieldErrors).flat()[0]
                : err?.response?.data?.message;
            setError(message || 'Failed to submit claim.');
            // Only release the lock on failure — a successful submit stays
            // locked forever (the button is replaced by "View My Claims"
            // right after), so there's never a second window to resubmit.
            claimLockRef.current = false;
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell eyebrow="Lost & Found" title="Found Item">
                <div className="ds-card"><div className="ds-skeleton" /><div className="ds-skeleton" /></div>
            </DashboardShell>
        );
    }

    if (!item) {
        return (
            <DashboardShell eyebrow="Lost & Found" title="Found Item">
                <div className="ds-card"><div className="ds-error">{error || 'Item not found.'}</div></div>
            </DashboardShell>
        );
    }

    const dateFound = item.date_found ? new Date(item.date_found).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
    // A finder can't claim the item they themselves turned in — reporting
    // it and then "claiming" it back would let someone route around the
    // whole verification process. The backend enforces this too (see
    // ClaimService::submit); this just keeps the button from showing up
    // for them in the first place.
    const isOwnFind = !!user && item.finder?.id === user.id;
    const canClaim = !isStaff && !isOwnFind && item.status === 'stored';

    return (
        <DashboardShell
            eyebrow="Lost & Found"
            title={item.item_name}
            subtitle={`Reported by ${item.finder?.name || 'a community member'}`}
            actions={<span className={badgeClass(item.status)}>{(item.status || '').replace(/_/g, ' ')}</span>}
        >
            <Link to="/found-items" className="ds-back-link">
                <ArrowLeft size={14} /> Back to Found Items
            </Link>

            <div className="ds-card">
                <div className="ds-card-title">Item</div>
                <p className="ds-card-desc">Details as reported and verified by Security.</p>

                {item.image_url && (
                    <ImageViewer
                        src={item.image_url}
                        alt={item.item_name}
                        className="ds-detail-photo-wrap"
                    />
                )}

                <div className="ds-info-grid">
                    <InfoItem icon={Tag} label="Category" value={item.category} />
                    <InfoItem icon={Sparkles} label="Brand / Model / Color" value={[item.brand, item.model, item.color].filter(Boolean).join(' · ')} />
                    <InfoItem icon={MapPin} label="Location Found" value={item.location_found} />
                    <InfoItem icon={Calendar} label="Date Found" value={dateFound} />
                    {item.storage_location && <InfoItem icon={Boxes} label="Storage" value={item.storage_location.code} />}
                    {isStaff && <InfoItem icon={UserCircle} label="Reported by" value={item.finder?.name} />}
                </div>

                {item.description && (
                    <div className="ds-info-item" style={{ marginTop: 12 }}>
                        <span className="ds-info-icon"><HelpCircle size={16} /></span>
                        <div className="ds-info-text">
                            <div className="ds-info-label">Description</div>
                            <div className="ds-info-value" style={{ fontWeight: 500 }}>{item.description}</div>
                        </div>
                    </div>
                )}
            </div>

            {!isStaff && isOwnFind && item.status === 'stored' && (
                <div className="ds-card">
                    <div className="ds-card-title">
                        <span className="ds-card-title-icon"><Package size={17} /> You reported this item</span>
                    </div>
                    <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                        Since you're the one who turned this in, you can't submit a claim for it yourself.
                        If it turns out to actually be yours, ask Security to review the report in person.
                    </p>
                </div>
            )}

            {canClaim && (
                <div className="ds-card">
                    <div className="ds-card-title">
                        <span className="ds-card-title-icon"><Package size={17} /> Is this yours?</span>
                    </div>
                    <p className="ds-card-desc">
                        Submit a claim. Security will ask you to provide evidence of ownership before releasing it.
                    </p>

                    {myLostItems.length > 0 && (
                        <div className="ds-field">
                            <label>Link to one of your lost item reports (optional)</label>
                            <select value={selectedLostItem} onChange={(e) => setSelectedLostItem(e.target.value)}>
                                <option value="">— None —</option>
                                {myLostItems.map(li => (
                                    <option key={li.id} value={li.id}>{li.item_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {error && <div className="ds-error">{error}</div>}
                    {success && <div className="ds-success"><CheckCircle2 size={15} style={{ verticalAlign: -2, marginRight: 4 }} />{success}</div>}

                    {!success && (
                        <button className="ds-btn ds-btn-primary" onClick={handleClaim} disabled={submitting}>
                            {submitting ? 'Submitting…' : 'Submit Claim'}
                        </button>
                    )}
                    {success && (
                        <button className="ds-btn ds-btn-primary" onClick={() => navigate('/claims')}>
                            View My Claims
                        </button>
                    )}
                </div>
            )}
        </DashboardShell>
    );
}
