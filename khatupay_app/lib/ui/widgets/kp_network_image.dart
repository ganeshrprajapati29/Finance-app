import 'package:flutter/material.dart';

import '../../core/app_theme.dart';

/// Image wrapper that never lets a broken/slow image break a layout.
///
/// Accepts either a local asset path (`assets/...`) or an https URL and picks
/// the right provider automatically. While loading it shows a tinted
/// placeholder of the same size; on failure it falls back to [fallbackAsset]
/// (if it resolves) and then to a neutral icon well. Nothing here ever throws
/// on a null/empty source - callers routinely pass banner URLs straight from
/// the API.
class KpNetworkImage extends StatelessWidget {
  const KpNetworkImage({
    super.key,
    required this.source,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.fallbackAsset,
    this.fallbackIcon = Icons.image_outlined,
    this.backgroundColor,
  });

  /// Asset path or remote URL. Null/empty renders the fallback directly.
  final String? source;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  /// Local asset shown when [source] is empty or fails to load.
  final String? fallbackAsset;
  final IconData fallbackIcon;
  final Color? backgroundColor;

  static bool _isRemote(String value) =>
      value.startsWith('http://') || value.startsWith('https://');

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(KhatuRadius.md);
    final src = (source ?? '').trim();

    Widget child;
    if (src.isEmpty) {
      child = _fallback();
    } else if (_isRemote(src)) {
      child = Image.network(
        src,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (context, widget, progress) {
          if (progress == null) return widget;
          return _placeholder();
        },
        errorBuilder: (_, __, ___) => _fallback(),
      );
    } else {
      child = Image.asset(
        src,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _fallback(),
      );
    }

    return ClipRRect(borderRadius: radius, child: child);
  }

  Widget _placeholder() => Container(
        width: width,
        height: height,
        color: backgroundColor ?? KhatuColors.surfaceAlt,
        alignment: Alignment.center,
        child: const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: KhatuColors.teal,
          ),
        ),
      );

  Widget _fallback() {
    final asset = (fallbackAsset ?? '').trim();
    if (asset.isNotEmpty) {
      return Image.asset(
        asset,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _iconWell(),
      );
    }
    return _iconWell();
  }

  Widget _iconWell() => Container(
        width: width,
        height: height,
        color: backgroundColor ?? KhatuColors.softTeal,
        alignment: Alignment.center,
        child: Icon(
          fallbackIcon,
          color: KhatuColors.teal.withValues(alpha: 0.55),
          size: 28,
        ),
      );
}

/// Circular avatar built on [KpNetworkImage]. Falls back to the user's
/// initials so an empty photo URL still renders something meaningful.
class KpAvatar extends StatelessWidget {
  const KpAvatar({
    super.key,
    this.source,
    this.name,
    this.size = 44,
    this.background,
    this.foreground,
  });

  final String? source;
  final String? name;
  final double size;
  final Color? background;
  final Color? foreground;

  static String initials(String? raw) {
    final parts = (raw ?? '')
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'KP';
    if (parts.length == 1) {
      final single = parts.first;
      return (single.length > 1 ? single.substring(0, 2) : single)
          .toUpperCase();
    }
    return (parts.first[0] + parts[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final src = (source ?? '').trim();
    final bg = background ?? KhatuColors.softTeal;
    final fg = foreground ?? KhatuColors.deepTeal;

    if (src.isEmpty) {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Text(
          initials(name),
          style: TextStyle(
            color: fg,
            fontWeight: FontWeight.w900,
            fontSize: size * 0.36,
          ),
        ),
      );
    }

    return KpNetworkImage(
      source: src,
      width: size,
      height: size,
      borderRadius: BorderRadius.circular(size),
      fallbackIcon: Icons.person_outline_rounded,
      backgroundColor: bg,
    );
  }
}
