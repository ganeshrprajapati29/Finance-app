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
}
