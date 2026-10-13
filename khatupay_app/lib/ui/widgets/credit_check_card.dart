import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// Shows where the Experian credit check stands on the review screen: idle,
/// running, received, no history (manual review) or failed with a retry.
class CreditCheckCard extends StatelessWidget {
  const CreditCheckCard({
    super.key,
    required this.checking,
    required this.status,
    required this.summary,
    required this.message,
    required this.enabled,
    required this.onCheck,
  });

  final bool checking;
  final String status;
  final Map<String, dynamic>? summary;
  final String? message;
  final bool enabled;
  final Future<bool> Function() onCheck;

  @override
  Widget build(BuildContext context) {
    if (checking) {
      return _tile(
        color: KhatuColors.blue,
        leading: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2.4),
        ),
        title: 'Checking your credit report',
        body:
            'Fetching it securely from Experian. This can take up to a minute - please keep the app open.',
      );
    }

    if (status == 'VERIFIED') {
      final score = num.tryParse('${summary?['score'] ?? ''}');
      final band = (summary?['scoreBand'] ?? '').toString();
      final accounts = num.tryParse('${summary?['accountCount'] ?? ''}');
      final lines = <String>[
        if (score != null)
          'Experian score ${score.toInt()}${band.isNotEmpty ? ' - $band' : ''}'
        else
          'Report received from Experian.',
        if (accounts != null)
          '${accounts.toInt()} credit account${accounts == 1 ? '' : 's'} on file',
      ];
      return _tile(
        color: KhatuColors.success,
        leading: const Icon(Icons.verified_rounded,
            color: KhatuColors.success, size: 22),
        title: 'Credit report received',
        body: lines.join('\n'),
      );
    }

    if (status == 'REVIEW') {
      return _tile(
        color: KhatuColors.warning,
        leading: const Icon(Icons.fact_check_outlined,
            color: KhatuColors.warning, size: 22),
        title: 'No credit history found',
        body:
            'Our credit team will review your application manually. You can still submit.',
      );
    }

    if ((message ?? '').trim().isNotEmpty) {
      return _tile(
        color: KhatuColors.danger,
        leading: const Icon(Icons.error_outline_rounded,
            color: KhatuColors.danger, size: 22),
        title: 'Credit report not available',
        body: message!,
        action: TextButton(
          onPressed: enabled ? () => onCheck() : null,
          child: const Text('Try again'),
        ),
      );
    }

    return _tile(
      color: KhatuColors.deepTeal,
      leading: const Icon(Icons.speed_rounded,
          color: KhatuColors.deepTeal, size: 22),
      title: 'Credit check',
      body:
          'Your Experian credit report is fetched securely when you submit. You can also check it now.',
      action: TextButton(
        onPressed: enabled ? () => onCheck() : null,
        child: const Text('Check now'),
      ),
    );
  }

  Widget _tile({
    required Color color,
    required Widget leading,
    required String title,
    required String body,
    Widget? action,
  }) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 1), child: leading),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w900,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  body,
                  style: const TextStyle(
                    color: KhatuColors.text,
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          if (action != null) action,
        ],
      ),
    );
  }
}
