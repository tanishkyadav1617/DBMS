import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Smartphones', 'Accessories', 'Wearables', 'General'];
const PAYMENT_MODES = ['Cash on Delivery', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking'];

function statusBadge(status) {
  const map = {
    'Pending Review':   'badge-pending-review',
    'Pending Delivery': 'badge-pending-delivery',
    'In Transit':       'badge-in-transit',
    'Delivered':        'badge-delivered',
    'Not Delivered':    'badge-not-delivered',
  };
  return <span className={`badge ${map[status] || 'badge-pending-review'}`}>{status}</span>;
}

// ── Multi-Item Cart & Checkout Modal ─────────────────────────────────────────
function CartCheckoutModal({ cart, onUpdateQty, onRemove, onClear, onClose, onSuccess }) {
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMode, setPaymentMode]         = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0);
  const cartWeight = cart.reduce((sum, item) => sum + (item.quantity * (item.weight_per_unit_kg || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    setLoading(true); setError('');
    try {
      await api.post('/api/place-order', {
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity:   parseFloat(item.quantity),
        })),
        delivery_address: deliveryAddress.trim(),
        payment_mode:     paymentMode.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Order placement failed.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>🛒 Shopping Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})</h3>
          {cart.length > 0 && (
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '.8rem' }}
              onClick={onClear}
            >
              Clear Cart
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {cart.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="icon">🛍️</div>
            <p>Your shopping cart is empty.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={onClose}>
              Browse Catalog
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
              <table className="cart-items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => {
                    const subtotal = (item.quantity * item.price_per_unit).toFixed(2);
                    return (
                      <tr key={item.product_id}>
                        <td>
                          <strong>{item.product_name}</strong>
                          <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>
                            {item.category} • Max: {item.stock_quantity} {item.selling_unit}
                          </div>
                        </td>
                        <td>₹{item.price_per_unit} <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>/{item.selling_unit}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="qty-control">
                            <button
                              type="button"
                              className="qty-btn"
                              onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <span className="qty-val">{item.quantity}</span>
                            <button
                              type="button"
                              className="qty-btn"
                              onClick={() => onUpdateQty(item.product_id, item.quantity + 1)}
                              disabled={item.quantity >= item.stock_quantity}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{subtotal}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}
                            onClick={() => onRemove(item.product_id)}
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#EEF2FF', padding: '12px 14px', borderRadius: 7, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Est. Package Weight: </span>
                <strong>{cartWeight.toFixed(2)} kg</strong>
              </div>
              <div>
                <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Total Amount: </span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>₹{cartTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label>Delivery Address</label>
              <input
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Full delivery address, landmark, PIN"
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Mode</label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value)}
                required
              >
                <option value="">— Select payment option —</option>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Continue Shopping
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading || cart.length === 0}>
                {loading ? 'Placing Order…' : `Confirm Order (₹${cartTotal.toFixed(2)})`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────
function BrowseTab({ cart, onAddToCart, onOpenCart }) {
  const [selectedCat, setSelectedCat] = useState('All');
  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedCat === 'All' ? '/api/products' : `/api/products?category=${encodeURIComponent(selectedCat)}`;
      const { data } = await api.get(url);
      setProducts(data);
    } catch {} finally { setLoading(false); }
  }, [selectedCat]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p style={{ color: 'var(--muted)', fontSize: '.88rem' }}>
          Select items from categories and add them to your multi-item shopping cart.
        </p>
        <button className="cart-header-btn" onClick={onOpenCart}>
          🛒 View Cart <span className="count-badge">{cartItemCount}</span> {cartTotal > 0 && `— ₹${cartTotal.toFixed(2)}`}
        </button>
      </div>

      <div className="browse-layout">
        <div className="cat-sidebar">
          <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Category</p>
          {CATEGORIES.map(c => (
            <button key={c} className={`cat-btn ${selectedCat === c ? 'active' : ''}`} onClick={() => setSelectedCat(c)}>{c}</button>
          ))}
        </div>
        <div className="products-area">
          {loading ? <p style={{ color: 'var(--muted)' }}>Loading…</p> : (
            products.length === 0
              ? <div className="empty-state"><div className="icon">📭</div>No products found.</div>
              : <div className="card-grid">
                  {products.map(p => {
                    const cartItem = cart.find(i => i.product_id === p.product_id);
                    return (
                      <div key={p.product_id} className="product-card">
                        <div className="cat-tag">{p.category}</div>
                        <h3>{p.product_name}</h3>
                        <div className="price">₹{p.price_per_unit} <span className="unit">/ {p.selling_unit}</span></div>
                        <div className="stock">
                          Stock: {p.stock_quantity} {p.selling_unit} &nbsp;|&nbsp; {p.weight_per_unit_kg} kg/unit
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                          <button
                            className={`btn btn-sm ${cartItem ? 'btn-success' : 'btn-outline'}`}
                            style={{ flex: 1 }}
                            onClick={() => onAddToCart(p, 1)}
                            disabled={p.stock_quantity <= 0}
                          >
                            {cartItem ? `In Cart (${cartItem.quantity}) +` : '+ Add to Cart'}
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => {
                              onAddToCart(p, 1);
                              onOpenCart();
                            }}
                            disabled={p.stock_quantity <= 0}
                          >
                            Buy Now
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── My Orders Tab ─────────────────────────────────────────────────────────────
function MyOrdersTab() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('/api/orders/my')
      .then(r => setOrders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>;
  if (!orders.length) return <div className="empty-state"><div className="icon">🧾</div>You haven't placed any orders yet.</div>;

  return (
    <div className="card-grid">
      {orders.map(o => (
        <div key={o.order_id} className="order-card">
          <div className="order-header">
            <span className="order-id">Order #{o.order_id}</span>
            {statusBadge(o.status)}
          </div>

          <h3 style={{ fontSize: '.98rem', marginBottom: 4 }}>
            {o.items && o.items.length > 1
              ? `Multi-Item Package (${o.items.length} items)`
              : (o.items && o.items[0]?.product_name) || o.product_name}
          </h3>

          {/* Itemized Order Details */}
          {o.items && o.items.length > 0 && (
            <div className="order-items-box">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.product_name}</td>
                      <td style={{ textAlign: 'center' }}>{it.quantity} {it.selling_unit}</td>
                      <td style={{ textAlign: 'right' }}>₹{it.total_price || (it.quantity * it.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="order-meta">
            <div>
              <strong>Grand Total: ₹{o.total_price}</strong> &nbsp;|&nbsp;
              Package: <strong>{parseFloat(o.package_weight_kg || 0).toFixed(2)} kg</strong>
            </div>
            <div>Payment: {o.payment_mode}</div>
            <div>Address: {o.delivery_address}</div>
            <div>Ordered: {new Date(o.created_at).toLocaleString()}</div>
          </div>

          {o.status === 'In Transit' && o.partner_name && (
            <div className="partner-info">
              🚚 <strong>Delivery Partner: {o.partner_name}</strong><br />
              📞 {o.partner_phone}<br />
              ⏱ ETA: {o.estimated_delivery} mins
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Customer Dashboard Master ─────────────────────────────────────────────────
export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]         = useState('browse');
  const [cart, setCart]       = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toast, setToast]     = useState('');

  const handleLogout = () => { logout(); navigate('/'); };

  const handleAddToCart = (product, addQty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.product_id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + addQty, product.stock_quantity);
        return prev.map(i => i.product_id === product.product_id ? { ...i, quantity: nextQty } : i);
      } else {
        return [...prev, {
          product_id:         product.product_id,
          product_name:       product.product_name,
          category:           product.category,
          selling_unit:       product.selling_unit,
          price_per_unit:     product.price_per_unit,
          weight_per_unit_kg: product.weight_per_unit_kg,
          stock_quantity:     product.stock_quantity,
          quantity:           Math.min(addQty, product.stock_quantity),
        }];
      }
    });
    setToast(`Added ${product.product_name} to cart.`);
    setTimeout(() => setToast(''), 2500);
  };

  const handleUpdateQty = (productId, newQty) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart(prev => prev.map(i => {
      if (i.product_id === productId) {
        return { ...i, quantity: Math.min(newQty, i.stock_quantity) };
      }
      return i;
    }));
  };

  const handleRemoveFromCart = (productId) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderSuccess = () => {
    setCart([]);
    setIsCartOpen(false);
    setToast('🎉 Order placed successfully! Awaiting manager review.');
    setTimeout(() => setToast(''), 4000);
    setTab('orders');
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          📦 IDS <span>Customer Portal</span>
        </div>
        <nav className="sidebar-nav">
          <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>
            🛍 Browse Products
          </button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            🧾 My Orders
          </button>
        </nav>
        <div style={{ padding: '0 12px' }}>
          <p style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>
            Signed in as<br /><strong style={{ color: '#fff' }}>{user?.full_name}</strong>
          </p>
          <button className="sidebar-logout" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{tab === 'browse' ? '🛍 Browse Products' : '🧾 My Orders'}</h1>
            <p>{tab === 'browse' ? 'Select items and place your multi-item order.' : 'Track all your orders and delivery statuses in real-time.'}</p>
          </div>
          {tab === 'browse' && cart.length > 0 && (
            <button className="btn btn-primary" onClick={() => setIsCartOpen(true)}>
              🛒 Checkout Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
            </button>
          )}
        </div>

        {toast && <div className="alert alert-success">{toast}</div>}

        {tab === 'browse' ? (
          <BrowseTab
            cart={cart}
            onAddToCart={handleAddToCart}
            onOpenCart={() => setIsCartOpen(true)}
          />
        ) : (
          <MyOrdersTab />
        )}

        {isCartOpen && (
          <CartCheckoutModal
            cart={cart}
            onUpdateQty={handleUpdateQty}
            onRemove={handleRemoveFromCart}
            onClear={handleClearCart}
            onClose={() => setIsCartOpen(false)}
            onSuccess={handleOrderSuccess}
          />
        )}
      </main>
    </div>
  );
}
