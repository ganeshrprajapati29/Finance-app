import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// Formats paise-free rupee amounts the way Indian users expect
/// (1,23,456 grouping). Kept here so every money surface agrees.
String kpMoney(num? value, {bool withSymbol = true, int decimals = 0}) {
  final amount = (value ?? 0).toDouble();
  final negative = amount < 0;
  final fixed = amount.abs().toStringAsFixed(decimals);
  final parts = fixed.split('.');
  var whole = parts.first;

  // Indian grouping: last 3 digits, then pairs.
  final buffer = StringBuffer();
  if (whole.length > 3) {
    final last3 = whole.substring(whole.length - 3);
    var rest = whole.substring(0, whole.length - 3);
    final groups = <String>[];
    while (rest.length > 2) {
      groups.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) groups.insert(0, rest);
    buffer.write(groups.join(','));
    buffer.write(',');
    buffer.write(last3);
  } else {
    buffer.write(whole);
  }
  whole = buffer.toString();

  final decimalPart = parts.length > 1 ? '.${parts[1]}' : '';
  return '${negative ? '-' : ''}${withSymbol ? '₹' : ''}$whole$decimalPart';
}

/// Hero money card: wallet balance, loan limit, outstanding, etc.
///
/// Renders on the brand gradient with an optional pair of inline actions
/// (Add money / Withdraw) and up to two secondary stats. Amount can be masked
/// via [obscured] for shoulder-surfing safety.
class KpBalanceCard extends StatelessWidget {
  const KpBalanceCard({
    super.key,
    required this.label,
    required this.amount,
    this.caption,
    this.stats = const [],
    this.primaryActionLabel,
    this.onPrimaryAction,
    this.secondaryActionLabel,
    this.onSecondaryAction,
    this.primaryActionIcon = Icons.add_rounded,
    this.secondaryActionIcon = Icons.account_balance_outlined,
    this.gradient,
    this.trailing,
    this.obscured = false,
    this.onToggleObscure,
    this.loading = false,
  });

  final String label;
  final num? amount;
  final String? caption;

  /// Small stat pairs shown under the amount, e.g. `('This month', '₹4,200')`.
  final List<KpBalanceStat> stats;

  final String? primaryActionLabel;
  final VoidCallback? onPrimaryAction;
  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryAction;
  final IconData primaryActionIcon;
  final IconData secondaryActionIcon;

  final Gradient? gradient;
  final Widget? trailing;

  final bool obscured;
  final VoidCallback? onToggleObscure;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.xl),
      decoration: BoxDecoration(
        gradient: gradient ?? KhatuColors.brandGradient,
        borderRadius: BorderRadius.circular(KhatuRadius.xl),
        boxShadow: KhatuShadow.raised,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.82),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    if (onToggleObscure != null)
                      IconButton(
                        onPressed: onToggleObscure,
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.only(left: 6),
                        constraints: const BoxConstraints(),
                        tooltip: obscured ? 'Show balance' : 'Hide balance',
                        icon: Icon(
                          obscured
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 16,
                          color: Colors.white.withValues(alpha: 0.82),
                        ),
                      ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: KhatuSpace.sm),
          if (loading)
            Container(
              width: 160,
              height: 34,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(KhatuRadius.sm),
              ),
            )
          else
            Text(
              obscured ? '₹ ••••••' : kpMoney(amount),
              style: KhatuText.amountLarge,
            ),
          if ((caption ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: KhatuSpace.xs + 2),
            Text(
              caption!,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.78),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          if (stats.isNotEmpty) ...[
            const SizedBox(height: KhatuSpace.lg),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: KhatuSpace.md,
                vertical: KhatuSpace.md,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(KhatuRadius.md),
                border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
              ),
              child: Row(
                children: [
                  for (var i = 0; i < stats.length; i++) ...[
                    if (i > 0)
                      Container(
                        width: 1,
                        height: 30,
                        margin: const EdgeInsets.symmetric(
                            horizontal: KhatuSpace.md),
                        color: Colors.white.withValues(alpha: 0.16),
                      ),
                    Expanded(child: _StatBlock(stat: stats[i])),
                  ],
                ],
              ),
            ),
          ],
          if (primaryActionLabel != null || secondaryActionLabel != null) ...[
            const SizedBox(height: KhatuSpace.lg),
            Row(
              children: [
                if (primaryActionLabel != null)
                  Expanded(
                    child: _CardButton(
                      label: primaryActionLabel!,
                      icon: primaryActionIcon,
                      onTap: onPrimaryAction,
                      filled: true,
                    ),
                  ),
                if (primaryActionLabel != null && secondaryActionLabel != null)
                  const SizedBox(width: KhatuSpace.md),
                if (secondaryActionLabel != null)
                  Expanded(
                    child: _CardButton(
                      label: secondaryActionLabel!,
                      icon: secondaryActionIcon,
                      onTap: onSecondaryAction,
                      filled: false,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class KpBalanceStat {
  const KpBalanceStat({required this.label, required this.value, this.icon});

  final String label;
  final String value;
  final IconData? icon;
}

class _StatBlock extends StatelessWidget {
  const _StatBlock({required this.stat});

  final KpBalanceStat stat;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            if (stat.icon != null) ...[
              Icon(stat.icon,
                  size: 12, color: Colors.white.withValues(alpha: 0.75)),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                stat.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.75),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 3),
        Text(
          stat.value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _CardButton extends StatelessWidget {
  const _CardButton({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.filled,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? Colors.white : Colors.white.withValues(alpha: 0.14),
      borderRadius: BorderRadius.circular(KhatuRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        onTap: onTap,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
            border: filled
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.28)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 17,
                color: filled ? KhatuColors.deepTeal : Colors.white,
              ),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: filled ? KhatuColors.deepTeal : Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 13.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
