import 'package:dio/dio.dart';

import '../../core/api_client.dart';
import '../models/clubapi_bill.dart';
import '../models/clubapi_transaction.dart';
import '../models/service_catalog.dart';

/// A failed `/api/services` call, carrying the server's user-facing message
/// and, for validation failures, the message for each input field.
class ServiceApiException implements Exception {
  const ServiceApiException(this.message, {this.code = '', this.fieldErrors = const {}});

  final String message;
  final String code;
  final Map<String, String> fieldErrors;

  @override
  String toString() => message;
}

class ClubAPIService {
  final _dio = ApiClient.client;
  final Map<String, _CacheEntry> _cache = {};
  DateTime? _circuitOpenedAt;
  int _failureCount = 0;

  static const Duration _cacheTtl = Duration(minutes: 5);
  static const Duration _circuitCooldown = Duration(seconds: 20);
  static const int _circuitFailureLimit = 3;

  // Bill operations
  Future<ClubAPIBill> fetchBill({
    required String type,
    required String provider,
    required String accountRef,
    String? customerMobile,
    Map<String, String?> values = const {},
  }) async {
    final cacheKey =
        'bill_fetch_${type}_${provider}_${accountRef}_${customerMobile ?? ''}_${values.values.join('_')}';

    // Check cache first
    if (_isCacheValid(cacheKey)) {
      return _cache[cacheKey]!.data as ClubAPIBill;
    }

    return _executeWithCircuitBreaker(
      cacheKey,
      () async {
        try {
          final response = await _dio.post('/services/bills/fetch', data: {
            'service': type,
            'providerId': provider,
            'fields': {
              ..._optionalValues(values),
              'mobile': accountRef,
            },
            if (customerMobile != null && customerMobile.isNotEmpty)
              'customerMobile': customerMobile,
          });
          final body = response.data is Map
              ? Map<String, dynamic>.from(response.data)
              : <String, dynamic>{};
          final data = body['data'] is Map
              ? Map<String, dynamic>.from(body['data'])
              : body;
          final billJson = data['bill'] is Map
              ? Map<String, dynamic>.from(data['bill'])
              : data;
            billJson['urid'] = data['fetchId'] ?? billJson['urid'];
          return ClubAPIBill.fromJson(billJson);
        } on DioException catch (e) {
          throw Exception(_friendlyError(
            e,
            fallback:
                'Unable to fetch the bill. Please check the details and try again.',
          ));
        }
      },
    );
  }

  Future<ClubAPITransaction> payBill({
    required String billId,
    required double amount,
    required String operatorId,
    required String accountRef,
    String? customerMobile,
    Map<String, String?> values = const {},
  }) async {
    final response = await _dio.post('/clubapi/bill/pay', data: {
      'billId': billId,
      'amount': amount,
      'operatorId': operatorId,
      'accountRef': accountRef,
      'bbpsId': operatorId,
      'mobile': accountRef,
      if (customerMobile != null && customerMobile.isNotEmpty)
        'customerMobile': customerMobile,
      ..._optionalValues(values),
    });
    final data = response.data['data'];
    return ClubAPITransaction.fromJson(
        Map<String, dynamic>.from(data['transaction'] ?? data));
  }

  // Recharge operations
  Future<ClubAPITransaction> recharge({
    required String type, // 'mobile' or 'dth'
    required String operatorId,
    required String accountRef,
    required double amount,
    String? customerMobile,
    String? cbId,
    Map<String, String?> values = const {},
  }) async {
    final response = await _dio.post('/clubapi/recharge', data: {
      'type': type,
      'operatorId': operatorId,
      'accountRef': accountRef,
      'amount': amount,
      if (customerMobile != null && customerMobile.isNotEmpty)
        'customerMobile': customerMobile,
      if (cbId != null && cbId.isNotEmpty) 'cbId': cbId,
      ..._optionalValues(values),
    });
    final data = response.data['data'];
    return ClubAPITransaction.fromJson(
        Map<String, dynamic>.from(data['transaction'] ?? data));
  }

  // Transaction operations
  Future<ClubAPITransaction> getTransactionStatus(String urid) async {
    final response = await _dio.get('/clubapi/transaction/$urid/status');
    return ClubAPITransaction.fromJson(response.data['data']);
  }

  Future<List<ClubAPITransaction>> getTransactionHistory({
    int page = 1,
    int limit = 100,
    String? type,
    String? status,
    String? query,
  }) async {
    final response = await _dio.get('/clubapi/transactions', queryParameters: {
      'page': page,
      'limit': limit,
      if (type != null && type.isNotEmpty) 'type': type,
      if (status != null && status.isNotEmpty) 'status': status,
      if (query != null && query.isNotEmpty) 'q': query,
    });
    final data = response.data['data'];
    final rows = data is List ? data : (data['transactions'] ?? []);
    return (rows as List).map((e) => ClubAPITransaction.fromJson(e)).toList();
  }

  // Utility APIs
  Future<Map<String, dynamic>> getUtilityTransactionStatus(
      String urid, String orderId) async {
    final response = await _dio.post('/utility/transaction-status', data: {
      'urid': urid,
      'orderId': orderId,
    });
    return response.data['data'];
  }

  Future<Map<String, dynamic>> getBalance() async {
    final response = await _dio.get('/utility/balance');
    return response.data['data'];
  }

  Future<List<dynamic>> getOperatorList() async {
    try {
      final response = await _dio.get('/utility/operators');
      return _asList(response.data, preferredKeys: const [
        'operatorList',
        'operators',
        'list',
        'records',
        'data',
      ]);
    } on DioException catch (e) {
      throw Exception(_friendlyRechargeError(
        e,
        fallback: 'Operator list abhi load nahi ho payi. Please try again.',
      ));
    }
  }

  Future<Map<String, dynamic>> raiseDispute(String orderId) async {
    final response = await _dio.post('/utility/dispute', data: {
      'orderId': orderId,
    });
    return response.data['data'];
  }

  Future<List<dynamic>> getStateList() async {
    final response = await _dio.get('/utility/states');
    return response.data['data'];
  }

  Future<List<dynamic>> getOperatorPlans(String operatorId) async {
    try {
      final response = await _dio.get('/utility/operator-plans/$operatorId');
      return _asList(response.data, preferredKeys: const [
        'operatorPlan',
        'operatorPlans',
        'plans',
        'plan',
        'records',
        'list',
        'data',
      ]);
    } on DioException catch (e) {
      throw Exception(_friendlyRechargeError(
        e,
        fallback:
            'Recharge packs abhi load nahi ho paye. Aap amount manually enter karke continue kar sakte hain.',
      ));
    }
  }

  Future<List<dynamic>> getMobileDetails() async {
    try {
      final response = await _dio.get('/utility/mobile-details');
      return _asList(response.data, preferredKeys: const [
        'mobileDetails',
        'details',
        'records',
        'list',
        'data',
      ]);
    } on DioException catch (e) {
      throw Exception(_friendlyRechargeError(
        e,
        fallback:
            'Operator auto-detect abhi nahi ho paya. Please operator manually select karein.',
      ));
    }
  }

  List<dynamic> _asList(
    dynamic data, {
    List<String> preferredKeys = const [
      'data',
      'plans',
      'plan',
      'records',
      'list',
      'operatorPlan',
      'mobileDetails',
      'details',
    ],
  }) {
    if (data is List) return data;
    if (data is Map) {
      for (final key in preferredKeys) {
        final value = data[key];
        if (value is List) return value;
        if (value is Map) {
          final nested = _asList(value, preferredKeys: preferredKeys);
          if (nested.isNotEmpty) return nested;
        }
      }
      for (final value in data.values) {
        if (value is List) return value;
        if (value is Map) {
          final nested = _asList(value, preferredKeys: preferredKeys);
          if (nested.isNotEmpty) return nested;
        }
      }
      return [data];
    }
    return const [];
  }

  Future<Map<String, dynamic>> validateBankAccount({
    required String customerMobile,
    required String accountNumber,
    required String ifscCode,
    String? urid,
  }) async {
    final response = await _dio.post('/utility/validate-bank-account', data: {
      if (urid != null && urid.isNotEmpty) 'urid': urid,
      'customerMobile': customerMobile,
      'accountNumber': accountNumber,
      'ifscCode': ifscCode.toUpperCase(),
    });
    final data = Map<String, dynamic>.from(response.data['data']);
    final clubapi = data['clubapi'] is Map
        ? Map<String, dynamic>.from(data['clubapi'])
        : const <String, dynamic>{};
    final nested = clubapi['data'] is Map
        ? Map<String, dynamic>.from(clubapi['data'])
        : const <String, dynamic>{};
    final accountName = data['accountName'] ??
        data['beneficiaryName'] ??
        clubapi['beneficiaryName'] ??
        clubapi['accountName'] ??
        clubapi['name'] ??
        nested['beneficiaryName'] ??
        nested['accountName'] ??
        nested['name'] ??
        '';
    return {
      ...data,
      'accountName': accountName,
      'beneficiaryName': data['beneficiaryName'] ?? accountName,
      'resText': data['resText'] ??
          clubapi['resText'] ??
          clubapi['message'] ??
          nested['resText'] ??
          '',
    };
  }

  Future<Map<String, dynamic>> validateUpi(String upiId) async {
    final response =
        await _dio.post('/utility/validate-upi', data: {'upiId': upiId});
    final data = Map<String, dynamic>.from(response.data['data']);
    final clubapi = data['clubapi'] is Map
        ? Map<String, dynamic>.from(data['clubapi'])
        : const <String, dynamic>{};
    return {
      ...data,
      'accountName': data['accountName'] ??
          clubapi['name'] ??
          clubapi['accountName'] ??
          clubapi['upiName'] ??
          clubapi['beneName'] ??
          '',
      'resText':
          data['resText'] ?? clubapi['resText'] ?? clubapi['message'] ?? '',
    };
  }

  Future<Map<String, dynamic>> validateRechargeAmount({
    required String urid,
    required String mobile,
    required String operatorId,
    required String rechargeAmount,
    required String transType,
  }) async {
    final response =
        await _dio.post('/utility/validate-recharge-amount', data: {
      'urid': urid,
      'mobile': mobile,
      'operatorId': operatorId,
      'rechargeAmount': rechargeAmount,
      'transType': transType,
    });
    return response.data['data'];
  }

  Future<Map<String, dynamic>> sendAadhaarOtp({
    required String aadhaarNumber,
    String? aadhaarMobile,
  }) async {
    final response = await _dio.post('/utility/aadhaar/send-otp', data: {
      'aadhaarNumber': aadhaarNumber,
      if (aadhaarMobile != null && aadhaarMobile.isNotEmpty)
        'aadhaarMobile': aadhaarMobile,
    });
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> verifyAadhaarOtp({
    required String aadhaarNumber,
    required String otp,
    String? aadhaarMobile,
    String? otpSessionId,
    String? urid,
  }) async {
    final response = await _dio.post('/utility/aadhaar/verify-otp', data: {
      'aadhaarNumber': aadhaarNumber,
      'otp': otp,
      if (aadhaarMobile != null && aadhaarMobile.isNotEmpty)
        'aadhaarMobile': aadhaarMobile,
      if (otpSessionId != null && otpSessionId.isNotEmpty)
        'otpSessionId': otpSessionId,
      if (urid != null && urid.isNotEmpty) 'urid': urid,
    });
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> verifyPan(String pan) async {
    final response = await _dio.post('/utility/pan/verify', data: {'pan': pan});
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> fetchBbpsBill({
    required String mobile,
    required String bbpsId,
    required String customerMobile,
    Map<String, String?> values = const {},
  }) async {
    try {
      final response = await _dio.post('/utility/bbps/fetch-bill', data: {
        'mobile': mobile,
        'bbpsId': bbpsId,
        'customerMobile': customerMobile,
        ..._optionalValues(values),
      });
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw Exception(_friendlyError(
        e,
        fallback:
            'Unable to fetch the bill. Please check the details and try again.',
      ));
    }
  }

  Future<Map<String, dynamic>> payBbpsBill({
    required String mobile,
    required String bbpsId,
    required String customerMobile,
    required String amount,
    Map<String, String?> values = const {},
  }) async {
    final response = await _dio.post('/utility/bbps/pay-bill', data: {
      'mobile': mobile,
      'bbpsId': bbpsId,
      'customerMobile': customerMobile,
      'amount': amount,
      ..._optionalValues(values),
    });
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> payout({
    required String amount,
    required String outletMobile,
    required String bankAccountNumber,
    required String bankIfscCode,
    required String beneficiaryName,
    String? mobile,
  }) async {
    final response = await _dio.post('/utility/payout', data: {
      'amount': amount,
      'outletMobile': outletMobile,
      'bankAccountNumber': bankAccountNumber,
      'bankIfscCode': bankIfscCode.toUpperCase(),
      'beneficiaryName': beneficiaryName,
      if (mobile != null && mobile.isNotEmpty) 'mobile': mobile,
    });
    final data = Map<String, dynamic>.from(response.data['data']);
    final clubapi = data['clubapi'] is Map
        ? Map<String, dynamic>.from(data['clubapi'])
        : const <String, dynamic>{};
    final nested = clubapi['data'] is Map
        ? Map<String, dynamic>.from(clubapi['data'])
        : const <String, dynamic>{};
    return {
      ...data,
      'urid': data['urid'] ?? clubapi['urid'] ?? nested['urid'] ?? '',
      'orderId': data['orderId'] ??
          clubapi['orderId'] ??
          clubapi['order_id'] ??
          nested['orderId'] ??
          '',
      'status': data['status'] ?? clubapi['status'] ?? nested['status'] ?? '',
      'resText': data['resText'] ??
          clubapi['resText'] ??
          clubapi['message'] ??
          nested['resText'] ??
          '',
    };
  }

  Future<Map<String, dynamic>> registerOutlet({
    required String outletMobile,
    required String aadhaarNumber,
    required String pan,
    required String name,
    required String shopName,
    required String shopAddress,
    required String pincode,
    required String state,
    required String city,
    required String bankAccountNumber,
    required String bankIfscCode,
    required String latitude,
    required String longitude,
    String? mobile,
    String? email,
    Map<String, String?> extra = const {},
  }) async {
    final response = await _dio.post('/utility/outlet/register', data: {
      'outletMobile': outletMobile,
      'aadhaarNumber': aadhaarNumber,
      'pan': pan.toUpperCase(),
      'name': name,
      'shopName': shopName,
      'shopAddress': shopAddress,
      'pincode': pincode,
      'state': state,
      'city': city,
      'bankAccountNumber': bankAccountNumber,
      'bankIfscCode': bankIfscCode.toUpperCase(),
      'latitude': latitude,
      'longitude': longitude,
      if (mobile != null && mobile.isNotEmpty) 'mobile': mobile,
      if (email != null && email.isNotEmpty) 'email': email,
      ..._cleanValues(extra),
    });
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> verifyOutletOtp({
    required String outletMobile,
    required String otp,
    String? aadhaarNumber,
    String? mobile,
    String? otpSessionId,
    String? latitude,
    String? longitude,
  }) async {
    final response = await _dio.post('/utility/outlet/verify-otp', data: {
      'outletMobile': outletMobile,
      'otp': otp,
      if (aadhaarNumber != null && aadhaarNumber.isNotEmpty)
        'aadhaarNumber': aadhaarNumber,
      if (mobile != null && mobile.isNotEmpty) 'mobile': mobile,
      if (otpSessionId != null && otpSessionId.isNotEmpty)
        'otpSessionId': otpSessionId,
      if (latitude != null && latitude.isNotEmpty) 'latitude': latitude,
      if (longitude != null && longitude.isNotEmpty) 'longitude': longitude,
    });
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> getOutletStatus(String outletMobile) async {
    final response = await _dio.post('/utility/outlet/status', data: {
      'outletMobile': outletMobile,
    });
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> clubapiTransaction(
      Map<String, dynamic> payload) async {
    final response =
        await _dio.post('/utility/clubapi/transaction', data: payload);
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> clubapiUtility(
      Map<String, dynamic> payload) async {
    final response = await _dio.post('/utility/clubapi/utility', data: payload);
    return Map<String, dynamic>.from(response.data['data']);
  }

  /* ------------------------------------------- recharge & bill services */

  ServiceCatalog? _catalog;
  DateTime? _catalogLoadedAt;

  /// The five services with their operators / billers and input fields.
  /// Cached for two minutes so switching between service screens is instant.
  Future<ServiceCatalog> getServiceCatalog({bool refresh = false}) async {
    final loadedAt = _catalogLoadedAt;
    if (!refresh &&
        _catalog != null &&
        loadedAt != null &&
        DateTime.now().difference(loadedAt) < const Duration(minutes: 2)) {
      return _catalog!;
    }
    final data = await _serviceCall(() => _dio.get('/services/catalog'),
        fallback: 'Services could not be loaded. Please try again.');
    final catalog = ServiceCatalog.fromJson(data is Map ? Map<String, dynamic>.from(data) : const {});
    _catalog = catalog;
    _catalogLoadedAt = DateTime.now();
    return catalog;
  }

  /// Suggests the operator for a mobile number, or null when unknown.
  Future<MobileOperatorMatch?> detectMobileOperator(String number) async {
    try {
      final data = await _serviceCall(
        () => _dio.get('/services/mobile/operator', queryParameters: {'number': number}),
        fallback: '',
      );
      if (data is! Map) return null;
      final match = MobileOperatorMatch.fromJson(Map<String, dynamic>.from(data));
      return match.providerId.isEmpty ? null : match;
    } catch (_) {
      // Detection is only a convenience; the user can always pick manually.
      return null;
    }
  }

  Future<RechargePlans> getMobilePlans(String providerId, {String stateId = ''}) async {
    final data = await _serviceCall(
      () => _dio.get('/services/mobile/plans', queryParameters: {
        'providerId': providerId,
        if (stateId.isNotEmpty) 'stateId': stateId,
      }),
      fallback: 'Plans could not be loaded. You can still enter an amount.',
    );
    return RechargePlans.fromJson(data is Map ? Map<String, dynamic>.from(data) : const {});
  }

  /// Fetches a bill. The server stores it; pay with the returned fetchId.
  Future<FetchedBill> fetchServiceBill({
    required String service,
    required String providerId,
    required Map<String, String> fields,
    String? customerMobile,
  }) async {
    final data = await _serviceCall(
      () => _dio.post('/services/bills/fetch', data: {
        'service': service,
        'providerId': providerId,
        'fields': fields,
        if (customerMobile != null && customerMobile.isNotEmpty)
          'customerMobile': customerMobile,
      }),
      fallback: 'Bill could not be fetched. Please check the details and try again.',
    );
    final bill = FetchedBill.fromJson(data is Map ? Map<String, dynamic>.from(data) : const {});
    if (bill.fetchId.isEmpty) {
      throw const ServiceApiException('Bill could not be fetched. Please try again.');
    }
    return bill;
  }

  Future<ServiceTransaction> getServiceTransaction(String urid) async {
    final data = await _serviceCall(
      () => _dio.get('/services/transactions/${Uri.encodeComponent(urid)}'),
      fallback: 'Status could not be refreshed. Please try again.',
    );
    return ServiceTransaction.fromJson(data is Map ? Map<String, dynamic>.from(data) : const {});
  }

  Future<List<ServiceTransaction>> getServiceTransactions({String? service, int limit = 30}) async {
    final data = await _serviceCall(
      () => _dio.get('/services/transactions', queryParameters: {
        'limit': limit,
        if (service != null && service.isNotEmpty) 'service': service,
      }),
      fallback: 'Recent transactions could not be loaded.',
    );
    final rows = data is Map && data['transactions'] is List ? data['transactions'] as List : const [];
    return rows
        .whereType<Map>()
        .map((row) => ServiceTransaction.fromJson(Map<String, dynamic>.from(row)))
        .where((txn) => txn.urid.isNotEmpty)
        .toList();
  }

  /// Runs a services call and turns failures into [ServiceApiException] with
  /// the server's own message (never raw Dio text).
  Future<dynamic> _serviceCall(
    Future<Response<dynamic>> Function() request, {
    required String fallback,
  }) async {
    try {
      final response = await request();
      final body = response.data;
      return body is Map ? body['data'] : null;
    } on DioException catch (error) {
      final body = error.response?.data;
      final fieldErrors = <String, String>{};
      var message = '';
      var code = '';
      if (body is Map) {
        message = body['message']?.toString().trim() ?? '';
        code = body['code']?.toString() ?? '';
        final data = body['data'];
        if (data is Map && data['fieldErrors'] is Map) {
          (data['fieldErrors'] as Map).forEach((key, value) {
            fieldErrors[key.toString()] = value.toString();
          });
        }
      }
      if (message.isEmpty) {
        message = switch (error.type) {
          DioExceptionType.connectionTimeout ||
          DioExceptionType.receiveTimeout ||
          DioExceptionType.sendTimeout =>
            'The service is taking longer than usual. Please try again.',
          DioExceptionType.connectionError => 'Please check your internet connection and try again.',
          _ => fallback,
        };
      }
      throw ServiceApiException(message, code: code, fieldErrors: fieldErrors);
    }
  }

  Map<String, String> _optionalValues(Map<String, String?> values) {
    final result = <String, String>{};
    for (var index = 1; index <= 5; index++) {
      final value = values['opvalue$index'];
      if (value != null && value.isNotEmpty) result['opvalue$index'] = value;
    }
    return result;
  }

  Map<String, String> _cleanValues(Map<String, String?> values) {
    final result = <String, String>{};
    values.forEach((key, value) {
      if (value != null && value.isNotEmpty) result[key] = value;
    });
    return result;
  }

  String _friendlyError(DioException e, {required String fallback}) {
    final data = e.response?.data;
    if (data is Map) {
      for (final key in ['message', 'error', 'resText', 'code']) {
        final value = data[key];
        if (value != null && value.toString().trim().isNotEmpty) {
          return _cleanProviderMessage(value.toString());
        }
      }
      final nested = data['data'];
      if (nested is Map) {
        for (final key in ['message', 'error', 'resText', 'statusMessage']) {
          final value = nested[key];
          if (value != null && value.toString().trim().isNotEmpty) {
            return _cleanProviderMessage(value.toString());
          }
        }
      }
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'The bill service is responding slowly. Please try again in a moment.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Please check your internet connection and try again.';
    }
    return fallback;
  }

  String _cleanProviderMessage(String message) {
    final text = message.replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
    final lower = text.toLowerCase();
    if (lower.contains('invalid') ||
        lower.contains('not found') ||
        lower.contains('no bill') ||
        lower.contains('consumer') ||
        lower.contains('account') ||
        lower.contains('required')) {
      return 'The bill details do not match. Please check the biller and consumer/account number and try again.';
    }
    if (lower.contains('timeout') ||
        lower.contains('network') ||
        lower.contains('service unavailable')) {
      return 'The bill service is responding slowly. Please try again in a moment.';
    }
    return text.isEmpty ? 'Unable to fetch the bill. Please try again.' : text;
  }

  String _friendlyRechargeError(DioException e, {required String fallback}) {
    final data = e.response?.data;
    if (data is Map) {
      final nested = data['data'];
      for (final value in [
        data['message'],
        data['error'],
        data['resText'],
        nested is Map ? nested['message'] : null,
        nested is Map ? nested['resText'] : null,
        nested is Map ? nested['error'] : null,
      ]) {
        final text = value?.toString().trim() ?? '';
        if (text.isNotEmpty) {
          final cleaned = text.replaceFirst(RegExp(r'^Exception:\s*'), '');
          final lower = cleaned.toLowerCase();
          if (lower.contains('unauthorized') || lower.contains('token')) {
            return 'Session expired. Please login again.';
          }
          if (lower.contains('not found') ||
              lower.contains('invalid') ||
              lower.contains('no data')) {
            return fallback;
          }
          return cleaned;
        }
      }
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'Recharge service slow chal rahi hai. Please thodi der baad try karein.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Internet connection check karke dobara try karein.';
    }
    return fallback;
  }

  bool _isCacheValid(String key) {
    final entry = _cache[key];
    if (entry == null) return false;
    return DateTime.now().difference(entry.createdAt) < _cacheTtl;
  }

  Future<T> _executeWithCircuitBreaker<T>(
    String cacheKey,
    Future<T> Function() action,
  ) async {
    if (_circuitOpenedAt != null &&
        DateTime.now().difference(_circuitOpenedAt!) < _circuitCooldown) {
      final cached = _cache[cacheKey];
      if (cached != null) return cached.data as T;
      throw Exception(
          'Service temporarily unavailable. Please try again shortly.');
    }

    try {
      final data = await action();
      _failureCount = 0;
      _circuitOpenedAt = null;
      _cache[cacheKey] = _CacheEntry(data);
      return data;
    } catch (_) {
      _failureCount++;
      if (_failureCount >= _circuitFailureLimit) {
        _circuitOpenedAt = DateTime.now();
      }
      rethrow;
    }
  }
}

class _CacheEntry {
  final Object? data;
  final DateTime createdAt;

  _CacheEntry(this.data) : createdAt = DateTime.now();
}
