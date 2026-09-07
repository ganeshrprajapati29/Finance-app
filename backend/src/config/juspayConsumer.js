function cleanPem(value = '') {
  return String(value || '').replace(/\\n/g, '\n').trim();
}

export default {
  enabled: String(process.env.JUSPAY_CONSUMER_ENABLED || 'false').toLowerCase() === 'true',
  baseUrl: (process.env.JUSPAY_CONSUMER_BASE_URL || '').replace(/\/+$/, ''),
  apiUri: process.env.JUSPAY_CONSUMER_API_URI || '',
  merchantId: process.env.JUSPAY_CONSUMER_MERCHANT_ID || process.env.JUSPAY_MERCHANT_ID || '',
  merchantChannelId: process.env.JUSPAY_CONSUMER_MERCHANT_CHANNEL_ID || process.env.JUSPAY_MERCHANT_CHANNEL_ID || '',
  kid: process.env.JUSPAY_CONSUMER_KID || process.env.JUSPAY_KID || '',
  privateKey: cleanPem(process.env.JUSPAY_CONSUMER_PRIVATE_KEY || process.env.JUSPAY_PRIVATE_KEY || ''),
  pspPublicKey: cleanPem(process.env.JUSPAY_CONSUMER_PSP_PUBLIC_KEY || process.env.JUSPAY_PSP_PUBLIC_KEY || ''),
  requestIdPrefix: process.env.JUSPAY_CONSUMER_REQUEST_PREFIX || 'KP',
  callbackUrl: process.env.JUSPAY_CONSUMER_CALLBACK_URL || 'https://khatupay.com/api/callback/juspay-consumer',
  paths: {
    getSmsToken: process.env.JUSPAY_CONSUMER_GET_SMS_TOKEN_PATH || '',
    bindDevice: process.env.JUSPAY_CONSUMER_BIND_DEVICE_PATH || '',
    fetchAccounts: process.env.JUSPAY_CONSUMER_FETCH_ACCOUNTS_PATH || '',
    checkBalance: process.env.JUSPAY_CONSUMER_CHECK_BALANCE_PATH || '',
    verifyVpa: process.env.JUSPAY_CONSUMER_VERIFY_VPA_PATH || '',
    setMpin: process.env.JUSPAY_CONSUMER_SET_MPIN_PATH || '',
    changeMpin: process.env.JUSPAY_CONSUMER_CHANGE_MPIN_PATH || '',
    resetMpin: process.env.JUSPAY_CONSUMER_RESET_MPIN_PATH || '',
    sendMoney: process.env.JUSPAY_CONSUMER_SEND_MONEY_PATH || '',
    requestMoney: process.env.JUSPAY_CONSUMER_REQUEST_MONEY_PATH || '',
    transactionStatus: process.env.JUSPAY_CONSUMER_TRANSACTION_STATUS_PATH || '',
    listTransactions: process.env.JUSPAY_CONSUMER_LIST_TRANSACTIONS_PATH || '',
    listBanks: process.env.JUSPAY_CONSUMER_LIST_BANKS_PATH || '',
    upiNumberAvailability: process.env.JUSPAY_CONSUMER_UPI_NUMBER_AVAILABILITY_PATH || '',
    createUpiNumber: process.env.JUSPAY_CONSUMER_CREATE_UPI_NUMBER_PATH || '',
    updateUpiNumber: process.env.JUSPAY_CONSUMER_UPDATE_UPI_NUMBER_PATH || '',
    complaintRaise: process.env.JUSPAY_CONSUMER_COMPLAINT_RAISE_PATH || '',
    complaintStatus: process.env.JUSPAY_CONSUMER_COMPLAINT_STATUS_PATH || '',
    upiLiteStatus: process.env.JUSPAY_CONSUMER_UPI_LITE_STATUS_PATH || '',
  },
};
