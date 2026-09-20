import 'dart:async';

import 'package:dio/dio.dart';

import 'auth_storage.dart';
import 'config.dart';

/// Shared Dio client with bearer-token injection and transparent access-token
/// refresh.
///
/// Two things this deliberately guards against:
///
/// 1. **Refresh recursion.** `/auth/refresh` is excluded from the 401 handler.
///    Without that, an expired *refresh* token makes the handler call
///    `/auth/refresh`, which 401s, which re-enters the handler, which calls
///    `/auth/refresh` again - unbounded recursion that never reaches the
///    `AuthStorage.clear()` fallback. Now an invalid refresh token clears the
///    session once and the original 401 surfaces to the caller.
///
/// 2. **Refresh stampede.** Several requests can 401 at the same moment (the
///    dashboard alone fires three). A single in-flight [Completer] is shared
///    so exactly one refresh call is made and every waiter retries with the
///    same new token.
class ApiClient {
  ApiClient._();

  /// Paths that must never carry an Authorization header or trigger a refresh.
  static const _authExemptPaths = [
    '/auth/refresh',
    '/auth/login',
    '/auth/register'
  ];

  static Future<String?>? _refreshInFlight;

  static final Dio _dio = _build();

  static Dio _build() {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 30),
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (!_isAuthExempt(options.path)) {
            final token = await AuthStorage.getAccessToken();
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          return handler.next(options);
        },
        onError: (e, handler) async {
          final path = e.requestOptions.path;

          final code = e.response?.data is Map
              ? e.response?.data['code']?.toString()
              : null;
          if (e.response?.statusCode == 403 && code == 'ACCOUNT_BLOCKED') {
            await AuthStorage.clear();
            return handler.next(e);
          }

          // Only an expired *access* token is recoverable here.
          if (e.response?.statusCode != 401 || _isAuthExempt(path)) {
            return handler.next(e);
          }

          // Never retry the same request twice - a 401 on the retry means the
          // freshly-minted token was rejected too, and looping would hammer
          // the API.
          if (e.requestOptions.extra['kp_retried'] == true) {
            return handler.next(e);
          }

          final newAccess = await _refreshAccessToken();
          if (newAccess == null || newAccess.isEmpty) {
            return handler.next(e);
          }

          try {
            final req = e.requestOptions
              ..headers['Authorization'] = 'Bearer $newAccess'
              ..extra['kp_retried'] = true;
            final retry = await _dio.fetch(req);
            return handler.resolve(retry);
          } catch (_) {
            // Surface the original failure, not the retry's, so the user sees
            // the error for what they actually asked for.
            return handler.next(e);
          }
        },
      ),
    );

    return dio;
  }

  static bool _isAuthExempt(String path) =>
      _authExemptPaths.any((exempt) => path.contains(exempt));

  /// Refreshes the access token, collapsing concurrent callers onto one
  /// request. Returns null when the session is no longer valid (in which case
  /// stored tokens have been cleared).
  static Future<String?> _refreshAccessToken() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  static Future<String?> _performRefresh() async {
    final refresh = await AuthStorage.getRefreshToken();
    if (refresh == null || refresh.isEmpty) return null;

    try {
      final r = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );

      // Defensive read: a malformed 2xx must not throw a null-subscript error
      // from inside an interceptor.
      final data = r.data is Map ? r.data['data'] : null;
      final newAccess = data is Map ? data['accessToken']?.toString() : null;

      if (newAccess == null || newAccess.isEmpty) {
        await AuthStorage.clear();
        return null;
      }

      await AuthStorage.saveTokens(newAccess, refresh);
      return newAccess;
    } on DioException catch (e) {
      // 401/403 means the refresh token itself is dead - end the session. A
      // network blip must NOT log the user out, so only auth failures clear.
      final status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        await AuthStorage.clear();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Dio get client => _dio;
}
