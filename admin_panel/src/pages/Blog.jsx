import React from 'react';
import { BookOpen, Headphones, Receipt, ShieldCheck, Smartphone } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function Blog() {
  return (
    <PublicInfoPage
      eyebrow="Guides"
      icon={BookOpen}
      title="Helpful updates for"
      accent="digital services"
      copy="Short customer-friendly guides about mobile recharge, DTH recharge, support, receipts and account safety on Khatu Pay."
      primaryAction={{ to: '/help-center', label: 'Help center' }}
      secondaryAction={{ to: '/contact', label: 'Contact' }}
      checklist={['Recharge help', 'Receipt guidance', 'Support and safety notes']}
      cards={[
        { icon: Smartphone, title: 'Recharge checklist', text: 'Check number, operator and amount carefully before payment.', color: '#0f766e' },
        { icon: Receipt, title: 'Recharge records', text: 'Keep your receipt and transaction reference for support.', color: '#f59e0b' },
        { icon: Headphones, title: 'Support tips', text: 'Share date, amount and service details for faster support.', color: '#2563eb' },
        { icon: ShieldCheck, title: 'Account safety', text: 'Use your own account and keep login details private.', color: '#7c3aed' },
      ]}
    />
  );
}
