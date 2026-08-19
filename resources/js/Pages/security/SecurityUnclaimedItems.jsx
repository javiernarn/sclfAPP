import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';
import { useToast } from '../../context/ToastContext';
import { AlertTriangle, PackageX, RotateCcw, Trash2, Gift, Building2, ArrowRightLeft } from '../../Components/icons';

// Mirrors FoundItem::DISPOSITION_METHODS on the backend exactly.
const DISPOSITION_OPTIONS = [
    { value: 'donated', label: 'Donated', icon: Gift },
    { value: 'discarded', label: 'Discarded', icon: Trash2 },
    { value: 'destroyed', label: 'Destroyed', icon: PackageX },
    { value: 'transferred', label: 'Transferred', icon: ArrowRightLeft },
];

// One unclaimed item's card — dispose (with a method + optional notes) or
// restore it back onto the active shelf.
function UnclaimedItemCard({ item, onDisposed, onRestored }) {
    const [method, setMethod] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    const dispose = async () => {
        if (!method) {
            toast.error('Choose a disposition method first.', { title: 'Method required' });
            return;
        }
        setBusy(true);
        try {
            await axios.post(`/found-items/${item.id}/dispose`, { method, notes: notes || undefined });
            toast.success(`Item marked ${method}.`, { title: 'Disposed' });
            onDisposed(item.id);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not dispose of this item.', { title: 'Could not dispose' });
        } finally {
            setBusy(false);
        }
    };

    const restore = async () => {
        setBusy(true);
        try {
            await axios.post(`/found-items/${item.id}/restore`, { notes: notes || undefined });
            toast.success('Item restored to storage.', { title: 'Restored' });
            onRestored(item.id);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not restore this item.', { title: 'Could not restore' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="ds-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="ds-list-item-main">
                <div style={{ minWidth: 0 }}>
                    <p className="ds-list-item-title">{item.item_name}</p>
                    <p className="ds-list-item-meta">
                        {item.category}
                        {item.storage_location?.code ? ` · ${item.storage_location.code}` : ''}
                        {item.finder?.name ? ` · Found by ${item.finder.name}` : ''}
                    </p>
                    <p className="ds-list-item-meta">
                        <AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                        Flagged unclaimed {item.unclaimed_at ? new Date(item.unclaimed_at).toLocaleDateString() : '—'}
                        {item.retention_expires_at ? ` (retention ended ${new Date(item.retention_expires_at).toLocaleDateString()})` : ''}
                    </p>
                </div>
            </div>
            <div className="ds-form-row ds-form-row-2" style={{ marginTop: 8 }}>
                <div className="ds-field">
                    <label>Disposition method</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="">Choose…</option>
                        {DISPOSITION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <div className="ds-field">
                    <label>Notes</label>
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — where it went, why, etc." />
                </div>
            </div>
            <div className="ds-list-item-side" style={{ marginTop: 4 }}>
                <button className="ds-btn ds-btn-danger" disabled={busy} onClick={dispose}>
                    Dispose
                </button>
                <button className="ds-btn ds-btn-secondary" disabled={busy} onClick={restore}>
                    <RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Restore to storage
                </button>
            </div>
        </li>
    );
}

export default function SecurityUnclaimedItems() {
    const [items, setItems] = useState([]);
    const [eligibleCount, setEligibleCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [sweeping, setSweeping] = useState(false);
    const toast = useToast();

    useEffect(() => {
        document.title = "Unclaimed Items | SCLF - Opol Community College";
    }, []);

    const load = () => {
        setLoading(true);
        axios.get('/inventory/unclaimed')
            .then((res) => {
                setItems(res.data.data?.data || []);
                setEligibleCount(res.data.eligible_count || 0);
            })
            .catch((err) => {
                toast.error(err?.response?.data?.message || 'Could not load unclaimed items.', { title: 'Could not load' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const runSweep = async () => {
        setSweeping(true);
        try {
            const res = await axios.post('/inventory/unclaimed/sweep');
            toast.success(res.data.message, { title: 'Sweep complete' });
            load();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not run the sweep.', { title: 'Could not sweep' });
        } finally {
            setSweeping(false);
        }
    };

    const removeFromList = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

    return (
        <DashboardShell
            eyebrow="Security"
            title="Unclaimed Items"
            subtitle="Items whose retention period expired with no claim — dispose of them, or restore one if the owner turns up."
        >
            <div className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h3 style={{ marginBottom: 4 }}>Retention Sweep</h3>
                        <p className="ds-card-desc" style={{ marginBottom: 0 }}>
                            Runs automatically every night. {eligibleCount > 0
                                ? `${eligibleCount} item(s) are past retention and eligible right now.`
                                : 'Nothing is currently past retention.'}
                        </p>
                    </div>
                    <button className="ds-btn ds-btn-primary" disabled={sweeping || eligibleCount === 0} onClick={runSweep}>
                        {sweeping ? 'Sweeping…' : `Run sweep now${eligibleCount ? ` (${eligibleCount})` : ''}`}
                    </button>
                </div>
            </div>

            <div className="ds-card">
                <h3>Flagged Unclaimed</h3>
                {loading && <div className="ds-skeleton" />}
                {!loading && items.length === 0 && (
                    <div className="ds-empty">
                        <Building2 size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                        Nothing flagged unclaimed right now.
                    </div>
                )}
                {!loading && items.length > 0 && (
                    <ul className="ds-list">
                        {items.map((item) => (
                            <UnclaimedItemCard
                                key={item.id}
                                item={item}
                                onDisposed={removeFromList}
                                onRestored={removeFromList}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </DashboardShell>
    );
}
