import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Clock3, HelpCircle, RotateCcw, XCircle } from 'lucide-react';

import '../styles/publicSite.css';

const configs = {
  success: {
    icon: CheckCircle2,
    title: 'Payment received',
    text: 'Your payment has been received. Service status will update after gateway confirmation.',
    tone: '#0f766e',
  },
  failed: {
    icon: XCircle,
    title: 'Payment not completed',
    text: 'The transaction was not completed. If any amount was debited, it will be reviewed as per gateway status.',
    tone: '#dc2626',
  },
  pending: {
    icon: Clock3,
    title: 'Payment pending',
    text: 'Your payment is still processing. Please check the latest status from your service history.',
    tone: '#d97706',
  },
  timeout: {
    icon: Clock3,
    title: 'Payment timed out',
    text: 'The payment session timed out. Please check history before trying again.',
    tone: '#d97706',
  },
  refund: {
    icon: RotateCcw,
    title: 'Refund update',
    text: 'Your refund update has been recorded. Please check your account history for details.',
    tone: '#0f766e',
  },
};

function statusFromPath(pathname) {
  if (pathname.includes('failed')) return 'failed';
  if (pathname.includes('pending')) return 'pending';
  if (pathname.includes('timeout')) return 'timeout';
  if (pathname.includes('refund')) return 'refund';
  return 'success';
}

export default function PaymentReturn() {
  const location = useLocation();
  const config = configs[statusFromPath(location.pathname)] || configs.success;
  const Icon = config.icon || HelpCircle;

  return (
    <div className="public-page portal-shell">
      <section className="public-section" style={{ minHeight: '68vh', display: 'grid', placeItems: 'center' }}>
        <div className="public-panel" style={{ maxWidth: 560, textAlign: 'center' }}>
          <Icon size={56} color={config.tone} style={{ marginBottom: 16 }} />
          <h1 className="public-title" style={{ fontSize: 34, marginBottom: 10 }}>{config.title}</h1>
          <p className="public-copy" style={{ margin: '0 auto 22px' }}>{config.text}</p>
          <div className="public-actions" style={{ justifyContent: 'center' }}>
            <Link className="public-btn primary" to="/user/portal">View history</Link>
            <Link className="public-btn" to="/help-center">Need help</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
