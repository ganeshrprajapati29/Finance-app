import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

import { billCategories, platformHighlights, publicImageForTitle, serviceCatalog } from '../data/publicContent.js';
import { getPublicOverview } from '../services/publicService.js';
import homeServicesBanner from '../assets/home-services-banner.png';
import khatuLogo from '../assets/khatulogo-removebg-preview.png';
import merchantQrArt from '../assets/illustrations/merchant-qr.svg';
import '../styles/publicSite.css';

export default function Home() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    getPublicOverview().then(setOverview);
  }, []);

  const liveHighlights = overview?.highlights?.length ? overview.highlights : platformHighlights;

  return (
    <div
      className="public-page home-page"
      style={{ '--home-bg-image': `url(${homeServicesBanner})` }}
    >
      {/* The first screen has to answer "what is this?" immediately, so it
          leads with the Khatu Pay mark and product name before the pitch. */}
      <section className="public-hero home-hero-section">
        <div className="home-hero-content">
          <div className="home-brand-lockup">
            <img src={khatuLogo} alt="" aria-hidden="true" />
            <div>
              <strong>Khatu Pay</strong>
              <span>
                <ShieldCheck size={13} /> Secure payments, recharges &amp; credit
              </span>
            </div>
          </div>
          <h1 className="public-title">
            Recharge, bills and instant credit <span>in one app</span>
          </h1>
          <p className="public-copy">
            Accept UPI QR payments, pay any BBPS bill, recharge mobile and DTH,
            and apply for a paperless personal loan - all from one Khatu Pay
            account.
          </p>
          <div className="public-actions">
            <Link className="public-btn primary" to="/features">
              View services <ArrowRight size={18} />
            </Link>
            <Link className="public-btn" to="/user/login">
              Customer login
            </Link>
          </div>
          <div className="home-hero-points">
            <span>UPI QR Payments</span>
            <span>Recharge &amp; Bills</span>
            <span>Instant Loans</span>
          </div>
        </div>
        <div className="home-hero-visual">
          <img
            className="home-hero-illustration"
            src={merchantQrArt}
            alt="A shopkeeper accepting a UPI QR payment from a customer's phone"
            loading="eager"
            width="640"
            height="400"
          />
        </div>
      </section>

      <section className="public-section home-surface-section">
        <div className="public-section-head">
          <div>
            <h2>Explore Khatu Pay</h2>
            <p className="public-copy">Recharge, receipts, status updates and support workflows in a clean customer experience.</p>
          </div>
          <Link className="public-btn" to="/help-center">Need help?</Link>
        </div>
        <div className="public-grid">
          {serviceCatalog.map((service) => {
            const Icon = service.icon;
            return (
              <Link
                key={service.slug}
                to={`/services/${service.slug}`}
                className="public-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
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
                  <Icon size={23} />
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                  <h3>{service.title}</h3>
                  <span className="public-chip">{service.status}</span>
                </div>
                <p>{service.short}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="public-section home-surface-section coverage-surface">
        <div className="public-section-head">
          <div>
            <h2>Coverage At A Glance</h2>
            <p className="public-copy">Clear availability for recharge, support and upcoming workflows.</p>
          </div>
        </div>
        <div className="coverage-grid">
          {billCategories.map((item) => {
            const Icon = item.icon;
            return (
              <div className="coverage-card" key={item.label}>
                <div className="coverage-image">
                  <img
                    src={item.image || publicImageForTitle(item.label)}
                    alt={`${item.label} visual`}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.parentElement.style.display = 'none';
                    }}
                  />
                </div>
                <div className="coverage-body">
                  <span>
                    <Icon size={20} />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.label.includes('Utility') || item.label.includes('Business') ? 'Coming soon' : 'Available'}</small>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="public-section home-surface-section status-surface">
        <div className="public-section-head">
          <div>
            <h2>Platform Status</h2>
            <p className="public-copy">Service availability shown from Khatu Pay backend.</p>
          </div>
        </div>
        <div className="public-grid">
          {liveHighlights.map((item) => {
            const Icon = item.icon || CheckCircle2;
            return (
              <div key={item.label} className="public-card" style={{ padding: 15 }}>
                <Icon size={22} color="#0f766e" />
                <h3>{item.value}</h3>
                <p>{item.label}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
