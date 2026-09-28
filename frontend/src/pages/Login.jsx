import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// Externalized domain rules and default demo accounts
const MANAGER_DOMAIN = (process.env.REACT_APP_MANAGER_DOMAIN || 'manager.com').replace(/^@/, '');
const CUSTOMER_DOMAIN = (process.env.REACT_APP_CUSTOMER_DOMAIN || 'customer.com').replace(/^@/, '');
const DELIVERY_DOMAIN = (process.env.REACT_APP_DELIVERY_DOMAIN || 'delpart.com').replace(/^@/, '');

const DEMO_PASSWORD = process.env.REACT_APP_DEMO_PASSWORD || 'password123';
const DEMO_MANAGER_EMAIL = process.env.REACT_APP_DEMO_MANAGER_EMAIL || `tanishk@${MANAGER_DOMAIN}`;
const DEMO_CUSTOMER_EMAIL = process.env.REACT_APP_DEMO_CUSTOMER_EMAIL || `agam@${CUSTOMER_DOMAIN}`;
const DEMO_DELIVERY_EMAIL = process.env.REACT_APP_DEMO_DELIVERY_EMAIL || `chauhan@${DELIVERY_DOMAIN}`;

const ROLE_ROUTES = {
  'Manager': '/manager',
  'Customer': '/customer',
  'Delivery Partner': '/delivery',
};

const VEHICLE_TYPES = ['Two-Wheeler', 'Van', 'Truck'];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', vehicle_type: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDeliveryDomain = form.email.toLowerCase().endsWith(`@${DELIVERY_DOMAIN}`);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/api/login', { email: form.email, password: form.password });
      login(data, data.token);
      navigate(ROLE_ROUTES[data.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const payload = { full_name: form.full_name, email: form.email, password: form.password, phone: form.phone };
    if (isDeliveryDomain) payload.vehicle_type = form.vehicle_type;
    try {
      await api.post('/api/register', payload);
      setSuccess('Account created! You can now log in.');
      setMode('login');
      setForm(f => ({ ...f, full_name: '', phone: '', vehicle_type: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>📦 IDS</h1>
        <p className="auth-subtitle">Inventory &amp; Delivery System</p>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="domain-hint">
              <strong>Quick Demo Logins (1-Click):</strong><br />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => { setForm(f => ({ ...f, email: DEMO_MANAGER_EMAIL, password: DEMO_PASSWORD })); }}
                >
                  👑 <strong>Manager:</strong> {DEMO_MANAGER_EMAIL}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => { setForm(f => ({ ...f, email: DEMO_CUSTOMER_EMAIL, password: DEMO_PASSWORD })); }}
                >
                  🛒 <strong>Customer:</strong> {DEMO_CUSTOMER_EMAIL}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => { setForm(f => ({ ...f, email: DEMO_DELIVERY_EMAIL, password: DEMO_PASSWORD })); }}
                >
                  🚚 <strong>Delivery:</strong> {DEMO_DELIVERY_EMAIL}
                </button>
              </div>
              <div style={{ marginTop: '10px', fontSize: '.75rem', opacity: 0.85 }}>
                Role rules: @{MANAGER_DOMAIN} (Manager), @{DELIVERY_DOMAIN} (Delivery), Any other domain = Customer
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Full Name</label>
              <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Your name" required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@gmail.com (or any domain)" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" required />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98000 00000" required />
            </div>
            {isDeliveryDomain && (
              <div className="form-group">
                <label>Vehicle Type</label>
                <select name="vehicle_type" value={form.vehicle_type} onChange={handleChange} required>
                  <option value="">— Select vehicle —</option>
                  {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <div className="auth-toggle">
          {mode === 'login'
            ? <>Don't have an account? <button onClick={() => { setMode('register'); setError(''); }}>Register</button></>
            : <>Already have an account? <button onClick={() => { setMode('login'); setError(''); }}>Sign In</button></>
          }
        </div>
      </div>
    </div>
  );
}
