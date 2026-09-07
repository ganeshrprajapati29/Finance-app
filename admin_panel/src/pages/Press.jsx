import React from 'react';
import { Building2, Mail, Megaphone, Newspaper, Phone } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';
import { brand } from '../data/publicContent.js';

export default function Press() {
  return (
    <PublicInfoPage
      eyebrow="Company"
      icon={Newspaper}
      title="Khatu Pay company"
      accent="information"
      copy={`${brand.company} provides digital mobile recharge and DTH recharge workflows through Khatu Pay. For business or media queries, contact our team directly.`}
      primaryAction={{ to: '/contact', label: 'Contact team' }}
      secondaryAction={{ to: '/about', label: 'About us' }}
      checklist={['Company information', 'Service updates', 'Business contact']}
      cards={[
        { icon: Building2, title: brand.company, text: 'Registered company operating Khatu Pay digital service workflows.', color: '#0f766e' },
        { icon: Mail, title: brand.email, text: 'Email contact for company and support communication.', color: '#2563eb' },
        { icon: Phone, title: brand.phone, text: 'Phone contact for service and onboarding queries.', color: '#f59e0b' },
        { icon: Megaphone, title: 'Service updates', text: 'Public pages describe available recharge service areas.', color: '#7c3aed' },
      ]}
    />
  );
}
