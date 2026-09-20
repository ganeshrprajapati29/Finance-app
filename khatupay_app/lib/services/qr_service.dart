import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/config.dart';

class QRService {
  final Dio _dio = ApiClient.client;

  String imageUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http') || path.startsWith('data:image')) return path;
    final apiRoot = AppConfig.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$apiRoot$path';
  }

  String buildUpiUri({
    required String vpa,
    required String name,
    num? amount,
    String? note,
    String? transactionRef,
  }) {
    final params = <String, String>{
      'pa': vpa,
      'pn': name,
      'cu': 'INR',
    };
    if (amount != null && amount > 0) params['am'] = amount.toStringAsFixed(2);
    if (note != null && note.trim().isNotEmpty) params['tn'] = note.trim();
    if (transactionRef != null && transactionRef.trim().isNotEmpty) params['tr'] = transactionRef.trim();
    return Uri(scheme: 'upi', host: 'pay', queryParameters: params).toString();
  }

  Map<String, dynamic> _normalizeQr(Map<String, dynamic> data) {
    final payload = Map<String, dynamic>.from(data['payload'] ?? {});
    final vpa = (payload['pa'] ?? payload['merchantVpa'] ?? payload['vpa'] ?? data['vpa'] ?? '').toString();
    final name = (payload['pn'] ?? payload['merchantName'] ?? data['name'] ?? 'KhatuPay').toString();
    final note = (payload['tn'] ?? payload['note'] ?? data['note'] ?? 'KhatuPay payment').toString();
    final amountValue = payload['amount'] ?? data['amount'];
    final amount = amountValue is num ? amountValue : num.tryParse(amountValue?.toString() ?? '');
    final ref = (payload['qrId'] ?? data['id'] ?? data['_id'])?.toString();
    final uri = (data['uri'] ?? payload['uri'] ?? payload['qrString'])?.toString();

    data['imagePath'] = imageUrl(data['imagePath']?.toString());
    data['uri'] = (uri != null && uri.startsWith('upi://'))
        ? uri
        : buildUpiUri(vpa: vpa, name: name, amount: amount, note: note, transactionRef: ref);
    return data;
  }

  /// 🔹 Generate a new QR code for payment or transfer
  ///
  /// - [vpa] UPI ID
  /// - [name] Payee name
  /// - [amount] optional, can be null if user just wants static UPI QR
  /// - [note] optional message / purpose of payment
  ///
  /// Returns: `{ "id": "...", "imagePath": "...", "uri": "upi://pay?..." }`
  Future<Map<String, dynamic>> generate({
    required String vpa,
    required String name,
    num? amount,
    String? note,
  }) async {
    try {
      // Prepare request payload
      final data = <String, dynamic>{
        'vpa': vpa,
        'name': name,
      };
      if (amount != null) data['amount'] = amount;
      if (note != null && note.isNotEmpty) data['note'] = note;

      // Call backend API
      final response = await _dio.post('/qr', data: data);

      if (response.data == null ||
          response.data['data'] == null ||
          response.data['success'] == false ||
          response.data['ok'] == false) {
        throw 'Unexpected server response';
      }

      return _normalizeQr(Map<String, dynamic>.from(response.data['data']));
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to generate QR';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Fetch an existing QR by ID (optional helper)
  Future<Map<String, dynamic>> getMyQr() async {
    try {
      final response = await _dio.get('/qr/me');
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['success'] == false ||
          response.data['ok'] == false) {
        throw 'Invalid QR data';
      }
      return _normalizeQr(Map<String, dynamic>.from(response.data['data']));
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to load KhatuPay QR';
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getById(String id) async {
    try {
      final response = await _dio.get('/qr/$id');
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['success'] == false ||
          response.data['ok'] == false) {
        throw 'Invalid QR data';
      }
      return _normalizeQr(Map<String, dynamic>.from(response.data['data']));
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to fetch QR details';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Delete a QR (if allowed)
  Future<void> delete(String id) async {
    try {
      await _dio.delete('/qr/$id');
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to delete QR';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Get QR history for current user
  Future<List<Map<String, dynamic>>> getHistory() async {
    try {
      final response = await _dio.get('/qr/history');
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['success'] == false ||
          response.data['ok'] == false) {
        throw 'Invalid history data';
      }
      return (response.data['data'] as List)
          .map((item) {
            return _normalizeQr(Map<String, dynamic>.from(item));
          })
          .toList();
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to fetch QR history';
    } catch (e) {
      rethrow;
    }
  }
}
