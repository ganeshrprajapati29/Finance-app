import 'package:dio/dio.dart';
import '../core/api_client.dart';

class QRService {
  final Dio _dio = ApiClient.client;

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

      // Expect response like { ok: true, data: { id, imagePath, uri } }
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['ok'] == false) {
        throw 'Unexpected server response';
      }

      final qrData = Map<String, dynamic>.from(response.data['data']);
      return qrData;
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to generate QR';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Fetch an existing QR by ID (optional helper)
  Future<Map<String, dynamic>> getById(String id) async {
    try {
      final response = await _dio.get('/qr/$id');
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['ok'] == false) {
        throw 'Invalid QR data';
      }
      return Map<String, dynamic>.from(response.data['data']);
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
          response.data['ok'] == false) {
        throw 'Invalid history data';
      }
      return List<Map<String, dynamic>>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to fetch QR history';
    } catch (e) {
      rethrow;
    }
  }
}
