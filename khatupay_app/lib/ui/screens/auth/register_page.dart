import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/auth_providers.dart';
import '../../../routes/app_router.dart';
import '../../widgets/auth_shell.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});
  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}
class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController(), _mobile = TextEditingController(), _email = TextEditingController(), _password = TextEditingController(), _confirm = TextEditingController();
  bool _accepted = false, _loading = false;
  String? _message;
  @override
  void initState() { super.initState(); _password.addListener(() => setState(() {})); }
  @override
  void dispose() { _name.dispose(); _mobile.dispose(); _email.dispose(); _password.dispose(); _confirm.dispose(); super.dispose(); }
  bool get _strong => _password.text.length >= 8 && RegExp('[A-Za-z]').hasMatch(_password.text) && RegExp('[0-9]').hasMatch(_password.text);
  Future<void> _register() async {
    if (_loading || _formKey.currentState?.validate() != true) return;
    if (!_accepted) { setState(() => _message = 'Please accept the Terms of Service and Privacy Policy.'); return; }
    setState(() { _loading = true; _message = null; });
    try {
      final email = _email.text.trim().toLowerCase();
      await ref.read(authServiceProvider).register(_name.text.trim(), email, _mobile.text.trim(), _password.text, null);
      if (mounted) router.push('/verify?email=${Uri.encodeComponent(email)}');
    } catch (error) {
      if (mounted) setState(() => _message = friendlyAuthError(error, fallback: 'Unable to create your account. Please try again.'));
    } finally { if (mounted) setState(() => _loading = false); }
  }
  @override
  Widget build(BuildContext context) => AuthShell(
    title: 'Create your account', subtitle: 'Step 1 of 2 · Enter your basic details', icon: Icons.person_outline_rounded,
    illustrationAsset: 'assets/auth/auth_secure_access.png', showBack: true,
    footerText: 'Already have an account? Sign in', onFooterTap: () => router.go('/login'),
    child: Form(key: _formKey, child: Column(children: [
      const LinearProgressIndicator(value: .5, color: kpAuthTeal, backgroundColor: kpAuthMint, minHeight: 5),
      const SizedBox(height: 18),
      AuthTextField(controller: _name, label: 'Full name', icon: Icons.person_outline_rounded, textInputAction: TextInputAction.next, validator: (v) => v.trim().length < 2 ? 'Enter your full name' : null),
      const SizedBox(height: 12),
      AuthTextField(controller: _mobile, label: 'Mobile number', icon: Icons.phone_android_outlined, keyboardType: TextInputType.phone, maxLength: 10, inputFormatters: [FilteringTextInputFormatter.digitsOnly], textInputAction: TextInputAction.next, validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v) ? null : 'Enter a valid 10-digit Indian mobile number'),
      const SizedBox(height: 12),
      AuthTextField(controller: _email, label: 'Email address', icon: Icons.email_outlined, keyboardType: TextInputType.emailAddress, textInputAction: TextInputAction.next, validator: (v) => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v) ? null : 'Enter a valid email address'),
      const SizedBox(height: 12),
      AuthTextField(controller: _password, label: 'Password', icon: Icons.lock_outline_rounded, obscure: true, textInputAction: TextInputAction.next, validator: (_) => _strong ? null : 'Use at least 8 characters with a letter and number'),
      const SizedBox(height: 8),
      Align(alignment: Alignment.centerLeft, child: PasswordRequirements(password: _password.text)),
      const SizedBox(height: 12),
      AuthTextField(controller: _confirm, label: 'Confirm password', icon: Icons.verified_user_outlined, obscure: true, validator: (v) => v == _password.text ? null : 'Passwords do not match'),
      CheckboxListTile(value: _accepted, onChanged: _loading ? null : (v) => setState(() => _accepted = v ?? false), activeColor: kpAuthTeal, contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, title: const Text('I agree to the Terms of Service and Privacy Policy.', style: TextStyle(fontSize: 13, color: kpAuthMuted))),
      if (_message != null) ...[AuthMessage(message: _message!), const SizedBox(height: 12)],
      AuthPrimaryButton(label: 'Continue', loading: _loading, onPressed: _register),
    ])),
  );
}

