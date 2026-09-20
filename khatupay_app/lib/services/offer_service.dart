import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/config.dart';

class OfferService {
  final Dio _dio = ApiClient.client;

  String imageUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http')) return path;
    final apiRoot = AppConfig.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$apiRoot$path';
  }

  Future<List<Map<String, dynamic>>> getOffers({
    String placement = 'ALL',
    String category = 'ALL',
    int limit = 30,
  }) async {
    final response = await _dio.get('/offers', queryParameters: {
      'placement': placement,
      'category': category,
      'limit': limit,
    });
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => _normalize(Map<String, dynamic>.from(item))).toList();
  }

  Future<Map<String, dynamic>> getOffer(String id) async {
    final response = await _dio.get('/offers/$id');
    return _normalize(Map<String, dynamic>.from(response.data['data'] ?? {}));
  }

  Map<String, dynamic> _normalize(Map<String, dynamic> offer) {
    offer['imageUrl'] = imageUrl(offer['imageUrl']?.toString());
    offer['thumbnailUrl'] = imageUrl(offer['thumbnailUrl']?.toString());
    return offer;
  }
}
