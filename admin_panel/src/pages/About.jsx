import React from 'react';
import { BadgeCheck, Banknote, Clock, QrCode, Receipt, ShieldCheck, Smartphone, Tv, Zap } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function About() {
  return (
    <PublicInfoPage
      eyebrow="About Khatu Pay"
      icon={BadgeCheck}
      title="Simple digital services for"
      accent="recharge and QR support"
      copy="Khatu Pay is built around clear customer journeys: mobile recharge, DTH recharge, QR payment support, partner-led loan assistance, secure checkout, history and support records in one clean experience."
      primaryAction={{ to: '/features', label: 'Explore services' }}
      secondaryAction={{ to: '/contact', label: 'Contact team' }}
      checklist={['Mobile recharge', 'DTH recharge', 'QR payment support', 'Partner-led loan assistance', 'History and support records']}
      cards={[
        { icon: Smartphone, title: 'Mobile Recharge', text: 'A simple flow for number, operator, amount and status tracking.', color: '#0f766e' },
        { icon: Tv, title: 'DTH Recharge', text: 'Customer ID based DTH recharge flow with payment verification.', color: '#2563eb' },
        { icon: QrCode, title: 'QR Payment Support', text: 'QR based payment reference and account support workflows.', color: '#0891b2' },
        { icon: Banknote, title: 'Partner Loan Assistance', text: 'Loan enquiry support through eligible third-party lending partners.', color: '#16a34a' },
        { icon: Receipt, title: 'Receipts', text: 'Recharge receipts and references are available from customer account.', color: '#f59e0b' },
        { icon: ShieldCheck, title: 'Secure Checkout', text: 'Payment verification happens before service submission.', color: '#0ea5e9' },
        { icon: Clock, title: 'Service History', text: 'Customers can view recent service records and status updates.', color: '#7c3aed' },
        { icon: Zap, title: 'Fast Support', text: 'Support information and contact options are easy to find.', color: '#dc2626' },
      ]}
    />
  );
}
