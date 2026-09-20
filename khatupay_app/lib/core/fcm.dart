import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'auth_storage.dart';
import '../routes/app_router.dart';
import '../services/user_service.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class FCM {
  static final ValueNotifier<int> inboxRevision = ValueNotifier<int>(0);
  static final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _androidChannel =
      AndroidNotificationChannel(
    'khatupay_alerts',
    'KhatuPay Alerts',
    description: 'Payment, loan, KYC and account alerts',
    importance: Importance.high,
  );

  static Future<void> init() async {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    await _initLocalNotifications();

    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    await _messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    await registerCurrentDevice();
    _messaging.onTokenRefresh.listen(_saveToken, onError: (Object error) {
      if (kDebugMode) debugPrint('KhatuPay FCM token refresh skipped: $error');
    });
    try {
      await _messaging.subscribeToTopic('general');
    } catch (error) {
      if (kDebugMode)
        debugPrint('KhatuPay FCM topic subscribe skipped: $error');
    }

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _openMessage(initialMessage);
    }
  }

  static Future<String?> token() async {
    try {
      return await _messaging.getToken();
    } catch (error) {
      if (kDebugMode) debugPrint('KhatuPay FCM token unavailable: $error');
      return null;
    }
  }

  static Future<void> registerCurrentDevice() async {
    final currentToken = await token();
    if (kDebugMode) debugPrint('KhatuPay FCM token: $currentToken');
    await _saveToken(currentToken);
  }

  static void listenForeground() {
    FirebaseMessaging.onMessage.listen(_showLocalNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_openMessage);
  }

  static Future<void> _initLocalNotifications() async {
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (response) {
        _openRoute(response.payload);
      },
    );

    if (Platform.isAndroid) {
      final androidPlugin =
          _localNotifications.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(_androidChannel);
      await androidPlugin?.requestNotificationsPermission();
    }
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    inboxRevision.value++;
    final title =
        message.notification?.title ?? message.data['title'] ?? 'KhatuPay';
    final body = message.notification?.body ??
        message.data['body'] ??
        'You have a new notification';

    await _localNotifications.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
          playSound: true,
          enableVibration: true,
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: _routeForMessage(message),
    );
  }

  static Future<void> _saveToken(String? token) async {
    if (token == null || token.isEmpty) return;
    final accessToken = await AuthStorage.getAccessToken();
    if (accessToken == null || accessToken.isEmpty) return;
    await UserService().registerFcmToken(token);
  }

  static void _openMessage(RemoteMessage message) {
    _openRoute(_routeForMessage(message));
  }

  static String _routeForMessage(RemoteMessage message) {
    final data = message.data;
    final route = data['route']?.toString();
    if (route != null && _isAllowedRoute(route)) return route;

    switch (data['screen']?.toString()) {
      case 'loan':
        final id = data['loanId']?.toString();
        return id == null || id.isEmpty ? '/loans' : '/loan/$id';
      case 'payments':
      case 'payment':
        return '/payments';
      case 'kyc':
        return '/kyc';
      case 'support':
        return '/support';
      case 'offers':
        return '/offers';
      default:
        return '/notifications';
    }
  }

  static void _openRoute(String? route) {
    final target =
        route != null && _isAllowedRoute(route) ? route : '/notifications';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      router.go(target);
    });
  }

  static bool _isAllowedRoute(String route) {
    final uri = Uri.tryParse(route);
    if (uri == null || uri.hasScheme || !route.startsWith('/')) return false;
    const exact = {
      '/notifications',
      '/service-history',
      '/loans',
      '/kyc',
      '/settings',
      '/support',
      '/business',
      '/business/transactions',
      '/business/settlements',
      '/business/qr',
    };
    return exact.contains(uri.path) ||
        RegExp(r'^/loan/[a-zA-Z0-9_-]+$').hasMatch(uri.path);
  }
}

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
