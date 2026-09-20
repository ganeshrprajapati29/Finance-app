import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'auth_service.dart';

class SessionTimeoutService {
  static const Duration _sessionTimeout = Duration(minutes: 30); // 30 minutes timeout
  static const Duration _warningTime = Duration(minutes: 5); // Show warning 5 minutes before timeout

  Timer? _sessionTimer;
  Timer? _warningTimer;
  bool _isWarningShown = false;

  final AuthService _authService = AuthService();
  final GoRouter _router;

  SessionTimeoutService(this._router) {
    _initializeSessionTimeout();
  }

  void _initializeSessionTimeout() {
    _resetSessionTimer();
  }

  void _resetSessionTimer() {
    _sessionTimer?.cancel();
    _warningTimer?.cancel();
    _isWarningShown = false;

    // Set warning timer (25 minutes from now)
    _warningTimer = Timer(_sessionTimeout - _warningTime, _showSessionWarning);

    // Set session timeout timer (30 minutes from now)
    _sessionTimer = Timer(_sessionTimeout, _handleSessionTimeout);
  }

  void _showSessionWarning() {
    if (_isWarningShown) return;
    _isWarningShown = true;

    // Show warning dialog
    showDialog(
      context: _router.routerDelegate.navigatorKey.currentContext!,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Session Timeout Warning'),
        content: const Text(
          'Your session will expire in 5 minutes due to inactivity. '
          'Please tap "Continue" to extend your session.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _extendSession();
            },
            child: const Text('Continue'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _handleSessionTimeout();
            },
            child: const Text('Logout Now'),
          ),
        ],
      ),
    );
  }

  void _extendSession() {
    _resetSessionTimer();
  }

  void _handleSessionTimeout() async {
    // Cancel timers
    _sessionTimer?.cancel();
    _warningTimer?.cancel();

    // Clear authentication data
    await _authService.logout();

    // Navigate to login page
    _router.go('/login');

    // Show timeout message
    if (_router.routerDelegate.navigatorKey.currentContext != null) {
      ScaffoldMessenger.of(_router.routerDelegate.navigatorKey.currentContext!)
          .showSnackBar(
        const SnackBar(
          content: Text('Session expired due to inactivity. Please login again.'),
          duration: Duration(seconds: 5),
        ),
      );
    }
  }

  // Call this method whenever user performs any action
  void onUserActivity() {
    _resetSessionTimer();
  }

  // Call this when user logs in
  void onLogin() {
    _resetSessionTimer();
  }

  // Call this when user logs out
  void onLogout() {
    _sessionTimer?.cancel();
    _warningTimer?.cancel();
  }

  // Get remaining session time in minutes
  int getRemainingMinutes() {
    if (_sessionTimer == null) return 0;
    return (_sessionTimer!.tick / 60).round();
  }

  // Check if session is about to expire
  bool get isSessionExpiringSoon => _isWarningShown;

  void dispose() {
    _sessionTimer?.cancel();
    _warningTimer?.cancel();
  }
}

// Provider for session timeout service
final sessionTimeoutProvider = Provider<SessionTimeoutService>((ref) {
  throw UnimplementedError('SessionTimeoutService must be initialized in main.dart');
});
