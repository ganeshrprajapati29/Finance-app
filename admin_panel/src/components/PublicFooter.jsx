import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';

import footerBg from './../assets/footer-bg.png';
import khatuLogo from './../assets/khatulogo-removebg-preview.png';
import { billCategories, brand, platformHighlights, serviceCatalog } from '../data/publicContent.js';

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Services' },
  { to: '/help-center', label: 'Help Center' },
  { to: '/contact', label: 'Contact' },
];

const legalLinks = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-conditions', label: 'Terms & Conditions' },
  { to: '/refund-policy', label: 'Refund Policy' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
  { to: '/disclaimer', label: 'Disclaimer' },
];

const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.finance.khatupay';

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();
  const visibleServices = useMemo(() => serviceCatalog.slice(0, 6), []);
  const visibleRechargeItems = useMemo(() => billCategories.slice(0, 8), []);

  return (
    <footer className="public-footer" style={{ '--footer-bg-image': `url(${footerBg})` }}>
      <div className="footer-shell">
        <section className="footer-brand-panel">
          <Link to="/" className="footer-brand" aria-label={`${brand.name} home`}>
            <img src={khatuLogo} alt={brand.name} />
            <span>
              <strong>{brand.name}</strong>
              <small>Customer service platform</small>
            </span>
          </Link>

          <p>
            Recharge, status tracking, receipts and customer support in one
            responsive Khatu Pay experience.
          </p>

          <div className="footer-contact-list">
            <a href={`tel:${brand.phone.replace(/\s/g, '')}`}>
              <Phone size={16} />
              {brand.phone}
            </a>
            <a href={`mailto:${brand.email}`}>
              <Mail size={16} />
              {brand.email}
            </a>
            <span>
              <MapPin size={16} />
              India
            </span>
            <a
              className="footer-play-link"
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download Khatu Pay app from Google Play"
            >
              <span className="google-play-mark" aria-hidden="true">
                <i className="gp-triangle gp-green" />
                <i className="gp-triangle gp-blue" />
                <i className="gp-triangle gp-yellow" />
                <i className="gp-triangle gp-red" />
              </span>
              <span>
                <small>Get it on</small>
                Google Play
              </span>
            </a>
          </div>
        </section>

        <section className="footer-links-panel">
          <div className="footer-column">
            <h3>Quick Links</h3>
            <nav>
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="footer-column footer-services">
            <h3>Services</h3>
            <nav>
              {visibleServices.map((service) => {
                const Icon = service.icon;
                return (
                  <Link key={service.slug} to={`/services/${service.slug}`}>
                    <span style={{ color: service.color }}>
                      <Icon size={16} />
                    </span>
                    {service.title}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="footer-column">
            <h3>Service Support</h3>
            <div className="footer-chip-grid">
              {visibleRechargeItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to="/user/login" className="footer-chip">
                    <Icon size={14} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="footer-status-row">
          {platformHighlights.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="footer-status-card">
                <Icon size={18} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            );
          })}
        </section>
      </div>

      <div className="footer-bottom-band">
        <div className="footer-bottom-inner">
          <p>
            © {currentYear} {brand.company}. All rights reserved.
          </p>
          <div className="footer-legal-links">
            {legalLinks.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="footer-trust">
            <ShieldCheck size={16} />
            Secure customer checkout
          </div>
        </div>
      </div>

      <style>{`
        .public-footer {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(236, 253, 247, 0.9)),
            var(--footer-bg-image) center / cover no-repeat,
            #ffffff;
          border-top: 1px solid rgba(15, 118, 110, 0.14);
          font-family: 'Segoe UI', system-ui, sans-serif;
          color: #0f172a;
        }

        .footer-shell {
          max-width: 1220px;
          margin: 0 auto;
          padding: 58px 22px 34px;
          display: grid;
          gap: 30px;
        }

        .footer-brand-panel {
          display: grid;
          grid-template-columns: minmax(240px, 0.9fr) minmax(280px, 1.1fr);
          align-items: center;
          gap: 24px;
          padding: 0 0 26px;
          border-bottom: 1px solid rgba(15, 118, 110, 0.14);
        }

        .footer-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #0f172a;
          text-decoration: none;
        }

        .footer-brand img {
          width: 74px;
          height: 74px;
          object-fit: contain;
        }

        .footer-brand span {
          display: grid;
          gap: 4px;
        }

        .footer-brand strong {
          font-size: 22px;
          font-weight: 900;
        }

        .footer-brand small {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .footer-brand-panel p {
          margin: 0;
          color: #475569;
          line-height: 1.7;
          font-size: 14px;
        }

        .footer-contact-list {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .footer-contact-list a,
        .footer-contact-list span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 38px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          color: #0f766e;
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          border: 1px solid rgba(15, 118, 110, 0.14);
          backdrop-filter: blur(12px);
        }

        .footer-contact-list .footer-play-link {
          min-height: 46px;
          padding: 8px 15px;
          border-radius: 14px;
          background: #0f172a;
          color: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
        }

        .google-play-mark {
          position: relative;
          width: 23px;
          height: 25px;
          display: inline-block;
          flex: 0 0 auto;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0;
          overflow: hidden;
        }

        .gp-triangle {
          position: absolute;
          inset: 0;
          display: block;
          clip-path: polygon(0 0, 100% 50%, 0 100%);
        }

        .gp-green {
          background: #00d084;
          clip-path: polygon(0 0, 47% 50%, 0 100%);
        }

        .gp-blue {
          background: #3ddcff;
          clip-path: polygon(0 0, 100% 50%, 47% 50%);
        }

        .gp-yellow {
          background: #ffd95a;
          clip-path: polygon(47% 50%, 100% 50%, 0 100%);
        }

        .gp-red {
          background: #ff5a5f;
          clip-path: polygon(75% 36%, 100% 50%, 75% 64%, 47% 50%);
        }

        .footer-play-link > span {
          display: grid;
          gap: 1px;
          min-height: 0;
          padding: 0;
          background: transparent;
          color: #ffffff;
          border: 0;
          border-radius: 0;
          font-size: 14px;
          line-height: 1.1;
        }

        .footer-play-link small {
          color: #cbd5e1;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .footer-links-panel {
          display: grid;
          grid-template-columns: 0.8fr 1fr 1.25fr;
          gap: 18px;
        }

        .footer-column {
          min-width: 0;
          padding: 6px 0;
        }

        .footer-column h3 {
          margin: 0 0 14px;
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
        }

        .footer-column nav {
          display: grid;
          gap: 10px;
        }

        .footer-column a {
          color: #475569;
          text-decoration: none;
          font-size: 14px;
          font-weight: 750;
        }

        .footer-column a:hover {
          color: #0f766e;
        }

        .footer-services a {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .footer-services span {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(15, 118, 110, 0.12);
          flex: 0 0 auto;
        }

        .footer-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .footer-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 34px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(15, 118, 110, 0.12);
          color: #0f766e;
        }

        .footer-status-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .footer-status-card {
          min-height: 76px;
          display: grid;
          gap: 4px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(15, 118, 110, 0.12);
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(12px);
        }

        .footer-status-card svg {
          color: #0f766e;
        }

        .footer-status-card span {
          color: #64748b;
          font-size: 12px;
          font-weight: 850;
        }

        .footer-status-card strong {
          font-size: 14px;
          font-weight: 950;
          color: #0f172a;
        }

        .footer-bottom-band {
          border-top: 1px solid rgba(15, 118, 110, 0.12);
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(12px);
        }

        .footer-bottom-inner {
          max-width: 1220px;
          margin: 0 auto;
          padding: 18px 22px;
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 16px;
        }

        .footer-bottom-inner p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .footer-legal-links {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .footer-legal-links a,
        .footer-trust {
          color: #64748b;
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
        }

        .footer-trust {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #0f766e;
          white-space: nowrap;
        }

        @media (max-width: 960px) {
          .footer-brand-panel,
          .footer-links-panel,
          .footer-status-row,
          .footer-bottom-inner {
            grid-template-columns: 1fr 1fr;
          }

          .footer-bottom-inner p {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 620px) {
          .footer-shell {
            padding: 38px 14px 24px;
          }

          .footer-brand-panel,
          .footer-links-panel,
          .footer-status-row,
          .footer-bottom-inner {
            grid-template-columns: 1fr;
          }

          .footer-brand-panel,
            .footer-column {
            padding: 16px;
            border-radius: 14px;
          }

          .footer-brand img {
            width: 60px;
            height: 60px;
          }

          .footer-brand strong {
            font-size: 18px;
          }

          .footer-contact-list {
            align-items: stretch;
          }

          .footer-contact-list a,
          .footer-contact-list span {
            width: 100%;
          }

          .footer-bottom-inner {
            text-align: center;
          }

          .footer-legal-links,
          .footer-trust {
            justify-content: center;
          }
        }
      `}</style>
    </footer>
  );
}
