import React from 'react';
import { FileText, KeyRound, LockKeyhole, ShieldCheck, UserCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function Security() {
  return (
    <PublicInfoPage
      eyebrow="Security"
      icon={ShieldCheck}
      title="Designed for safer"
      accent="customer transactions"
      copy="Khatu Pay uses account login, payment verification, backend service submission and callback based status updates to keep recharge and bill workflows clear."
      primaryAction={{ to: '/user/login', label: 'Customer login' }}
      secondaryAction={{ to: '/help-center', label: 'Help center' }}
      checklist={['Account based access', 'Verified checkout', 'Status and receipt records']}
      cards={[
        { icon: LockKeyhole, title: 'Protected Login', text: 'Customer area is available through authenticated access.', color: '#0f766e' },
        { icon: KeyRound, title: 'Payment Verification', text: 'The backend verifies checkout before submitting service details.', color: '#2563eb' },
        { icon: FileText, title: 'Records', text: 'Receipts and service history help with support and status checks.', color: '#f59e0b' },
        { icon: UserCheck, title: 'Support Ready', text: 'Customers can contact support for account or transaction queries.', color: '#7c3aed' },
      ]}
    />
  );
}
