import 'package:dio/dio.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../core/api_client.dart';
import '../core/config.dart';

class PaymentService {
  final _dio = ApiClient.client;
  late Razorpay _razorpay;

  PaymentService() {
    _razorpay = Razorpay();
  }

  Future<Map<String, dynamic>> createRazorpayOrder(double amount, {String? loanId, bool isFullPayment = false, int? installmentNo}) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'loanId': loanId,
      'isFullPayment': isFullPayment,
      'installmentNo': installmentNo,
    });
    return r.data['data'];
  }

  Future<Map<String, dynamic>> createP2PPaymentOrder(
    double amount,
    String payeeVPA,
    String payeeName, {
    String? payeeUserId,
    String? payeeMobile,
    String? note,
  }) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'payeeUserId': payeeUserId,
      'payeeVPA': payeeVPA,
      'payeeName': payeeName,
      'payeeMobile': payeeMobile,
      'payeeNote': note,
    });
    return r.data['data'];
  }

  Future<Map<String, dynamic>> createWalletTopupOrder(double amount) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'walletTopup': true,
      'notes': {'purpose': 'wallet_topup'},
    });
    return r.data['data'];
  }

  Future<Map<String, dynamic>> createRechargeOrder({
    required double amount,
    required String type,
    required String operatorId,
    required String accountRef,
    String? customerMobile,
    Map<String, String?> values = const {},
  }) async {
    final recharge = <String, dynamic>{
      'type': type,
      'operatorId': operatorId,
      'accountRef': accountRef,
      if (customerMobile != null && customerMobile.isNotEmpty) 'customerMobile': customerMobile,
      for (final entry in values.entries)
        if (entry.value != null && entry.value!.isNotEmpty) entry.key: entry.value,
    };
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'recharge': recharge,
      'notes': {'purpose': 'recharge_payment'},
    });
    return Map<String, dynamic>.from(r.data['data']);
  }

  Future<Map<String, dynamic>> payWithWallet(double amount, {String? billId, String? type, String? note}) async {
    final r = await _dio.post('/payments/wallet/pay', data: {
      'amount': amount,
      'billId': billId,
      'type': type,
      'note': note,
    });
    return Map<String, dynamic>.from(r.data['data']);
  }

  void newCheckout({
    required double amount,
    required String orderId,
    String? keyId,
    required Function(String oid, String pid, String sig) onSuccess,
    required Function(String message) onFail,
  }) {
    final options = {
      'key': keyId ?? AppConfig.razorpayKey,
      'amount': (amount * 100).toInt(), // Amount in paise
      'name': 'Khatu Pay',
      'order_id': orderId,
      'description': 'Payment',
      'prefill': {
        'contact': 'customer_contact',
        'email': 'customer_email',
      },
      'theme': {
        'color': '#3399cc',
      },
    };

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse response) {
      onSuccess(response.orderId!, response.paymentId!, response.signature!);
    });

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse response) {
      onFail(response.message ?? 'Payment failed');
    });

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse response) {
      onFail('External wallet selected');
    });

    _razorpay.open(options);
  }

  Future<Map<String, dynamic>> verifyRazorpay(String orderId, String paymentId, String signature) async {
    final r = await _dio.post('/payments/razorpay/verify', data: {
      'razorpay_order_id': orderId,
      'razorpay_payment_id': paymentId,
      'razorpay_signature': signature,
    });
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  void dispose() {
    _razorpay.clear();
  }
}
