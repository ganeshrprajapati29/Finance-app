import React from 'react';
import { Link } from 'react-router-dom';
import { Banknote, LockKeyhole, QrCode, Receipt, ShieldCheck, UserCheck } from 'lucide-react';

import '../styles/publicSite.css';

export default function DigitalPayments() {
  const items = [
    { title: 'Secure checkout', text: 'Recharge requests are submitted after payment status verification.', icon: LockKeyhole },
    { title: 'QR payment support', text: 'QR based payment references can be used for eligible customer workflows.', icon: QrCode },
    { title: 'Partner loan assistance', text: 'Loan enquiries may be supported through third-party lending partners.', icon: Banknote },
    { title: 'Receipts', text: 'Receipts and service history are available for customer records.', icon: Receipt },
    { title: 'Security', text: 'Account login, server-side verification and status updates support safer workflows.', icon: ShieldCheck },
    { title: 'Account view', text: 'Customers can login to view profile and service status from backend data.', icon: UserCheck },
  ];

  return (
    <div className="public-page">
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">Secure Checkout</span>
          <h1 className="public-title">
            Checkout flows built for <span>verified recharge</span>
          </h1>
          <p className="public-copy">
            Khatu Pay uses backend verified checkout flows for mobile recharge,
            DTH recharge, QR support and eligible partner service workflows.
            Each paid service request is submitted only after successful
            payment status confirmation.
          </p>
          <div className="public-actions">
            <Link className="public-btn primary" to="/features">View services</Link>
            <Link className="public-btn" to="/user/login">Customer login</Link>
          </div>
        </div>
        <div className="public-panel">
          <div className="public-grid" style={{ gridTemplateColumns: '1fr' }}>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div className="public-card" key={item.title}>
                  <Icon color="#0f766e" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
