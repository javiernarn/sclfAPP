import React, { useState } from 'react';
import axios from '../../config/axiosConfig';
import { useNavigate } from 'react-router-dom';

export default function LostItemCreate() {
    const [form, setForm] = useState({ item_name: '', description: '', category: '', location_lost: '', date_lost: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await axios.post('/lost-items', form);
            navigate('/lost-items');
        } catch (err) {
            setError('Failed to submit. Please check your inputs.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 500, margin: '60px auto', fontFamily: 'sans-serif' }}>
            <h2>Report a Lost Item</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                    <label>Item Name</label><br />
                    <input name="item_name" value={form.item_name} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Description</label><br />
                    <textarea name="description" value={form.description} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Category</label><br />
                    <input name="category" value={form.category} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Location Lost</label><br />
                    <input name="location_lost" value={form.location_lost} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Date Lost</label><br />
                    <input type="date" name="date_lost" value={form.date_lost} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
                </div>
                <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
                    {loading ? 'Submitting...' : 'Submit Report'}
                </button>
            </form>
        </div>
    );
}