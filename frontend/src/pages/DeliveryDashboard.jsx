import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function statusBadge(status) {
  const map = {
    'Pending Delivery': 'badge-pending-delivery',
    'In Transit':       'badge-in-transit',
    'Delivered':        'badge-delivered',
    'Not Delivered':    'badge-not-delivered',
  };
  return <span className={`badge ${map[status] || ''}`}>{status}</span>;
}

// ── ETA Modal ─────────────────────────────────────────────────────────────────
function ETAModal({ order, onClose, onSuccess }) {
  const [eta, setEta]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await api.put(`/api/orders/${order.order_id}/accept`, { estimated_delivery: parseInt(eta) });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Accept failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>⏱ Set ETA — Order #{order.order_id}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: 14 }}>
          {order.product_summary || order.product_name} &nbsp;→&nbsp; {order.delivery_address}
        </p>
        <p style={{ fontSize: '.83rem', marginBottom: 14 }}>
          Package weight: <strong>{parseFloat(order.package_weight_kg || 0).toFixed(2)} kg</strong>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Estimated Delivery Time (minutes)</label>
            <input type="number" min="1" value={eta} onChange={e => setEta(e.target.value)}
              placeholder="e.g. 45" required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Accepting…' : '✅ Accept & Go In Transit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Open Board Tab ─────────────────────────────────────────────────────────────
function OpenBoardTab({ onAccepted }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [etaModal, setEtaModal] = useState(null);
  const [toast, setToast]     = useState('');

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('/api/orders/open-board').then(r => setOrders(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAccepted = () => {
    setEtaModal(null);
    setToast('🚚 Order accepted! Now In Transit.');
    setTimeout(() => setToast(''), 4000);
    fetchOrders();
    if (onAccepted) onAccepted();
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;

  return (
    <div>
      {toast && <div className="alert alert-success">{toast}</div>}
      {orders.length === 0
        ? <div className="empty-state"><div className="icon">🟢</div>No orders available right now. Check back soon!</div>
        : <div className="card-grid">
            {orders.map(o => (
              <div key={o.order_id} className="order-card">
                <div className="order-header">
                  <span className="order-id">Order #{o.order_id}</span>
                  {statusBadge(o.status)}
                </div>
                <h3>{o.items && o.items.length > 1 ? `Multi-Item (${o.items.length} items)` : o.product_name}</h3>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8 }}>
                  {o.product_summary}
                </div>
                <div className="order-meta">
                  <div>📍 {o.delivery_address}</div>
                  <div>👤 {o.customer_name}</div>
                  <div>📦 Package weight: <strong>{parseFloat(o.package_weight_kg || 0).toFixed(2)} kg</strong></div>
                  <div>🗓 {new Date(o.created_at).toLocaleDateString()}</div>
                  {o.distance_km && <div>🗺 Distance: {o.distance_km} km</div>}
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-success" style={{ width: '100%' }} onClick={() => setEtaModal(o)}>
                    ✅ Accept Order
                  </button>
                </div>
              </div>
            ))}
          </div>
      }
      {etaModal && <ETAModal order={etaModal} onClose={() => setEtaModal(null)} onSuccess={handleAccepted} />}
    </div>
  );
}

// ── My Deliveries Tab ──────────────────────────────────────────────────────────
function MyDeliveriesTab({ refresh }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState('');

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('/api/orders/my-deliveries').then(r => setOrders(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders, refresh]);

  const handleFinalize = async (orderId, status) => {
    try {
      await api.put(`/api/orders/${orderId}/finalize`, { status });
      setToast(`Order #${orderId} → ${status}`);
      setTimeout(() => setToast(''), 3000);
      fetchOrders();
    } catch (err) { alert(err.response?.data?.error || 'Failed.'); }
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  if (!orders.length) return <div className="empty-state"><div className="icon">📭</div>No deliveries yet.</div>;

  return (
    <div>
      {toast && <div className="alert alert-success">{toast}</div>}
      <div className="card-grid">
        {orders.map(o => (
          <div key={o.order_id} className="order-card">
            <div className="order-header">
              <span className="order-id">Order #{o.order_id}</span>
              {statusBadge(o.status)}
            </div>
            <h3>{o.items && o.items.length > 1 ? `Multi-Item (${o.items.length} items)` : o.product_name}</h3>
            {o.items && o.items.length > 1 && (
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: 8 }}>
                {o.product_summary}
              </div>
            )}
            <div className="order-meta">
              <div>📍 {o.delivery_address}</div>
              <div>👤 {o.customer_name} &nbsp;|&nbsp; 📞 {o.customer_phone}</div>
              <div>📦 Package weight: <strong>{parseFloat(o.package_weight_kg || 0).toFixed(2)} kg</strong></div>
              {o.estimated_delivery && <div>⏱ ETA: {o.estimated_delivery} mins</div>}
              {o.distance_km && <div>🗺 {o.distance_km} km</div>}
              <div>🗓 {new Date(o.created_at).toLocaleDateString()}</div>
            </div>
            {o.status === 'In Transit' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleFinalize(o.order_id, 'Delivered')}>
                  ✅ Delivered
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleFinalize(o.order_id, 'Not Delivered')}>
                  ❌ Not Delivered
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DeliveryDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('board');
  const [refreshDeliveries, setRefreshDeliveries] = useState(0);

  const handleLogout = () => { logout(); navigate('/'); };

  // When a new order is accepted from Open Board, refresh My Deliveries
  const handleAccepted = () => setRefreshDeliveries(n => n + 1);

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          📦 IDS <span>Delivery Portal</span>
        </div>
        <nav className="sidebar-nav">
          <button className={tab === 'board'      ? 'active' : ''} onClick={() => setTab('board')}>🟢 Open Board</button>
          <button className={tab === 'deliveries' ? 'active' : ''} onClick={() => setTab('deliveries')}>🚚 My Deliveries</button>
        </nav>
        <div style={{ padding: '0 12px' }}>
          <p style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.6)', marginBottom: 4 }}>
            {user?.full_name}<br />
            <span style={{ color: 'rgba(255,255,255,.5)' }}>{user?.vehicle_type}</span>
          </p>
          <button className="sidebar-logout" onClick={handleLogout} style={{ marginTop: 8 }}>🚪 Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-header">
          <h1>{tab === 'board' ? '🟢 Open Delivery Board' : '🚚 My Deliveries'}</h1>
          <p>
            {tab === 'board'
              ? 'Accept available orders. You can carry multiple orders simultaneously.'
              : 'Manage your active and completed deliveries.'}
          </p>
        </div>
        {tab === 'board'
          ? <OpenBoardTab onAccepted={handleAccepted} />
          : <MyDeliveriesTab refresh={refreshDeliveries} />
        }
      </main>
    </div>
  );
}
