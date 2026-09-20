import 'package:dio/dio.dart';

import '../core/api_client.dart';

class NotificationService {
  static Dio get _dio => ApiClient.client;

  static Future<List<Map<String, dynamic>>> getNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    final response = await _dio.get(
      '/notifications',
      queryParameters: {
        'page': page,
        'limit': limit,
        'unreadOnly': unreadOnly,
      },
    );

    final notifications = response.data['data']?['notifications'];
    if (notifications is List) {
      return notifications
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> getNotificationPage({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
    String category = 'all',
  }) async {
    final response = await _dio.get('/notifications', queryParameters: {
      'page': page,
      'limit': limit,
      'unreadOnly': unreadOnly,
      if (category != 'all') 'category': category,
    });
    final data = response.data['data'];
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  static Future<int> getUnreadCount() async {
    final response = await _dio.get('/notifications/unread-count');
    return response.data['data']?['count'] as int? ?? 0;
  }

  static Future<Map<String, dynamic>> getSummary() async {
    final response = await _dio.get('/notifications/summary');
    final data = response.data['data'];
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  static Future<Map<String, dynamic>> generateSmart(
      {bool dryRun = false}) async {
    final response = await _dio.post(
      '/notifications/generate-smart',
      data: {'dryRun': dryRun},
    );
    final data = response.data['data'];
    return data is Map ? Map<String, dynamic>.from(data) : {};
  }

  static Future<void> sendTestPush({String? fcmToken}) async {
    await _dio.post(
      '/notifications/test-push',
      data: {
        if (fcmToken != null && fcmToken.trim().isNotEmpty)
          'fcmToken': fcmToken.trim(),
      },
    );
  }

  static Future<void> markAsRead(String notificationId) async {
    await _dio.put('/notifications/$notificationId/read');
  }

  static Future<void> markAllAsRead() async {
    await _dio.put('/notifications/read-all');
  }

  static Future<void> markAsUnread(String notificationId) async {
    await _dio.put('/notifications/$notificationId/unread');
  }

  static Future<void> unregisterDevice(String token) async {
    await _dio.delete('/users/me/fcm-token', data: {'fcmToken': token});
  }

  static Future<void> deleteNotification(String notificationId) async {
    await _dio.delete('/notifications/$notificationId');
  }
}
