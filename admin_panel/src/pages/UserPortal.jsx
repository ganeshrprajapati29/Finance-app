import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  CheckCircle2,
  History,
  LogOut,
  ShieldCheck,
  Smartphone,
  Tv,
} from 'lucide-react';

import api from '../api/axios.js';
import loadRazorpay from '../utils/loadRazorpay.js';
import '../styles/publicSite.css';

function getUserTokens() {
  try {
    return JSON.parse(localStorage.getItem('kp_user_tokens') || '{}');
  } catch {
    return {};
  }
}

const emptyRecharge = {
  type: 'mobile',
  accountRef: '',
  operatorId: '',
  amount: '',
  customerMobile: '',
};

export default function UserPortal() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [recharge, setRecharge] = useState(emptyRecharge);
  const [history, setHistory] = useState([]);
  const token = useMemo(() => getUserTokens().accessToken, []);

  useEffect(() => {
    if (!token) {
      navigate('/user/login');
      return;
    }
    api
      .get('/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        const profile = response.data?.data;
        setUser(profile);
        setRecharge((current) => ({ ...current, customerMobile: profile?.mobile || '' }));
      })
      .catch(() => setError('We could not load your account. Please login again.'));
    loadHistory();
  }, [navigate, token]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadHistory = async () => {
    try {
      const response = await api.get('/clubapi/transactions?limit=8', { headers: authHeaders });
      const rows = response.data?.data?.transactions || response.data?.data || [];
      setHistory(Array.isArray(rows) ? rows : []);
    } catch {
      setHistory([]);
    }
  };

  const logout = () => {
    localStorage.removeItem('kp_user_tokens');
    navigate('/user/login');
  };

  const friendlyError = (error) =>
    error.response?.data?.message ||
    error.message ||
    'Something went wrong. Please check details and try again.';

  const runCheckout = async ({ payload }) => {
    const orderResponse = await api.post('/payments/razorpay/order', payload, { headers: authHeaders });
    const checkout = orderResponse.data?.data;
    const Razorpay = await loadRazorpay();
    const order = checkout?.order;
    if (!Razorpay || !order?.id || !checkout?.key_id) {
      throw new Error('Payment gateway could not be opened. Please try again.');
    }

    return new Promise((resolve, reject) => {
      const instance = new Razorpay({
        key: checkout.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Khatu Pay',
        description: 'Secure service payment',
        order_id: order.id,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.mobile || recharge.customerMobile || '',
        },
        theme: { color: '#0f766e' },
        handler: async (response) => {
          try {
            const verifyResponse = await api.post('/payments/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }, { headers: authHeaders });
            resolve({ checkout, verify: verifyResponse.data?.data });
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled. No amount was charged.')),
        },
      });
      instance.on('payment.failed', (response) => {
        reject(new Error(response?.error?.description || 'Payment failed. Please try again.'));
      });
      instance.open();
    });
  };

  const submitRecharge = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoadingAction('recharge');
    try {
      const amount = Number(recharge.amount);
      if (!recharge.accountRef || !recharge.operatorId || !amount) {
        throw new Error('Please enter number/customer ID, operator ID and amount.');
      }
      await runCheckout({
        payload: {
          amount,
          notes: { purpose: 'service_payment' },
          recharge: {
            type: recharge.type,
            operatorId: recharge.operatorId,
            accountRef: recharge.accountRef,
            customerMobile: recharge.customerMobile || user?.mobile || '',
          },
        },
      });
      setMessage('Payment received. Service request is processing now.');
      await loadHistory();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="public-page portal-shell">
      <section className="public-hero compact">
        <div>
          <span className="public-eyebrow">
            <ShieldCheck size={16} />
            Customer portal
          </span>
          <h1 className="public-title">
            Recharge and <span>account details</span>
          </h1>
          <p className="public-copy">
            Login-based service area for mobile recharge, DTH recharge,
            profile status and recent recharge history.
          </p>
          <div className="public-actions">
            <button className="public-btn" type="button" onClick={logout}>
              <LogOut size={18} /> Logout
            </button>
            <Link className="public-btn primary" to="/help-center">Help center</Link>
          </div>
        </div>
        <div className="public-panel">
          {!user && !error && <div className="public-chip">Loading account...</div>}
          {error && <div className="public-chip error">{error}</div>}
          {message && <div className="public-chip success">{message}</div>}
          {user && (
            <>
              <h2 style={{ marginTop: 0 }}>{user.name}</h2>
              <p className="public-copy">{user.email} | {user.mobile}</p>
              <div className="public-grid" style={{ marginTop: 18, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div className="public-card">
                  <BadgeCheck color="#0f766e" />
                  <h3>{user.emailVerified ? 'Verified' : 'Pending'}</h3>
                  <p>Email status</p>
                </div>
                <div className="public-card">
                  <ShieldCheck color="#0f766e" />
                  <h3>{user.kyc?.status || 'PENDING'}</h3>
                  <p>Profile status</p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <div>
            <h2>Start a service</h2>
            <p className="public-copy">Enter details, complete secure checkout and track status from history.</p>
          </div>
        </div>
        <div className="public-grid" style={{ gridTemplateColumns: 'minmax(280px, 560px)' }}>
          <form className="public-panel public-form" onSubmit={submitRecharge}>
            <h2 style={{ margin: 0, fontSize: 22 }}>
              {recharge.type === 'mobile' ? <Smartphone size={22} /> : <Tv size={22} />} Recharge
            </h2>
            <select
              className="public-select"
              value={recharge.type}
              onChange={(e) => setRecharge({ ...recharge, type: e.target.value })}
            >
              <option value="mobile">Mobile Recharge</option>
              <option value="dth">DTH Recharge</option>
            </select>
            <input
              className="public-input"
              placeholder={recharge.type === 'mobile' ? 'Mobile number' : 'Customer ID'}
              value={recharge.accountRef}
              onChange={(e) => setRecharge({ ...recharge, accountRef: e.target.value.replace(/\D/g, '').slice(0, 15) })}
            />
            <input
              className="public-input"
              placeholder="Operator ID"
              value={recharge.operatorId}
              onChange={(e) => setRecharge({ ...recharge, operatorId: e.target.value.trim() })}
            />
            <input
              className="public-input"
              type="number"
              min="1"
              placeholder="Amount"
              value={recharge.amount}
              onChange={(e) => setRecharge({ ...recharge, amount: e.target.value })}
            />
            <input
              className="public-input"
              placeholder="Customer mobile"
              value={recharge.customerMobile}
              onChange={(e) => setRecharge({ ...recharge, customerMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            />
            <button className="public-btn primary" type="submit" disabled={loadingAction === 'recharge'}>
              {loadingAction === 'recharge' ? 'Opening gateway...' : 'Pay Now'}
            </button>
          </form>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <div>
            <h2>Recent service history</h2>
            <p className="public-copy">Latest recharge status from your account.</p>
          </div>
          <button className="public-btn" type="button" onClick={loadHistory}>
            <History size={18} /> Refresh
          </button>
        </div>
        <div className="public-grid">
          {history.length === 0 ? (
            <div className="public-card">
              <CheckCircle2 color="#0f766e" />
              <h3>No recent records</h3>
              <p>Your completed service requests will appear here.</p>
            </div>
          ) : (
            history.map((item) => (
              <div className="public-card" key={item._id || item.urid}>
                <span className="public-chip">{item.status || 'processing'}</span>
                <h3>{item.type || 'Service request'}</h3>
                <p>{item.accountRef || item.provider || item.urid}</p>
                <strong>Rs. {Number(item.amount || 0).toFixed(0)}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
