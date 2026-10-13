import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// Small, resilient visual used across the loan journey. The image is purely
/// presentational; every verification and decision state still comes from the
/// existing server-backed flows.
class LoanVisual extends StatelessWidget {
  const LoanVisual({
    super.key,
    required this.asset,
    required this.fallbackIcon,
    this.size = 104,
  });

  final String asset;
  final IconData fallbackIcon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        asset,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
        errorBuilder: (_, __, ___) => DecoratedBox(
          decoration: BoxDecoration(
            color: KhatuColors.softTeal,
            borderRadius: BorderRadius.circular(KhatuRadius.lg),
          ),
          child:
              Icon(fallbackIcon, color: KhatuColors.deepTeal, size: size * .42),
        ),
      ),
    );
  }
}
