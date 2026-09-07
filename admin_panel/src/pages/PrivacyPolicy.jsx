import React from 'react';
import { Mail, ShieldCheck, UserCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';
import { brand } from '../data/publicContent.js';

export default function PrivacyPolicy() {
  return (
    <PublicInfoPage
      eyebrow="Privacy"
      icon={ShieldCheck}
      title="Privacy"
      accent="policy"
      copy="This policy explains how Khatu Pay handles customer information for recharge, account access and support workflows."
      primaryAction={{ to: '/contact', label: 'Contact support' }}
      secondaryAction={{ to: '/', label: 'Home' }}
      checklist={[brand.company, brand.email, 'Recharge service support']}
      cards={[
        { icon: UserCheck, title: 'Customer information', text: 'Basic details such as name, email, mobile number and recharge inputs may be used to process requests.', color: '#0f766e' },
        { icon: ShieldCheck, title: 'Data use', text: 'Information is used for account access, payment verification, recharge submission, status tracking and support.', color: '#2563eb' },
        { icon: Mail, title: 'Contact', text: `Privacy queries can be sent to ${brand.email}.`, color: '#f59e0b' },
      ]}
      sections={[
        { title: 'Information Collection', text: 'Khatu Pay may collect account details, contact details and service inputs needed for mobile recharge, DTH recharge and support.' },
        { title: 'Use of Information', text: 'Information is used to provide customer login, process payment verification, submit supported recharge requests and maintain service history.' },
        { title: 'Payment Processing', text: 'Payments may be processed through integrated payment partners. Khatu Pay verifies payment status before recharge submission.' },
        { title: 'Security', text: 'Reasonable technical and operational safeguards are used to protect customer information.' },
        { title: 'Updates', text: 'This policy may be updated as service workflows and operational requirements change.' },
      ]}
    />
  );
}
