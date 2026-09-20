import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/config.dart';

class RewardService {
  final Dio _dio = ApiClient.client;

  String imageUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http')) return path;
    final apiRoot = AppConfig.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$apiRoot$path';
  }

  Future<List<Map<String, dynamic>>> campaigns({String placement = 'REWARDS', String type = 'ALL'}) async {
    final response = await _dio.get('/rewards', queryParameters: {'placement': placement, 'type': type});
    final list = response.data['data'] as List? ?? [];
    return list.map((item) {
      final map = Map<String, dynamic>.from(item);
      map['imageUrl'] = imageUrl(map['imageUrl']?.toString());
      return map;
    }).toList();
  }

  Future<List<Map<String, dynamic>>> claims() async {
    final response = await _dio.get('/rewards/claims');
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item)).toList();
  }

  Future<Map<String, dynamic>> claim(String id, {String? couponCode, int? answerIndex}) async {
    try {
      final response = await _dio.post('/rewards/$id/claim', data: {
        if (couponCode != null) 'couponCode': couponCode,
        if (answerIndex != null) 'answerIndex': answerIndex,
      });
      return Map<String, dynamic>.from(response.data['data'] ?? {});
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) throw data['message'].toString();
      throw e.message ?? 'Reward claim failed';
    }
  }
}
