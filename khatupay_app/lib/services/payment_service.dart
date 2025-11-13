import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../core/api_client.dart';
import '../core/config.dart';

class PaymentService {
  final _dio = ApiClient.client;

  Future<Map> createRazorpayOrder(num amount, {String? loanId, String? billId, int? installmentNo, bool? isFullPayment, String? payeeVPA, String? payeeName, String? payeeNote}) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount, 'loanId': loanId, 'billId': billId, 'installmentNo': installmentNo, 'isFullPayment': isFullPayment,
      'payeeVPA': payeeVPA, 'payeeName': payeeName, 'payeeNote': payeeNote
    });
    return r.data['data']; // { order, paymentId, key_id }
  }

  /// 🔹 Create P2P payment order for scanned QR
  Future<Map> createP2PPaymentOrder(num amount, String payeeVPA, String payeeName, {String? note}) async {
    return createRazorpayOrder(amount, payeeVPA: payeeVPA, payeeName: payeeName, payeeNote: note);
  }

  Future<void> verifyRazorpay(String orderId, String paymentId, String signature) async {
    await _dio.post('/payments/razorpay/verify', data: {
      'razorpay_order_id': orderId, 'razorpay_payment_id': paymentId, 'razorpay_signature': signature
    });
  }

  Razorpay newCheckout({
    required num amount,
    required String orderId,
    required Function(String,String,String) onSuccess,
    required Function(String) onFail,
  }) {
    final rz = Razorpay();
    rz.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) {
      onSuccess(r.orderId!, r.paymentId!, r.signature!);
      rz.clear();
    });
    rz.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse e) {
      onFail(e.message ?? 'failed');
      rz.clear();
    });
    rz.open({
      'key': AppConfig.razorpayKey,
      'amount': (amount * 100).toInt(),
      'currency': 'INR',
      'name': 'Khatu Pay',
      'order_id': orderId,
      'prefill': { 'email': 'test@example.com', 'contact':'9999999999' }
    });
    return rz;
  }
}
