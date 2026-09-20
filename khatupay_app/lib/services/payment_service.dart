import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../core/config.dart';

/// The customer closed the Razorpay sheet. Not an error - screens should show
/// a neutral message rather than a red failure state.
class PaymentCancelledException implements Exception {
  const PaymentCancelledException([this.message = 'Payment cancelled.']);
  final String message;
  @override
  String toString() => message;
}

/// Razorpay reported the payment as failed (declined, network, invalid...).
class PaymentFailedException implements Exception {
  const PaymentFailedException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// The customer paid, but the app could not confirm it with the server (for
/// example the network dropped right after payment). The money is safe: the
/// Razorpay webhook confirms the payment server-side. Screens should say
/// "confirming" and let the customer track it, never ask them to pay again.
class PaymentVerificationPendingException implements Exception {
  const PaymentVerificationPendingException({
    required this.orderId,
    this.paymentId = '',
    this.message =
        'Payment received. We are confirming it with the bank - this can take a minute.',
  });
  final String orderId;
  final String paymentId;
  final String message;
  @override
  String toString() => message;
}

/// Razorpay checkout + Khatu Pay payment APIs.
///
/// Orders are always created by the backend (`/payments/razorpay/order`),
/// checkout opens with the backend's `order.id` and public `key_id`, and the
/// signature returned by Razorpay is sent to `/payments/razorpay/verify`. The
/// app never verifies a signature itself.
class PaymentService {
  final _dio = ApiClient.client;
  late Razorpay _razorpay;

  static const String _brandColor = '#0F766E';

  PaymentService() {
    _razorpay = Razorpay();
  }

  /* ------------------------------------------------------------- orders */

  Future<Map<String, dynamic>> createRazorpayOrder(double amount,
      {String? loanId, bool isFullPayment = false, int? installmentNo}) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'loanId': loanId,
      'isFullPayment': isFullPayment,
      'installmentNo': installmentNo,
    });
    return _normalizeGatewayData(r.data['data']);
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
    return _normalizeGatewayData(r.data['data']);
  }

  Future<Map<String, dynamic>> createWalletTopupOrder(double amount) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'walletTopup': true,
      'notes': {'purpose': 'wallet_topup'},
    });
    return _normalizeGatewayData(r.data['data']);
  }

  /// Creates a Razorpay order for a recharge or bill payment.
  ///
  /// [service] is the payload built by `ServicePaymentRequest.toJson()`: the
  /// service key, provider id, amount and either the account number
  /// (recharge) or the fetched bill id. The server re-validates all of it and
  /// decides the payable amount.
  Future<Map<String, dynamic>> createServiceOrder(
      Map<String, dynamic> service) async {
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': service['amount'],
      'service': service,
      'notes': {'purpose': 'service_payment'},
    });
    return _normalizeGatewayData(r.data['data']);
  }

  /// Pays a recharge or bill from the Khatu wallet balance.
  Future<Map<String, dynamic>> payServiceWithWallet(
      Map<String, dynamic> service) async {
    final r = await _dio.post('/payments/wallet/service', data: {
      'amount': service['amount'],
      'service': service,
    });
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  /// Legacy recharge order (older screens). Prefer [createServiceOrder].
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
      if (customerMobile != null && customerMobile.isNotEmpty)
        'customerMobile': customerMobile,
      for (final entry in values.entries)
        if (entry.value != null && entry.value!.isNotEmpty)
          entry.key: entry.value,
    };
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'recharge': recharge,
      'notes': {'purpose': 'recharge_payment'},
    });
    return _normalizeGatewayData(r.data['data']);
  }

  /// Legacy bill order (older screens). Prefer [createServiceOrder].
  Future<Map<String, dynamic>> createClubAPIBillOrder({
    required double amount,
    required String billId,
    required String operatorId,
    required String accountRef,
    required String customerMobile,
    Map<String, String?> values = const {},
  }) async {
    final clubapiBill = <String, dynamic>{
      'billId': billId,
      'operatorId': operatorId,
      'accountRef': accountRef,
      'customerMobile': customerMobile,
      for (final entry in values.entries)
        if (entry.value != null && entry.value!.isNotEmpty)
          entry.key: entry.value,
    };
    final r = await _dio.post('/payments/razorpay/order', data: {
      'amount': amount,
      'clubapiBill': clubapiBill,
      'notes': {'purpose': 'bbps_bill_payment'},
    });
    return _normalizeGatewayData(r.data['data']);
  }

  /* ------------------------------------------------------- normalisation */

  Map<String, dynamic> _normalizeGatewayData(dynamic raw) {
    final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final nestedOrder = data['order'] is Map
        ? Map<String, dynamic>.from(data['order'])
        : <String, dynamic>{};
    final nestedPayment = nestedOrder['payment'] is Map
        ? Map<String, dynamic>.from(nestedOrder['payment'])
        : <String, dynamic>{};
    final link = _firstText([
      data['paymentLink'],
      data['payment_link'],
      data['paymentUrl'],
      data['payment_url'],
      data['link'],
      data['url'],
      nestedOrder['paymentLink'],
      nestedOrder['payment_link'],
      nestedOrder['paymentUrl'],
      nestedOrder['payment_url'],
      nestedOrder['link'],
      nestedOrder['url'],
      nestedPayment['payment_url'],
      nestedPayment['paymentUrl'],
      nestedPayment['url'],
    ]);

    if (link.isNotEmpty) {
      nestedOrder['id'] = link;
      nestedOrder['payment_url'] = link;
      nestedOrder['gateway'] = 'external';
      data['paymentLink'] = link;
      data['order'] = nestedOrder;
    }
    final razorpayOrderId = _firstText([
      nestedOrder['id'],
      nestedOrder['order_id'],
      data['orderId'],
      data['razorpay_order_id'],
    ]);
    if (razorpayOrderId.isNotEmpty && !_isPaymentAppLink(razorpayOrderId)) {
      nestedOrder['id'] = razorpayOrderId;
      nestedOrder['gateway'] = 'razorpay';
      data['orderId'] = razorpayOrderId;
      data['gateway'] = 'razorpay';
      data['key_id'] =
          _firstText([data['key_id'], data['keyId'], AppConfig.razorpayKey]);
      data['order'] = nestedOrder;
    }
    final appLink = _paymentAppLinkFrom(data);
    if (appLink.isNotEmpty) data['paymentAppLink'] = appLink;
    return data;
  }

  String _firstText(List<dynamic> values) {
    for (final value in values) {
      final text = value?.toString().trim() ?? '';
      if (text.isNotEmpty) return text;
    }
    return '';
  }

  String checkoutLinkFrom(dynamic raw) {
    final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final order = data['order'] is Map
        ? Map<String, dynamic>.from(data['order'])
        : <String, dynamic>{};
    final payment = order['payment'] is Map
        ? Map<String, dynamic>.from(order['payment'])
        : <String, dynamic>{};
    return _firstText([
      data['paymentLink'],
      data['payment_link'],
      data['paymentUrl'],
      data['payment_url'],
      data['link'],
      data['url'],
      order['paymentLink'],
      order['payment_link'],
      order['paymentUrl'],
      order['payment_url'],
      order['id'],
      order['link'],
      order['url'],
      payment['payment_url'],
      payment['paymentUrl'],
      payment['url'],
    ]);
  }

  bool _isPaymentAppLink(String value) {
    final lower = value.trim().toLowerCase();
    return lower.startsWith('upi://') ||
        lower.startsWith('intent://') ||
        lower.startsWith('tez://') ||
        lower.startsWith('gpay://') ||
        lower.startsWith('phonepe://') ||
        lower.startsWith('paytmmp://') ||
        lower.startsWith('bhim://');
  }

  String _paymentAppLinkFrom(dynamic raw) {
    const directKeys = [
      'paymentAppLink',
      'appLink',
      'app_link',
      'upiIntent',
      'upi_intent',
      'upiLink',
      'upi_link',
      'upiUrl',
      'upi_url',
      'upiQrString',
      'upi_qr_string',
      'qrString',
      'qr_string',
      'intent',
      'deepLink',
      'deep_link',
      'deeplink',
    ];

    String scan(dynamic value) {
      if (value is String) {
        final text = value.trim();
        return _isPaymentAppLink(text) ? text : '';
      }
      if (value is Map) {
        final map = Map<String, dynamic>.from(value);
        for (final key in directKeys) {
          final found = scan(map[key]);
          if (found.isNotEmpty) return found;
        }
        for (final item in map.values) {
          final found = scan(item);
          if (found.isNotEmpty) return found;
        }
      }
      if (value is List) {
        for (final item in value) {
          final found = scan(item);
          if (found.isNotEmpty) return found;
        }
      }
      return '';
    }

    return scan(raw);
  }

  /* ------------------------------------------------------------ checkout */

  /// Opens Razorpay for a backend-created order and verifies the result on
  /// the server. Returns the `/payments/razorpay/verify` response data.
  ///
  /// Throws [PaymentCancelledException], [PaymentFailedException] or
  /// [PaymentVerificationPendingException] (paid, confirmation pending).
  Future<Map<String, dynamic>> openGatewayCheckout(
    Map<String, dynamic> data, {
    String? description,
    String? contact,
    String? email,
  }) async {
    final order = data['order'] is Map
        ? Map<String, dynamic>.from(data['order'])
        : <String, dynamic>{};
    final orderId = _firstText([
      order['id'],
      order['order_id'],
      data['orderId'],
      data['razorpay_order_id'],
    ]);
    final key =
        _firstText([data['key_id'], data['keyId'], AppConfig.razorpayKey]);
    final orderAmount = order['amount'];
    final dataAmount = data['amount'];
    final amountInPaise = orderAmount is num
        ? orderAmount.round()
        : (dataAmount is num ? (dataAmount * 100).round() : 0);

    if (orderId.isEmpty || key.isEmpty) {
      throw const PaymentFailedException(
          'Payment could not be started. Please try again or contact support.');
    }

    final completer = Completer<Map<String, dynamic>>();
    _razorpay.clear();

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS,
        (PaymentSuccessResponse response) async {
      final paidOrderId = (response.orderId ?? orderId).trim();
      final paymentId = (response.paymentId ?? '').trim();
      final signature = (response.signature ?? '').trim();

      if (paymentId.isEmpty || signature.isEmpty) {
        if (!completer.isCompleted) {
          completer.completeError(PaymentVerificationPendingException(
            orderId: paidOrderId,
            paymentId: paymentId,
          ));
        }
        return;
      }

      try {
        final verified =
            await _verifyWithRetry(paidOrderId, paymentId, signature);
        if (!completer.isCompleted) completer.complete(verified);
      } on PaymentFailedException catch (error) {
        if (!completer.isCompleted) completer.completeError(error);
      } catch (_) {
        if (!completer.isCompleted) {
          completer.completeError(PaymentVerificationPendingException(
            orderId: paidOrderId,
            paymentId: paymentId,
          ));
        }
      }
    });

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR,
        (PaymentFailureResponse response) {
      if (completer.isCompleted) return;
      if (response.code == Razorpay.PAYMENT_CANCELLED) {
        completer.completeError(const PaymentCancelledException());
        return;
      }
      completer.completeError(PaymentFailedException(_failureMessage(response)));
    });

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET,
        (ExternalWalletResponse response) {
      if (!completer.isCompleted) {
        completer.completeError(const PaymentFailedException(
            'This wallet is not supported. Please pay with UPI, card or net banking.'));
      }
    });

    try {
      _razorpay.open({
        'key': key,
        'amount': amountInPaise > 0 ? amountInPaise : order['amount'],
        'currency': 'INR',
        'name': 'Khatu Pay',
        'order_id': orderId,
        'description': description ?? 'Khatu Pay payment',
        'prefill': {
          if ((contact ?? data['customerMobile']?.toString() ?? '').isNotEmpty)
            'contact': contact ?? data['customerMobile'].toString(),
          if ((email ?? data['customerEmail']?.toString() ?? '').isNotEmpty)
            'email': email ?? data['customerEmail'].toString(),
        },
        'theme': {'color': _brandColor},
        'retry': {'enabled': true, 'max_count': 3},
      });
    } catch (_) {
      if (!completer.isCompleted) {
        completer.completeError(const PaymentFailedException(
            'Payment screen could not be opened. Please try again.'));
      }
    }

    return completer.future.whenComplete(() => _razorpay.clear());
  }

  /// Verification is retried on network errors because the customer has
  /// already paid by this point; a 4xx (bad signature) is final.
  Future<Map<String, dynamic>> _verifyWithRetry(
      String orderId, String paymentId, String signature) async {
    DioException? lastError;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        return await verifyRazorpay(orderId, paymentId, signature);
      } on DioException catch (error) {
        final status = error.response?.statusCode ?? 0;
        if (status >= 400 && status < 500) {
          throw const PaymentFailedException(
              'This payment could not be verified. If money was deducted it will be refunded automatically.');
        }
        lastError = error;
        await Future.delayed(Duration(milliseconds: 800 * (attempt + 1)));
      }
    }
    throw lastError ?? Exception('Verification failed');
  }

  String _failureMessage(PaymentFailureResponse response) {
    if (response.code == Razorpay.NETWORK_ERROR) {
      return 'Network error during payment. Please check your connection and try again.';
    }
    final raw = response.message?.trim() ?? '';
    if (raw.startsWith('{')) {
      try {
        final decoded = jsonDecode(raw);
        final description = decoded is Map
            ? (decoded['error'] is Map
                ? decoded['error']['description']
                : decoded['description'])
            : null;
        if (description != null && description.toString().trim().isNotEmpty) {
          return description.toString().trim();
        }
      } catch (_) {
        // Fall through to the generic message.
      }
    }
    if (raw.isNotEmpty && raw.length < 160 && !raw.contains('{')) return raw;
    return 'Payment failed. No money was deducted - please try again.';
  }

  String paymentOrderIdFrom(dynamic raw) {
    final data = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final order = data['order'] is Map
        ? Map<String, dynamic>.from(data['order'])
        : <String, dynamic>{};
    return _firstText([
      data['khatuPaymentId'],
      data['orderId'],
      data['paymentId'],
      order['khatuPaymentId'],
      order['orderId'],
      order['order_id'],
      order['id'],
    ]);
  }

  Future<Map<String, dynamic>> getPaymentStatus(String orderId) async {
    final r = await _dio.post('/payments/status', data: {
      'orderId': orderId,
    });
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  Future<Map<String, dynamic>> payWithWallet(double amount,
      {String? billId, String? type, String? note}) async {
    final r = await _dio.post('/payments/wallet/pay', data: {
      'amount': amount,
      'billId': billId,
      'type': type,
      'note': note,
    });
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  /// Legacy wallet recharge (older screens). Prefer [payServiceWithWallet].
  Future<Map<String, dynamic>> payWalletForRecharge({
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
      if (customerMobile != null && customerMobile.isNotEmpty)
        'customerMobile': customerMobile,
      for (final entry in values.entries)
        if (entry.value != null && entry.value!.isNotEmpty)
          entry.key: entry.value,
    };
    final r = await _dio.post('/payments/wallet/service', data: {
      'amount': amount,
      'recharge': recharge,
    });
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  /// Legacy wallet bill payment (older screens). Prefer [payServiceWithWallet].
  Future<Map<String, dynamic>> payWalletForBbpsBill({
    required double amount,
    required String billId,
    required String operatorId,
    required String accountRef,
    required String customerMobile,
    Map<String, String?> values = const {},
  }) async {
    final clubapiBill = <String, dynamic>{
      'billId': billId,
      'operatorId': operatorId,
      'accountRef': accountRef,
      'customerMobile': customerMobile,
      for (final entry in values.entries)
        if (entry.value != null && entry.value!.isNotEmpty)
          entry.key: entry.value,
    };
    final r = await _dio.post('/payments/wallet/service', data: {
      'amount': amount,
      'clubapiBill': clubapiBill,
    });
    return Map<String, dynamic>.from(r.data['data'] ?? {});
  }

  /// Callback-style checkout kept for older screens. New code should use
  /// [openGatewayCheckout], which verifies on the server and types failures.
  void newCheckout({
    required double amount,
    required String orderId,
    String? keyId,
    String? contact,
    required Function(String oid, String pid, String sig) onSuccess,
    required Function(String message) onFail,
  }) {
    if (_isPaymentAppLink(orderId) || orderId.startsWith(RegExp(r'https?://'))) {
      launchUrl(Uri.parse(orderId), mode: LaunchMode.externalApplication)
          .then((opened) {
        if (!opened) {
          onFail('Payment gateway could not be opened. Please try again.');
        }
      }).catchError((_) {
        onFail('Payment gateway could not be opened. Please try again.');
      });
      return;
    }

    final key =
        (keyId != null && keyId.isNotEmpty) ? keyId : AppConfig.razorpayKey;
    if (key.isEmpty) {
      onFail('Payment is not configured correctly. Please contact support.');
      return;
    }

    _razorpay.clear();

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS,
        (PaymentSuccessResponse response) {
      final paidOrderId = response.orderId ?? orderId;
      final paymentId = response.paymentId ?? '';
      final signature = response.signature ?? '';
      if (paidOrderId.isEmpty || paymentId.isEmpty || signature.isEmpty) {
        onFail(
            'Payment received but could not be confirmed yet. Please check payment history in a minute.');
        return;
      }
      onSuccess(paidOrderId, paymentId, signature);
    });

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR,
        (PaymentFailureResponse response) {
      onFail(response.code == Razorpay.PAYMENT_CANCELLED
          ? 'Payment cancelled.'
          : _failureMessage(response));
    });

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET,
        (ExternalWalletResponse response) {
      onFail(
          'This wallet is not supported. Please pay with UPI, card or net banking.');
    });

    _razorpay.open({
      'key': key,
      'amount': (amount * 100).round(),
      'currency': 'INR',
      'name': 'Khatu Pay',
      'order_id': orderId,
      'description': 'Khatu Pay payment',
      'prefill': {
        if (contact != null && contact.isNotEmpty) 'contact': contact,
      },
      'theme': {'color': _brandColor},
    });
  }

  Future<Map<String, dynamic>> verifyRazorpay(
      String orderId, String paymentId, String signature) async {
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
