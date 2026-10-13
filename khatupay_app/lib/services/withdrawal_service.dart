import '../core/api_client.dart';
import '../models/withdrawal_request.dart';

class WithdrawalService {
  static Future<List<WithdrawalRequest>> getMyWithdrawals() async {
    final response = await ApiClient.client.get('/withdrawals');
    final body = response.data;
    final data = body is Map && body['data'] is List ? body['data'] as List : const [];
    return data
        .whereType<Map>()
        .map((e) => WithdrawalRequest.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<WithdrawalRequest> createWithdrawal({
    required num amount,
    required Map<String, dynamic> bankDetails,
  }) async {
    final response = await ApiClient.client.post('/withdrawals', data: {
      'amount': amount,
      'bankDetails': bankDetails,
    });
    final body = response.data;
    if (body is! Map || body['data'] is! Map) {
      throw 'Your withdrawal request could not be completed. Please try again.';
    }
    return WithdrawalRequest.fromJson(Map<String, dynamic>.from(body['data'] as Map));
  }
}
