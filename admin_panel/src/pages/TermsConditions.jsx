import React from 'react';
import { CheckCircle2, FileText, Scale, ShieldCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function TermsConditions() {
  return (
    <PublicInfoPage
      eyebrow="Terms"
      icon={Scale}
      title="Terms and"
      accent="conditions"
      copy="These terms describe how customers should use Khatu Pay recharge, account and support services."
      primaryAction={{ to: '/user/login', label: 'Customer login' }}
      secondaryAction={{ to: '/contact', label: 'Contact' }}
      checklist={['Enter correct details', 'Review before checkout', 'Track status after payment']}
      cards={[
        { icon: FileText, title: 'Service use', text: 'Users should use Khatu Pay only for supported mobile and DTH recharge workflows.', color: '#0f766e' },
        { icon: CheckCircle2, title: 'Correct details', text: 'Users are responsible for entering correct mobile number, DTH customer ID and amount details.', color: '#2563eb' },
        { icon: ShieldCheck, title: 'Payment status', text: 'Recharge submission depends on successful payment verification.', color: '#f59e0b' },
      ]}
      sections={[
        { title: 'Acceptance', text: 'By using Khatu Pay, users agree to these terms for recharge and account services.' },
        { title: 'Services', text: 'Khatu Pay provides digital workflows for mobile recharge, DTH recharge and customer support.' },
        { title: 'User Responsibility', text: 'Users must review details and amount before confirming checkout.' },
        { title: 'Failed Requests', text: 'Failed or pending service requests are handled according to payment status, provider response and support review.' },
        { title: 'Updates', text: 'Terms may be updated periodically to reflect service or operational changes.' },
      ]}
    />
  );
}
