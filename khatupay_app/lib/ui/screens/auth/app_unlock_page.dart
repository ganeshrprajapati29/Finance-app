import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth_storage.dart';
import '../../../core/app_navigation_history.dart';
import '../../../core/fcm.dart';
import '../../../providers/auth_providers.dart';
import '../../../routes/app_router.dart';
import '../../../services/biometric_service.dart';
import '../../widgets/auth_shell.dart';

class AppUnlockPage extends ConsumerStatefulWidget {
  const AppUnlockPage({super.key, this.returnTo});

  final String? returnTo;

  @override
  ConsumerState<AppUnlockPage> createState() => _AppUnlockPageState();
}

class _AppUnlockPageState extends ConsumerState<AppUnlockPage> {
  final _mpin = TextEditingController();
  String _name = 'there';
  String _identifier = '';
  bool _loading = false;
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  bool _biometricPrompted = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final values = await Future.wait([
      AuthStorage.getDisplayName(),
      AuthStorage.getLastIdentifier(),
      AuthStorage.isBiometricEnabled(),
      BiometricService().isBiometricAvailable(),
    ]);
    if (!mounted) return;
    setState(() {
      _name = (values[0] as String?)?.trim().isNotEmpty == true
          ? (values[0] as String).trim()
          : 'there';
      _identifier = (values[1] as String?)?.trim() ?? '';
      _biometricEnabled = values[2] as bool;
      _biometricAvailable = values[3] as bool;
    });

    if (_biometricEnabled && _biometricAvailable && !_biometricPrompted) {
      _biometricPrompted = true;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _unlockWithBiometrics());
    }
  }

  Future<void> _completeUnlock() async {
    FCM.registerCurrentDevice().catchError((_) {});
    ref.invalidate(meProvider);
    if (!mounted) return;
    final savedRoute = await AuthStorage.getResumeRoute();
    final target = _safeRoute(widget.returnTo) ?? _safeRoute(savedRoute) ?? '/';
    await AuthStorage.clearResumeRoute();
    AppNavigationHistory.reset(target);
    router.go(target);
    FCM.onSessionReady();
  }

  String? _safeRoute(String? value) {
    final route = value?.trim() ?? '';
    if (!route.startsWith('/') || route.startsWith('//')) return null;
    final path = Uri.tryParse(route)?.path ?? '';
    const blocked = {'/splash', '/login', '/unlock', '/forgot', '/forgot-pin'};
    return blocked.contains(path) ? null : route;
  }

  Future<void> _unlockWithBiometrics() async {
    if (_loading ||
        !_biometricEnabled ||
        !_biometricAvailable ||
        _identifier.isEmpty) {
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
    });
    final authenticated = await BiometricService().authenticate(
      reason: 'Unlock Khatu Pay securely',
      biometricOnly: true,
    );
    if (!mounted) return;

    if (authenticated) {
      await _completeUnlock();
      return;
    }

    setState(() {
      _loading = false;
      _message =
          'Biometric verification was not completed. Use your MPIN instead.';
    });
  }

  Future<void> _unlock() async {
    if (_loading || _mpin.text.length != 4 || _identifier.isEmpty) {
      setState(() => _message = 'Enter your 4-digit MPIN to continue.');
      return;
    }
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      await ref.read(authServiceProvider).loginPin(_identifier, _mpin.text);
      await _completeUnlock();
    } catch (error) {
      if (mounted) {
        setState(() => _message = friendlyAuthError(
          error,
          fallback: 'Unable to unlock KhatuPay. Please try again.',
        ));
      }
      _mpin.clear();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _useAnotherMobile() async {
    await AuthStorage.clear();
    if (mounted) {
      AppNavigationHistory.reset('/login');
      router.go('/login');
    }
  }

  @override
  void dispose() {
    _mpin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AuthShell(
        title: 'Hello, $_name',
        subtitle: _biometricEnabled && _biometricAvailable
            ? 'Use your device biometrics or MPIN to unlock securely.'
            : 'Enter your MPIN to unlock your account securely.',
        icon: Icons.lock_outline_rounded,
        illustrationAsset: 'assets/auth/auth_secure_access.png',
        compactIllustration: true,
        footerText: 'Use a different mobile number',
        onFooterTap: _loading ? null : _useAnotherMobile,
        child: Column(
          children: [
            if (_biometricEnabled && _biometricAvailable) ...[
              AuthPrimaryButton(
                label: 'Unlock with biometrics',
                loading: _loading,
                icon: Icons.fingerprint_rounded,
                onPressed: _unlockWithBiometrics,
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Text(
                  'or use your MPIN',
                  style: TextStyle(
                    color: kpAuthMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '4-digit MPIN',
                style: TextStyle(
                  color: kpAuthInk,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 10),
            AuthMpinInput(
              controller: _mpin,
              enabled: !_loading,
              onCompleted: (_) => _unlock(),
            ),
            if (_message != null) ...[
              AuthMessage(message: _message!),
              const SizedBox(height: 14),
            ],
            if (!_biometricEnabled || !_biometricAvailable)
              AuthPrimaryButton(
                label: 'Unlock KhatuPay',
                loading: _loading,
                icon: Icons.lock_open_rounded,
                onPressed: _unlock,
              )
            else
              OutlinedButton.icon(
                onPressed: _loading ? null : _unlock,
                icon: const Icon(Icons.lock_open_rounded),
                label: const Text('Unlock with MPIN'),
              ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: _loading ? null : () => router.push('/forgot-pin'),
              icon: const Icon(Icons.help_outline_rounded),
              label: const Text('Forgot MPIN?'),
            ),
          ],
        ),
      );
}
