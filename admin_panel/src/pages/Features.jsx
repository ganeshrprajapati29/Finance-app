import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Layers3 } from 'lucide-react';

import { billCategories, publicImageForTitle, serviceCatalog } from '../data/publicContent.js';
import '../styles/publicSite.css';

export default function Features() {
  return (
    <div className="public-page">
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">
            <Layers3 size={16} />
            Services
          </span>
          <h1 className="public-title">
            Khatu Pay <span>digital service catalog</span>
          </h1>
          <p className="public-copy">
            Website pages explain active customer flows and planned modules.
            Mobile recharge, DTH recharge, QR payment support, service history
            and partner-led loan assistance are presented through clean,
            backend-connected customer panels where available.
          </p>
          <div className="public-actions">
            <Link className="public-btn primary" to="/user/login">Customer login</Link>
            <Link className="public-btn" to="/contact">Talk to team</Link>
          </div>
        </div>
        <div className="public-panel">
          <h2 style={{ marginTop: 0, fontSize: 24 }}>Service readiness</h2>
          <div className="public-grid" style={{ gridTemplateColumns: '1fr', marginTop: 14 }}>
            {serviceCatalog.slice(0, 5).map((service) => (
              <div key={service.slug} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                <strong>{service.title}</strong>
                <span className="public-chip">{service.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <div>
            <h2>Service Catalog</h2>
            <p className="public-copy">Tap a service to view details, live status and planned availability.</p>
          </div>
        </div>
        <div className="public-grid">
          {serviceCatalog.map((service) => {
            const Icon = service.icon;
            return (
              <Link key={service.slug} to={`/services/${service.slug}`} className="public-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                {service.image && (
                  <div className="public-card-media">
                    <img
                      src={service.image}
                      alt={`${service.title} visual`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.parentElement.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <span className="public-icon" style={{ background: `${service.color}18`, color: service.color }}>
                  <Icon size={24} />
                </span>
                <h3>{service.title}</h3>
                <p>{service.short}</p>
                <ul className="public-list">
                  {service.bullets.slice(0, 3).map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={17} color="#0f766e" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <h2>Service Coverage</h2>
        </div>
        <div className="public-grid">
          {billCategories.map((item) => {
            const Icon = item.icon;
            return (
              <div className="public-card" key={item.label}>
                <div className="public-card-media">
                  <img
                    src={item.image || publicImageForTitle(item.label)}
                    alt={`${item.label} visual`}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.parentElement.style.display = 'none';
                    }}
                  />
                </div>
                <Icon color="#0f766e" />
                <h3>{item.label}</h3>
                <p>Available or planned for eligible customer requests with verified account and support workflows.</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
