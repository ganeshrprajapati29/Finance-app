import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function Disclaimer() {
  return (
    <PublicInfoPage
      eyebrow="Important Notice"
      icon={AlertTriangle}
      title="Service"
      accent="disclaimer"
      copy="Information on this website is provided to explain Khatu Pay recharge services. Actual mobile or DTH recharge status depends on customer details, payment confirmation and service provider response."
      primaryAction={{ to: '/', label: 'Back home' }}
      secondaryAction={{ to: '/contact', label: 'Contact support' }}
      checklist={['Check details before payment', 'Provider response may vary', 'Contact support for queries']}
      cards={[
        { icon: FileText, title: 'Information purpose', text: 'Website content explains service flows and customer support options.', color: '#0f766e' },
        { icon: CheckCircle2, title: 'Customer details', text: 'Users are responsible for entering correct numbers and account references.', color: '#2563eb' },
        { icon: ShieldCheck, title: 'Recharge status', text: 'Final status depends on payment verification and recharge provider response.', color: '#f59e0b' },
      ]}
    />
  );
}
