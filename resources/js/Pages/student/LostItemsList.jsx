import React, { useEffect, useState } from 'react';
import axios from '../../config/axiosConfig';
import { Link } from 'react-router-dom';

export default function LostItemsList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/lost-items')
            .then(res => setItems(res.data.data))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <p>Loading...</p>;

    return (
        <div style={{ maxWidth: 700, margin: '60px auto', fontFamily: 'sans-serif' }}>
            <h2>Lost Items</h2>
            <p><Link to="/lost-items/create">+ Report Lost Item</Link></p>
            {items.length === 0 && <p>No lost items reported yet.</p>}
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {items.map(item => (
                    <li key={item.id} style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                        <strong>{item.item_name}</strong> — {item.category || 'Uncategorized'}
                        <br />
                        <small>Reported by {item.reporter} · Status: {item.status}</small>
                    </li>
                ))}
            </ul>
            <p><Link to="/dashboard">← Back to Dashboard</Link></p>
        </div>
    );
}