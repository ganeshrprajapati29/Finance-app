const env = process.env.DECENTRO_ENV || 'staging';

const hosts = {
  staging: 'https://in.staging.decentro.tech',
  production: 'https://in.decentro.tech'
};

export default {
  env,
  baseURL: process.env.DECENTRO_BASE_URL || hosts[env] || hosts.staging,
  clientId: process.env.DECENTRO_CLIENT_ID || '',
  clientSecret: process.env.DECENTRO_CLIENT_SECRET || '',
  financialServicesModuleSecret:
    process.env.DECENTRO_FINANCIAL_SERVICES_MODULE_SECRET ||
    process.env.DECENTRO_MODULE_SECRET ||
    '',
  financialServicesProviderSecret:
    process.env.DECENTRO_FINANCIAL_SERVICES_PROVIDER_SECRET ||
    process.env.DECENTRO_PROVIDER_SECRET ||
    '',
  paymentsClientId: process.env.DECENTRO_PAYMENTS_CLIENT_ID || '',
  paymentsClientSecret: process.env.DECENTRO_PAYMENTS_CLIENT_SECRET || '',
  paymentsMasterConsumerUrn: process.env.DECENTRO_PAYMENTS_MASTER_CONSUMER_URN || ''
};
