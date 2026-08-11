
import '../../core/api_client.dart';
import '../models/clubapi_bill.dart';
import '../models/clubapi_transaction.dart';

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
    final cacheKey = 'bill_fetch_${type}_${provider}_${accountRef}_${customerMobile ?? ''}_${values.values.join('_')}';

    // Check cache first
    if (_isCacheValid(cacheKey)) {
      return _cache[cacheKey]!.data as ClubAPIBill;
    }

    return _executeWithCircuitBreaker(
      cacheKey,
      () async {
        final response = await _dio.post('/clubapi/bill/fetch', data: {
          'type': type,
          'provider': provider,
          'accountRef': accountRef,
          'bbpsId': provider,
          'mobile': accountRef,
          if (customerMobile != null && customerMobile.isNotEmpty) 'customerMobile': customerMobile,
          ..._optionalValues(values),
        });
        final data = response.data['data'];
        return ClubAPIBill.fromJson(Map<String, dynamic>.from(data['bill'] ?? data));
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
      if (customerMobile != null && customerMobile.isNotEmpty) 'customerMobile': customerMobile,
      ..._optionalValues(values),
    });
    final data = response.data['data'];
    return ClubAPITransaction.fromJson(Map<String, dynamic>.from(data['transaction'] ?? data));
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
      if (customerMobile != null && customerMobile.isNotEmpty) 'customerMobile': customerMobile,
      if (cbId != null && cbId.isNotEmpty) 'cbId': cbId,
      ..._optionalValues(values),
    });
    final data = response.data['data'];
    return ClubAPITransaction.fromJson(Map<String, dynamic>.from(data['transaction'] ?? data));
  }

  // Transaction operations
  Future<ClubAPITransaction> getTransactionStatus(String urid) async {
    final response = await _dio.get('/clubapi/transaction/$urid/status');
    return ClubAPITransaction.fromJson(response.data['data']);
  }

  Future<List<ClubAPITransaction>> getTransactionHistory() async {
    final response = await _dio.get('/clubapi/transactions');
    final data = response.data['data'];
    final rows = data is List ? data : (data['transactions'] ?? []);
    return (rows as List)
        .map((e) => ClubAPITransaction.fromJson(e))
        .toList();
  }

  // Utility APIs
  Future<Map<String, dynamic>> getUtilityTransactionStatus(String urid, String orderId) async {
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
    final response = await _dio.get('/utility/operators');
    final data = response.data['data'];
    if (data is List) return data;
    if (data is Map && data['operatorList'] is List) return data['operatorList'];
    if (response.data['operatorList'] is List) return response.data['operatorList'];
    return const [];
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
    final response = await _dio.get('/utility/operator-plans/$operatorId');
    return response.data['data'];
  }

  Future<List<dynamic>> getMobileDetails() async {
    final response = await _dio.get('/utility/mobile-details');
    return response.data['data'];
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
    final clubapi = data['clubapi'] is Map ? Map<String, dynamic>.from(data['clubapi']) : const <String, dynamic>{};
    final nested = clubapi['data'] is Map ? Map<String, dynamic>.from(clubapi['data']) : const <String, dynamic>{};
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
      'resText': data['resText'] ?? clubapi['resText'] ?? clubapi['message'] ?? nested['resText'] ?? '',
    };
  }

  Future<Map<String, dynamic>> validateUpi(String upiId) async {
    final response = await _dio.post('/utility/validate-upi', data: {'upiId': upiId});
    final data = Map<String, dynamic>.from(response.data['data']);
    final clubapi = data['clubapi'] is Map ? Map<String, dynamic>.from(data['clubapi']) : const <String, dynamic>{};
    return {
      ...data,
      'accountName': data['accountName'] ??
          clubapi['name'] ??
          clubapi['accountName'] ??
          clubapi['upiName'] ??
          clubapi['beneName'] ??
          '',
      'resText': data['resText'] ?? clubapi['resText'] ?? clubapi['message'] ?? '',
    };
  }

  Future<Map<String, dynamic>> validateRechargeAmount({
    required String urid,
    required String mobile,
    required String operatorId,
    required String rechargeAmount,
    required String transType,
  }) async {
    final response = await _dio.post('/utility/validate-recharge-amount', data: {
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
      if (aadhaarMobile != null && aadhaarMobile.isNotEmpty) 'aadhaarMobile': aadhaarMobile,
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
      if (aadhaarMobile != null && aadhaarMobile.isNotEmpty) 'aadhaarMobile': aadhaarMobile,
      if (otpSessionId != null && otpSessionId.isNotEmpty) 'otpSessionId': otpSessionId,
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
    final response = await _dio.post('/utility/bbps/fetch-bill', data: {
      'mobile': mobile,
      'bbpsId': bbpsId,
      'customerMobile': customerMobile,
      ..._optionalValues(values),
    });
    return Map<String, dynamic>.from(response.data['data']);
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
    final clubapi = data['clubapi'] is Map ? Map<String, dynamic>.from(data['clubapi']) : const <String, dynamic>{};
    final nested = clubapi['data'] is Map ? Map<String, dynamic>.from(clubapi['data']) : const <String, dynamic>{};
    return {
      ...data,
      'urid': data['urid'] ?? clubapi['urid'] ?? nested['urid'] ?? '',
      'orderId': data['orderId'] ?? clubapi['orderId'] ?? clubapi['order_id'] ?? nested['orderId'] ?? '',
      'status': data['status'] ?? clubapi['status'] ?? nested['status'] ?? '',
      'resText': data['resText'] ?? clubapi['resText'] ?? clubapi['message'] ?? nested['resText'] ?? '',
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
      if (aadhaarNumber != null && aadhaarNumber.isNotEmpty) 'aadhaarNumber': aadhaarNumber,
      if (mobile != null && mobile.isNotEmpty) 'mobile': mobile,
      if (otpSessionId != null && otpSessionId.isNotEmpty) 'otpSessionId': otpSessionId,
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

  Future<Map<String, dynamic>> clubapiTransaction(Map<String, dynamic> payload) async {
    final response = await _dio.post('/utility/clubapi/transaction', data: payload);
    return Map<String, dynamic>.from(response.data['data']);
  }

  Future<Map<String, dynamic>> clubapiUtility(Map<String, dynamic> payload) async {
    final response = await _dio.post('/utility/clubapi/utility', data: payload);
    return Map<String, dynamic>.from(response.data['data']);
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
      throw Exception('Service temporarily unavailable. Please try again shortly.');
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
