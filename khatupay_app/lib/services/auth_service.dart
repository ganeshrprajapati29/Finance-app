import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/auth_storage.dart';
import '../models/user.dart';
import '../core/fcm.dart';
import 'notification_service.dart';

class AuthService {
  final Dio _dio = ApiClient.client;

  /// 🔹 Register new user (password is only ever used at signup; every
  /// login afterwards uses the 4-digit PIN created here)
  Future<void> register(String name, String email, String mobile,
      String password, String? mpin) async {
    try {
      await _dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'mobile': mobile,
        'password': password,
        if (mpin != null && mpin.isNotEmpty) 'mpin': mpin,
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

  Future<void> resendVerification(String email) async {
    try {
      await _dio.post('/auth/resend-verification', data: {'email': email});
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Unable to resend verification code';
    }
  }

  Future<void> forgotPassword(String email) async {
    try {
      await _dio.post('/auth/forgot', data: {'email': email});
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Unable to send verification code';
    }
  }

  Future<void> resetPassword(
      String email, String otp, String newPassword) async {
    try {
      await _dio.post('/auth/reset', data: {
        'email': email,
        'otp': otp,
        'newPassword': newPassword,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Unable to reset password';
    }
  }

  /// 🔹 Login with the 4-digit PIN — the only login method for regular users.
  Future<KPUser> loginPin(String identifier, String pin) async {
    return _login(identifier, mpin: pin);
  }

  Future<KPUser> loginPassword(String identifier, String password) async {
    return _login(identifier, password: password);
  }

  Future<KPUser> _login(String identifier,
      {String? mpin, String? password}) async {
    try {
      final isEmail = identifier.contains('@');
      final res = await _dio.post('/auth/login', data: {
        if (isEmail) 'email': identifier else 'mobile': identifier,
        if (mpin != null) 'mpin': mpin,
        if (password != null) 'password': password,
      });

      final data = res.data['data'];
      if (data == null) throw 'Invalid login response';

      await AuthStorage.saveTokens(data['accessToken'], data['refreshToken']);
      await AuthStorage.saveLastIdentifier(identifier);
      return KPUser.fromJson(data['user']);
    } on DioException catch (e) {
      final message = e.response?.data['message'];
      throw message ?? 'Login failed';
    } catch (e) {
      rethrow;
    }
  }

  /// 🔹 Forgot PIN (send OTP by email)
  Future<void> forgotPin(String identifier) async {
    try {
      final isEmail = identifier.contains('@');
      await _dio.post('/auth/forgot-pin', data: {
        if (isEmail) 'email': identifier else 'mobile': identifier,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to send OTP';
    }
  }

  /// 🔹 Reset PIN with OTP
  Future<void> resetPin(String email, String otp, String newPin) async {
    try {
      await _dio.post('/auth/reset-pin', data: {
        'email': email,
        'otp': otp,
        'newPin': newPin,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to reset PIN';
    }
  }

  /// 🔹 Change password (still used from Settings, independent of login)
  Future<void> changePassword(
      String currentPassword, String newPassword) async {
    try {
      await _dio.put('/auth/change-password', data: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to change password';
    }
  }

  /// 🔹 Change PIN from within Settings (requires current password)
  Future<void> setMpin(String currentPassword, String mpin) async {
    try {
      await _dio.put('/auth/set-mpin', data: {
        'currentPassword': currentPassword,
        'mpin': mpin,
      });
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Failed to update PIN';
    }
  }

  Future<void> logout() async {
    final token = await FCM.token();
    if (token != null && token.isNotEmpty) {
      try {
        await NotificationService.unregisterDevice(token);
      } catch (_) {}
    }
    await AuthStorage.clear();
  }

  Future<void> logoutAll() async {
    try {
      await _dio.post('/auth/logout-all');
    } on DioException catch (e) {
      throw e.response?.data['message'] ?? 'Unable to sign out all devices';
    }
    await AuthStorage.clear();
  }
}
