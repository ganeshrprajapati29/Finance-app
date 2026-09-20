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
  Future<void> updateMe({String? name, String? mobile, String? upiId}) async {
    try {
      final token = await AuthStorage.getAccessToken();
      final data = <String, dynamic>{};
      if (name != null) data['name'] = name;
      if (mobile != null) data['mobile'] = mobile;
      if (upiId != null) data['upiId'] = upiId;
      await _dio.put(
        '/users/me',
        data: data,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to update profile';
    }
  }

  /// 🔹 Upload KYC documents
  Future<void> uploadKyc({
    required List<String> filePaths,
    required String documentType,
    required String documentNumber,
  }) async {
    try {
      final token = await AuthStorage.getAccessToken();
      final form = FormData();
      form.fields.add(MapEntry('documentType', documentType));
      form.fields.add(MapEntry('documentNumber', documentNumber));

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

  Future<Map<String, dynamic>> sendAadhaarOtp({
    required String aadhaarNumber,
    String? aadhaarMobile,
  }) async {
    try {
      final response = await _dio.post('/kyc/me/aadhaar/send-otp', data: {
        'aadhaarNumber': aadhaarNumber,
        if (aadhaarMobile != null && aadhaarMobile.isNotEmpty) 'aadhaarMobile': aadhaarMobile,
      });
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Aadhaar OTP send failed';
    }
  }

  Future<Map<String, dynamic>> verifyAadhaarOtp({
    required String aadhaarNumber,
    required String otp,
    String? aadhaarMobile,
    String? otpSessionId,
    String? urid,
  }) async {
    try {
      final response = await _dio.post('/kyc/me/aadhaar/verify-otp', data: {
        'aadhaarNumber': aadhaarNumber,
        'otp': otp,
        if (aadhaarMobile != null && aadhaarMobile.isNotEmpty) 'aadhaarMobile': aadhaarMobile,
        if (otpSessionId != null && otpSessionId.isNotEmpty) 'otpSessionId': otpSessionId,
        if (urid != null && urid.isNotEmpty) 'urid': urid,
      });
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Aadhaar OTP verification failed';
    }
  }

  Future<Map<String, dynamic>> verifyPan(String pan) async {
    try {
      final response = await _dio.post('/kyc/me/pan/verify', data: {'pan': pan});
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'PAN verification failed';
    }
  }

  Future<Map<String, dynamic>> validateUpi(String upiId) async {
    try {
      final response = await _dio.post('/utility/validate-upi', data: {'upiId': upiId});
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'UPI validation failed';
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

  /// 🔹 Fetch this user's app settings (e.g. push notification preference)
  Future<Map<String, dynamic>> getSettings() async {
    try {
      final token = await AuthStorage.getAccessToken();
      final res = await _dio.get(
        '/users/me/settings',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      return Map<String, dynamic>.from(res.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to fetch settings';
    }
  }

  /// 🔹 Update this user's app settings
  Future<void> updateSettings({bool? notificationsEnabled}) async {
    try {
      final token = await AuthStorage.getAccessToken();
      final data = <String, dynamic>{};
      if (notificationsEnabled != null) data['notificationsEnabled'] = notificationsEnabled;
      await _dio.put(
        '/users/me/settings',
        data: data,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to update settings';
    }
  }

  Future<Map<String, dynamic>> resolveUpiByMobile(String mobile) async {
    try {
      final response = await _dio.post('/users/resolve-upi', data: {
        'mobile': mobile,
      });
      if (response.data == null ||
          response.data['data'] == null ||
          response.data['ok'] == false ||
          response.data['success'] == false) {
        throw 'Receiver not found';
      }
      return Map<String, dynamic>.from(response.data['data']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Unable to find receiver';
    } catch (e) {
      rethrow;
    }
  }
}
