import React from 'react';
import { ArrowLeftRight, CheckCircle2, Receipt, RefreshCw } from 'lucide-react';

import PublicInfoPage from '../components/PublicInfoPage.jsx';

export default function RefundPolicy() {
  return (
    <PublicInfoPage
      eyebrow="Refunds"
      icon={RefreshCw}
      title="Refund and"
      accent="support policy"
      copy="Refund handling depends on payment confirmation, recharge provider response and final transaction status. Support can help review failed or pending recharge requests."
      primaryAction={{ to: '/contact', label: 'Contact support' }}
      secondaryAction={{ to: '/help-center', label: 'Help center' }}
      checklist={['Keep transaction reference', 'Share amount and date', 'Support reviews failed requests']}
      cards={[
        { icon: RefreshCw, title: 'Failed recharge', text: 'If a payment succeeds but recharge fails, support can review the request status.', color: '#0f766e' },
        { icon: Receipt, title: 'Original method', text: 'Eligible refunds are generally handled through the same method used for checkout.', color: '#2563eb' },
        { icon: ArrowLeftRight, title: 'Processing time', text: 'Refund timelines may depend on payment and bank processing.', color: '#f59e0b' },
        { icon: CheckCircle2, title: 'Support details', text: 'Transaction ID, date, amount and recharge details help faster review.', color: '#7c3aed' },
      ]}
      sections={[
        { title: 'Eligibility', text: 'Refund review is generally applicable when payment is deducted but the recharge request fails or cannot be completed.' },
        { title: 'Successful Services', text: 'Completed recharge requests are normally not eligible for refund.' },
        { title: 'Processing', text: 'Eligible refunds are initiated after transaction status review and may take time depending on payment and bank systems.' },
        { title: 'Support Request', text: 'Customers should contact support with transaction reference, amount, date and recharge details.' },
      ]}
    />
  );
}
