import 'dart:async';
import 'dart:collection';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/connectivity_service.dart';
import '../../services/biometric_service.dart';
import '../services/clubapi_service_updated.dart';
import '../models/clubapi_bill.dart';
import '../models/clubapi_transaction.dart';

// Service provider
final clubAPIServiceProvider = Provider((_) => ClubAPIService());

// Bill fetch state
final billFetchProvider = StateNotifierProvider<BillFetchNotifier, AsyncValue<ClubAPIBill?>>((ref) {
  return BillFetchNotifier(ref.read(clubAPIServiceProvider));
});

class BillFetchNotifier extends StateNotifier<AsyncValue<ClubAPIBill?>> {
  final ClubAPIService _service;

  BillFetchNotifier(this._service) : super(const AsyncValue.data(null));

  Future<void> fetchBill({
    required String type,
    required String provider,
    required String accountRef,
    String? customerMobile,
    Map<String, String?> values = const {},
  }) async {
    state = const AsyncValue.loading();
    try {
      final bill = await _service.fetchBill(
        type: type,
        provider: provider,
        accountRef: accountRef,
        customerMobile: customerMobile,
        values: values,
      );
      state = AsyncValue.data(bill);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  void clearBill() {
    state = const AsyncValue.data(null);
  }
}

// Transaction history provider
final transactionHistoryProvider = FutureProvider<List<ClubAPITransaction>>((ref) async {
  final service = ref.read(clubAPIServiceProvider);
  return service.getTransactionHistory();
});

// Recharge state
final rechargeProvider = StateNotifierProvider<RechargeNotifier, AsyncValue<ClubAPITransaction?>>((ref) {
  return RechargeNotifier(ref.read(clubAPIServiceProvider));
});

class RechargeNotifier extends StateNotifier<AsyncValue<ClubAPITransaction?>> {
  final ClubAPIService _service;

  RechargeNotifier(this._service) : super(const AsyncValue.data(null));

  Future<void> recharge({
    required String type,
    required String operatorId,
    required String accountRef,
    required double amount,
    String? customerMobile,
    String? cbId,
    Map<String, String?> values = const {},
  }) async {
    state = const AsyncValue.loading();
    try {
      final transaction = await _service.recharge(
        type: type,
        operatorId: operatorId,
        accountRef: accountRef,
        amount: amount,
        customerMobile: customerMobile,
        cbId: cbId,
        values: values,
      );
      state = AsyncValue.data(transaction);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  void clearTransaction() {
    state = const AsyncValue.data(null);
  }
}

// Bill payment state with retry logic and queue management
final billPayProvider = StateNotifierProvider<BillPayNotifier, AsyncValue<ClubAPITransaction?>>((ref) {
  return BillPayNotifier(ref.read(clubAPIServiceProvider));
});

class BillPayNotifier extends StateNotifier<AsyncValue<ClubAPITransaction?>> {
  final ClubAPIService _service;
  final Queue<_PaymentRequest> _paymentQueue = Queue<_PaymentRequest>();
  final Map<String, Timer> _retryTimers = {};
  final Map<String, int> _retryCounts = {};
  final Map<String, ClubAPITransaction> _cache = {};
  static const int _maxRetries = 3;
  static const Duration _retryDelay = Duration(seconds: 2);

  BillPayNotifier(this._service) : super(const AsyncValue.data(null));

  Future<void> payBill({
    required String billId,
    required double amount,
    required String operatorId,
    required String accountRef,
    String? customerMobile,
    Map<String, String?> values = const {},
  }) async {
    // Check connectivity first
    final connectivityService = ConnectivityService();
    if (!connectivityService.isConnected) {
      throw Exception('No internet connection. Please check your network and try again.');
    }

    // Authenticate user with biometrics for payment
    final biometricService = BiometricService();
    final isBiometricAvailable = await biometricService.isBiometricAvailable();
    if (isBiometricAvailable) {
      final authenticated = await biometricService.authenticateForPayment(
        amount: amount,
        description: 'bill payment',
      );
      if (!authenticated) {
        throw Exception('Biometric authentication failed. Payment cancelled.');
      }
    }

    final requestId = _generateRequestId();
    final request = _PaymentRequest(
      id: requestId,
      billId: billId,
      amount: amount,
      operatorId: operatorId,
      accountRef: accountRef,
      customerMobile: customerMobile,
      values: values,
    );

    _paymentQueue.add(request);
    await _processQueue();
  }

  Future<void> _processQueue() async {
    if (_paymentQueue.isEmpty || state.isLoading) return;

    final request = _paymentQueue.removeFirst();
    state = const AsyncValue.loading();

    try {
      // Check cache first
      if (_cache.containsKey(request.id)) {
        state = AsyncValue.data(_cache[request.id]);
        return;
      }

      final transaction = await _executeWithRetry(request);
      _cache[request.id] = transaction;
      state = AsyncValue.data(transaction);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      // Re-queue failed requests for manual retry
      if ((_retryCounts[request.id] ?? 0) < _maxRetries) {
        _paymentQueue.addFirst(request);
      }
    }
  }

  Future<ClubAPITransaction> _executeWithRetry(_PaymentRequest request) async {
    int retryCount = _retryCounts[request.id] ?? 0;

    while (retryCount < _maxRetries) {
      try {
        final transaction = await _service.payBill(
          billId: request.billId,
          amount: request.amount,
          operatorId: request.operatorId,
          accountRef: request.accountRef,
          customerMobile: request.customerMobile,
          values: request.values,
        );
        _retryCounts.remove(request.id);
        return transaction;
      } catch (e) {
        retryCount++;
        _retryCounts[request.id] = retryCount;

        if (retryCount < _maxRetries) {
          await Future.delayed(_retryDelay * retryCount);
        } else {
          rethrow;
        }
      }
    }

    throw Exception('Max retries exceeded for payment request ${request.id}');
  }

  void retryFailedPayment() {
    if (_paymentQueue.isNotEmpty) {
      _processQueue();
    }
  }

  void clearPayment() {
    state = const AsyncValue.data(null);
    _paymentQueue.clear();
    _retryTimers.forEach((key, timer) => timer.cancel());
    _retryTimers.clear();
    _retryCounts.clear();
  }

  String _generateRequestId() {
    return DateTime.now().millisecondsSinceEpoch.toString();
  }
}

class _PaymentRequest {
  final String id;
  final String billId;
  final double amount;
  final String operatorId;
  final String accountRef;
  final String? customerMobile;
  final Map<String, String?> values;

  _PaymentRequest({
    required this.id,
    required this.billId,
    required this.amount,
    required this.operatorId,
    required this.accountRef,
    this.customerMobile,
    this.values = const {},
  });
}
