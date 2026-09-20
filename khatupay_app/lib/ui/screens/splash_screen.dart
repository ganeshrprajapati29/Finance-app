import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth_storage.dart';
import '../../services/app_update_service.dart';
import '../../services/play_store_update_service.dart';
import 'update_required_page.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Animation<Offset> _slide;
  AppUpdatePolicy? _requiredUpdate;
  PlayStoreUpdateResult _playUpdate = PlayStoreUpdateResult.unavailable;
  bool _playPromptStarted = false;
  bool _bootCompleted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..forward();

    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    _scale = Tween<double>(begin: 0.84, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(
            CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

    _routeAfterBoot();
  }

  Future<void> _routeAfterBoot() async {
    final tokenFuture = AuthStorage.getAccessToken().timeout(
      const Duration(milliseconds: 900),
      onTimeout: () => null,
    );
    final policyFuture = AppUpdateService.check();
    final playUpdateFuture = PlayStoreUpdateService.check();
    await Future.delayed(const Duration(milliseconds: 650));
    final results = await Future.wait([
      tokenFuture,
      policyFuture,
      playUpdateFuture,
    ]);
    if (!mounted) return;
    final policy = results[1] as AppUpdatePolicy?;
    final playUpdate = results[2] as PlayStoreUpdateResult;
    if (playUpdate.updateAvailable) {
      final installedBuild = policy?.installedBuild ?? 1;
      setState(() {
        _playUpdate = playUpdate;
        _requiredUpdate = AppUpdatePolicy(
          latestVersion: policy?.latestVersion ?? '',
          latestBuild: playUpdate.availableBuild ??
              policy?.latestBuild ??
              installedBuild + 1,
          minimumSupportedBuild:
              playUpdate.availableBuild ?? installedBuild + 1,
          forceUpdate: true,
          message:
              'A new Khatu Pay version is available on Google Play. Update now to continue securely.',
          storeUrl: policy?.storeUrl ??
              'https://play.google.com/store/apps/details?id=com.finance.khatupay',
          installedBuild: installedBuild,
        );
        _bootCompleted = true;
      });
      if (playUpdate.immediateAllowed && !_playPromptStarted) {
        _playPromptStarted = true;
        WidgetsBinding.instance.addPostFrameCallback((_) => _startPlayUpdate());
      }
      return;
    }
    if (policy?.updateRequired == true) {
      setState(() {
        _requiredUpdate = policy;
        _bootCompleted = true;
      });
      return;
    }
    final token = results[0] as String?;
    _bootCompleted = true;
    context.go(token == null ? '/login' : '/');
  }

  Future<void> _checkUpdateAgain() async {
    final results = await Future.wait([
      AppUpdateService.check(),
      PlayStoreUpdateService.check(),
    ]);
    final policy = results[0] as AppUpdatePolicy?;
    final playUpdate = results[1] as PlayStoreUpdateResult;
    if (!mounted) return;
    if (playUpdate.updateAvailable) {
      setState(() => _playUpdate = playUpdate);
      return;
    }
    if (policy?.updateRequired == true) {
      setState(() => _requiredUpdate = policy);
      return;
    }
    final token = await AuthStorage.getAccessToken();
    if (mounted) context.go(token == null ? '/login' : '/');
  }

  Future<bool> _startPlayUpdate() async {
    if (!_playUpdate.immediateAllowed) return false;
    final completed = await PlayStoreUpdateService.startImmediateUpdate();
    if (completed && mounted) await _checkUpdateAgain();
    return completed;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _bootCompleted &&
        _requiredUpdate != null) {
      _checkUpdateAgain();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_requiredUpdate != null) {
      return UpdateRequiredPage(
        policy: _requiredUpdate!,
        onCheckAgain: _checkUpdateAgain,
        onUpdateRequested:
            _playUpdate.immediateAllowed ? _startPlayUpdate : null,
      );
    }
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            const Positioned(
              left: 28,
              top: 82,
              child: _ServiceWatermark(icon: Icons.phone_android_rounded),
            ),
            const Positioned(
              right: 28,
              top: 150,
              child: _ServiceWatermark(icon: Icons.receipt_long_rounded),
            ),
            const Positioned(
              left: 38,
              bottom: 154,
              child: _ServiceWatermark(icon: Icons.description_outlined),
            ),
            const Positioned(
              right: 36,
              bottom: 110,
              child: _ServiceWatermark(icon: Icons.qr_code_2_rounded),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                children: [
                  const Spacer(flex: 4),
                  FadeTransition(
                    opacity: _fade,
                    child: SlideTransition(
                      position: _slide,
                      child: Column(
                        children: [
                          ScaleTransition(
                            scale: _scale,
                            child: Container(
                              width: 124,
                              height: 124,
                              padding: const EdgeInsets.all(17),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(28),
                                border: Border.all(
                                  color: const Color(0xFFD8EEE9),
                                ),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x1A0F766E),
                                    blurRadius: 30,
                                    spreadRadius: 5,
                                    offset: Offset(0, 12),
                                  ),
                                ],
                              ),
                              child: Image.asset(
                                'assets/khatulogo-removebg-preview.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'KhatuPay',
                            style: TextStyle(
                              color: Color(0xFF172033),
                              fontSize: 34,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Payments. Credit. Business.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFF667085),
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0,
                            ),
                          ),
                          const SizedBox(height: 30),
                          const _LoadingState(),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(flex: 5),
                  FadeTransition(
                    opacity: _fade,
                    child: const _TrustLine(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: Color(0xFF0F766E),
            backgroundColor: Color(0xFFE1F2EE),
          ),
        ),
        SizedBox(height: 12),
        Text(
          'Starting securely',
          style: TextStyle(
            color: Color(0xFF667085),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _TrustLine extends StatelessWidget {
  const _TrustLine();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.verified_user_outlined, color: Color(0xFF0F766E), size: 15),
        SizedBox(width: 7),
        Flexible(
          child: Text(
            'Secure  •  Simple  •  Reliable',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF667085),
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
        ),
      ],
    );
  }
}

class _ServiceWatermark extends StatelessWidget {
  final IconData icon;

  const _ServiceWatermark({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFFF3FAF8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE3F2EF)),
      ),
      child: Icon(icon, color: const Color(0x3D0F766E), size: 25),
    );
  }
}
