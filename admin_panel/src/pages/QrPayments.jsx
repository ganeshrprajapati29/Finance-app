import React from 'react';
import { BadgeCheck, QrCode, Receipt, ShieldCheck, UserCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function QrPayments() {
  return (
    <PublicInfoPage
      eyebrow="Recharge Support"
      icon={QrCode}
      title="QR payment support and"
      accent="service records"
      copy="Khatu Pay supports QR based payment references for eligible customer and merchant workflows, with receipts and support records handled inside the platform."
      primaryAction={{ to: '/user/login', label: 'Customer login' }}
      secondaryAction={{ to: '/contact', label: 'Contact support' }}
      checklist={['QR code support', 'Payment reference records', 'Receipt records', 'Support-ready service details']}
      cards={[
        { icon: QrCode, title: 'QR display', text: 'Eligible customers can use QR based support workflows where enabled.', color: '#0f766e' },
        { icon: Receipt, title: 'Receipts', text: 'Payment references and receipts help customers track completed requests.', color: '#2563eb' },
        { icon: ShieldCheck, title: 'Verified flow', text: 'Checkout and status handling are managed through backend service workflows.', color: '#f59e0b' },
        { icon: UserCheck, title: 'Customer account', text: 'Login helps customers view profile and service history details.', color: '#7c3aed' },
        { icon: BadgeCheck, title: 'Support', text: 'Support can review references, amount and service status when needed.', color: '#dc2626' },
      ]}
    />
  );
}
