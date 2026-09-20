import '../../core/api_client.dart';
import '../models/clubapi_bill.dart';
import '../models/clubapi_transaction.dart';

class ClubAPIService {
  final _dio = ApiClient.client;

  // Bill operations
  Future<ClubAPIBill> fetchBill({
    required String type,
    required String provider,
    required String accountRef,
  }) async {
    final response = await _dio.post('/clubapi/bill/fetch', data: {
      'type': type,
      'provider': provider,
      'accountRef': accountRef,
    });
    return ClubAPIBill.fromJson(response.data['data']);
  }

  Future<ClubAPITransaction> payBill({
    required String billId,
    required double amount,
    required String operatorId,
    required String accountRef,
  }) async {
    final response = await _dio.post('/clubapi/bill/pay', data: {
      'billId': billId,
      'amount': amount,
      'operatorId': operatorId,
      'accountRef': accountRef,
    });
    return ClubAPITransaction.fromJson(response.data['data']);
  }

  // Recharge operations
  Future<ClubAPITransaction> recharge({
    required String type, // 'mobile' or 'dth'
    required String operatorId,
    required String accountRef,
    required double amount,
    String? customerMobile,
  }) async {
    final response = await _dio.post('/clubapi/recharge', data: {
      'type': type,
      'operatorId': operatorId,
      'accountRef': accountRef,
      'amount': amount,
      'customerMobile': customerMobile,
    });
    return ClubAPITransaction.fromJson(response.data['data']);
  }

  // Transaction operations
  Future<ClubAPITransaction> getTransactionStatus(String urid) async {
    final response = await _dio.get('/clubapi/transaction/$urid/status');
    return ClubAPITransaction.fromJson(response.data['data']);
  }

  Future<List<ClubAPITransaction>> getTransactionHistory() async {
    final response = await _dio.get('/clubapi/transactions');
    return (response.data['data'] as List)
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
    return response.data['data'];
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
    required String urid,
    required String customerMobile,
    required String accountNumber,
    required String ifscCode,
  }) async {
    final response = await _dio.post('/utility/validate-bank-account', data: {
      'urid': urid,
      'customerMobile': customerMobile,
      'accountNumber': accountNumber,
      'ifscCode': ifscCode,
    });
    return response.data['data'];
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
}
