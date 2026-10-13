import 'dart:async';

import 'package:flutter/material.dart';

import '../../../routes/app_router.dart';
import '../../../services/auth_service.dart';
import '../../widgets/auth_shell.dart';

class VerifyMobilePage extends StatefulWidget {
  const VerifyMobilePage({super.key, this.mobile});

  final String? mobile;

  @override
  State<VerifyMobilePage> createState() => _VerifyMobilePageState();
}

class _VerifyMobilePageState extends State<VerifyMobilePage> {
  final _otp = TextEditingController();
  bool _sending = false;
  bool _verifying = false;
  bool _verified = false;
  int _seconds = 0;
  Timer? _timer;
  String? _message;

  String get _mobile => (widget.mobile ?? '').replaceAll(RegExp(r'\D'), '');
  String get _masked => _mobile.length == 10
      ? '${_mobile.substring(0, 2)}******${_mobile.substring(8)}'
      : _mobile;

  @override
  void dispose() {
    _timer?.cancel();
    _otp.dispose();
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

  Future<void> _send() async {
    if (_sending || _seconds > 0) return;
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(_mobile)) {
      setState(
          () => _message = 'Please return and enter a valid mobile number.');
      return;
    }
    setState(() {
      _sending = true;
      _message = null;
    });
    try {
      await AuthService().sendMobileOtp(_mobile);
      if (!mounted) return;
      _otp.clear();
      _startTimer();
      setState(
          () => _message = 'A 6-digit code was sent to your mobile number.');
    } catch (error) {
      if (mounted) {
        setState(() => _message = friendlyAuthError(
              error,
              fallback: 'Unable to send the verification code right now.',
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
      await AuthService().verifyMobileOtp(_mobile, _otp.text);
      if (mounted) setState(() => _verified = true);
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

  @override
  Widget build(BuildContext context) {
    if (_verified) {
      return AuthShell(
        title: 'Mobile verified',
        subtitle: 'Your KhatuPay account is ready to use.',
        icon: Icons.verified_user_rounded,
        illustrationAsset: 'assets/auth/account_verified.png',
        compactIllustration: true,
        footerText: '',
        child: AuthPrimaryButton(
          label: 'Continue to login',
          icon: Icons.login_rounded,
          onPressed: () => router.go('/login'),
        ),
      );
    }

    return AuthShell(
      title: 'Verify mobile number',
      subtitle: 'We will send a secure code to +91 $_masked',
      icon: Icons.phone_android_rounded,
      illustrationAsset: 'assets/auth_secure_access.png',
      compactIllustration: true,
      showBack: true,
      footerText: 'Change mobile number',
      onFooterTap: () => router.pop(),
      child: Column(
        children: [
          if (_seconds == 0)
            AuthPrimaryButton(
              label: 'Send verification code',
              icon: Icons.sms_outlined,
              loading: _sending,
              onPressed: _send,
            )
          else ...[
            AuthOtpInput(controller: _otp, onCompleted: (_) => _verify()),
            const SizedBox(height: 12),
            AuthPrimaryButton(
              label: 'Verify mobile number',
              icon: Icons.verified_user_outlined,
              loading: _verifying,
              onPressed: _verify,
            ),
          ],
          if (_message != null) ...[
            const SizedBox(height: 12),
            AuthMessage(
              message: _message!,
              success: _message!.startsWith('A 6-digit'),
            ),
          ],
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: _seconds == 0 && !_sending ? _send : null,
            icon: const Icon(Icons.refresh_rounded),
            label: Text(
                _seconds == 0 ? 'Resend code' : 'Resend code in ${_seconds}s'),
          ),
        ],
      ),
    );
  }
}
