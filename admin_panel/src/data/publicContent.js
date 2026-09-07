import {
  BadgeCheck,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  Headphones,
  Landmark,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
  Tv,
  WalletCards,
  Zap,
} from 'lucide-react';

export const brand = {
  name: 'Khatu Pay',
  company: 'Khatu Pay',
  phone: '+91 8400154277',
  email: 'info@khatupay.com',
  website: 'https://khatupay.com',
};

export const serviceImages = {
  mobileRecharge: 'https://panmitra.com/img/mobile_recharge.png',
  dthRecharge: 'https://wpblogassets.paytm.com/paytmblog/uploads/2025/11/image-2025-11-25T164700.151.jpg',
  secureCheckout: 'https://cdni.iconscout.com/illustration/premium/thumb/people-doing-online-card-payment-via-mobile-app-6471117-5349346.png',
  qrPayment: 'https://cdni.iconscout.com/illustration/premium/thumb/female-using-merchant-services-illustration-svg-download-png-10254657.png',
  loanAssistance: 'https://cdni.iconscout.com/illustration/premium/thumb/girl-getting-business-loan-illustration-svg-download-png-12561324.png',
  historyReceipts: 'https://img.freepik.com/free-vector/invoice-concept-illustration_114360-2411.jpg',
  support: 'https://img.freepik.com/free-vector/call-center-concept-illustration_114360-3769.jpg',
  security: 'https://img.freepik.com/free-vector/security-on-concept-illustration_114360-4705.jpg',
  utilityBills: 'https://img.freepik.com/free-vector/online-payment-concept-illustration_114360-4498.jpg',
  bankVerification: 'https://img.freepik.com/free-vector/banknote-concept-illustration_114360-4413.jpg',
  businessTools: 'https://img.freepik.com/free-vector/dashboard-concept-illustration_114360-4351.jpg',
  walletServices: 'https://img.freepik.com/free-vector/wallet-concept-illustration_114360-2806.jpg',
};

export function publicImageForTitle(title = '') {
  const value = title.toLowerCase();
  if (value.includes('dth') || value.includes('tv')) return serviceImages.dthRecharge;
  if (value.includes('qr')) return serviceImages.qrPayment;
  if (value.includes('loan') || value.includes('partner')) return serviceImages.loanAssistance;
  if (value.includes('support') || value.includes('help')) return serviceImages.support;
  if (value.includes('receipt') || value.includes('history') || value.includes('record')) return serviceImages.historyReceipts;
  if (value.includes('secure') || value.includes('security') || value.includes('checkout') || value.includes('verified')) return serviceImages.secureCheckout;
  if (value.includes('bank') || value.includes('verification')) return serviceImages.bankVerification;
  if (value.includes('wallet')) return serviceImages.walletServices;
  if (value.includes('business') || value.includes('report')) return serviceImages.businessTools;
  if (value.includes('bill') || value.includes('utility')) return serviceImages.utilityBills;
  return serviceImages.mobileRecharge;
}

export const serviceCatalog = [
  {
    slug: 'mobile-recharge',
    title: 'Mobile Recharge',
    short: 'Mobile recharge with secure checkout and status tracking.',
    icon: Smartphone,
    color: '#0f766e',
    status: 'Live',
    image: serviceImages.mobileRecharge,
    bullets: ['Mobile number input', 'Amount review', 'Secure checkout', 'Recharge history'],
  },
  {
    slug: 'dth-recharge',
    title: 'DTH Recharge',
    short: 'Recharge DTH connections with a simple customer ID based flow.',
    icon: Tv,
    color: '#2563eb',
    status: 'Live',
    image: serviceImages.dthRecharge,
    bullets: ['DTH operator support', 'Customer ID input', 'Payment verification', 'Service history'],
  },
  {
    slug: 'secure-checkout',
    title: 'Secure Checkout',
    short: 'Payment is verified before submitting any recharge request.',
    icon: LockKeyhole,
    color: '#0ea5e9',
    status: 'Live',
    image: serviceImages.secureCheckout,
    bullets: ['Secure checkout', 'Payment verification', 'Receipt generation', 'Status updates'],
  },
  {
    slug: 'qr-payments',
    title: 'QR Payment Support',
    short: 'QR based customer payment support with verified account and receipt tracking.',
    icon: QrCode,
    color: '#0891b2',
    status: 'Live',
    image: serviceImages.qrPayment,
    bullets: ['QR code display', 'Payment reference support', 'Receipt records', 'Support tracking'],
  },
  {
    slug: 'partner-loan-assistance',
    title: 'Partner Loan Assistance',
    short: 'Loan application assistance through eligible third-party lending partners, subject to approval.',
    icon: Banknote,
    color: '#16a34a',
    status: 'Partner service',
    image: serviceImages.loanAssistance,
    bullets: ['Basic enquiry form', 'Eligibility review', 'Partner lender processing', 'Application status updates'],
  },
  {
    slug: 'recharge-history',
    title: 'Recharge History',
    short: 'Customers can view recharge status and reference details after login.',
    icon: FileText,
    color: '#7c3aed',
    status: 'Live',
    image: serviceImages.historyReceipts,
    bullets: ['Recharge records', 'Reference IDs', 'Status tracking', 'Support workflow'],
  },
  {
    slug: 'support',
    title: 'Customer Support',
    short: 'Support for recharge status, receipt and failed transaction review.',
    icon: Headphones,
    color: '#dc2626',
    status: 'Live',
    image: serviceImages.support,
    bullets: ['Support tickets', 'Recharge status help', 'Receipt review', 'Clear updates'],
  },
  {
    slug: 'security-support',
    title: 'Security & Support',
    short: 'Profile verification, support tickets, policies and account safety controls.',
    icon: ShieldCheck,
    color: '#334155',
    status: 'Live',
    image: serviceImages.security,
    bullets: ['Profile status', 'Support tickets', 'Secure auth', 'Helpful policies'],
  },
  {
    slug: 'utility-bill-payments',
    title: 'Utility Bill Payments',
    short: 'Electricity, water, broadband and other utility payment workflows are planned.',
    icon: CreditCard,
    color: '#ea580c',
    status: 'Coming Soon',
    image: serviceImages.utilityBills,
    bullets: ['Biller search', 'Bill fetch', 'Secure checkout', 'Status history'],
  },
  {
    slug: 'bank-verification',
    title: 'Bank Verification',
    short: 'Account validation and name verification tools are planned for verified workflows.',
    icon: Landmark,
    color: '#4f46e5',
    status: 'Coming Soon',
    image: serviceImages.bankVerification,
    bullets: ['Account validation', 'Name match', 'Verification status', 'Secure records'],
  },
  {
    slug: 'business-tools',
    title: 'Business Tools',
    short: 'Merchant support tools, reports and service insights are planned for business users.',
    icon: Building2,
    color: '#475569',
    status: 'Coming Soon',
    image: serviceImages.businessTools,
    bullets: ['Service reports', 'Customer records', 'QR support', 'Business insights'],
  },
  {
    slug: 'wallet-services',
    title: 'Wallet Services',
    short: 'A simple wallet view for eligible Khatu Pay services is planned.',
    icon: WalletCards,
    color: '#7c3aed',
    status: 'Coming Soon',
    image: serviceImages.walletServices,
    bullets: ['Wallet view', 'Service payments', 'Transaction history', 'Refund updates'],
  },
];

export const billCategories = [
  { label: 'Prepaid Mobile', icon: Smartphone },
  { label: 'DTH Recharge', icon: Tv },
  { label: 'QR Payment Support', icon: QrCode },
  { label: 'Partner Loan Assistance', icon: Banknote },
  { label: 'Secure Checkout', icon: LockKeyhole },
  { label: 'Recharge Receipts', icon: FileText },
  { label: 'Status Tracking', icon: BadgeCheck },
  { label: 'Customer Support', icon: Headphones },
  { label: 'Utility Bills', icon: CreditCard },
  { label: 'Business Tools', icon: Building2 },
];

export const platformHighlights = [
  { label: 'Service status', value: 'Online', icon: LockKeyhole },
  { label: 'Recharge', value: 'Available', icon: Zap },
  { label: 'QR support', value: 'Enabled', icon: QrCode },
  { label: 'Loan assistance', value: 'Partner based', icon: Banknote },
  { label: 'Support', value: 'Ticket based', icon: Headphones },
  { label: 'Receipts', value: 'Available', icon: FileText },
];

const defaultServiceDetail = {
  overview:
    'This page explains the customer workflow, status visibility and support options available for this Khatu Pay service.',
  steps: ['Select the service', 'Enter required details', 'Review information', 'Track the final status'],
  info: [
    { title: 'Customer First Flow', text: 'Forms are kept simple with clear labels, helpful validation and easy review before submission.' },
    { title: 'Status Visibility', text: 'Customers can check request status and reference details from their account wherever available.' },
    { title: 'Support Ready', text: 'Support records help customers raise a query with relevant service and payment references.' },
  ],
  faq: [
    { question: 'Is this service available to all customers?', answer: 'Availability may depend on account status, service category and operational checks.' },
    { question: 'Where can users track requests?', answer: 'Users can login to their account and review service history, receipts and support updates.' },
  ],
};

export function getServiceDetail(service) {
  const details = {
    'mobile-recharge': {
      overview: 'Mobile recharge on Khatu Pay is built for a simple number, plan or amount, checkout and status tracking flow.',
      steps: ['Enter mobile number', 'Select operator or plan', 'Review amount', 'Complete checkout and track status'],
      info: [
        { title: 'Plan And Amount Support', text: 'Customers can continue with available plans or manually enter a recharge amount where supported.' },
        { title: 'Payment First Processing', text: 'Recharge is submitted only after payment status is checked by the backend.' },
        { title: 'Receipts And References', text: 'Recharge history keeps amount, number, status and provider references for support review.' },
      ],
      faq: [
        { question: 'What if recharge is pending?', answer: 'The status screen and history page show pending updates until the final provider response is available.' },
        { question: 'What if payment succeeds but recharge fails?', answer: 'The transaction can be reviewed from support with payment and recharge references.' },
      ],
    },
    'dth-recharge': {
      overview: 'DTH recharge keeps the customer ID and amount flow simple, with review and status tracking after checkout.',
      steps: ['Choose DTH operator', 'Enter customer ID', 'Enter amount', 'Pay and track recharge status'],
      info: [
        { title: 'Simple DTH Form', text: 'Only required fields are shown so customers can complete recharge without unnecessary steps.' },
        { title: 'Clear Confirmation', text: 'Amount, operator and customer ID can be reviewed before payment.' },
        { title: 'Support Trail', text: 'Status and reference details are stored for customer support follow-up.' },
      ],
      faq: [
        { question: 'Do DTH plans appear on the website?', answer: 'DTH recharge is amount based where plan fetching is not available.' },
        { question: 'Can users check old DTH recharges?', answer: 'Available records can be reviewed from service history after login.' },
      ],
    },
    'secure-checkout': {
      overview: 'Secure checkout helps verify payment flow before a service request is processed.',
      steps: ['Create checkout request', 'Complete payment', 'Verify payment status', 'Continue service processing'],
      info: [
        { title: 'Backend Verification', text: 'Payment status is verified server-side before service fulfilment begins.' },
        { title: 'Clear Result States', text: 'Success, pending and failed states are handled with customer-friendly messages.' },
        { title: 'Receipt Support', text: 'Payment references are stored so support can review deducted or pending payments.' },
      ],
      faq: [
        { question: 'Is payment data secure?', answer: 'Sensitive payment credentials are handled from backend integrations and are not exposed in public pages.' },
        { question: 'Can failed payments be reviewed?', answer: 'Customers can contact support with order and payment references for review.' },
      ],
    },
    'partner-loan-assistance': {
      overview: 'Khatu Pay may help users submit an enquiry to eligible third-party lending partners. Approval and terms remain subject to partner policies.',
      steps: ['Submit basic enquiry', 'Complete required verification', 'Partner eligibility review', 'Receive application updates'],
      info: [
        { title: 'Partner-Based Assistance', text: 'Khatu Pay does not promise approval, amount, pricing or disbursal on public pages.' },
        { title: 'Simple Enquiry', text: 'The customer flow collects only required information for review and communication.' },
        { title: 'Transparent Updates', text: 'Application status can be shown after login when partner updates are available.' },
      ],
      faq: [
        { question: 'Does Khatu Pay directly provide loans?', answer: 'Loan assistance is routed through eligible third-party partners, subject to their review and policies.' },
        { question: 'Is approval guaranteed?', answer: 'No. Approval, amount and terms are decided by the respective partner.' },
      ],
    },
  };

  return { ...defaultServiceDetail, ...(details[service?.slug] || {}) };
}

export const faqs = [
  {
    question: 'Can users recharge from the website?',
    answer:
      'Yes. Registered customers can login on the website, enter recharge details and complete secure checkout.',
  },
  {
    question: 'How does payment happen?',
    answer:
      'Recharge checkout uses a secure flow. The backend verifies payment status before submitting the recharge request.',
  },
  {
    question: 'What happens if recharge fails?',
    answer:
      'Transaction status is tracked through backend updates and history. If a service request does not complete, customer support can review it.',
  },
  {
    question: 'Does Khatu Pay provide loans directly?',
    answer:
      'Khatu Pay may support loan enquiry and application assistance through eligible third-party lending partners. Final approval, pricing and disbursal are handled by the respective partner as per their policies.',
  },
  {
    question: 'Can customers use QR payment support?',
    answer:
      'QR payment support is available for eligible account and service workflows. Customers should keep transaction references for support review.',
  },
  {
    question: 'Can I view my account online?',
    answer:
      'Yes. Customer login shows profile status, saved contact details and service history links.',
  },
];
