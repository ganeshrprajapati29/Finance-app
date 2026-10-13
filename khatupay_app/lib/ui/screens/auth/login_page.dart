import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth_storage.dart';
import '../../../core/app_navigation_history.dart';
import '../../../core/fcm.dart';
import '../../../providers/auth_providers.dart';
import '../../../routes/app_router.dart';
import '../../widgets/auth_shell.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    AuthStorage.getLastIdentifier().then((value) {
      if (mounted && value != null) _identifier.text = value;
    });
  }

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_loading || _formKey.currentState?.validate() != true) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      await ref
          .read(authServiceProvider)
          .loginPassword(_identifier.text.trim(), _password.text);
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
            fallback: 'Unable to sign in right now. Please try again.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthShell(
        title: 'Welcome back',
        subtitle:
            'Use your registered mobile number or email to continue securely.',
        icon: Icons.verified_user_outlined,
        illustrationAsset: 'assets/auth/auth_secure_access.png',
        footerText: 'New to KhatuPay? Create account',
        onFooterTap: () => router.go('/register'),
        child: Form(
          key: _formKey,
          child: Column(children: [
            AuthTextField(
                controller: _identifier,
                label: 'Mobile number or email',
                icon: Icons.person_outline_rounded,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                validator: (v) => v.isEmpty
                    ? 'Enter your registered mobile number or email'
                    : null),
            const SizedBox(height: 14),
            AuthTextField(
                controller: _password,
                label: 'Password',
                icon: Icons.lock_outline_rounded,
                obscure: true,
                textInputAction: TextInputAction.done,
                validator: (v) => v.isEmpty ? 'Enter your password' : null),
            Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                    onPressed: _loading ? null : () => router.push('/forgot'),
                    child: const Text('Forgot password?',
                        style: TextStyle(fontWeight: FontWeight.w700)))),
            if (_message != null) ...[
              AuthMessage(message: _message!),
              const SizedBox(height: 14)
            ],
            AuthPrimaryButton(
                label: 'Sign in securely',
                loading: _loading,
                icon: Icons.lock_open_rounded,
                onPressed: _login),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed:
                  _loading ? null : () => router.push('/login-mobile-otp'),
              icon: const Icon(Icons.sms_outlined),
              label: const Text('Use mobile OTP instead'),
            ),
          ]),
        ),
      );
}
