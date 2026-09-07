import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import { getServiceDetail, serviceCatalog } from '../data/publicContent.js';
import '../styles/publicSite.css';

export default function DynamicPage() {
  const { slug } = useParams();
  const service = serviceCatalog.find((item) => item.slug === slug) || serviceCatalog[0];
  const detail = getServiceDetail(service);
  const Icon = service.icon;

  return (
    <div className="public-page">
      <section className="public-hero">
        <div>
          <span className="public-eyebrow">{service.status}</span>
          <h1 className="public-title">
            {service.title} on <span>Khatu Pay</span>
          </h1>
          <p className="public-copy">{detail.overview}</p>
          <div className="public-actions">
            <Link className="public-btn primary" to="/user/login">Open customer account</Link>
            <Link className="public-btn" to="/contact">Contact team</Link>
          </div>
        </div>
        <div className="public-panel">
          {service.image && (
            <div className="public-detail-media">
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
          <span className="public-icon" style={{ width: 64, height: 64, background: `${service.color}18`, color: service.color }}>
            <Icon size={32} />
          </span>
          <h2 style={{ marginTop: 16 }}>{service.title}</h2>
          <p className="public-copy">{service.short}</p>
          <ul className="public-list">
            {service.bullets.map((item) => (
              <li key={item}>
                <CheckCircle2 size={18} color="#0f766e" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="public-section">
        <div className="public-section-head">
          <div>
            <h2>How It Works</h2>
            <p className="public-copy">A clear customer journey from selection to status update.</p>
          </div>
        </div>
        <div className="service-step-grid">
          {detail.steps.map((step, index) => (
            <article className="service-step-card" key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section">
        <div className="public-grid">
          {detail.info.map((item) => (
            <article className="public-card service-detail-card" key={item.title}>
              <CheckCircle2 size={22} color="#0f766e" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section">
        <div className="policy-stack">
          {detail.faq.map((item) => (
            <article className="policy-item service-faq-item" key={item.question}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
