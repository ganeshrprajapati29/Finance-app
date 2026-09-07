import React from 'react';
import { BadgeCheck, CheckCircle2, Headphones, Receipt, ShieldCheck, Smartphone, Tv } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function Pricing() {
  return (
    <PublicInfoPage
      eyebrow="Service Plans"
      icon={BadgeCheck}
      title="Choose services from your"
      accent="customer account"
      copy="Khatu Pay keeps pricing communication simple. Customers can login, choose mobile or DTH recharge, review the amount, complete checkout and track the request."
      primaryAction={{ to: '/user/login', label: 'Login' }}
      secondaryAction={{ to: '/features', label: 'View services' }}
      checklist={['Review amount before checkout', 'Payment verified by backend', 'Status shown in service history']}
      cards={[
        { icon: Smartphone, title: 'Mobile Recharge', text: 'Enter mobile number, operator details and amount before checkout.', color: '#0f766e' },
        { icon: Tv, title: 'DTH Recharge', text: 'Recharge DTH customer IDs with secure payment confirmation.', color: '#2563eb' },
        { icon: Receipt, title: 'Recharge Receipt', text: 'Receipt and reference details are available after successful checkout.', color: '#f59e0b' },
        { icon: Headphones, title: 'Support', text: 'Support channels are available for receipts and service status.', color: '#7c3aed' },
        { icon: ShieldCheck, title: 'Secure Flow', text: 'Service requests are submitted after successful payment verification.', color: '#0ea5e9' },
        { icon: CheckCircle2, title: 'History', text: 'Recent recharge and bill records are visible after login.', color: '#dc2626' },
      ]}
    />
  );
}
