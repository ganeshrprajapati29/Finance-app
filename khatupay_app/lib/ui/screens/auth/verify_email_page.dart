import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/auth_storage.dart';
import '../../../routes/app_router.dart';
import '../../../services/auth_service.dart';
import '../../widgets/auth_shell.dart';

class VerifyEmailPage extends StatefulWidget {
  final String? email;
  const VerifyEmailPage({super.key, this.email});
  @override
  State<VerifyEmailPage> createState() => _VerifyEmailPageState();
}
class _VerifyEmailPageState extends State<VerifyEmailPage> {
  final _otp = TextEditingController();
  bool _loading = false, _verified = false;
  int _seconds = 30;
  Timer? _timer;
  String? _message;
  String get _email => (widget.email ?? '').trim().toLowerCase();
  String get _masked {
    final parts = _email.split('@');
    if (parts.length != 2 || parts.first.isEmpty) return _email;
    final name = parts.first;
    final hiddenLength = (name.length - 1).clamp(2, 8).toInt();
    return '${name.substring(0, 1)}${List.filled(hiddenLength, '*').join()}@${parts.last}';
  }
  @override
  void initState() { super.initState(); _startTimer(); }
  void _startTimer() {
    _timer?.cancel(); _seconds = 30;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_seconds <= 1) { timer.cancel(); setState(() => _seconds = 0); } else { setState(() => _seconds--); }
    });
  }
  @override
  void dispose() { _timer?.cancel(); _otp.dispose(); super.dispose(); }
  Future<void> _verify() async {
    if (_loading || _otp.text.length != 6) { setState(() => _message = 'Enter the complete 6-digit verification code.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().verifyEmail(_email, _otp.text);
      await AuthStorage.saveLastIdentifier(_email);
      if (mounted) setState(() => _verified = true);
    } catch (error) {
      if (mounted) setState(() => _message = friendlyAuthError(error, fallback: 'We could not verify this code. Please try again.'));
    } finally { if (mounted) setState(() => _loading = false); }
  }
  Future<void> _resend() async {
    if (_loading || _seconds > 0) return;
    setState(() { _loading = true; _message = null; });
    try {
      await AuthService().resendVerification(_email);
      if (mounted) { _otp.clear(); _startTimer(); setState(() => _message = 'A new verification code has been sent.'); }
    } catch (error) {
      if (mounted) setState(() => _message = friendlyAuthError(error, fallback: 'Unable to resend the code right now.'));
    } finally { if (mounted) setState(() => _loading = false); }
  }
  @override
  Widget build(BuildContext context) {
    if (_verified) {
      return AuthShell(title: 'Account verified', subtitle: 'Your KhatuPay account is ready.', icon: Icons.check_circle_rounded, illustrationAsset: 'assets/auth/account_verified.png', compactIllustration: true, footerText: '', child: AuthPrimaryButton(label: 'Continue to login', icon: Icons.login_rounded, onPressed: () => router.go('/login')));
    }
    return AuthShell(
      title: 'Verify your email', subtitle: 'Step 2 of 2 · We sent a secure code to $_masked', icon: Icons.email_outlined,
      illustrationAsset: 'assets/auth/email_verification.png', compactIllustration: true, showBack: true,
      footerText: 'Change email', onFooterTap: () => router.pop(),
      child: Column(children: [
        AuthOtpInput(controller: _otp),
        if (_message != null) ...[AuthMessage(message: _message!, success: _message!.contains('sent')), const SizedBox(height: 12)],
        AuthPrimaryButton(label: 'Verify account', loading: _loading, icon: Icons.verified_user_outlined, onPressed: _verify),
        const SizedBox(height: 8),
        TextButton.icon(onPressed: _seconds == 0 && !_loading ? _resend : null, icon: const Icon(Icons.refresh_rounded), label: Text(_seconds == 0 ? 'Resend code' : 'Resend code in ${_seconds}s')),
      ]),
    );
  }
}
