import '../core/api_client.dart';
import '../models/withdrawal_request.dart';

class WithdrawalService {
  static Future<List<WithdrawalRequest>> getMyWithdrawals() async {
    final response = await ApiClient.client.get('/withdrawals');
    final data = response.data['data'] as List;
    return data.map((e) => WithdrawalRequest.fromJson(e)).toList();
  }

  static Future<WithdrawalRequest> createWithdrawal({
    required num amount,
    required Map<String, dynamic> bankDetails,
  }) async {
    final response = await ApiClient.client.post('/withdrawals', data: {
      'amount': amount,
      'bankDetails': bankDetails,
    });
    return WithdrawalRequest.fromJson(response.data['data']);
  }
}
