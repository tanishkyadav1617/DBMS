import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['All', 'Pending Review', 'Pending Delivery', 'In Transit', 'Delivered', 'Not Delivered'];
const CATEGORIES = ['Grocery', 'Electronics', 'Smartphones', 'Accessories', 'Wearables', 'General'];
const UNITS = ['kg', 'liter', 'piece', 'box'];
const VEHICLE_TYPES = ['Two-Wheeler', 'Van', 'Truck'];

function statusBadge(status) {
  const map = {
    'Pending Review':   'badge-pending-review',
    'Pending Delivery': 'badge-pending-delivery',
    'In Transit':       'badge-in-transit',
    'Delivered':        'badge-delivered',
    'Not Delivered':    'badge-not-delivered',
    'Active':           'badge-active',
    'Suspended':        'badge-suspended',
  };
  return <span className={`badge ${map[status] || ''}`}>{status}</span>;
}

// ── Dispatch Modal ────────────────────────────────────────────────────────────
function DispatchModal({ order, onClose, onSuccess }) {
  const [distanceKm, setDistanceKm]       = useState('');
  const [dispatchMode, setDispatchMode]   = useState('General');
  const [exclusiveType, setExclusiveType] = useState('vehicle'); // 'vehicle' | 'direct'
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [partnerId, setPartnerId]         = useState('');
  const [partners, setPartners]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  useEffect(() => {
    if (dispatchMode === 'Exclusive' && exclusiveType === 'direct') {
      api.get('/api/delivery-partners').then(r => setPartners(r.data)).catch(() => {});
    }
  }, [dispatchMode, exclusiveType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const payload = { distance_km: parseFloat(distanceKm), dispatch_mode: dispatchMode };
    if (dispatchMode === 'Exclusive') {
      if (exclusiveType === 'vehicle') payload.vehicle_type_filter = vehicleFilter;
      else                             payload.partner_id = parseInt(partnerId);
    }
    try {
      await api.put(`/api/orders/${order.order_id}/dispatch`, payload);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Dispatch failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>🚀 Dispatch Order #{order.order_id}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: 8 }}>
          👤 {order.customer_name} &nbsp;|&nbsp; 📍 {order.delivery_address}
        </p>
        <div style={{ background: '#F9FAFB', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', marginBottom: 14, fontSize: '.84rem' }}>
          <div><strong>Items:</strong> {order.product_summary || order.product_name}</div>
          <div style={{ marginTop: 4 }}>
            Package weight: <strong>{parseFloat(order.package_weight_kg || 0).toFixed(2)} kg</strong>
            &nbsp;|&nbsp; Total: <strong>₹{order.total_price}</strong>
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Distance (km)</label>
            <input type="number" step="0.01" min="0.1" value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)} placeholder="e.g. 12.5" required />
          </div>
          <div className="form-group">
            <label>Dispatch Mode</label>
            <div className="radio-group">
              {['General', 'Exclusive'].map(m => (
                <label key={m} className="radio-opt">
                  <input type="radio" name="dmode" value={m} checked={dispatchMode === m}
                    onChange={() => setDispatchMode(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>

          {dispatchMode === 'Exclusive' && (
            <div className="sub-option">
              <p style={{ fontSize: '.83rem', fontWeight: 600, marginBottom: 10 }}>Exclusive routing:</p>
              <div className="radio-group">
                <label className="radio-opt">
                  <input type="radio" name="etype" value="vehicle" checked={exclusiveType === 'vehicle'}
                    onChange={() => setExclusiveType('vehicle')} />
                  Filter by vehicle type
                </label>
                <label className="radio-opt">
                  <input type="radio" name="etype" value="direct" checked={exclusiveType === 'direct'}
                    onChange={() => setExclusiveType('direct')} />
                  Assign to specific driver
                </label>
              </div>
              {exclusiveType === 'vehicle' && (
                <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                  <label>Vehicle Type</label>
                  <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} required>
                    <option value="">— Select —</option>
                    {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
              {exclusiveType === 'direct' && (
                <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                  <label>Select Driver</label>
                  <select value={partnerId} onChange={e => setPartnerId(e.target.value)} required>
                    <option value="">— Select driver —</option>
                    {partners.map(p => (
                      <option key={p.user_id} value={p.user_id}>
                        {p.full_name} ({p.vehicle_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Dispatching…' : 'Dispatch Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Product Form Modal (Add / Edit) ───────────────────────────────────────────
function ProductModal({ product, onClose, onSuccess }) {
  const isEdit = !!product;
  const [form, setForm] = useState(product || { product_name: '', category: '', selling_unit: '', price_per_unit: '', weight_per_unit_kg: '', stock_quantity: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (isEdit) await api.put(`/api/products/${product.product_id}`, form);
      else         await api.post('/api/products', form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>{isEdit ? '✏️ Edit Product' : '➕ Add Product'}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Product Name</label>
              <input name="product_name" value={form.product_name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Selling Unit</label>
              <select name="selling_unit" value={form.selling_unit} onChange={handleChange} required>
                <option value="">— Select —</option>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Price per Unit (₹)</label>
              <input name="price_per_unit" type="number" step="0.01" value={form.price_per_unit} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Weight per Unit (kg)</label>
              <input name="weight_per_unit_kg" type="number" step="0.01" value={form.weight_per_unit_kg} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Stock Quantity</label>
              <input name="stock_quantity" type="number" step="0.01" value={form.stock_quantity} onChange={handleChange} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (isEdit ? 'Update' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pending Review Tab ─────────────────────────────────────────────────────────
function PendingReviewTab() {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dispatch, setDispatch] = useState(null);
  const [toast, setToast]       = useState('');

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('/api/orders/pending-review').then(r => setOrders(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDispatched = () => {
    setDispatch(null);
    setToast('✅ Order dispatched to delivery board.');
    setTimeout(() => setToast(''), 4000);
    fetchOrders();
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;

  return (
    <div>
      {toast && <div className="alert alert-success">{toast}</div>}
      {orders.length === 0
        ? <div className="empty-state"><div className="icon">✅</div>No orders pending review.</div>
        : <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Product</th><th>Customer</th><th>Qty</th>
                  <th>Weight</th><th>Total</th><th>Address</th><th>Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.order_id}>
                    <td>#{o.order_id}</td>
                    <td>
                      <strong>{o.items && o.items.length > 1 ? `Multi-Item (${o.items.length} items)` : o.product_name}</strong>
                      <br /><small style={{ color: 'var(--muted)' }}>{o.product_summary || o.category}</small>
                    </td>
                    <td>{o.customer_name}<br /><small style={{ color: 'var(--muted)' }}>{o.customer_phone}</small></td>
                    <td>{o.items && o.items.length > 1 ? `${o.items.reduce((s, it) => s + it.quantity, 0)} units` : o.quantity}</td>
                    <td>{parseFloat(o.package_weight_kg || 0).toFixed(2)} kg</td>
                    <td>₹{o.total_price}</td>
                    <td style={{ maxWidth: 150, wordBreak: 'break-word' }}>{o.delivery_address}</td>
                    <td style={{ fontSize: '.8rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => setDispatch(o)}>Dispatch</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
      {dispatch && <DispatchModal order={dispatch} onClose={() => setDispatch(null)} onSuccess={handleDispatched} />}
    </div>
  );
}

// ── Inventory Tab ──────────────────────────────────────────────────────────────
function InventoryTab() {
  const [products, setProducts]             = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [loading, setLoading]               = useState(true);
  const [modal, setModal]                   = useState(null); // null | 'add' | product obj
  const [toast, setToast]                   = useState('');

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const url = categoryFilter && categoryFilter !== 'All Categories'
      ? `/api/products?category=${encodeURIComponent(categoryFilter)}`
      : '/api/products';
    api.get(url).then(r => setProducts(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [categoryFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/api/products/${id}`);
      setToast('Product deleted.'); setTimeout(() => setToast(''), 3000);
      fetchProducts();
    } catch (err) { alert(err.response?.data?.error || 'Delete failed.'); }
  };

  const handleSaved = () => {
    setModal(null); fetchProducts();
    setToast('Product saved.'); setTimeout(() => setToast(''), 3000);
  };

  return (
    <div>
      {toast && <div className="alert alert-success">{toast}</div>}
      <div className="toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setModal('add')}>➕ Add Product</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 600, fontSize: '.88rem' }}>Category:</label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: '.88rem' }}
            >
              {['All Categories', ...CATEGORIES].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{products.length} products found</span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : products.length === 0 ? (
        <div className="empty-state"><div className="icon">📦</div>No products found for this category.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Category</th><th>Unit</th><th>Price</th><th>Weight</th><th>Stock</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.product_id}>
                  <td>{p.product_name}</td>
                  <td>{p.category}</td>
                  <td>{p.selling_unit}</td>
                  <td>₹{p.price_per_unit}</td>
                  <td>{p.weight_per_unit_kg} kg</td>
                  <td>
                    <span style={{ color: p.stock_quantity <= 5 ? 'var(--danger)' : 'inherit', fontWeight: p.stock_quantity <= 5 ? 700 : 400 }}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setModal(p)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.product_id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ProductModal
          product={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSuccess={handleSaved}
        />
      )}
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]           = useState([]);
  const [roleFilter, setRoleFilter] = useState('All Users');
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState('');

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const roleParam = roleFilter && roleFilter !== 'All Users' ? roleFilter : '';
    const url = roleParam ? `/api/users?role=${encodeURIComponent(roleParam)}` : '/api/users';
    api.get(url).then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggle = async (user) => {
    const action = user.account_status === 'Active' ? 'Suspend' : 'Activate';
    if (!window.confirm(`${action} ${user.full_name}?`)) return;
    try {
      const { data } = await api.put(`/api/users/${user.user_id}/suspend`);
      setToast(`${user.full_name} → ${data.account_status}`);
      setTimeout(() => setToast(''), 3000);
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Failed.'); }
  };

  return (
    <div>
      {toast && <div className="alert alert-success">{toast}</div>}
      <div className="toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 600, fontSize: '.88rem' }}>Filter by role:</label>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: '.88rem' }}
          >
            {['All Users', 'Customers', 'Delivery Partners', 'Managers'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{users.length} users</span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : users.length === 0 ? (
        <div className="empty-state"><div className="icon">👥</div>No users found for this role.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Vehicle</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const domain = u.email.split('@')[1]?.toLowerCase();
                const roleLabel = domain === 'manager.com' ? 'Manager' : (domain === 'delpart.com' ? 'Delivery Partner' : 'Customer');
                return (
                  <tr key={u.user_id}>
                    <td>{u.full_name}</td>
                    <td style={{ fontSize: '.83rem' }}>{u.email}</td>
                    <td>{u.phone}</td>
                    <td>{roleLabel}</td>
                    <td>{u.vehicle_type || '—'}</td>
                    <td>{statusBadge(u.account_status)}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${u.account_status === 'Active' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggle(u)}
                      >
                        {u.account_status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── All Orders Tab ─────────────────────────────────────────────────────────────
function AllOrdersTab() {
  const [orders, setOrders]     = useState([]);
  const [filter, setFilter]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = filter ? `/api/orders/all?status=${encodeURIComponent(filter)}` : '/api/orders/all';
    api.get(url).then(r => setOrders(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="toolbar">
        <label style={{ fontWeight: 600, fontSize: '.88rem' }}>Filter by status:</label>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', fontSize: '.88rem' }}>
          {STATUSES.map(s => <option key={s} value={s === 'All' ? '' : s}>{s}</option>)}
        </select>
        <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>{orders.length} orders</span>
      </div>
      {loading ? <p style={{ color: 'var(--muted)' }}>Loading…</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Product</th><th>Customer</th><th>Partner</th><th>Total</th><th>Distance</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.order_id}>
                  <td>#{o.order_id}</td>
                  <td>
                    <strong>{o.items && o.items.length > 1 ? `Multi-Item (${o.items.length})` : o.product_name}</strong>
                    <br /><small style={{ color: 'var(--muted)' }}>{o.product_summary || o.category}</small>
                  </td>
                  <td>{o.customer_name}</td>
                  <td>{o.partner_name || '—'}</td>
                  <td>₹{o.total_price}</td>
                  <td>{o.distance_km ? `${o.distance_km} km` : '—'}</td>
                  <td>{statusBadge(o.status)}</td>
                  <td style={{ fontSize: '.8rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── DPI Leaderboard Tab ────────────────────────────────────────────────────────
function LeaderboardTab() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/manager/dpi').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  if (!data.length) return <div className="empty-state"><div className="icon">🏆</div>No delivery partner data yet.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th><th>Driver</th><th>Vehicle</th>
            <th>✅ Delivered</th><th>❌ Failed</th><th>📍 Total km</th>
            <th>DPI Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.user_id}>
              <td><span className="dpi-rank">#{i + 1}</span></td>
              <td>{d.full_name}</td>
              <td>{d.vehicle_type || '—'}</td>
              <td>{d.successful}</td>
              <td>{d.failed}</td>
              <td>{parseFloat(d.total_km).toFixed(1)} km</td>
              <td><span className="dpi-score">{parseFloat(d.dpi).toFixed(1)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 10 }}>
        DPI = (10 × Delivered) − (5 × Failed) + Total km
      </p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'review',      label: '⏳ Pending Review' },
  { key: 'inventory',   label: '📦 Inventory' },
  { key: 'users',       label: '👥 Users' },
  { key: 'orders',      label: '📋 All Orders' },
  { key: 'leaderboard', label: '🏆 DPI Leaderboard' },
];

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('review');

  const handleLogout = () => { logout(); navigate('/'); };

  const currentTab = TABS.find(t => t.key === tab);

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          📦 IDS <span>Manager Portal</span>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '0 12px' }}>
          <p style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>
            Signed in as<br /><strong style={{ color: '#fff' }}>{user?.full_name}</strong>
          </p>
          <button className="sidebar-logout" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-header">
          <h1>{currentTab?.label}</h1>
        </div>
        {tab === 'review'      && <PendingReviewTab />}
        {tab === 'inventory'   && <InventoryTab />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'orders'      && <AllOrdersTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
      </main>
    </div>
  );
}
