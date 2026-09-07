# Juspay Consumer Stack / TPAP Setup

Use this file after Juspay/partner bank approves Consumer Stack.

Consumer callback URL to share with Juspay:

```text
https://khatupay.com/api/callback/juspay-consumer
```

Server IP to whitelist:

```text
72.60.102.36
```

Current payment rule:

```text
Khatu UPI Consumer screen only
Recharge, DTH, BBPS and wallet top-up remain on Razorpay until changed intentionally
```

Backend environment variables:

```env
JUSPAY_CONSUMER_ENABLED=false
JUSPAY_CONSUMER_BASE_URL=https://api.beta.your-bank.upi.juspay.in
JUSPAY_CONSUMER_API_URI=
JUSPAY_CONSUMER_MERCHANT_ID=your_consumer_stack_merchant_id
JUSPAY_CONSUMER_MERCHANT_CHANNEL_ID=your_consumer_stack_channel_id
JUSPAY_CONSUMER_KID=your_consumer_stack_kid
JUSPAY_CONSUMER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JUSPAY_CONSUMER_PSP_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JUSPAY_CONSUMER_CALLBACK_URL=https://khatupay.com/api/callback/juspay-consumer

JUSPAY_CONSUMER_GET_SMS_TOKEN_PATH=
JUSPAY_CONSUMER_BIND_DEVICE_PATH=
JUSPAY_CONSUMER_FETCH_ACCOUNTS_PATH=
JUSPAY_CONSUMER_CHECK_BALANCE_PATH=
JUSPAY_CONSUMER_VERIFY_VPA_PATH=
JUSPAY_CONSUMER_SET_MPIN_PATH=
JUSPAY_CONSUMER_CHANGE_MPIN_PATH=
JUSPAY_CONSUMER_RESET_MPIN_PATH=
JUSPAY_CONSUMER_SEND_MONEY_PATH=
JUSPAY_CONSUMER_REQUEST_MONEY_PATH=
JUSPAY_CONSUMER_TRANSACTION_STATUS_PATH=
JUSPAY_CONSUMER_LIST_TRANSACTIONS_PATH=
JUSPAY_CONSUMER_LIST_BANKS_PATH=
JUSPAY_CONSUMER_UPI_NUMBER_AVAILABILITY_PATH=
JUSPAY_CONSUMER_CREATE_UPI_NUMBER_PATH=
JUSPAY_CONSUMER_UPDATE_UPI_NUMBER_PATH=
JUSPAY_CONSUMER_UPI_LITE_STATUS_PATH=
JUSPAY_CONSUMER_COMPLAINT_RAISE_PATH=
JUSPAY_CONSUMER_COMPLAINT_STATUS_PATH=
```

Consumer Stack backend endpoints:

```text
GET  /api/upi-consumer/setup
POST /api/upi-consumer/sms-token
POST /api/upi-consumer/bind-device
POST /api/upi-consumer/banks
POST /api/upi-consumer/accounts/fetch
POST /api/upi-consumer/balance
POST /api/upi-consumer/vpa/verify
POST /api/upi-consumer/mpin/set
POST /api/upi-consumer/mpin/change
POST /api/upi-consumer/mpin/reset
POST /api/upi-consumer/send-money
POST /api/upi-consumer/request-money
POST /api/upi-consumer/transactions/status
POST /api/upi-consumer/transactions/list
POST /api/upi-consumer/upi-number/check
POST /api/upi-consumer/upi-number/create
POST /api/upi-consumer/upi-number/update
POST /api/upi-consumer/upi-lite/status
POST /api/upi-consumer/complaints/raise
POST /api/upi-consumer/complaints/status
```
