import React from 'react';
import { BadgeCheck, Banknote, Clock, FileText, ShieldCheck, UserCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function InstantLoans() {
  return (
    <PublicInfoPage
      eyebrow="Partner Service"
      icon={Banknote}
      title="Loan application assistance through"
      accent="third-party partners"
      copy="Khatu Pay may help customers submit basic loan enquiries and application details to eligible third-party lending partners. Final eligibility, approval, pricing, documentation and disbursal are handled by the respective partner as per their policies."
      primaryAction={{ to: '/user/login', label: 'Customer login' }}
      secondaryAction={{ to: '/contact', label: 'Contact team' }}
      checklist={[
        'Simple enquiry flow',
        'Basic profile review',
        'Partner lender processing',
        'Application status support',
      ]}
      cards={[
        {
          icon: UserCheck,
          title: 'Customer Details',
          text: 'Customers can provide basic contact and profile information from their account.',
          color: '#0f766e',
        },
        {
          icon: FileText,
          title: 'Document Support',
          text: 'Required documents may be collected based on the partner lender workflow.',
          color: '#2563eb',
        },
        {
          icon: ShieldCheck,
          title: 'Secure Handling',
          text: 'Application details are handled through authenticated customer and admin panels.',
          color: '#7c3aed',
        },
        {
          icon: Clock,
          title: 'Status Updates',
          text: 'Application status can be tracked after submission where partner workflow is enabled.',
          color: '#f59e0b',
        },
        {
          icon: BadgeCheck,
          title: 'Partner Decision',
          text: 'Loan approval and disbursal decisions remain with the third-party lending partner.',
          color: '#16a34a',
        },
      ]}
    />
  );
}
