import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import 'app_back_button.dart';

/// Standard page chrome for Khatu Pay.
///
/// Gives every screen the same gutters, max content width (so the app does not
/// stretch into unreadable line lengths on tablets/foldables), pull-to-refresh
/// behaviour and app bar treatment. Screens supply [children] and stop
/// re-implementing Scaffold + ListView + padding each time.
class KpAppShell extends StatelessWidget {
  const KpAppShell({
    super.key,
    required this.title,
    this.subtitle,
    this.children = const [],
    this.body,
    this.actions,
    this.onRefresh,
    this.floatingActionButton,
    this.bottomBar,
    this.showBack = true,
    this.padding,
    this.backgroundColor,
    this.centerTitle = true,
    this.appBar,
    this.maxContentWidth = 620,
    this.scrollable = true,
  });

  final String title;
  final String? subtitle;

  /// Convenience list body. Ignored when [body] is supplied.
  final List<Widget> children;

  /// Full custom body. Takes precedence over [children].
  final Widget? body;

  final List<Widget>? actions;
  final Future<void> Function()? onRefresh;
  final Widget? floatingActionButton;
  final Widget? bottomBar;
  final bool showBack;
  final EdgeInsetsGeometry? padding;
  final Color? backgroundColor;
  final bool centerTitle;

  /// Escape hatch for screens that need a bespoke app bar (tabs, search...).
  final PreferredSizeWidget? appBar;

  final double maxContentWidth;

  /// When false the body is laid out without a scroll view (the screen
  /// manages its own scrolling, e.g. a CustomScrollView or a fixed layout).
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    Widget content = body ??
        (scrollable
            ? ListView(
                padding: padding ?? KhatuSpace.pageScroll,
                physics: const AlwaysScrollableScrollPhysics(),
                children: children,
              )
            : Padding(
                padding: padding ?? KhatuSpace.page,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: children,
                ),
              ));

    if (onRefresh != null) {
      content = RefreshIndicator(
        color: KhatuColors.teal,
        onRefresh: onRefresh!,
        child: content,
      );
    }

    return Scaffold(
      backgroundColor: backgroundColor ?? KhatuColors.bg,
      appBar: appBar ??
          AppBar(
            centerTitle: centerTitle,
            leading: showBack ? const AppBackButton() : null,
            automaticallyImplyLeading: showBack,
            titleSpacing: showBack ? 0 : KhatuSpace.lg,
            title: (subtitle ?? '').trim().isEmpty
                ? Text(title)
                : Column(
                    crossAxisAlignment: centerTitle
                        ? CrossAxisAlignment.center
                        : CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(title),
                      Text(
                        subtitle!,
                        style: KhatuText.caption,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
            actions: actions,
          ),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomBar,
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxContentWidth),
            child: content,
          ),
        ),
      ),
    );
  }
}

/// Section heading with an optional trailing text action. Used to break long
/// pages into scannable blocks.
class KpSectionHeader extends StatelessWidget {
  const KpSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.icon,
    this.padding = const EdgeInsets.fromLTRB(2, KhatuSpace.xl, 2, KhatuSpace.md),
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: KhatuColors.deepTeal),
            KhatuSpace.wSm,
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: KhatuText.h3),
                if ((subtitle ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: KhatuText.caption,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(actionLabel!),
                  const Icon(Icons.chevron_right_rounded, size: 16),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Flat, hairline-bordered surface - the default container for content blocks.
class KpCard extends StatelessWidget {
  const KpCard({
    super.key,
    required this.child,
    this.padding = KhatuSpace.card,
    this.margin,
    this.color,
    this.borderColor,
    this.onTap,
    this.radius = KhatuRadius.md,
    this.elevated = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final Color? borderColor;
  final VoidCallback? onTap;
  final double radius;
  final bool elevated;

  @override
  Widget build(BuildContext context) {
    final decorated = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? KhatuColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? KhatuColors.line),
        boxShadow: elevated ? KhatuShadow.soft : null,
      ),
      child: child,
    );

    final content = onTap == null
        ? decorated
        : Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(radius),
              onTap: onTap,
              child: decorated,
            ),
          );

    if (margin == null) return content;
    return Padding(padding: margin!, child: content);
  }
}

/// Informational strip (safety cue, KYC nudge, service notice).
class KpNoticeBanner extends StatelessWidget {
  const KpNoticeBanner({
    super.key,
    required this.message,
    this.icon = Icons.verified_user_outlined,
    this.color = KhatuColors.deepTeal,
    this.title,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final String? title;
  final IconData icon;
  final Color color;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if ((title ?? '').trim().isNotEmpty) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w900,
                      fontSize: 13.5,
                    ),
                  ),
                  const SizedBox(height: 3),
                ],
                Text(
                  message,
                  style: TextStyle(
                    color: color.withValues(alpha: 0.92),
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                    height: 1.35,
                  ),
                ),
                if (actionLabel != null && onAction != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: TextButton(
                      onPressed: onAction,
                      style: TextButton.styleFrom(
                        foregroundColor: color,
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 30),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(actionLabel!),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
