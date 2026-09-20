import 'package:dio/dio.dart';
import '../core/api_client.dart';

class QRStickerOrderService {
  final Dio _dio = ApiClient.client;

  Future<Map<String, dynamic>> getConfig() async {
    final response = await _dio.get('/qr-sticker-orders/config');
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<Map<String, dynamic>> createOrder({
    required String? qrCodeId,
    required String stickerType,
    required int quantity,
    required Map<String, dynamic> shippingAddress,
    String? userNote,
  }) async {
    final response = await _dio.post('/qr-sticker-orders', data: {
      'qrCodeId': qrCodeId,
      'stickerType': stickerType,
      'quantity': quantity,
      'shippingAddress': shippingAddress,
      'userNote': userNote,
    });
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<List<Map<String, dynamic>>> getOrders() async {
    final response = await _dio.get('/qr-sticker-orders');
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item)).toList();
  }

  Future<Map<String, dynamic>> getOrder(String id) async {
    final response = await _dio.get('/qr-sticker-orders/$id');
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<void> cancelOrder(String id) async {
    await _dio.put('/qr-sticker-orders/$id/cancel');
  }
}
