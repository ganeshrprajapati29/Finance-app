import React, { useState } from 'react';
import { Mail, MapPin, Phone, Send } from 'lucide-react';

import { brand } from '../data/publicContent.js';
import { submitPublicContact } from '../services/publicService.js';
import '../styles/publicSite.css';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      const response = await submitPublicContact(form);
      setStatus(`Message received. Reference: ${response?.data?.reference || 'Khatu Pay Support'}`);
      setForm({ name: '', email: '', message: '' });
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-page">
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">
            <Send size={16} />
            Contact Khatu Pay
          </span>
          <h1 className="public-title">
            Talk to us about <span>support, onboarding and services</span>
          </h1>
          <p className="public-copy">
            Use this page for business, customer support and payment related
            communication. Logged-in users can also raise tickets from the app.
          </p>
          <div className="public-grid" style={{ marginTop: 22 }}>
            <a className="public-card" href={`tel:${brand.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Phone color="#0f766e" />
              <h3>{brand.phone}</h3>
              <p>Support and onboarding assistance.</p>
            </a>
            <a className="public-card" href={`mailto:${brand.email}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Mail color="#0f766e" />
              <h3>{brand.email}</h3>
              <p>Write to the Khatu Pay team.</p>
            </a>
            <div className="public-card">
              <MapPin color="#0f766e" />
              <h3>India</h3>
              <p>Digital-first recharge and payment services.</p>
            </div>
          </div>
        </div>

        <form className="public-panel public-form" onSubmit={submit}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Send a message</h2>
          <input
            className="public-input"
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="public-input"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <textarea
            className="public-textarea"
            placeholder="How can we help?"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <button className="public-btn primary" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Submit'}
          </button>
          {status && <div className="public-chip">{status}</div>}
        </form>
      </section>
    </div>
  );
}
