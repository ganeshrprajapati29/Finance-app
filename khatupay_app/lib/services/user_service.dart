import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/auth_storage.dart';
import '../models/user.dart';

class UserService {
  final Dio _dio = ApiClient.client;

  /// 🔹 Fetch logged-in user's profile
  Future<KPUser> me() async {
    try {
      final token = await AuthStorage.getAccessToken();
      final res = await _dio.get(
        '/users/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      final data = res.data['data'];
      return KPUser.fromJson(data);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to fetch profile';
    }
  }

  /// 🔹 Update profile info
  Future<void> updateMe({String? name, String? mobile}) async {
    try {
      final token = await AuthStorage.getAccessToken();
      await _dio.put(
        '/users/me',
        data: {'name': name, 'mobile': mobile},
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to update profile';
    }
  }

  /// 🔹 Upload KYC documents
  Future<void> uploadKyc(List<String> filePaths) async {
    try {
      final token = await AuthStorage.getAccessToken();
      final form = FormData();

      for (final path in filePaths) {
        form.files.add(MapEntry(
          'files',
          await MultipartFile.fromFile(path),
        ));
      }

      await _dio.post(
        '/kyc/me/docs',
        data: form,
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'multipart/form-data',
          },
        ),
      );
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'KYC upload failed';
    }
  }

  /// 🔹 Register FCM token (optional)
  Future<void> registerFcmToken(String token) async {
    try {
      final accessToken = await AuthStorage.getAccessToken();
      await _dio.put(
        '/users/me',
        data: {'fcmToken': token},
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
    } on DioException {
      // No need to throw, optional
    }
  }

  /// 🔹 Search loan by ID and mobile number
  Future<Map<String, dynamic>> searchLoanByIdAndMobile(String loanId, String mobile) async {
    try {
      final response = await _dio.post('/users/search-loan', data: {
        'loanId': loanId,
        'mobile': mobile,
      });
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['ok'] == false) {
        throw 'Loan not found';
      }
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to search loan';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Search loans by mobile number
  Future<List<Map<String, dynamic>>> searchLoansByMobile(String mobile) async {
    try {
      final response = await _dio.post('/users/search-loans', data: {
        'mobile': mobile,
      });
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['ok'] == false) {
        return [];
      }
      final data = response.data['data'];
      if (data is List) {
        return data.map((e) => Map<String, dynamic>.from(e)).toList();
      }
      return [];
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to search loans';
    } catch (e) {
      rethrow;
    }
  }
}
