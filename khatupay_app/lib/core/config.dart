class AppConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://khatupay.com/api',
  );

  // No placeholder default on purpose: a broken/fake key must fail loudly
  // (see PaymentService.newCheckout) rather than silently open checkout
  // with a non-functional key. The real key is always passed at build time
  // via --dart-define=RAZORPAY_KEY=..., and normally the server-provided
  // key_id from the order response is used anyway - this is only a
  // last-resort fallback if that response is ever missing it.
  static const String razorpayKey = String.fromEnvironment('RAZORPAY_KEY');
}
