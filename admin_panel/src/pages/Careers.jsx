import React from 'react';
import { Briefcase, Headphones, Mail, Settings, Users } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function Careers() {
  return (
    <PublicInfoPage
      eyebrow="Careers"
      icon={Briefcase}
      title="Work with"
      accent="Khatu Pay"
      copy="Khatu Pay is building practical digital service workflows for mobile recharge, DTH recharge, customer support and secure checkout. Openings are shared through official company communication."
      primaryAction={{ to: '/contact', label: 'Contact team' }}
      secondaryAction={{ to: '/about', label: 'About Khatu Pay' }}
      checklist={['Product and support focus', 'Digital service workflows', 'Customer-first operations']}
      cards={[
        { icon: Users, title: 'Customer Experience', text: 'Improve how users recharge and track service status.', color: '#0f766e' },
        { icon: Settings, title: 'Operations', text: 'Support reliable internal processes and service coordination.', color: '#2563eb' },
        { icon: Headphones, title: 'Support', text: 'Help customers with receipts, status checks and account queries.', color: '#f59e0b' },
        { icon: Mail, title: 'Apply or enquire', text: 'Use the contact page for company communication.', color: '#7c3aed' },
      ]}
    />
  );
}
