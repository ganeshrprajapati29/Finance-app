import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// Brand illustrations shipped with the app, for empty states that deserve
/// more than an icon. Authored in-house (see
/// `admin_panel/src/assets/illustrations/*.svg`) and pre-rendered to PNG, so
/// there is no third-party licensing attached to them.
class KpIllustrations {
  const KpIllustrations._();

  /// Shopkeeper accepting a UPI QR payment.
  static const merchantQr = 'assets/illustrations/merchant-qr.png';

  /// Mobile wallet behind a security shield.
  static const secureWallet = 'assets/illustrations/secure-wallet.png';

  /// Loan application approved and credited.
  static const loanApproved = 'assets/illustrations/loan-approved.png';
}

/// "Nothing here yet" placeholder.
///
/// Distinct from [KpErrorState]: an empty state is a normal, non-alarming
/// outcome (no transactions yet, no offers live) and is styled in brand teal
/// rather than red.
class KpEmptyState extends StatelessWidget {
  const KpEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.illustration,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final String title;
  final String? message;
  final IconData icon;

  /// Optional asset path (see [KpIllustrations]) shown instead of the icon
  /// well. Falls back to the icon if the asset fails to load.
  final String? illustration;

  final String? actionLabel;
  final VoidCallback? onAction;

  /// Tighter padding for use inside a card rather than as a full page body.
  final bool compact;

  Widget _icon() => Container(
        width: compact ? 56 : 72,
        height: compact ? 56 : 72,
        decoration: const BoxDecoration(
          color: KhatuColors.softTeal,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: compact ? 26 : 34, color: KhatuColors.teal),
      );

  @override
  Widget build(BuildContext context) {
    final art = (illustration ?? '').trim();

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: KhatuSpace.xxl,
          vertical: compact ? KhatuSpace.xl : KhatuSpace.xxxl + 8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (art.isEmpty || compact)
              _icon()
            else
              Image.asset(
                art,
                height: 150,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => _icon(),
              ),
            SizedBox(height: compact ? KhatuSpace.md : KhatuSpace.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: compact ? KhatuText.h3 : KhatuText.h2,
            ),
            if ((message ?? '').trim().isNotEmpty) ...[
              KhatuSpace.gapSm,
              Text(
                message!.trim(),
                textAlign: TextAlign.center,
                style: KhatuText.bodyMuted,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              KhatuSpace.gapLg,
              OutlinedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
