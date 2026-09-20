import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../../services/auth_service.dart';
import '../widgets/app_back_button.dart';

class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;
  bool _showPasswords = false;
  String? _message;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_formKey.currentState?.validate() != true) return;
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await AuthService()
          .changePassword(_current.text.trim(), _next.text.trim());
      if (!mounted) return;
      setState(() => _message = 'Password changed successfully');
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password changed successfully')));
      router.go('/settings');
    } catch (e) {
      if (mounted) setState(() => _message = 'Password change failed: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Change Password'),
        leading: const AppBackButton(fallbackRoute: '/settings'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [KhatuColors.deepTeal, KhatuColors.teal]),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Icon(Icons.lock_reset, color: Colors.white, size: 44),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Keep your KhatuPay account secure with a strong password.',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              _Message(text: _message!),
            ],
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _passwordField(_current, 'Current Password'),
                    const SizedBox(height: 12),
                    _passwordField(_next, 'New Password', newPassword: true),
                    const SizedBox(height: 12),
                    _passwordField(_confirm, 'Confirm New Password',
                        confirm: true),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _showPasswords,
                      onChanged: (value) =>
                          setState(() => _showPasswords = value),
                      title: const Text('Show passwords',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.verified_user_outlined),
                label: Text(_saving ? 'Updating...' : 'Update Password'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  TextFormField _passwordField(
    TextEditingController controller,
    String label, {
    bool newPassword = false,
    bool confirm = false,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: !_showPasswords,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.password, color: KhatuColors.teal),
        border: const OutlineInputBorder(),
      ),
      validator: (value) {
        final text = value?.trim() ?? '';
        if (text.isEmpty) return 'Required';
        if ((newPassword || confirm) && text.length < 6)
          return 'Minimum 6 characters';
        if (newPassword && text == _current.text.trim())
          return 'New password must be different';
        if (confirm && text != _next.text.trim())
          return 'Password does not match';
        return null;
      },
    );
  }
}

class _Message extends StatelessWidget {
  final String text;
  const _Message({required this.text});

  @override
  Widget build(BuildContext context) {
    final success = text.toLowerCase().contains('success');
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: success ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: success ? Colors.green.shade200 : Colors.orange.shade200),
      ),
      child: Text(text,
          style: TextStyle(
              color: success ? Colors.green.shade900 : Colors.orange.shade900,
              fontWeight: FontWeight.w800)),
    );
  }
}
