import '../core/api_client.dart';
import '../models/faq.dart';

class FAQService {
  final _dio = ApiClient.client;
  Future<List<FAQ>> list() async {
    final r = await _dio.get('/faq');
    return (r.data['data'] as List).map((e)=>FAQ.fromJson(e)).toList();
  }
}
