import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useAuth } from '../../context/AuthContext';

export default function FoundItemDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { roles } = useAuth();
    const [item, setItem] = useState(null);
    const [myLostItems, setMyLostItems] = useState([]);
    const [selectedLostItem, setSelectedLostItem] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`/found-items/${id}/claims`, {
                lost_item_id: selectedLostItem || null,
            });
            setSuccess('Claim submitted. Security will review it and you\'ll be notified.');
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to submit claim.');
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

    return (
        <DashboardShell eyebrow="Lost & Found" title={item.item_name} subtitle={`Reported by ${item.finder?.name || 'a community member'}`}>
            <div className="ds-card">
                {item.image_url && (
                    <img src={item.image_url} alt={item.item_name} style={{ maxWidth: 320, borderRadius: 12, marginBottom: 16 }} />
                )}
                <p><strong>Description:</strong> {item.description}</p>
                <p><strong>Category:</strong> {item.category || '—'}</p>
                <p><strong>Brand / Model / Color:</strong> {[item.brand, item.model, item.color].filter(Boolean).join(' · ') || '—'}</p>
                <p><strong>Location Found:</strong> {item.location_found || '—'}</p>
                <p><strong>Date Found:</strong> {item.date_found || '—'}</p>
                <p><strong>Status:</strong> <span className="ds-badge ds-badge-default">{(item.status || '').replace(/_/g, ' ')}</span></p>
                {item.storage_location && <p><strong>Storage:</strong> {item.storage_location.code}</p>}

                {!isStaff && item.status === 'stored' && (
                    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--ds-border, #e2e8f0)' }}>
                        <h3 style={{ marginBottom: 8 }}>Is this yours?</h3>
                        <p className="ds-list-item-meta" style={{ marginBottom: 12 }}>
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
                        {success && <div className="ds-success">{success}</div>}

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
            </div>
        </DashboardShell>
    );
}
