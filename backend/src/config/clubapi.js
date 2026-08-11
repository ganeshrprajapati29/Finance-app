import 'dotenv/config';

const clubapiConfig = {
  baseURL: process.env.CLUBAPI_BASE_URL || 'https://api.clubapi.in',
  transactionURL: process.env.CLUBAPI_TRANSACTION_URL || 'https://api.clubapi.in/transaction.php',
  utilityURL: process.env.CLUBAPI_UTILITY_URL || 'https://api.clubapi.in/utility/transaction.php',
  directURL: process.env.CLUBAPI_DIRECT_URL || 'https://direct.clubapi.in/transaction.php',
  token: process.env.CLUBAPI_TOKEN || '',
  callbackId: process.env.CLUBAPI_CALLBACK_ID || process.env.CLUBAPI_CB_ID || '',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

export default clubapiConfig;
