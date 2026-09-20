import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/app_theme.dart';
import 'kp_balance_card.dart';
import 'kp_status_badge.dart';

/// Direction of money movement, used to pick the icon and amount colour.
enum KpTxnDirection { credit, debit, neutral }

/// Ledger row: icon well, title + meta, signed amount and status.
///
/// Every field is null-tolerant. Payment payloads from the API vary a lot
/// between types (P2P, recharge, BBPS, loan EMI, wallet top-up), so a missing
/// `amount`, `createdAt` or `status` renders a placeholder instead of throwing.
class KpTransactionTile extends StatelessWidget {
  const KpTransactionTile({
    super.key,
    required this.title,
    this.subtitle,
    this.amount,
    this.status,
    this.timestamp,
    this.direction = KpTxnDirection.neutral,
    this.icon,
    this.iconColor,
    this.onTap,
    this.trailingCaption,
    this.showDivider = false,
  });

  /// Builds a tile straight from a `/payments` row. Unknown shapes degrade to
  /// sensible defaults rather than throwing.
  factory KpTransactionTile.fromPayment(
    Map<dynamic, dynamic>? raw, {
    VoidCallback? onTap,
  }) {
    final map = Map<String, dynamic>.from(raw ?? const {});
    final type = (map['type'] ?? '').toString().toUpperCase();
    final status = (map['status'] ?? '').toString();
    final amount = _toNum(map['amount']);
    final createdAt = _toDate(map['createdAt'] ?? map['paymentDate']);

    final credit = type == 'WALLET_TOPUP' || type == 'REFUND';
    final meta = <String>[
      if (type.isNotEmpty) _typeLabel(type),
      if ((map['khatuPaymentId'] ?? '').toString().trim().isNotEmpty)
        map['khatuPaymentId'].toString().trim(),
    ].join(' • ');

    return KpTransactionTile(
      title: _typeLabel(type),
      subtitle: meta.isEmpty ? null : meta,
      amount: amount,
      status: status,
      timestamp: createdAt,
      direction: credit ? KpTxnDirection.credit : KpTxnDirection.debit,
      icon: _typeIcon(type),
      onTap: onTap,
    );
  }

  final String title;
  final String? subtitle;
  final num? amount;
  final String? status;
  final DateTime? timestamp;
  final KpTxnDirection direction;
  final IconData? icon;
  final Color? iconColor;
  final VoidCallback? onTap;
  final String? trailingCaption;
  final bool showDivider;

  static num? _toNum(dynamic value) {
    if (value == null) return null;
    if (value is num) return value;
    return num.tryParse(value.toString());
  }

  static DateTime? _toDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    return DateTime.tryParse(value.toString())?.toLocal();
  }

  static String _typeLabel(String type) {
    switch (type) {
      case 'WALLET_TOPUP':
        return 'Money added to wallet';
      case 'WALLET_SPEND':
        return 'Wallet payment';
      case 'REPAYMENT':
        return 'Loan EMI';
      case 'FULL_REPAYMENT':
        return 'Loan foreclosure';
      case 'RECHARGE':
        return 'Mobile / DTH recharge';
      case 'BBPS_BILL':
      case 'BILL':
        return 'Bill payment';
      case 'P2P':
        return 'Money sent';
      case 'REFUND':
        return 'Refund received';
      case '':
        return 'Transaction';
      default:
        return KpStatusBadge.prettify(type);
    }
  }

  static IconData _typeIcon(String type) {
    switch (type) {
      case 'WALLET_TOPUP':
        return Icons.account_balance_wallet_outlined;
      case 'WALLET_SPEND':
        return Icons.payments_outlined;
      case 'REPAYMENT':
      case 'FULL_REPAYMENT':
        return Icons.request_quote_outlined;
      case 'RECHARGE':
        return Icons.smartphone_outlined;
      case 'BBPS_BILL':
      case 'BILL':
        return Icons.receipt_long_outlined;
      case 'P2P':
        return Icons.send_rounded;
      case 'REFUND':
        return Icons.replay_rounded;
      default:
        return Icons.swap_horiz_rounded;
    }
  }

  static String formatWhen(DateTime? value) {
    if (value == null) return '';
    final now = DateTime.now();
    final sameDay = value.year == now.year &&
        value.month == now.month &&
        value.day == now.day;
    if (sameDay) return 'Today, ${DateFormat('h:mm a').format(value)}';

    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = value.year == yesterday.year &&
        value.month == yesterday.month &&
        value.day == yesterday.day;
    if (isYesterday) return 'Yesterday, ${DateFormat('h:mm a').format(value)}';

    return DateFormat('d MMM yyyy, h:mm a').format(value);
  }

  Color get _amountColor {
    switch (direction) {
      case KpTxnDirection.credit:
        return KhatuColors.success;
      case KpTxnDirection.debit:
        return KhatuColors.text;
      case KpTxnDirection.neutral:
        return KhatuColors.text;
    }
  }

  String get _amountPrefix {
    switch (direction) {
      case KpTxnDirection.credit:
        return '+ ';
      case KpTxnDirection.debit:
        return '- ';
      case KpTxnDirection.neutral:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final tone = iconColor ??
        (direction == KpTxnDirection.credit
            ? KhatuColors.success
            : KhatuColors.deepTeal);
    final when = formatWhen(timestamp);

    final row = Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: KhatuSpace.md,
        vertical: KhatuSpace.md,
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(KhatuRadius.md),
            ),
            child: Icon(
              icon ?? Icons.swap_horiz_rounded,
              color: tone,
              size: 20,
            ),
          ),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title.trim().isEmpty ? 'Transaction' : title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: KhatuColors.text,
                  ),
                ),
                if ((subtitle ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!.trim(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: KhatuText.caption,
                  ),
                ],
                if (when.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    when,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: KhatuText.caption.copyWith(fontSize: 10.5),
                  ),
                ],
              ],
            ),
          ),
          KhatuSpace.wSm,
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                amount == null
                    ? '--'
                    : '$_amountPrefix${kpMoney(amount)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w900,
                  color: _amountColor,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 4),
              if ((status ?? '').trim().isNotEmpty)
                KpStatusBadge(status: status, dense: true, showDot: false)
              else if ((trailingCaption ?? '').trim().isNotEmpty)
                Text(trailingCaption!, style: KhatuText.caption),
            ],
          ),
        ],
      ),
    );

    final tappable = onTap == null
        ? row
        : InkWell(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
            onTap: onTap,
            child: row,
          );

    return Material(
      color: Colors.transparent,
      child: showDivider
          ? Column(
              children: [
                tappable,
                const Divider(height: 1, indent: KhatuSpace.md + 42 + 12),
              ],
            )
          : tappable,
    );
  }
}

/// Card that wraps a run of [KpTransactionTile]s with hairline separators, so
/// a history list reads as one panel instead of a stack of floating rows.
class KpTransactionGroup extends StatelessWidget {
  const KpTransactionGroup({
    super.key,
    required this.children,
    this.header,
    this.padding = EdgeInsets.zero,
  });

  final List<Widget> children;
  final Widget? header;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: KhatuColors.surface,
        borderRadius: BorderRadius.circular(KhatuRadius.lg),
        border: Border.all(color: KhatuColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (header != null) header!,
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              const Divider(height: 1, indent: KhatuSpace.md + 42 + 12),
            children[i],
          ],
        ],
      ),
    );
  }
}
