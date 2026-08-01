import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPage() {
    const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await register(form.name, form.email, form.password, form.password_confirmation);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
            <h2>Create your SCLF account</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                    <label>Name</label><br />
                    <input name="name" value={form.name} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Email</label><br />
                    <input type="email" name="email" value={form.email} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Password</label><br />
                    <input type="password" name="password" value={form.password} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label>Confirm Password</label><br />
                    <input type="password" name="password_confirmation" value={form.password_confirmation} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
                </div>
                <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
                    {loading ? 'Creating account...' : 'Register'}
                </button>
            </form>
            <p style={{ marginTop: 16 }}>
                Already have an account? <Link to="/login">Log in</Link>
            </p>
        </div>
    );
}