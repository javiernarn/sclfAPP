import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import DashboardShell from '../../Components/shared/DashboardShell';

export default function SecurityQrScanner() {
    const [publicCode, setPublicCode] = useState('');
    const [token, setToken] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        document.title = "QR Release Scanner | SCLF - Opol Community College";
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError(''); setResult(null); setBusy(true);
        try {
            const res = await axios.post('/qr/scan', { public_code: publicCode, token });
            setResult(res.data);
            setPublicCode(''); setToken('');
        } catch (err) {
            setError(err?.response?.data?.message || Object.values(err?.response?.data?.errors || {}).flat().join(' ') || 'Could not release item.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <DashboardShell
            eyebrow="Security"
            title="QR Release Scanner"
            subtitle="Enter the release code and token to authorize handing over an item. Every check happens server-side."
        >
            <div className="ds-card">
                <p className="ds-list-item-meta" style={{ marginBottom: 16 }}>
                    Confirm the claimant's identity in person, then open their approved claim and click
                    "Generate Release Code." Copy the public code and token shown there into the fields
                    below to complete the release — that code is shown only once, only to you.
                </p>
                <form onSubmit={submit}>
                    <div className="ds-field">
                        <label>Public Code</label>
                        <input value={publicCode} onChange={(e) => setPublicCode(e.target.value)} placeholder="SCLF-ITEM-000245" required />
                    </div>
                    <div className="ds-field">
                        <label>Token</label>
                        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token shown on the claim's Generate Release Code step" required />
                    </div>
                    {error && <div className="ds-error">{error}</div>}
                    {result && <div className="ds-success">{result.message}</div>}
                    <button className="ds-btn ds-btn-primary ds-btn-block" disabled={busy}>
                        {busy ? 'Verifying…' : 'Release Item'}
                    </button>
                </form>
            </div>
        </DashboardShell>
    );
}