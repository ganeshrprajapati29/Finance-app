import '../core/api_client.dart';
import '../models/faq.dart';

class FAQService {
  final _dio = ApiClient.client;
  Future<List<FAQ>> list() async {
    final r = await _dio.get('/faq');
    final body = r.data;
    final rows = body is Map && body['data'] is List ? body['data'] as List : const [];
    return rows
        .whereType<Map>()
        .map((e) => FAQ.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
