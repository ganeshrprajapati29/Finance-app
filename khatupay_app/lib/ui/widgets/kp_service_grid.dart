import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import 'kp_action_tile.dart';

/// One entry in a [KpServiceGrid].
class KpServiceItem {
  const KpServiceItem({
    required this.icon,
    required this.label,
    this.assetPath,
    this.onTap,
    this.color,
    this.badge,
    this.badgeColor,
    this.subtitle,
    this.enabled = true,
  });

  final IconData icon;
  final String? assetPath;
  final String label;
  final VoidCallback? onTap;
  final Color? color;
  final String? badge;
  final Color? badgeColor;
  final String? subtitle;
  final bool enabled;
}

/// Responsive grid of service shortcuts (Recharge, Electricity, Loan, QR...).
///
/// Column count adapts to the available width rather than being fixed at 4, so
/// the same grid reads correctly on a 320dp phone and on a tablet. Wrapped in
/// a white card by default, matching the "clean panel of services" pattern.
class KpServiceGrid extends StatelessWidget {
  const KpServiceGrid({
    super.key,
    required this.items,
    this.columns,
    this.padding = const EdgeInsets.symmetric(
      horizontal: KhatuSpace.sm,
      vertical: KhatuSpace.md,
    ),
    this.inCard = true,
    this.tileWidth = 84,
  });

  final List<KpServiceItem> items;

  /// Fixed column count. When null the grid computes it from [tileWidth].
  final int? columns;

  final EdgeInsetsGeometry padding;
  final bool inCard;

  /// Target width per tile, used to derive the column count.
  final double tileWidth;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final grid = LayoutBuilder(
      builder: (context, constraints) {
        final available = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        final computed = columns ?? (available / tileWidth).floor();
        final crossAxisCount = computed.clamp(3, 6);

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          itemCount: items.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: KhatuSpace.xs,
            crossAxisSpacing: KhatuSpace.xs,
            childAspectRatio: 0.82,
          ),
          itemBuilder: (context, index) {
            final item = items[index];
            return KpActionTile(
              icon: item.icon,
              assetPath: item.assetPath,
              label: item.label,
              onTap: item.onTap,
              color: item.color,
              badge: item.badge,
              badgeColor: item.badgeColor,
              subtitle: item.subtitle,
              enabled: item.enabled,
            );
          },
        );
      },
    );

    if (!inCard) return Padding(padding: padding, child: grid);

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: KhatuColors.surface,
        borderRadius: BorderRadius.circular(KhatuRadius.lg),
        border: Border.all(color: KhatuColors.line),
      ),
      child: grid,
    );
  }
}

/// Horizontally scrolling variant, for a long list of shortcuts that should
/// not push the rest of the page down (e.g. "Pay again" contacts).
class KpServiceRail extends StatelessWidget {
  const KpServiceRail({
    super.key,
    required this.items,
    this.height = 104,
    this.itemWidth = 80,
  });

  final List<KpServiceItem> items;
  final double height;
  final double itemWidth;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: KhatuSpace.sm),
        itemBuilder: (context, index) {
          final item = items[index];
          return SizedBox(
            width: itemWidth,
            child: KpActionTile(
              icon: item.icon,
              assetPath: item.assetPath,
              label: item.label,
              onTap: item.onTap,
              color: item.color,
              badge: item.badge,
              badgeColor: item.badgeColor,
              subtitle: item.subtitle,
              enabled: item.enabled,
            ),
          );
        },
      ),
    );
  }
}
