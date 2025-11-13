import 'package:dio/dio.dart';
import 'config.dart';
import 'auth_storage.dart';

class ApiClient {
  static final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );

  static Dio get client {
    _dio.interceptors.clear();

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Skip adding auth header for refresh endpoint
          if (!options.path.contains('/auth/refresh')) {
            final token = await AuthStorage.getAccessToken();
            if (token != null) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
          return handler.next(options);
        },
        onError: (e, handler) async {
          // handle expired access token (401)
          if (e.response?.statusCode == 401) {
            final refresh = await AuthStorage.getRefreshToken();
            if (refresh != null) {
              try {
                final r = await _dio.post('/auth/refresh', data: {'refreshToken': refresh});
                final newAccess = r.data['data']['accessToken'] as String?;
                if (newAccess != null) {
                  await AuthStorage.saveTokens(newAccess, refresh);

                  // retry original request
                  final req = e.requestOptions;
                  req.headers['Authorization'] = 'Bearer $newAccess';
                  final retry = await _dio.fetch(req);
                  return handler.resolve(retry);
                }
              } catch (_) {
                await AuthStorage.clear();
              }
            }
          }
          return handler.next(e);
        },
      ),
    );

    return _dio;
  }
}
