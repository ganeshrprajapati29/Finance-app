import 'dotenv/config';

const clubapiConfig = {
  baseURL: process.env.CLUBAPI_BASE_URL || 'https://api.clubapi.in',
  transactionURL: process.env.CLUBAPI_TRANSACTION_URL || 'https://api.clubapi.in/transaction.php',
  utilityURL: process.env.CLUBAPI_UTILITY_URL || 'https://api.clubapi.in/utility/transaction.php',
  directURL: process.env.CLUBAPI_DIRECT_URL || 'https://direct.clubapi.in/transaction.php',
  fundRequestURL: process.env.CLUBAPI_FUND_REQUEST_URL || 'https://clubapi.in/account/data_post.php?act=buyerFundRequestRequest',
  fundRequestListURL: process.env.CLUBAPI_FUND_REQUEST_LIST_URL || 'https://clubapi.in/account/data_post.php?act=buyerFundRequest',
  fundRequestCookie: process.env.CLUBAPI_PANEL_COOKIE || '',
  token: process.env.CLUBAPI_TOKEN || '',
  callbackId: process.env.CLUBAPI_CALLBACK_ID || process.env.CLUBAPI_CB_ID || '',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

export default clubapiConfig;
