import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/auth_storage.dart';
import '../models/user.dart';

class AuthService {
  final Dio _dio = ApiClient.client;

  /// 🔹 Register new user
  Future<void> register(
      String name, String email, String mobile, String password) async {
    try {
      await _dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'mobile': mobile,
        'password': password,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Registration failed';
    }
  }

  /// 🔹 Verify email via OTP
  Future<void> verifyEmail(String email, String otp) async {
    try {
      await _dio.post('/auth/verify-email', data: {
        'email': email,
        'otp': otp,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Email verification failed';
    }
  }

  /// 🔹 Login with email & password
  Future<KPUser> loginEmail(String email, String password) async {
    try {
      final res = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final data = res.data['data'];
      if (data == null) throw 'Invalid login response';

      // Save tokens for later requests
      await AuthStorage.saveTokens(
        data['accessToken'],
        data['refreshToken'],
      );

      // Return parsed user model
      return KPUser.fromJson(data['user']);
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Login failed';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Forgot password (send OTP)
  Future<void> forgot(String email) async {
    try {
      await _dio.post('/auth/forgot', data: {'email': email});
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to send reset email';
    }
  }

  /// 🔹 Reset password with OTP
  Future<void> reset(String email, String otp, String newPassword) async {
    try {
      await _dio.post('/auth/reset', data: {
        'email': email,
        'otp': otp,
        'newPassword': newPassword,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to reset password';
    }
  }

  /// 🔹 Logout and clear local tokens
  Future<void> logout() async {
    await AuthStorage.clear();
  }
}
