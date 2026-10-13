import 'package:flutter/material.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter/services.dart';
import 'core/app_navigation_history.dart';
import 'core/auth_storage.dart';
import 'core/app_theme.dart';
import 'core/fcm.dart';
import 'routes/app_router.dart';
import 'services/session_timeout_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Initialize Firebase Cloud Messaging (if using)
  // ✅ Configure EasyLoading
  EasyLoading.instance
    ..displayDuration = const Duration(milliseconds: 2000)
    ..indicatorType = EasyLoadingIndicatorType.fadingCircle
    ..loadingStyle = EasyLoadingStyle.custom
    ..indicatorSize = 45.0
    ..radius = 12.0
    ..progressColor = KhatuColors.teal
    ..backgroundColor = Colors.white
    ..indicatorColor = KhatuColors.teal
    ..textColor = KhatuColors.text
    ..maskColor = KhatuColors.ink.withValues(alpha: 0.12)
    ..userInteractions = true
    ..dismissOnTap = false;

  runApp(const ProviderScope(child: MyApp()));

  // ✅ Start listening for foreground messages after app is built
  WidgetsBinding.instance.addPostFrameCallback((_) {
    () async {
      // No timeout here: init() waits on the notification permission prompt,
      // and its listeners are registered before that wait.
      try {
        await FCM.init();
      } catch (e) {
        debugPrint('Firebase initialization skipped: $e');
      }
    }();
  });
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> with WidgetsBindingObserver {
  late SessionTimeoutService _sessionTimeoutService;
  late AppBackButtonDispatcher _backButtonDispatcher;
  String _lastLocation = '';
  DateTime? _backgroundedAt;
  bool _lockingOnResume = false;
  static const _backgroundLockDelay = Duration(minutes: 2);

  @override
  void initState() {
    super.initState();
    _sessionTimeoutService = SessionTimeoutService(router);
    _backButtonDispatcher = AppBackButtonDispatcher();
    _lastLocation = router.routeInformationProvider.value.uri.toString();
    AppNavigationHistory.seed(_lastLocation);
    router.routeInformationProvider.addListener(_trackRouteChange);
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    router.routeInformationProvider.removeListener(_trackRouteChange);
    WidgetsBinding.instance.removeObserver(this);
    _sessionTimeoutService.dispose();
    super.dispose();
  }

  void _trackRouteChange() {
    final location = router.routeInformationProvider.value.uri.toString();
    if (location == _lastLocation) return;
    AppNavigationHistory.record(location);
    _lastLocation = location;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _backgroundedAt ??= DateTime.now();
      _saveResumeRoute();
      return;
    }
    if (state == AppLifecycleState.resumed && _backgroundedAt != null) {
      final elapsed = DateTime.now().difference(_backgroundedAt!);
      _backgroundedAt = null;
      if (elapsed >= _backgroundLockDelay) _lockAfterBackground();
    }
  }

  Future<void> _saveResumeRoute() async {
    final route = router.routeInformationProvider.value.uri.toString();
    final path = Uri.tryParse(route)?.path ?? '';
    const blocked = {
      '/splash',
      '/login',
      '/unlock',
      '/forgot',
      '/forgot-pin',
      '/recharge-result',
    };
    if (route.startsWith('/') && !route.startsWith('//') && !blocked.contains(path)) {
      await AuthStorage.saveResumeRoute(route);
    }
  }

  Future<void> _lockAfterBackground() async {
    if (_lockingOnResume || !(await AuthStorage.isAppLockEnabled())) return;
    _lockingOnResume = true;
    try {
      final token = await AuthStorage.getAccessToken();
      final identifier = await AuthStorage.getLastIdentifier();
      final path = router.routeInformationProvider.value.uri.path;
      const unlockedRoutes = {
        '/splash',
        '/login',
        '/unlock',
        '/forgot',
        '/forgot-pin',
      };
      if (token != null &&
          identifier?.isNotEmpty == true &&
          !unlockedRoutes.contains(path)) {
        await _saveResumeRoute();
        final target = Uri(
          path: '/unlock',
          queryParameters: {'returnTo': path == '/' ? '/' : router.routeInformationProvider.value.uri.toString()},
        ).toString();
        AppNavigationHistory.reset(target);
        router.go(target);
      }
    } finally {
      _lockingOnResume = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Override the session timeout provider
    return ProviderScope(
      overrides: [
        sessionTimeoutProvider.overrideWithValue(_sessionTimeoutService),
      ],
      child: ScreenUtilInit(
        designSize: const Size(375, 812), // iPhone X size as base
        minTextAdapt: true,
        splitScreenMode: true,
        builder: (context, child) {
          return GestureDetector(
            onTap: () => _sessionTimeoutService.onUserActivity(),
            onPanDown: (_) => _sessionTimeoutService.onUserActivity(),
            onScaleStart: (_) => _sessionTimeoutService.onUserActivity(),
            behavior: HitTestBehavior.translucent,
            child: MaterialApp.router(
              title: 'Khatu Pay',

              // ✅ Apply website theme globally with modern styling
              theme: AppTheme.light(),

              // ✅ Route setup
              routerDelegate: router.routerDelegate,
              routeInformationParser: router.routeInformationParser,
              routeInformationProvider: router.routeInformationProvider,
              backButtonDispatcher: _backButtonDispatcher,

              // Some Android devices dispatch the system navigation key before
              // GoRouter's stack has settled after a `go()` navigation. Keep
              // that event inside the app and route it through our history.
              builder: (context, child) => PopScope<Object?>(
                canPop: false,
                onPopInvokedWithResult: (didPop, _) {
                  if (!didPop) {
                    _backButtonDispatcher.handleSystemBack();
                  }
                },
                child: child ?? const SizedBox.shrink(),
              ),

              debugShowCheckedModeBanner: false,
            ),
          );
        },
      ),
    );
  }
}

class AppBackButtonDispatcher extends RootBackButtonDispatcher {
  bool _handlingBack = false;

  Future<void> handleSystemBack() async {
    await _handleBack();
  }

  Future<bool> _confirmExit(BuildContext context) async {
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Exit KhatuPay?'),
        content: const Text('Do you want to close the app?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Exit'),
          ),
        ],
      ),
    );
    return shouldExit == true;
  }

  Future<bool> _handleBack() async {
    if (_handlingBack) return true;
    _handlingBack = true;
    try {
      final current = router.routeInformationProvider.value.uri.toString();
      final path = Uri.tryParse(current)?.path ?? '/';
      const authRoots = {'/login', '/unlock'};
      if (path != '/' && !authRoots.contains(path)) {
        AppNavigationHistory.goBack(router);
        return true;
      }

      // Dashboard and auth roots need explicit confirmation before Android
      // closes the task. Every other page is routed to its prior screen.
      if (path == '/') {
        final context = navigatorKey.currentContext;
        if (context == null) return true;
        final shouldExit = await _confirmExit(context);
        if (shouldExit) await SystemNavigator.pop();
        return true;
      }

      final context = navigatorKey.currentContext;
      if (context == null) return true;
      final shouldExit = await _confirmExit(context);
      if (shouldExit) {
        await SystemNavigator.pop();
      }
      return true;
    } finally {
      _handlingBack = false;
    }
  }

  @override
  Future<bool> didPopRoute() => _handleBack();
}
