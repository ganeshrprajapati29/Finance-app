# ClubAPI Integration Module

A completely isolated ClubAPI integration module for bill payments and recharges.

## Features

- **Bill Fetch**: Fetch bill details from various providers (Electricity, Water, Gas)
- **Bill Payment**: Pay bills through BBPS (Bharat Bill Payment System)
- **Mobile Recharge**: Recharge mobile numbers
- **DTH Recharge**: Recharge DTH connections
- **Transaction Status**: Check transaction status
- **Transaction History**: View all transactions

## Backend Structure

```
clubapi/
├── config.js          # ClubAPI configuration
├── helper.js          # Utility functions (URID generator, validation)
├── errorHandler.js    # Error handling middleware
├── routes.js          # Express routes
├── controllers.js     # Business logic controllers
├── models/            # MongoDB models
│   └── transaction.js # Transaction model
└── README.md          # This file
```

## Frontend Structure

```
khatupay_app/lib/clubapi/
├── models/
│   ├── clubapi_bill.dart
│   └── clubapi_transaction.dart
├── services/
│   └── clubapi_service.dart
├── providers/
│   └── clubapi_providers.dart
└── ui/
    ├── clubapi_dashboard.dart
    ├── clubapi_bill_page.dart
    └── clubapi_recharge_page.dart
```

## Backend Setup

1. **Environment Variables**: Add to your `.env` file:
   ```
   CLUBAPI_TOKEN=your_clubapi_token_here
   ```

2. **Database**: The module uses MongoDB. Ensure your MongoDB connection is configured.

3. **Integration**: Add to your main Express app:
   ```javascript
   const clubAPIRoutes = require('./clubapi/routes');
   app.use('/api/clubapi', clubAPIRoutes);
   ```

## Frontend Setup

1. **Dependencies**: Ensure you have these packages in `pubspec.yaml`:
   ```yaml
   dependencies:
     flutter_riverpod: ^2.0.0
     dio: ^5.0.0
   ```

2. **Integration**: Add to your app routing:
   ```dart
   // In your router configuration
   GoRoute(
     path: '/clubapi',
     builder: (_, __) => const ClubAPIDashboard(),
   ),
   ```

3. **Navigation**: Add a button or menu item to navigate to ClubAPI:
   ```dart
   Navigator.push(
     context,
     MaterialPageRoute(builder: (_) => const ClubAPIDashboard()),
   );
   ```

## API Endpoints

### Bill Operations
- `POST /api/clubapi/bill/fetch` - Fetch bill details
- `POST /api/clubapi/bill/pay` - Pay bill

### Recharge Operations
- `POST /api/clubapi/recharge` - Perform recharge

### Transaction Operations
- `GET /api/clubapi/transaction/:urid/status` - Get transaction status
- `GET /api/clubapi/transactions` - Get transaction history

## Usage Examples

### Backend
```javascript
// Fetch bill
const response = await fetch('/api/clubapi/bill/fetch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'ELECTRICITY',
    provider: 'TATA_POWER',
    accountRef: '1234567890'
  })
});

// Pay bill
const response = await fetch('/api/clubapi/bill/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    billId: 'BILL123',
    amount: 1500.00,
    operatorId: 'TATA_POWER',
    accountRef: '1234567890'
  })
});
```

### Frontend
```dart
// Fetch bill
final bill = await ref.read(clubAPIServiceProvider).fetchBill(
  type: 'ELECTRICITY',
  provider: 'TATA_POWER',
  accountRef: '1234567890',
);

// Pay bill
final transaction = await ref.read(clubAPIServiceProvider).payBill(
  billId: 'BILL123',
  amount: 1500.00,
  operatorId: 'TATA_POWER',
  accountRef: '1234567890',
);
```

## Error Handling

The module includes comprehensive error handling:
- Network errors
- API validation errors
- ClubAPI service errors
- Database errors

All errors return clean JSON responses with appropriate HTTP status codes.

## Security

- All requests require authentication
- Sensitive data is validated
- Transactions are logged for audit purposes
- API keys are stored securely in environment variables

## Testing

Test the endpoints using tools like Postman or curl:

```bash
# Fetch bill
curl -X POST http://localhost:3000/api/clubapi/bill/fetch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"type":"ELECTRICITY","provider":"TATA_POWER","accountRef":"1234567890"}'
```

## Support

This module is completely isolated and can be dropped into any existing Node.js/Express + Flutter project without modifications to existing code.
