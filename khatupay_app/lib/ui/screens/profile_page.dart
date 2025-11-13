import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import '../../services/user_service.dart';
import '../../routes/app_router.dart';
import '../../providers/auth_providers.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  String info = '';
  bool _isEditing = false;

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  void _startEditing() {
    final userAsync = ref.read(meProvider);
    userAsync.whenData((user) {
      _nameController.text = user.name;
      _mobileController.text = user.mobile;
      setState(() => _isEditing = true);
    });
  }

  Future<void> _saveProfile() async {
    try {
      await UserService().updateMe(
        name: _nameController.text.trim(),
        mobile: _mobileController.text.trim(),
      );
      setState(() => _isEditing = false);
      ref.invalidate(meProvider); // Refresh user data
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update profile: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(meProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile & KYC'),
        leading: IconButton(
          icon: const Icon(Icons.home),
          onPressed: () => router.go('/'),
        ),
        actions: [
          if (!_isEditing)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: _startEditing,
            )
          else
            IconButton(
              icon: const Icon(Icons.save),
              onPressed: _saveProfile,
            ),
        ],
      ),
      body: userAsync.when(
        data: (user) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Personal Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      if (!_isEditing) ...[
                        _buildInfoRow('Name', user.name),
                        _buildInfoRow('Email', user.email),
                        _buildInfoRow('Mobile', user.mobile),
                        _buildInfoRow('Email Verified', user.emailVerified ? 'Yes' : 'No'),
                        _buildInfoRow('Loan Limit', '₹${user.loanLimit}'),
                      ] else ...[
                        TextField(
                          controller: _nameController,
                          decoration: const InputDecoration(labelText: 'Name'),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _mobileController,
                          decoration: const InputDecoration(labelText: 'Mobile'),
                          keyboardType: TextInputType.phone,
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () => setState(() => _isEditing = false),
                              child: const Text('Cancel'),
                            ),
                            const SizedBox(width: 16),
                            ElevatedButton(
                              onPressed: _saveProfile,
                              child: const Text('Save'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('KYC Documents', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      const Text('Upload your identity documents for verification'),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () async {
                          final r = await FilePicker.platform.pickFiles(allowMultiple: true);
                          if (r == null) return;
                          final paths = r.files.where((f) => f.path != null).map((f) => f.path!).toList();
                          try {
                            await UserService().uploadKyc(paths);
                            setState(() => info = 'KYC docs uploaded successfully');
                          } catch (e) {
                            setState(() => info = 'Failed to upload KYC docs: $e');
                          }
                        },
                        child: const Text('Upload KYC Docs'),
                      ),
                      if (info.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(info, style: TextStyle(color: info.contains('successfully') ? Colors.green : Colors.red)),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error loading profile: $e')),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
