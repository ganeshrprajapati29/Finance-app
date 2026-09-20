import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import 'kp_status_badge.dart';

/// A single tappable service in a [KpServiceGrid] - icon well, label, optional
/// "NEW"/"OFF" ribbon.
///
/// Deliberately square-ish and label-under-icon (the pattern Indian payment
/// apps have trained users on) rather than a list row, so 4 fit per line on a
/// small phone without truncation.
class KpActionTile extends StatelessWidget {
  const KpActionTile({
    super.key,
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

  /// Icon + well tint. Defaults to brand teal.
  final Color? color;

  /// Short ribbon text, e.g. `NEW`, `10% OFF`.
  final String? badge;
  final Color? badgeColor;

  final String? subtitle;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? KhatuColors.teal;
    final active = enabled && onTap != null;
    final opacity = active ? 1.0 : 0.45;

    return Opacity(
      opacity: opacity,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(KhatuRadius.md),
          onTap: active ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: KhatuSpace.sm),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: tone.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(KhatuRadius.lg),
                        border: Border.all(color: tone.withValues(alpha: 0.16)),
                      ),
                      child: (assetPath ?? '').isEmpty
                          ? Icon(icon, color: tone, size: 24)
                          : Padding(
                              padding: const EdgeInsets.all(4),
                              child: Image.asset(
                                assetPath!,
                                fit: BoxFit.contain,
                                filterQuality: FilterQuality.medium,
                                errorBuilder: (_, __, ___) =>
                                    Icon(icon, color: tone, size: 24),
                              ),
                            ),
                    ),
                    if ((badge ?? '').trim().isNotEmpty)
                      Positioned(
                        top: -5,
                        right: -8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: badgeColor ?? KhatuColors.saffron,
                            borderRadius:
                                BorderRadius.circular(KhatuRadius.pill),
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: Text(
                            badge!.trim(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: KhatuSpace.sm),
                Text(
                  label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: KhatuColors.text,
                    height: 1.2,
                  ),
                ),
                if ((subtitle ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: KhatuText.caption.copyWith(fontSize: 10),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Full-width row action: leading icon well, title + subtitle, trailing chevron
/// or status badge. Used for settings, loan actions, support links.
class KpListActionTile extends StatelessWidget {
  const KpListActionTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.color,
    this.trailing,
    this.status,
    this.statusLabel,
    this.dense = false,
    this.showChevron = true,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color? color;
  final Widget? trailing;

  /// When set, a [KpStatusBadge] is rendered on the trailing edge.
  final String? status;
  final String? statusLabel;

  final bool dense;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? KhatuColors.teal;

    return Material(
      color: KhatuColors.surface,
      borderRadius: BorderRadius.circular(KhatuRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: KhatuSpace.md,
            vertical: dense ? KhatuSpace.md : KhatuSpace.lg - 2,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
            border: Border.all(color: KhatuColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: dense ? 36 : 42,
                height: dense ? 36 : 42,
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(KhatuRadius.md),
                ),
                child: Icon(icon, color: tone, size: dense ? 18 : 21),
              ),
              KhatuSpace.wMd,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: dense ? 13.5 : 14.5,
                        fontWeight: FontWeight.w800,
                        color: KhatuColors.text,
                      ),
                    ),
                    if ((subtitle ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: KhatuText.caption,
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null)
                trailing!
              else if (status != null) ...[
                KhatuSpace.wSm,
                KpStatusBadge(status: status, label: statusLabel, dense: true),
              ] else if (showChevron)
                const Icon(
                  Icons.chevron_right_rounded,
                  color: KhatuColors.faint,
                  size: 22,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small metric panel: label on top, value below, optional delta/footnote.
/// Two or three of these in a Row make the compact dashboard stat strip.
class KpMetricTile extends StatelessWidget {
  const KpMetricTile({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.footnote,
    this.color,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData? icon;
  final String? footnote;
  final Color? color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? KhatuColors.deepTeal;

    return Material(
      color: KhatuColors.surface,
      borderRadius: BorderRadius.circular(KhatuRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(KhatuSpace.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(KhatuRadius.md),
            border: Border.all(color: KhatuColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 14, color: tone),
                    const SizedBox(width: 5),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: KhatuText.caption,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: KhatuSpace.sm),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: tone,
                  letterSpacing: -0.3,
                ),
              ),
              if ((footnote ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  footnote!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KhatuText.caption.copyWith(fontSize: 10.5),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
