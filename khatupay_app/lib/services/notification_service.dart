import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config.dart';
import '../core/auth_storage.dart';

class NotificationService {
  static const String _baseUrl = AppConfig.baseUrl;

  static Future<List<Map<String, dynamic>>> getNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    final token = await AuthStorage.access;
    if (token == null) throw Exception('Not authenticated');

    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      'unreadOnly': unreadOnly.toString(),
    };

    final uri = Uri.parse('$_baseUrl/notifications').replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return List<Map<String, dynamic>>.from(data['data']['notifications']);
    } else {
      throw Exception('Failed to load notifications');
    }
  }

  static Future<int> getUnreadCount() async {
    final token = await AuthStorage.access;
    if (token == null) throw Exception('Not authenticated');

    final response = await http.get(
      Uri.parse('$_baseUrl/notifications/unread-count'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['data']['count'];
    } else {
      throw Exception('Failed to get unread count');
    }
  }

  static Future<void> markAsRead(String notificationId) async {
    final token = await AuthStorage.access;
    if (token == null) throw Exception('Not authenticated');

    final response = await http.put(
      Uri.parse('$_baseUrl/notifications/$notificationId/read'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to mark notification as read');
    }
  }

  static Future<void> markAllAsRead() async {
    final token = await AuthStorage.access;
    if (token == null) throw Exception('Not authenticated');

    final response = await http.put(
      Uri.parse('$_baseUrl/notifications/read-all'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to mark all notifications as read');
    }
  }

  static Future<void> deleteNotification(String notificationId) async {
    final token = await AuthStorage.access;
    if (token == null) throw Exception('Not authenticated');

    final response = await http.delete(
      Uri.parse('$_baseUrl/notifications/$notificationId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to delete notification');
    }
  }
}
