import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import 'config.dart';

class AuthStorage {
  // secure storage instance
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _kAccess = 'accessToken';
  static const String _kRefresh = 'refreshToken';

  /// ✅ Save tokens
  static Future<void> saveTokens(String access, String refresh) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  /// ✅ Get access token
  static Future<String?> getAccessToken() async {
    return await _storage.read(key: _kAccess);
  }

  /// ✅ Get refresh token
  static Future<String?> getRefreshToken() async {
    return await _storage.read(key: _kRefresh);
  }

  /// ✅ Refresh access token using refresh token
  static Future<String?> refreshAccessToken() async {
    try {
      final refresh = await getRefreshToken();
      if (refresh == null) return null;

      final dio = Dio(BaseOptions(baseUrl: AppConfig.baseUrl));
      final res = await dio.post('/auth/refresh', data: {'refreshToken': refresh});

      final newAccess = res.data['data']['accessToken'];
      if (newAccess != null) {
        await saveTokens(newAccess, refresh);
        return newAccess;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /// ✅ Clear tokens (logout)
  static Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }

  /// ✅ Helpers for quick access
  static Future<String?> get access async => await getAccessToken();
  static Future<String?> get refresh async => await getRefreshToken();
}
