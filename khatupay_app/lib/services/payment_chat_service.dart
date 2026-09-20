import 'package:dio/dio.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api_client.dart';
import '../core/auth_storage.dart';
import '../core/config.dart';

class PaymentChatService {
  final Dio _dio = ApiClient.client;
  io.Socket? _socket;

  Future<Map<String, dynamic>> resolve(String query) async {
    final response = await _dio.get('/payment-chat/resolve', queryParameters: {'q': query});
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<List<Map<String, dynamic>>> threads() async {
    final response = await _dio.get('/payment-chat/threads');
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item)).toList();
  }

  Future<Map<String, dynamic>> startThread({String? mobile, String? upiId}) async {
    final response = await _dio.post('/payment-chat/threads', data: {
      'mobile': mobile,
      'upiId': upiId,
    });
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<Map<String, dynamic>> thread(String threadId) async {
    final response = await _dio.get('/payment-chat/threads/$threadId');
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<List<Map<String, dynamic>>> messages(String threadId) async {
    final response = await _dio.get('/payment-chat/threads/$threadId/messages');
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item)).toList();
  }

  Future<Map<String, dynamic>> sendMessage(String threadId, String text) async {
    final response = await _dio.post('/payment-chat/threads/$threadId/messages', data: {'text': text});
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<Map<String, dynamic>> createPaymentOrder(String threadId, double amount, String note) async {
    final response = await _dio.post('/payment-chat/threads/$threadId/payments/order', data: {
      'amount': amount,
      'note': note,
    });
    return Map<String, dynamic>.from(response.data['data'] ?? {});
  }

  Future<List<Map<String, dynamic>>> paymentHistory() async {
    final response = await _dio.get('/payment-chat/payments');
    final list = response.data['data'] as List? ?? [];
    return list.map((item) => Map<String, dynamic>.from(item)).toList();
  }

  Future<io.Socket> connect({
    required void Function(Map<String, dynamic>) onMessage,
    required void Function(Map<String, dynamic>) onPaymentUpdate,
  }) async {
    final token = await AuthStorage.getAccessToken();
    final root = AppConfig.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    _socket?.dispose();
    _socket = io.io(
      root,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );
    _socket!
      ..on('payment_chat:new_message', (data) {
        if (data is Map) onMessage(Map<String, dynamic>.from(data));
      })
      ..on('payment_chat:payment_updated', (data) {
        if (data is Map) onPaymentUpdate(Map<String, dynamic>.from(data));
      })
      ..connect();
    return _socket!;
  }

  void join(String threadId) {
    _socket?.emit('payment_chat:join', threadId);
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
  }
}
