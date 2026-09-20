import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';

/// Failure state with a retry affordance.
///
/// Prefer [KpErrorState.fromError] so raw `DioException`/`SocketException`
/// text is never shown to a user - it routes through [friendlyErrorMessage]
/// which strips gateway/vendor names and stack-trace-shaped strings.
class KpErrorState extends StatelessWidget {
  const KpErrorState({
    super.key,
    required this.message,
    this.title = 'Something went wrong',
    this.icon = Icons.cloud_off_rounded,
    this.onRetry,
    this.retryLabel = 'Try again',
    this.compact = false,
  });

  /// Builds a state from any caught error, mapped to a friendly sentence.
  factory KpErrorState.fromError(
    Object error, {
    String title = 'Something went wrong',
    String fallback = 'Please try again in a moment.',
    VoidCallback? onRetry,
    bool compact = false,
  }) {
    return KpErrorState(
      title: title,
      message: friendlyErrorMessage(error, fallback: fallback),
      onRetry: onRetry,
      compact: compact,
    );
  }

  final String message;
  final String title;
  final IconData icon;
  final VoidCallback? onRetry;
  final String retryLabel;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: KhatuSpace.xxl,
          vertical: compact ? KhatuSpace.xl : KhatuSpace.xxxl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: compact ? 56 : 72,
              height: compact ? 56 : 72,
              decoration: const BoxDecoration(
                color: KhatuColors.softRed,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: compact ? 26 : 34,
                color: KhatuColors.danger,
              ),
            ),
            SizedBox(height: compact ? KhatuSpace.md : KhatuSpace.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: compact ? KhatuText.h3 : KhatuText.h2,
            ),
            KhatuSpace.gapSm,
            Text(
              message.trim().isEmpty
                  ? 'Please try again in a moment.'
                  : message.trim(),
              textAlign: TextAlign.center,
              style: KhatuText.bodyMuted,
            ),
            if (onRetry != null) ...[
              KhatuSpace.gapLg,
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: Text(retryLabel),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Inline (non-blocking) error strip, for when part of a screen failed but the
/// rest is still usable.
class KpErrorBanner extends StatelessWidget {
  const KpErrorBanner({
    super.key,
    required this.message,
    this.onRetry,
    this.icon = Icons.error_outline_rounded,
    this.color = KhatuColors.danger,
  });

  final String message;
  final VoidCallback? onRetry;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.20)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          KhatuSpace.wMd,
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 13,
                height: 1.35,
              ),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              style: TextButton.styleFrom(
                foregroundColor: color,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }
}
