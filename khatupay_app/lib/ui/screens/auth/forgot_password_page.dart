import 'dart:async';
import 'package:flutter/material.dart';
import '../../../routes/app_router.dart';
import '../../../services/auth_service.dart';
import '../../widgets/auth_shell.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}
class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _email = TextEditingController(), _otp = TextEditingController(), _password = TextEditingController(), _confirm = TextEditingController();
  int _stage = 1, _seconds = 0;
  bool _loading = false;
  String? _message;
  Timer? _timer;
  bool get _strong => _password.text.length >= 8 && RegExp('[A-Za-z]').hasMatch(_password.text) && RegExp('[0-9]').hasMatch(_password.text);
  @override
  void initState() { super.initState(); _password.addListener(() => setState(() {})); }
  void _countdown() {
    _timer?.cancel(); _seconds = 30;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_seconds <= 1) { timer.cancel(); setState(() => _seconds = 0); } else { setState(() => _seconds--); }
    });
  }
  @override
  void dispose() { _timer?.cancel(); _email.dispose(); _otp.dispose(); _password.dispose(); _confirm.dispose(); super.dispose(); }
  Future<void> _send() async {
    if (_loading || !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(_email.text.trim())) { setState(() => _message = 'Enter a valid registered email address.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().forgotPassword(_email.text.trim().toLowerCase());
      if (mounted) { _countdown(); setState(() { _stage = 2; _message = 'If an account exists for this email, a verification code has been sent.'; }); }
    } catch (error) {
      if (mounted) setState(() => _message = friendlyAuthError(error, fallback: 'Unable to send a code right now. Please try again.'));
    } finally { if (mounted) setState(() => _loading = false); }
  }
  void _continueOtp() {
    if (_otp.text.length != 6) { setState(() => _message = 'Enter the complete 6-digit verification code.'); return; }
    setState(() { _stage = 3; _message = null; });
  }
  Future<void> _reset() async {
    if (_loading) return;
    if (!_strong) { setState(() => _message = 'Use at least 8 characters with a letter and number.'); return; }
    if (_confirm.text != _password.text) { setState(() => _message = 'Passwords do not match.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().resetPassword(_email.text.trim().toLowerCase(), _otp.text, _password.text);
      if (mounted) setState(() => _stage = 4);
    } catch (error) {
      if (mounted) { setState(() { _stage = 2; _message = friendlyAuthError(error, fallback: 'Unable to update the password. Check the code and try again.'); }); }
    } finally { if (mounted) setState(() => _loading = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (_stage == 4) {
      return AuthShell(title: 'Password updated', subtitle: 'Your password has been updated securely.', icon: Icons.check_circle_rounded, illustrationAsset: 'assets/auth/account_verified.png', compactIllustration: true, footerText: '', child: AuthPrimaryButton(label: 'Back to login', icon: Icons.login_rounded, onPressed: () => router.go('/login')));
    }
    final title = _stage == 1 ? 'Reset your password' : _stage == 2 ? 'Verify your email' : 'Create a new password';
    final subtitle = _stage == 1 ? 'We will send a secure verification code to your registered email.' : _stage == 2 ? 'Enter the 6-digit code sent to your email.' : 'Choose a strong password you have not used before.';
    return AuthShell(
      title: title, subtitle: subtitle, icon: Icons.lock_outline_rounded, illustrationAsset: 'assets/auth/password_recovery.png', compactIllustration: true, showBack: true,
      footerText: 'Back to login', onFooterTap: () => router.go('/login'),
      child: Column(children: [
        if (_stage == 1) AuthTextField(controller: _email, label: 'Registered email', icon: Icons.email_outlined, keyboardType: TextInputType.emailAddress, validator: (_) => null),
        if (_stage == 2) ...[
          AuthOtpInput(controller: _otp),
          TextButton.icon(onPressed: _seconds == 0 && !_loading ? _send : null, icon: const Icon(Icons.refresh_rounded), label: Text(_seconds == 0 ? 'Resend code' : 'Resend code in ${_seconds}s')),
        ],
        if (_stage == 3) ...[
          AuthTextField(controller: _password, label: 'New password', icon: Icons.lock_outline_rounded, obscure: true),
          const SizedBox(height: 8), Align(alignment: Alignment.centerLeft, child: PasswordRequirements(password: _password.text)),
          const SizedBox(height: 12), AuthTextField(controller: _confirm, label: 'Confirm new password', icon: Icons.verified_user_outlined, obscure: true),
        ],
        if (_message != null) ...[const SizedBox(height: 12), AuthMessage(message: _message!, success: _message!.startsWith('If an account'))],
        const SizedBox(height: 16),
        AuthPrimaryButton(label: _stage == 1 ? 'Send verification code' : _stage == 2 ? 'Verify code' : 'Update password', loading: _loading, onPressed: _stage == 1 ? _send : _stage == 2 ? _continueOtp : _reset),
      ]),
    );
  }
}

