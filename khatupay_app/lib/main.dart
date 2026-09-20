import 'package:flutter/material.dart';
import 'package:flutter_easyloading/flutter_easyloading.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter/services.dart';
import 'core/app_navigation_history.dart';
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
      try {
        await FCM.init().timeout(const Duration(seconds: 5));
        FCM.listenForeground();
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

class _MyAppState extends ConsumerState<MyApp> {
  late SessionTimeoutService _sessionTimeoutService;
  late AppBackButtonDispatcher _backButtonDispatcher;
  String _lastLocation = '';

  @override
  void initState() {
    super.initState();
    _sessionTimeoutService = SessionTimeoutService(router);
    _backButtonDispatcher = AppBackButtonDispatcher();
    _lastLocation = router.routeInformationProvider.value.uri.toString();
    AppNavigationHistory.seed('/');
    router.routeInformationProvider.addListener(_trackRouteChange);
  }

  @override
  void dispose() {
    router.routeInformationProvider.removeListener(_trackRouteChange);
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

              debugShowCheckedModeBanner: false,
            ),
          );
        },
      ),
    );
  }
}

class AppBackButtonDispatcher extends RootBackButtonDispatcher {
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
    final current = router.routeInformationProvider.value.uri.toString();
    if (router.canPop()) {
      AppNavigationHistory.prepareForNativePop(current);
      router.pop();
      return true;
    }

    final path = Uri.tryParse(current)?.path ?? '/';
    if (path != '/') {
      AppNavigationHistory.goBack(router);
      return true;
    }

    final context = navigatorKey.currentContext;
    if (context == null) return true;
    final shouldExit = await _confirmExit(context);
    if (shouldExit) {
      await SystemNavigator.pop();
    }
    return true;
  }

  @override
  Future<bool> didPopRoute() => _handleBack();
}
