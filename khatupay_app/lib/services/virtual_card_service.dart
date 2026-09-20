import 'package:dio/dio.dart';
import '../core/api_client.dart';

class VirtualCardService {
  final Dio _dio = ApiClient.client;

  Future<List<Map<String, dynamic>>> myCards() async {
    final response = await _dio.get('/virtual-cards/mine');
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item)).toList();
  }

  Future<Map<String, dynamic>> apply({
    required String cardholderName,
    required String mobile,
    required String email,
    required String purpose,
    required double monthlyLimit,
    required List<String> allowedServices,
  }) async {
    try {
      final response = await _dio.post('/virtual-cards/apply', data: {
        'cardholderName': cardholderName,
        'mobile': mobile,
        'email': email,
        'purpose': purpose,
        'monthlyLimit': monthlyLimit,
        'allowedServices': allowedServices,
      });
      return Map<String, dynamic>.from(response.data['data'] ?? {});
    } on DioException catch (e) {
      throw _friendlyError(e, fallback: 'Virtual card application failed');
    }
  }

  Future<Map<String, dynamic>> getCard(String id) async {
    final response = await _dio.get('/virtual-cards/$id');
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<Map<String, dynamic>> updateStatus(String id, String action) async {
    try {
      final response = await _dio.put('/virtual-cards/$id/status', data: {'action': action});
      return Map<String, dynamic>.from(response.data['data'] ?? {});
    } on DioException catch (e) {
      throw _friendlyError(e, fallback: 'Virtual card status update failed');
    }
  }

  String _friendlyError(DioException e, {required String fallback}) {
    final data = e.response?.data;
    if (data is Map) {
      final message = data['message'] ?? data['error'] ?? data['code'];
      if (message != null && message.toString().trim().isNotEmpty) return message.toString();
    }
    return e.message ?? fallback;
  }
}
