import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import '../widgets/app_back_button.dart';
import '../widgets/fintech_components.dart';

class ComingSoonPage extends StatelessWidget {
  final String title;
  final String message;

  const ComingSoonPage({
    super.key,
    required this.title,
    this.message =
        'This feature is currently in setup mode. It will be enabled once approval is complete.',
  });

  static void showSnack(
    BuildContext context, {
    String message =
        'Coming soon. This feature will be enabled after approval.',
  }) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: const AppBackButton(),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: FinSurface(
              padding: const EdgeInsets.all(22),
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: Alignment.center,
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: KhatuColors.softTeal,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: KhatuColors.line),
                        ),
                        child: const Icon(
                          Icons.rocket_launch_rounded,
                          color: KhatuColors.teal,
                          size: 34,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: KhatuColors.text,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: KhatuColors.muted,
                        fontWeight: FontWeight.w700,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 18),
                    ElevatedButton.icon(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.check_circle_outline_rounded),
                      label: const Text('Got it'),
                    ),
                  ]),
            ),
          ),
        ),
      ),
    );
  }
}
