import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole, UserPlus } from 'lucide-react';

import api from '../api/axios.js';
import '../styles/publicSite.css';

const emptyForm = {
  name: '',
  email: '',
  mobile: '',
  password: '',
};

export default function UserAuth({ mode = 'login' }) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (isRegister) {
        await api.post('/auth/register', form);
        setMessage('Account created. Please verify email OTP in the Khatu Pay app before full use.');
      } else {
        const response = await api.post('/auth/login', {
          email: form.email,
          password: form.password,
        });
        localStorage.setItem('kp_user_tokens', JSON.stringify(response.data?.data || {}));
        navigate('/user/portal');
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-page auth-shell">
      <section className="public-hero compact">
        <div>
          <span className="public-eyebrow">
            {isRegister ? <UserPlus size={16} /> : <LockKeyhole size={16} />}
            Customer account
          </span>
          <h1 className="public-title">
            {isRegister ? 'Create your' : 'Login to your'} <span>Khatu Pay account</span>
          </h1>
          <p className="public-copy">
            Customer login connects to the same secure account system used by
            Khatu Pay services. Use it to view profile details and start
            supported mobile or DTH recharge requests.
          </p>
          <div className="public-actions">
            <Link className="public-btn" to="/">Back to website</Link>
            <Link className="public-btn" to={isRegister ? '/user/login' : '/user/register'}>
              {isRegister ? 'Already have account' : 'Create account'}
            </Link>
          </div>
        </div>

        <form className="public-panel public-form" onSubmit={submit}>
          <h2 style={{ margin: 0, fontSize: 24 }}>{isRegister ? 'Register' : 'Login'}</h2>
          {isRegister && (
            <input
              className="public-input"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          )}
          <input
            className="public-input"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {isRegister && (
            <input
              className="public-input"
              placeholder="Mobile number"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            />
          )}
          <input
            className="public-input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button className="public-btn primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Login'}
          </button>
          {message && <div className="public-chip">{message}</div>}
        </form>
      </section>
    </div>
  );
}
