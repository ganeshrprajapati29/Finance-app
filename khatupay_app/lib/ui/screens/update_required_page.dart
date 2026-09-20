import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../services/app_update_service.dart';

class UpdateRequiredPage extends StatefulWidget {
  final AppUpdatePolicy policy;
  final Future<void> Function() onCheckAgain;
  final Future<bool> Function()? onUpdateRequested;

  const UpdateRequiredPage({
    super.key,
    required this.policy,
    required this.onCheckAgain,
    this.onUpdateRequested,
  });

  @override
  State<UpdateRequiredPage> createState() => _UpdateRequiredPageState();
}

class _UpdateRequiredPageState extends State<UpdateRequiredPage> {
  bool _openingStore = false;
  bool _checking = false;

  Future<void> _openStore() async {
    if (_openingStore) return;
    setState(() => _openingStore = true);
    try {
      if (widget.onUpdateRequested != null) {
        final started = await widget.onUpdateRequested!();
        if (!started && mounted) {
          _showError(
              'The Play Store update could not be started. Please try again.');
        }
        return;
      }
      final opened = await launchUrl(
        Uri.parse(widget.policy.storeUrl),
        mode: LaunchMode.externalApplication,
      );
      if (!opened && mounted) _showError('Play Store could not be opened.');
    } catch (_) {
      if (mounted)
        _showError('Play Store could not be opened. Please try again.');
    } finally {
      if (mounted) setState(() => _openingStore = false);
    }
  }

  Future<void> _checkAgain() async {
    if (_checking) return;
    setState(() => _checking = true);
    await widget.onCheckAgain();
    if (mounted) setState(() => _checking = false);
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  children: [
                    Container(
                      width: 112,
                      height: 112,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEAF8F5),
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: Image.asset(
                        'assets/playstore-icon.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Text(
                      'Update required',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: KhatuColors.text,
                        fontSize: 27,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.policy.message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: KhatuColors.muted,
                        height: 1.55,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF4F7F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Installed build ${widget.policy.installedBuild}  |  Required build ${widget.policy.minimumSupportedBuild}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: KhatuColors.muted,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        onPressed: _openingStore ? null : _openStore,
                        icon: const Icon(Icons.system_update_alt_rounded),
                        label: Text(_openingStore
                            ? 'Opening Play Store...'
                            : 'Update from Play Store'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextButton.icon(
                      onPressed: _checking ? null : _checkAgain,
                      icon: _checking
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.refresh_rounded),
                      label: Text(
                          _checking ? 'Checking...' : 'I have updated the app'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
