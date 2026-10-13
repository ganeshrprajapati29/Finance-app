import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/app_navigation_history.dart';
import '../../../core/fcm.dart';
import '../../../providers/auth_providers.dart';
import '../../../routes/app_router.dart';
import '../../widgets/auth_shell.dart';

class MobileOtpLoginPage extends ConsumerStatefulWidget {
  const MobileOtpLoginPage({super.key});

  @override
  ConsumerState<MobileOtpLoginPage> createState() => _MobileOtpLoginPageState();
}

class _MobileOtpLoginPageState extends ConsumerState<MobileOtpLoginPage> {
  final _mobile = TextEditingController();
  final _otp = TextEditingController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _mpin = TextEditingController();
  final _confirmMpin = TextEditingController();
  bool _sending = false;
  bool _verifying = false;
  bool _savingProfile = false;
  int _seconds = 0;
  Timer? _timer;
  String? _message;
  String? _onboardingToken;

  String? _normalizedIndianMobile(String value) {
    var digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('0091')) digits = digits.substring(4);
    if (digits.startsWith('91') && digits.length == 12)
      digits = digits.substring(2);
    return RegExp(r'^[6-9]\d{9}$').hasMatch(digits) ? digits : null;
  }

  @override
  void dispose() {
    _timer?.cancel();
    _mobile.dispose();
    _otp.dispose();
    _name.dispose();
    _email.dispose();
    _mpin.dispose();
    _confirmMpin.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _seconds = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_seconds <= 1) {
        timer.cancel();
        setState(() => _seconds = 0);
      } else {
        setState(() => _seconds--);
      }
    });
  }

  void _changeNumber() {
    _timer?.cancel();
    setState(() {
      _seconds = 0;
      _otp.clear();
      _message = null;
    });
  }

  Future<void> _send() async {
    final mobile = _normalizedIndianMobile(_mobile.text);
    if (_sending || _seconds > 0) return;
    if (mobile == null) {
      setState(
          () => _message = 'Enter your registered 10-digit mobile number.');
      return;
    }
    setState(() {
      _sending = true;
      _message = null;
    });
    try {
      await ref.read(authServiceProvider).startMobileAuthentication(mobile);
      if (!mounted) return;
      _otp.clear();
      _startTimer();
      setState(
          () => _message = 'A 6-digit code was sent to your mobile number.');
    } catch (error) {
      if (mounted) {
        setState(() => _message = friendlyAuthError(
              error,
              fallback: 'Unable to send a verification code right now.',
            ));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _verify() async {
    if (_verifying) return;
    if (_otp.text.length != 6) {
      setState(
          () => _message = 'Enter the complete 6-digit verification code.');
      return;
    }
    setState(() {
      _verifying = true;
      _message = null;
    });
    try {
      final result = await ref
          .read(authServiceProvider)
          .verifyMobileAuthentication(
              _normalizedIndianMobile(_mobile.text) ?? '', _otp.text);
      if (result.needsProfile) {
        if (mounted) {
          _timer?.cancel();
          setState(() {
            _onboardingToken = result.onboardingToken;
            _message = null;
          });
        }
        return;
      }
      FCM.registerCurrentDevice().catchError((_) {});
      ref.invalidate(meProvider);
      if (mounted) {
        AppNavigationHistory.reset('/');
        router.go('/');
        FCM.onSessionReady();
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _otp.clear();
          _message = friendlyAuthError(error,
              fallback: 'Incorrect or expired code. Please try again.');
        });
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _completeProfile() async {
    if (_savingProfile) return;
    final name = _name.text.trim();
    final email = _email.text.trim();
    final pin = _mpin.text.trim();
    if (name.length < 2) {
      setState(() => _message = 'Enter your full name to continue.');
      return;
    }
    if (email.isNotEmpty &&
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      setState(
          () => _message = 'Enter a valid email address or leave it empty.');
      return;
    }
    if (!RegExp(r'^\d{4}$').hasMatch(pin) || pin != _confirmMpin.text.trim()) {
      setState(() => _message = 'Enter and confirm the same 4-digit MPIN.');
      return;
    }
    if (const {'0000', '1111', '1234'}.contains(pin)) {
      setState(() => _message = 'Choose a stronger 4-digit MPIN.');
      return;
    }
    setState(() {
      _savingProfile = true;
      _message = null;
    });
    try {
      await ref.read(authServiceProvider).completeMobileProfile(
            onboardingToken: _onboardingToken!,
            name: name,
            email: email,
            mpin: pin,
          );
      FCM.registerCurrentDevice().catchError((_) {});
      ref.invalidate(meProvider);
      if (mounted) {
        AppNavigationHistory.reset('/');
        router.go('/');
        FCM.onSessionReady();
      }
    } catch (error) {
      if (mounted)
        setState(() => _message = friendlyAuthError(error,
            fallback:
                'Profile setup could not be completed. Please try again.'));
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthShell(
        title: _onboardingToken == null
            ? 'Continue with mobile number'
            : 'Set up your profile',
        subtitle: _onboardingToken == null
            ? 'Enter your mobile number. We will send a secure one-time code.'
            : 'Your mobile number is verified. Complete these details once.',
        icon: Icons.sms_outlined,
        illustrationAsset: 'assets/auth/auth_secure_access.png',
        compactIllustration: true,
        showBack: true,
        footerText: _onboardingToken == null
            ? 'Need help? Contact support'
            : 'Use a different mobile number',
        onFooterTap: _onboardingToken == null
            ? () => router.push('/support')
            : () => setState(() {
                  _onboardingToken = null;
                  _otp.clear();
                  _seconds = 0;
                }),
        child: _onboardingToken != null
            ? _profileFields()
            : Column(
                children: [
                  AuthTextField(
                    controller: _mobile,
                    label: 'Mobile number',
                    icon: Icons.phone_android_outlined,
                    keyboardType: TextInputType.phone,
                    maxLength: 12,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                  const SizedBox(height: 12),
                  if (_seconds > 0) ...[
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: _sending || _verifying ? null : _changeNumber,
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        label: const Text('Change number'),
                      ),
                    ),
                    AuthOtpInput(
                        controller: _otp, onCompleted: (_) => _verify()),
                    const SizedBox(height: 12),
                    AuthPrimaryButton(
                      label: 'Verify and sign in',
                      icon: Icons.verified_user_outlined,
                      loading: _verifying,
                      onPressed: _verify,
                    ),
                  ] else
                    AuthPrimaryButton(
                      label: 'Send verification code',
                      icon: Icons.sms_outlined,
                      loading: _sending,
                      onPressed: _send,
                    ),
                  if (_message != null) ...[
                    const SizedBox(height: 12),
                    AuthMessage(
                        message: _message!,
                        success: _message!.startsWith('A 6-digit')),
                  ],
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: _seconds == 0 && !_sending ? _send : null,
                    icon: const Icon(Icons.refresh_rounded),
                    label: Text(_seconds == 0
                        ? 'Resend code'
                        : 'Resend code in ${_seconds}s'),
                  ),
                ],
              ),
      );

  Widget _profileFields() => Column(children: [
        AuthTextField(
            controller: _name,
            label: 'Full name',
            icon: Icons.person_outline_rounded,
            textInputAction: TextInputAction.next),
        const SizedBox(height: 12),
        AuthTextField(
            controller: _email,
            label: 'Email address (optional)',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next),
        const SizedBox(height: 12),
        AuthTextField(
            controller: _mpin,
            label: 'Create 4-digit MPIN',
            icon: Icons.pin_outlined,
            obscure: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.next),
        const SizedBox(height: 12),
        AuthTextField(
            controller: _confirmMpin,
            label: 'Confirm MPIN',
            icon: Icons.verified_user_outlined,
            obscure: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly]),
        if (_message != null) ...[
          const SizedBox(height: 12),
          AuthMessage(message: _message!)
        ],
        const SizedBox(height: 16),
        AuthPrimaryButton(
            label: 'Create secure profile',
            icon: Icons.verified_user_outlined,
            loading: _savingProfile,
            onPressed: _completeProfile),
      ]);
}
