import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../core/auth_storage.dart';
import '../models/user.dart';
import '../core/fcm.dart';
import 'notification_service.dart';

class AuthService {
  final Dio _dio = ApiClient.client;

  String _dioMessage(DioException error, String fallback) {
    final body = error.response?.data;
    if (body is Map) {
      final message = body['message'] ?? body['error'];
      if (message != null && message.toString().trim().isNotEmpty) {
        return message.toString();
      }
    }
    return fallback;
  }

  String _indiaMobile(String value) {
    var digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('0091')) digits = digits.substring(4);
    if (digits.startsWith('91') && digits.length == 12)
      digits = digits.substring(2);
    return digits;
  }

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
      throw _dioMessage(e, 'Registration failed. Please try again.');
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
      throw _dioMessage(e, 'Email verification failed. Please try again.');
    }
  }

  Future<void> resendVerification(String email) async {
    try {
      await _dio.post('/auth/resend-verification', data: {'email': email});
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to resend the verification code.');
    }
  }

  Future<void> sendMobileOtp(String mobile) async {
    try {
      await _dio.post('/auth/mobile-otp/send',
          data: {'mobile': _indiaMobile(mobile)});
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to send a verification code right now.');
    }
  }

  Future<void> verifyMobileOtp(String mobile, String otp) async {
    try {
      await _dio.post('/auth/mobile-otp/verify', data: {
        'mobile': _indiaMobile(mobile),
        'otp': otp,
      });
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to verify this code. Please try again.');
    }
  }

  Future<void> requestMobileLoginOtp(String mobile) async {
    try {
      await _dio.post('/auth/login/mobile-otp/send',
          data: {'mobile': _indiaMobile(mobile)});
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to send a verification code right now.');
    }
  }

  Future<KPUser> loginWithMobileOtp(String mobile, String otp) async {
    try {
      final res = await _dio.post('/auth/login/mobile-otp/verify', data: {
        'mobile': _indiaMobile(mobile),
        'otp': otp,
      });
      final data = res.data['data'];
      if (data == null) throw 'Invalid login response';
      await AuthStorage.saveTokens(data['accessToken'], data['refreshToken']);
      await AuthStorage.saveLastIdentifier(mobile);
      final user = KPUser.fromJson(data['user']);
      await AuthStorage.saveDisplayName(user.name);
      await AuthStorage.setAppLockEnabled(true);
      return user;
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to verify this code. Please try again.');
    }
  }

  Future<void> startMobileAuthentication(String mobile) async {
    try {
      await _dio.post('/auth/mobile-auth/send',
          data: {'mobile': _indiaMobile(mobile)});
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to send a verification code right now.');
    }
  }

  Future<MobileAuthenticationResult> verifyMobileAuthentication(
      String mobile, String otp) async {
    try {
      final response = await _dio.post('/auth/mobile-auth/verify', data: {
        'mobile': _indiaMobile(mobile),
        'otp': otp,
      });
      return await _mobileAuthResult(response.data['data'], mobile);
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to verify this code. Please try again.');
    }
  }

  Future<KPUser> completeMobileProfile({
    required String onboardingToken,
    required String name,
    required String email,
    required String mpin,
  }) async {
    try {
      final response =
          await _dio.post('/auth/mobile-auth/complete-profile', data: {
        'onboardingToken': onboardingToken,
        'name': name,
        'email': email,
        'mpin': mpin,
        'termsAccepted': true,
      });
      final result = await _mobileAuthResult(response.data['data'], '');
      if (result.user == null) throw 'Profile setup could not be completed.';
      return result.user!;
    } on DioException catch (e) {
      throw _dioMessage(e, 'Profile setup could not be completed. Please try again.');
    }
  }

  Future<MobileAuthenticationResult> _mobileAuthResult(
      dynamic raw, String mobile) async {
    final data =
        raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    final next = (data['next'] ?? '').toString();
    if (next == 'PROFILE') {
      final token = (data['onboardingToken'] ?? '').toString();
      if (token.isEmpty) throw 'Profile setup could not be started.';
      return MobileAuthenticationResult.profile(token);
    }
    final access = (data['accessToken'] ?? '').toString();
    final refresh = (data['refreshToken'] ?? '').toString();
    if (access.isEmpty || refresh.isEmpty || data['user'] is! Map) {
      throw 'Invalid login response.';
    }
    final user = KPUser.fromJson(Map<String, dynamic>.from(data['user']));
    await AuthStorage.saveTokens(access, refresh);
    await AuthStorage.saveLastIdentifier(mobile.isEmpty ? user.mobile : mobile);
    await AuthStorage.saveDisplayName(user.name);
    await AuthStorage.setAppLockEnabled(true);
    return MobileAuthenticationResult.login(user);
  }

  Future<void> forgotPassword(String email) async {
    try {
      await _dio.post('/auth/forgot', data: {'email': email});
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to send a verification code right now.');
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
      throw _dioMessage(e, 'Unable to reset your password. Please try again.');
    }
  }

  Future<void> checkResetOtp(String email, String otp) async {
    try {
      await _dio.post('/auth/check-reset-otp', data: {
        'email': email,
        'otp': otp,
      });
    } on DioException catch (e) {
      throw _dioMessage(e, 'Incorrect OTP. Please try again.');
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
      final user = KPUser.fromJson(data['user']);
      await AuthStorage.saveDisplayName(user.name);
      await AuthStorage.setAppLockEnabled(true);
      return user;
    } on DioException catch (e) {
      throw _dioMessage(e, 'Login failed. Please try again.');
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
      throw _dioMessage(e, 'Unable to send a verification code right now.');
    }
  }

  /// 🔹 Reset PIN with OTP
  Future<void> resetPin(String identifier, String otp, String newPin) async {
    try {
      final isEmail = identifier.contains('@');
      await _dio.post('/auth/reset-pin', data: {
        if (isEmail) 'email': identifier else 'mobile': identifier,
        'otp': otp,
        'newPin': newPin,
      });
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to reset your MPIN. Please try again.');
    }
  }

  Future<void> checkPinOtp(String identifier, String otp) async {
    try {
      final isEmail = identifier.contains('@');
      await _dio.post('/auth/check-pin-otp', data: {
        if (isEmail) 'email': identifier else 'mobile': identifier,
        'otp': otp,
      });
    } on DioException catch (e) {
      throw _dioMessage(e, 'Incorrect OTP. Please try again.');
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
      throw _dioMessage(e, 'Unable to change your password. Please try again.');
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
      throw _dioMessage(e, 'Unable to update your MPIN. Please try again.');
    }
  }

  Future<void> logout() async {
    final token = await FCM.token();
    if (token != null && token.isNotEmpty) {
      try {
        await NotificationService.unregisterDevice(token);
      } catch (_) {}
    }
    FCM.onSessionEnded();
    await AuthStorage.clear();
  }

  Future<void> logoutAll() async {
    try {
      await _dio.post('/auth/logout-all');
    } on DioException catch (e) {
      throw _dioMessage(e, 'Unable to sign out on other devices. Please try again.');
    }
    FCM.onSessionEnded();
    await AuthStorage.clear();
  }
}

class MobileAuthenticationResult {
  const MobileAuthenticationResult._({this.user, this.onboardingToken});
  final KPUser? user;
  final String? onboardingToken;
  bool get needsProfile => onboardingToken != null;
  factory MobileAuthenticationResult.login(KPUser user) =>
      MobileAuthenticationResult._(user: user);
  factory MobileAuthenticationResult.profile(String onboardingToken) =>
      MobileAuthenticationResult._(onboardingToken: onboardingToken);
}
