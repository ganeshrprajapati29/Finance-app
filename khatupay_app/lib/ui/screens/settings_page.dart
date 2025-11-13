import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/fcm.dart';
import '../../services/user_service.dart';
import '../../routes/app_router.dart';
import '../../providers/auth_providers.dart';

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  String token = '';
  bool _notificationsEnabled = true;
  bool _biometricEnabled = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.home),
          onPressed: () => router.go('/'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Account Settings
          _buildSectionHeader('Account'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.person),
                  title: const Text('Profile'),
                  subtitle: const Text('Manage your personal information'),
                  trailing: const Icon(Icons.arrow_forward_ios),
                  onTap: () => router.go('/profile'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.security),
                  title: const Text('Privacy & Security'),
                  subtitle: const Text('Password, biometric settings'),
                  trailing: const Icon(Icons.arrow_forward_ios),
                  onTap: () => _showPrivacyDialog(),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Notifications
          _buildSectionHeader('Notifications'),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  secondary: const Icon(Icons.notifications),
                  title: const Text('Push Notifications'),
                  subtitle: const Text('Receive notifications about your loans and payments'),
                  value: _notificationsEnabled,
                  onChanged: (value) => setState(() => _notificationsEnabled = value),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.token),
                  title: const Text('Device Registration'),
                  subtitle: const Text('Register device for push notifications'),
                  trailing: const Icon(Icons.arrow_forward_ios),
                  onTap: () => _registerFCMToken(),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Support
          _buildSectionHeader('Support'),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.help),
                  title: const Text('FAQs'),
                  subtitle: const Text('Frequently asked questions'),
                  trailing: const Icon(Icons.arrow_forward_ios),
                  onTap: () => router.go('/faq'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.support_agent),
                  title: const Text('Customer Support'),
                  subtitle: const Text('Contact our support team'),
                  trailing: const Icon(Icons.arrow_forward_ios),
                  onTap: () => router.go('/support'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.info),
                  title: const Text('About'),
                  subtitle: const Text('App version and information'),
                  trailing: const Icon(Icons.arrow_forward_ios),
                  onTap: () => _showAboutDialog(),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Account Actions
          _buildSectionHeader('Account Actions'),
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Logout', style: TextStyle(color: Colors.red)),
              subtitle: const Text('Sign out from your account'),
              onTap: () => _showLogoutDialog(),
            ),
          ),

          // FCM Token Display (for debugging)
          if (token.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildSectionHeader('Debug Info'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('FCM Token:', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    SelectableText(token, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
          color: Colors.blueAccent,
        ),
      ),
    );
  }

  void _registerFCMToken() async {
    try {
      final t = await FCM.token();
      setState(() => token = t ?? '');
      if (t != null) {
        await UserService().registerFcmToken(token);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Device registered for notifications')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to register device: $e')),
      );
    }
  }

  void _showPrivacyDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Privacy & Security'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SwitchListTile(
              title: const Text('Biometric Authentication'),
              subtitle: const Text('Use fingerprint/face unlock'),
              value: _biometricEnabled,
              onChanged: (value) => setState(() => _biometricEnabled = value),
            ),
            const SizedBox(height: 16),
            const Text('More privacy settings coming soon...'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog() {
    showAboutDialog(
      context: context,
      applicationName: 'Khatu Pay',
      applicationVersion: '1.0.0',
      applicationLegalese: '© 2024 Khatu Pay. All rights reserved.',
      children: [
        const SizedBox(height: 16),
        const Text('A comprehensive loan and payment management app.'),
      ],
    );
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              ref.read(authServiceProvider).logout();
              router.go('/login');
            },
            child: const Text('Logout', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
