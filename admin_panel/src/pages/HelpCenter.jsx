import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, LifeBuoy, Mail, Phone } from 'lucide-react';

import { brand, faqs } from '../data/publicContent.js';
import '../styles/publicSite.css';

export default function HelpCenter() {
  return (
    <div className="public-page">
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">
            <LifeBuoy size={16} />
            Support center
          </span>
          <h1 className="public-title">
            Help for <span>recharge, bills and account issues</span>
          </h1>
          <p className="public-copy">
            Customers can check app history, raise support tickets after login,
            or contact Khatu Pay support for payment and service queries.
          </p>
          <div className="public-actions">
            <Link className="public-btn primary" to="/user/login">Login to account</Link>
            <Link className="public-btn" to="/contact">Contact support</Link>
          </div>
        </div>
        <div className="public-panel">
          <h2 style={{ fontSize: 24 }}>Support channels</h2>
          <div className="public-grid" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
            <a className="public-card" href={`tel:${brand.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Phone color="#0f766e" />
              <h3>{brand.phone}</h3>
              <p>Phone support for urgent service queries.</p>
            </a>
            <a className="public-card" href={`mailto:${brand.email}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Mail color="#0f766e" />
              <h3>{brand.email}</h3>
              <p>Email support for receipts, refunds and account help.</p>
            </a>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className="public-grid">
          {faqs.map((faq) => (
            <div className="public-card" key={faq.question}>
              <HelpCircle color="#0f766e" />
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
