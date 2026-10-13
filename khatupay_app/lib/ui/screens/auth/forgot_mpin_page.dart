import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/auth_storage.dart';
import '../../../routes/app_router.dart';
import '../../../services/auth_service.dart';
import '../../widgets/auth_shell.dart';

class ForgotMpinPage extends StatefulWidget {
  const ForgotMpinPage({super.key});

  @override
  State<ForgotMpinPage> createState() => _ForgotMpinPageState();
}

class _ForgotMpinPageState extends State<ForgotMpinPage> {
  final _identifier = TextEditingController();
  final _otp = TextEditingController();
  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  int _step = 1;
  int _seconds = 0;
  bool _loading = false;
  String? _message;
  Timer? _timer;

  @override
  void initState() { super.initState(); _prefill(); }

  Future<void> _prefill() async {
    final value = await AuthStorage.getLastIdentifier();
    if (mounted && value != null) _identifier.text = value;
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _seconds = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _seconds <= 1) { timer.cancel(); if (mounted) setState(() => _seconds = 0); return; }
      setState(() => _seconds--);
    });
  }

  Future<void> _sendOtp() async {
    final value = _identifier.text.trim();
    if (value.isEmpty) { setState(() => _message = 'Enter your registered mobile number or email.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().forgotPin(value);
      _startTimer();
      if (mounted) setState(() { _otp.clear(); _step = 2; _message = 'A verification code has been sent to your registered email.'; });
    } catch (error) {
      if (mounted) setState(() => _message = friendlyAuthError(error, fallback: 'Unable to send a verification code.'));
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _continueOtp() async {
    if (_loading) return;
    if (_otp.text.length != 6) { setState(() => _message = 'Enter the complete 6-digit verification code.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().checkPinOtp(_identifier.text.trim(), _otp.text);
      if (mounted) setState(() { _step = 3; _message = null; });
    } catch (error) {
      if (mounted) { setState(() { _otp.clear(); _message = friendlyAuthError(error, fallback: 'Incorrect OTP. Please try again.'); }); }
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _reset() async {
    if (_pin.text.length != 4 || _pin.text != _confirm.text) { setState(() => _message = 'Enter and confirm the same 4-digit MPIN.'); return; }
    if (const {'0000', '1111', '1234'}.contains(_pin.text)) { setState(() => _message = 'Choose a stronger 4-digit MPIN.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().resetPin(_identifier.text.trim(), _otp.text, _pin.text);
      if (mounted) setState(() { _step = 4; });
    } catch (error) {
      if (mounted) setState(() { _step = 2; _message = friendlyAuthError(error, fallback: 'Unable to reset your MPIN. Please try again.'); });
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  void dispose() { _timer?.cancel(); _identifier.dispose(); _otp.dispose(); _pin.dispose(); _confirm.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (_step == 4) return AuthShell(title: 'MPIN updated', subtitle: 'Your new MPIN is ready to use.', icon: Icons.check_circle_rounded, illustrationAsset: 'assets/auth/account_verified.png', compactIllustration: true, footerText: '', child: AuthPrimaryButton(label: 'Back to unlock', icon: Icons.lock_open_rounded, onPressed: () => router.go('/unlock')));
    final title = _step == 1 ? 'Reset your MPIN' : _step == 2 ? 'Verify your identity' : 'Set a new MPIN';
    final subtitle = _step == 1 ? 'We will send a verification code to your registered email.' : _step == 2 ? 'Enter the 6-digit code sent to your registered email.' : 'Choose a secure 4-digit MPIN for app access.';
    return AuthShell(title: title, subtitle: subtitle, icon: Icons.pin_outlined, illustrationAsset: _step == 2 ? 'assets/auth/email_verification.png' : 'assets/auth/password_recovery.png', compactIllustration: true, showBack: true, footerText: 'Back to unlock', onFooterTap: () => router.go('/unlock'), child: Column(children: [
      if (_step == 1) AuthTextField(controller: _identifier, label: 'Mobile number or email', icon: Icons.person_outline_rounded, keyboardType: TextInputType.emailAddress, inputFormatters: [FilteringTextInputFormatter.deny(RegExp(r'\s'))]),
      if (_step == 2) ...[AuthOtpInput(controller: _otp, onCompleted: (_) => _continueOtp()), TextButton.icon(onPressed: _seconds == 0 && !_loading ? _sendOtp : null, icon: const Icon(Icons.refresh_rounded), label: Text(_seconds == 0 ? 'Resend code' : 'Resend code in ${_seconds}s'))],
      if (_step == 3) ...[AuthTextField(controller: _pin, label: 'New 4-digit MPIN', icon: Icons.pin_outlined, obscure: true, keyboardType: TextInputType.number, maxLength: 4, inputFormatters: [FilteringTextInputFormatter.digitsOnly]), const SizedBox(height: 12), AuthTextField(controller: _confirm, label: 'Confirm MPIN', icon: Icons.verified_user_outlined, obscure: true, keyboardType: TextInputType.number, maxLength: 4, inputFormatters: [FilteringTextInputFormatter.digitsOnly])],
      if (_message != null) ...[const SizedBox(height: 12), AuthMessage(message: _message!, success: _message!.contains('sent'))],
      const SizedBox(height: 16),
      AuthPrimaryButton(label: _step == 1 ? 'Send verification code' : _step == 2 ? 'Verify code' : 'Update MPIN', loading: _loading, onPressed: _step == 1 ? _sendOtp : _step == 2 ? _continueOtp : _reset),
    ]));
  }
}
