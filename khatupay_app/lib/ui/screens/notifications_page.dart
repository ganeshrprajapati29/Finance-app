import 'package:flutter/material.dart';
import '../../routes/app_router.dart';
import '../../services/notification_service.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>> notifications = [];
  bool isLoading = true;
  bool isRefreshing = false;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final data = await NotificationService.getNotifications();
      setState(() {
        notifications = data;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load notifications: $e')),
      );
    }
  }

  Future<void> _refreshNotifications() async {
    setState(() {
      isRefreshing = true;
    });
    await _loadNotifications();
    setState(() {
      isRefreshing = false;
    });
  }

  Future<void> _markAsRead(String id) async {
    try {
      await NotificationService.markAsRead(id);
      setState(() {
        final index = notifications.indexWhere((n) => n['_id'] == id);
        if (index != -1) {
          notifications[index]['isRead'] = true;
        }
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to mark as read: $e')),
      );
    }
  }

  Future<void> _markAllAsRead() async {
    try {
      await NotificationService.markAllAsRead();
      setState(() {
        for (var notification in notifications) {
          notification['isRead'] = true;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notifications marked as read')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to mark all as read: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = notifications.where((n) => !(n['isRead'] ?? false)).length;

    return Scaffold(
      appBar: AppBar(
        title: Text('Notifications ${unreadCount > 0 ? '($unreadCount)' : ''}'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => router.go('/'),
        ),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: _markAllAsRead,
              child: const Text('Mark All Read', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : notifications.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none, size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text('No notifications', style: TextStyle(fontSize: 18, color: Colors.grey)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _refreshNotifications,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: notifications.length,
                    itemBuilder: (context, index) {
                      final notification = notifications[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        color: notification['isRead'] ?? false ? Colors.white : Colors.blue.shade50,
                        elevation: 2,
                        child: InkWell(
                          onTap: () => _markAsRead(notification['_id']),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 12,
                                  height: 12,
                                  margin: const EdgeInsets.only(top: 4, right: 12),
                                  decoration: BoxDecoration(
                                    color: _getColorForType(notification['type']),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              notification['title'] ?? '',
                                              style: TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 16,
                                                color: notification['isRead'] ?? false ? Colors.black : Colors.black87,
                                              ),
                                            ),
                                          ),
                                          if (!(notification['isRead'] ?? false))
                                            Container(
                                              width: 8,
                                              height: 8,
                                              decoration: const BoxDecoration(
                                                color: Colors.blue,
                                                shape: BoxShape.circle,
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        notification['message'] ?? '',
                                        style: TextStyle(
                                          color: Colors.grey.shade700,
                                          fontSize: 14,
                                          height: 1.4,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          Text(
                                            _formatTime(notification['createdAt']),
                                            style: TextStyle(
                                              color: Colors.grey.shade500,
                                              fontSize: 12,
                                            ),
                                          ),
                                          const Spacer(),
                                          _getActionButton(notification),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  Color _getColorForType(String? type) {
    switch (type) {
      case 'loan':
        return Colors.green;
      case 'payment':
        return Colors.orange;
      case 'kyc':
        return Colors.red;
      case 'info':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  Widget _getActionButton(Map<String, dynamic> notification) {
    switch (notification['type']) {
      case 'loan':
        return TextButton(
          onPressed: () => router.go('/loans'),
          child: const Text('View Loan'),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            textStyle: const TextStyle(fontSize: 12),
          ),
        );
      case 'payment':
        return TextButton(
          onPressed: () => router.go('/payments'),
          child: const Text('Pay Now'),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            textStyle: const TextStyle(fontSize: 12),
          ),
        );
      case 'kyc':
        return TextButton(
          onPressed: () => router.go('/profile'),
          child: const Text('Upload'),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            textStyle: const TextStyle(fontSize: 12),
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  String _formatTime(String? dateString) {
    if (dateString == null) return '';
    try {
      final date = DateTime.parse(dateString);
      final now = DateTime.now();
      final difference = now.difference(date);

      if (difference.inDays > 0) {
        return '${difference.inDays} day${difference.inDays > 1 ? 's' : ''} ago';
      } else if (difference.inHours > 0) {
        return '${difference.inHours} hour${difference.inHours > 1 ? 's' : ''} ago';
      } else if (difference.inMinutes > 0) {
        return '${difference.inMinutes} min${difference.inMinutes > 1 ? 's' : ''} ago';
      } else {
        return 'Just now';
      }
    } catch (e) {
      return '';
    }
  }
}
