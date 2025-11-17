class AppConfig {
  // Android emulator -> backend on host's localhost
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.29.124:8080/api',
  );
  // for real device on same wifi, put your machine IP: 'http://192.168.1.5:8080'
  static const String razorpayKey = String.fromEnvironment('RAZORPAY_KEY', defaultValue: 'rzp_live_RIEvsgWYOOAfAT');
}
