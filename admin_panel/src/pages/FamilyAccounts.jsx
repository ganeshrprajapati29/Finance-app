import React from 'react';
import { History, ShieldCheck, Users } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function FamilyAccounts() {
  return (
    <PublicInfoPage
      eyebrow="Customer Accounts"
      icon={Users}
      title="Manage customer"
      accent="service records"
      copy="Khatu Pay customer account areas help users keep recharge, profile and support information in one place."
      primaryAction={{ to: '/user/login', label: 'Customer login' }}
      secondaryAction={{ to: '/help-center', label: 'Help center' }}
      checklist={['Profile details', 'Service history', 'Support records']}
      cards={[
        { icon: Users, title: 'Account access', text: 'Customers can login to view available profile and service options.', color: '#0f766e' },
        { icon: History, title: 'History', text: 'Recent recharge requests appear in service history.', color: '#2563eb' },
        { icon: ShieldCheck, title: 'Support', text: 'Account and transaction details help support review customer queries.', color: '#f59e0b' },
      ]}
    />
  );
}
