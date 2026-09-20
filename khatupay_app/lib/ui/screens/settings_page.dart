import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/auth_storage.dart';
import '../../core/friendly_error.dart';
import '../../providers/auth_providers.dart';
import '../../routes/app_router.dart';
import '../../services/biometric_service.dart';
import '../widgets/app_back_button.dart';
import '../widgets/kp_widgets.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  bool _loading = true;
  bool _saving = false;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _notificationsEnabled = true;
  String _version = '';
  String? _notice;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait<dynamic>([
        AuthStorage.isBiometricEnabled(),
        BiometricService().isBiometricAvailable(),
        PackageInfo.fromPlatform(),
        ref.read(userServiceProvider).getSettings(),
      ]);
      if (!mounted) return;
      final preferences = Map<String, dynamic>.from(values[3] as Map);
      setState(() {
        _biometricEnabled = values[0] as bool;
        _biometricAvailable = values[1] as bool;
        _version = (values[2] as PackageInfo).version;
        _notificationsEnabled = preferences['notificationsEnabled'] ?? true;
      });
    } catch (_) {
      final info = await PackageInfo.fromPlatform();
      if (mounted) setState(() => _version = info.version);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleNotifications(bool value) async {
    if (_saving) return;
    final previous = _notificationsEnabled;
    setState(() {
      _saving = true;
      _notificationsEnabled = value;
      _notice = null;
    });
    try {
      await ref
          .read(userServiceProvider)
          .updateSettings(notificationsEnabled: value);
      if (mounted) setState(() => _notice = 'Notification preference updated.');
    } catch (error) {
      if (mounted) {
        setState(() {
          _notificationsEnabled = previous;
          _notice = friendlyErrorMessage(error,
              fallback: 'Unable to update notifications right now.');
        });
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggleBiometric(bool value) async {
    if (!value) {
      await AuthStorage.setBiometricEnabled(false);
      if (mounted) setState(() => _biometricEnabled = false);
      return;
    }
    final verified = await BiometricService().authenticate(
      reason: 'Confirm biometric unlock for Khatu Pay',
      biometricOnly: true,
    );
    await AuthStorage.setBiometricEnabled(verified);
    if (mounted) {
      setState(() {
        _biometricEnabled = verified;
        _notice = verified
            ? 'Biometric unlock enabled.'
            : 'Biometric setup was not completed.';
      });
    }
  }

  Future<bool> _confirm(String title, String message, String action) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(action)),
          ],
        ),
      ) ??
      false;

  Future<void> _logout({bool allDevices = false}) async {
    final confirmed = await _confirm(
      allDevices ? 'Sign out all devices?' : 'Sign out?',
      allDevices
          ? 'All active Khatu Pay sessions will be closed. You will need to sign in again on every device.'
          : 'You will be signed out from this device.',
      allDevices ? 'Sign out all' : 'Sign out',
    );
    if (!confirmed) return;
    try {
      if (allDevices) {
        await ref.read(authServiceProvider).logoutAll();
      } else {
        await ref.read(authServiceProvider).logout();
      }
      ref.invalidate(meProvider);
      router.go('/login');
    } catch (error) {
      if (mounted)
        setState(() => _notice = friendlyErrorMessage(error,
            fallback: 'Unable to sign out all devices. Please try again.'));
    }
  }

  Future<void> _setPin() async {
    final password = TextEditingController();
    final pin = TextEditingController();
    final form = GlobalKey<FormState>();
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Set or change app PIN'),
        content: Form(
            key: form,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                  controller: password,
                  obscureText: true,
                  decoration:
                      const InputDecoration(labelText: 'Current password'),
                  validator: (value) =>
                      (value ?? '').isEmpty ? 'Enter current password' : null),
              const SizedBox(height: 12),
              TextFormField(
                  controller: pin,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  decoration: const InputDecoration(
                      labelText: 'New 4-digit PIN', counterText: ''),
                  validator: (value) => RegExp(r'^\d{4}$').hasMatch(value ?? '')
                      ? null
                      : 'Enter a 4-digit PIN'),
            ])),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () {
                if (form.currentState?.validate() ?? false)
                  Navigator.pop(context, true);
              },
              child: const Text('Update PIN')),
        ],
      ),
    );
    if (accepted != true) return;
    try {
      await ref.read(authServiceProvider).setMpin(password.text, pin.text);
      if (mounted) setState(() => _notice = 'App PIN updated securely.');
    } catch (error) {
      if (mounted)
        setState(() => _notice = friendlyErrorMessage(error,
            fallback: 'Unable to update your app PIN.'));
    } finally {
      password.dispose();
      pin.dispose();
    }
  }

  Future<void> _openPolicy(String path) async {
    final uri = Uri.parse('https://khatupay.com/$path');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        mounted) {
      setState(() => _notice = 'Unable to open this page right now.');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          leading: const AppBackButton(fallbackRoute: '/profile'),
          title: const Text('Settings'),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: KhatuSpace.pageScroll,
                  children: [
                    KpCard(
                        child: Row(children: [
                      Image.asset('assets/profile/security_privacy.png',
                          width: 76, height: 76),
                      const SizedBox(width: 14),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            const Text('Your account, your control',
                                style: KhatuText.h3),
                            const SizedBox(height: 4),
                            Text('Manage access, alerts and privacy securely.',
                                style: KhatuText.bodyMuted),
                          ])),
                    ])),
                    if (_notice != null) ...[
                      const SizedBox(height: 12),
                      KpNoticeBanner(
                          icon: Icons.info_outline,
                          color: KhatuColors.teal,
                          message: _notice!)
                    ],
                    _title('Account and security'),
                    _group([
                      _item(
                          Icons.lock_outline,
                          'Change password',
                          'Update your account password',
                          () => router.push('/change-password')),
                      _item(Icons.pin_outlined, 'App PIN',
                          'Set or change your 4-digit PIN', _setPin),
                      if (_biometricAvailable)
                        _switch(
                            Icons.fingerprint,
                            'Biometric unlock',
                            'Use device biometrics for quick access',
                            _biometricEnabled,
                            _toggleBiometric),
                      _item(
                          Icons.phonelink_lock_outlined,
                          'Sign out all devices',
                          'Close every active account session',
                          () => _logout(allDevices: true)),
                    ]),
                    _title('Notifications'),
                    _group([
                      _switch(
                          Icons.notifications_active_outlined,
                          'Service alerts',
                          'Recharge, bill, loan and merchant updates',
                          _notificationsEnabled,
                          _toggleNotifications),
                      _item(
                          Icons.notifications_none,
                          'Notification centre',
                          'View account and service updates',
                          () => router.push('/notifications')),
                      _info(Icons.security_outlined, 'Security alerts',
                          'Important login and security alerts remain enabled.'),
                    ]),
                    _title('App preferences'),
                    _group([
                      _item(
                          Icons.system_update_outlined,
                          'App update status',
                          _version.isEmpty
                              ? 'Check your installed version'
                              : 'Installed version $_version',
                          () => launchUrl(
                              Uri.parse(
                                  'https://play.google.com/store/apps/details?id=com.finance.khatupay'),
                              mode: LaunchMode.externalApplication)),
                    ]),
                    _title('Privacy and permissions'),
                    _group([
                      _item(Icons.privacy_tip_outlined, 'Privacy Policy', null,
                          () => _openPolicy('privacy-policy')),
                      _item(Icons.description_outlined, 'Terms of Service',
                          null, () => _openPolicy('terms-and-conditions')),
                      _item(
                          Icons.currency_exchange_outlined,
                          'Refund and Cancellation Policy',
                          null,
                          () => _openPolicy('refund-and-cancellation-policy')),
                      _item(
                          Icons.admin_panel_settings_outlined,
                          'Data and account security',
                          'How Khatu Pay protects your information',
                          () => _openPolicy('privacy-policy')),
                      _item(
                          Icons.person_remove_outlined,
                          'Delete account request',
                          'Contact support for a secure account review',
                          () => router.push(
                              '/support?subject=Delete%20account%20request')),
                    ]),
                    _title('Help and legal'),
                    _group([
                      _item(Icons.support_agent_outlined, 'Help and support',
                          null, () => router.push('/support')),
                      _item(Icons.help_outline, 'Frequently asked questions',
                          null, () => router.push('/faq')),
                      _item(
                          Icons.info_outline,
                          'About Khatu Pay',
                          _version.isEmpty ? null : 'App version $_version',
                          () => router.push('/faq')),
                    ]),
                    const SizedBox(height: 24),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                          foregroundColor: KhatuColors.danger,
                          side: const BorderSide(color: KhatuColors.danger),
                          minimumSize: const Size.fromHeight(48)),
                      onPressed: _logout,
                      icon: const Icon(Icons.logout),
                      label: const Text('Sign out'),
                    ),
                  ],
                ),
              ),
      );

  Widget _title(String text) => Padding(
      padding: const EdgeInsets.fromLTRB(2, 24, 2, 10),
      child: Text(text,
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: KhatuColors.text)));

  Widget _group(List<Widget> children) => Container(
        decoration: BoxDecoration(
            border: Border.all(color: KhatuColors.line),
            borderRadius: BorderRadius.circular(8)),
        child: Column(children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) const Divider(height: 1, indent: 54),
          ]
        ]),
      );

  Widget _item(
          IconData icon, String title, String? subtitle, VoidCallback onTap) =>
      ListTile(
          dense: true,
          leading: Icon(icon, color: KhatuColors.teal),
          title:
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: subtitle == null ? null : Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap);

  Widget _switch(IconData icon, String title, String subtitle, bool value,
          ValueChanged<bool> onChanged) =>
      SwitchListTile.adaptive(
          dense: true,
          secondary: Icon(icon, color: KhatuColors.teal),
          title:
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text(subtitle),
          value: value,
          onChanged: _saving ? null : onChanged);

  Widget _info(IconData icon, String title, String subtitle) => ListTile(
      dense: true,
      leading: Icon(icon, color: KhatuColors.teal),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle));
}
