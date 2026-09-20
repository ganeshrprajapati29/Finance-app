import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// Compact status pill used across payments, loans, KYC, withdrawals and
/// sticker orders.
///
/// The colour is derived from the raw backend status string via
/// [KhatuColors.status], so an unrecognised status renders in neutral grey
/// rather than throwing. Null/empty statuses fall back to `--`.
class KpStatusBadge extends StatelessWidget {
  const KpStatusBadge({
    super.key,
    required this.status,
    this.label,
    this.icon,
    this.dense = false,
    this.showDot = true,
  });

  /// Raw status from the API, e.g. `CONFIRMED`, `PENDING`, `disbursed`.
  final String? status;

  /// Optional override for the displayed text. Defaults to a prettified
  /// version of [status].
  final String? label;

  final IconData? icon;
  final bool dense;
  final bool showDot;

  /// `LOAN_ALREADY_PAID` -> `Loan already paid`
  static String prettify(String? raw) {
    final trimmed = (raw ?? '').trim();
    if (trimmed.isEmpty) return '--';
    final words = trimmed.replaceAll(RegExp(r'[_\-]+'), ' ').split(' ');
    return words
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final color = KhatuColors.status(status);
    final text = label ?? prettify(status);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(KhatuRadius.pill),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: dense ? 11 : 13, color: color),
            const SizedBox(width: 5),
          ] else if (showDot) ...[
            Container(
              width: dense ? 5 : 6,
              height: dense ? 5 : 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: dense ? 10.5 : 11.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}
