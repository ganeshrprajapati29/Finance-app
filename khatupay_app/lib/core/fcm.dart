import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'app_theme.dart';
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

  // A tapped notification can arrive before the user is signed in or unlocked
  // (cold start goes through splash/login). Its route waits here until then.
  static String? _pendingRoute;
  static bool _sessionReady = false;
  static bool _listening = false;

  static Future<void> init() async {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    // Listeners first: the permission prompt below can wait on the user for
    // a long time and taps must still be handled meanwhile.
    listenForeground();
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
    if (_listening) return;
    _listening = true;
    FirebaseMessaging.onMessage.listen(_showLocalNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_openMessage);
  }

  /// Call once the user is on the dashboard (after splash, login or unlock).
  /// Opens the screen of a notification tapped before that point.
  static void onSessionReady() {
    _sessionReady = true;
    final route = _pendingRoute;
    _pendingRoute = null;
    if (route != null && route != '/') _push(route);
  }

  static void onSessionEnded() {
    _sessionReady = false;
    _pendingRoute = null;
  }

  static Future<void> _initLocalNotifications() async {
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@drawable/ic_notification'),
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
    // iOS already shows foreground alerts via the presentation options set in
    // init(); a local copy would appear twice.
    if (!Platform.isAndroid) return;
    final title =
        message.notification?.title ?? message.data['title'] ?? 'KhatuPay';
    final body = message.notification?.body ??
        message.data['body'] ??
        'You have a new notification';

    await _localNotifications.show(
      (message.messageId ?? '${message.sentTime}$title').hashCode & 0x7fffffff,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _androidChannel.id,
          _androidChannel.name,
          channelDescription: _androidChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@drawable/ic_notification',
          color: KhatuColors.deepTeal,
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
    inboxRevision.value++;
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
        return '/payment-history';
      case 'kyc':
        return '/kyc';
      case 'business':
        return '/business';
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
    if (!_sessionReady) {
      _pendingRoute = target;
      return;
    }
    _push(target);
  }

  static void _push(String target) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (router.routerDelegate.currentConfiguration.uri.path == target) return;
      router.push(target);
    });
  }

  static bool _isAllowedRoute(String route) {
    final uri = Uri.tryParse(route);
    if (uri == null || uri.hasScheme || !route.startsWith('/')) return false;
    // Only screens that exist in app_router.dart and are safe to deep-link.
    const exact = {
      '/notifications',
      '/service-history',
      '/payment-history',
      '/payments',
      '/loans',
      '/kyc',
      '/offers',
      '/rewards',
      '/profile',
      '/settings',
      '/support',
      '/business',
      '/business/verification',
      '/business/transactions',
      '/business/settlements',
      '/business/qr',
    };
    return exact.contains(uri.path) ||
        RegExp(r'^/loan/[a-zA-Z0-9_-]+$').hasMatch(uri.path);
  }
}

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
