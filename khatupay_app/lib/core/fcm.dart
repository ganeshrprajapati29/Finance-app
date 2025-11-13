import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import '../routes/app_router.dart';

// Background handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('📩 Background message received: ${message.messageId}');
  print('👉 Data: ${message.data}');
}

class FCM {
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  static Future<void> init() async {
    // Request permission
    NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    print('🔔 Notification permission: ${settings.authorizationStatus}');

    // Get FCM token
    String? token = await _messaging.getToken();
    print('🔥 FCM Token: $token');

    // Listen for background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Subscribe to a topic (optional)
    await _messaging.subscribeToTopic('general');
    print('📡 Subscribed to topic: general');
  }

  static Future<String?> token() async {
    return await _messaging.getToken();
  }

  static void listenForeground() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('📨 Foreground message: ${message.notification?.title}');
      print('👉 Body: ${message.notification?.body}');
      print('👉 Data: ${message.data}');

      // Show alert popup when in foreground
      if (Platform.isAndroid) {
        showDialog(
          context: navigatorKey.currentContext!,
          builder: (ctx) => AlertDialog(
            title: Text(message.notification?.title ?? 'Notification'),
            content: Text(message.notification?.body ?? ''),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  // Navigate to notifications page using router
                  router.go('/notifications');
                },
                child: const Text('View'),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    });

    // Handle when app is opened from notification
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('📱 App opened from notification: ${message.messageId}');
      router.go('/notifications');
    });
  }
}

// ✅ Global navigator key for showing notifications
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
