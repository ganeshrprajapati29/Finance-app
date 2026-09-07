import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { publicImageForTitle } from '../data/publicContent.js';
import '../styles/publicSite.css';

export default function PublicInfoPage({
  eyebrow,
  icon: EyebrowIcon,
  title,
  accent,
  copy,
  primaryAction,
  secondaryAction,
  cards = [],
  sections = [],
  checklist = [],
}) {
  return (
    <div className="public-page">
      <section className="public-hero compact">
        <div>
          <span className="public-eyebrow">
            {EyebrowIcon && <EyebrowIcon size={16} />}
            {eyebrow}
          </span>
          <h1 className="public-title">
            {title} {accent && <span>{accent}</span>}
          </h1>
          <p className="public-copy">{copy}</p>
          {(primaryAction || secondaryAction) && (
            <div className="public-actions">
              {primaryAction && (
                <Link className="public-btn primary" to={primaryAction.to}>
                  {primaryAction.label} <ArrowRight size={18} />
                </Link>
              )}
              {secondaryAction && (
                <Link className="public-btn" to={secondaryAction.to}>
                  {secondaryAction.label}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="public-panel info-panel">
          <div className="info-panel-head">
            <strong>Khatu Pay</strong>
            <span className="public-chip success">Online</span>
          </div>
          <div className="info-checklist">
            {(checklist.length ? checklist : ['Secure checkout', 'Service tracking', 'Support records']).map((item) => (
              <div key={item}>
                <CheckCircle2 size={18} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {cards.length > 0 && (
        <section className="public-section">
          <div className="public-grid">
            {cards.map((card) => {
              const Icon = card.icon || CheckCircle2;
              return (
                <div className="public-card" key={card.title}>
                  {(card.image || card.title) && (
                    <div className="public-card-media">
                      <img
                        src={card.image || publicImageForTitle(card.title)}
                        alt={`${card.title} visual`}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.parentElement.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <span className="public-icon" style={{ background: `${card.color || '#0f766e'}18`, color: card.color || '#0f766e' }}>
                    <Icon size={22} />
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sections.length > 0 && (
        <section className="public-section">
          <div className="policy-stack">
            {sections.map((section) => (
              <article className="policy-item" key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
