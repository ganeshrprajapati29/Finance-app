import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/khatupay_qr_card.dart';
import '../../widgets/kp_widgets.dart';
import 'business_widgets.dart';

/// Business QR: shows the live QR, or exactly what is left before one can be
/// created. It never offers "Create QR" before payments are activated.
class MerchantQrPage extends ConsumerStatefulWidget {
  const MerchantQrPage({super.key});
  @override
  ConsumerState<MerchantQrPage> createState() => _MerchantQrPageState();
}

class _MerchantQrPageState extends ConsumerState<MerchantQrPage> {
  bool busy = false;
  String? busyLabel;
  String? error, notice;

  Future<void> _run(String label, Future<String?> Function() work) async {
    if (busy) return;
    setState(() {
      busy = true;
      busyLabel = label;
      error = null;
      notice = null;
    });
    try {
      final message = await work();
      ref.invalidate(merchantDashboardProvider);
      if (mounted && message != null) setState(() => notice = message);
    } catch (e) {
      if (mounted) {
        setState(() => error = e is String
            ? e
            : friendlyErrorMessage(e,
                fallback: 'That did not go through. Please try again.'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> refreshStatus() => _run('Checking status...', () async {
        await MerchantBusinessService().syncRazorpayOnboarding();
        return 'Status is up to date.';
      });

  Future<void> createQr() => _run('Creating your QR...', () async {
        await MerchantBusinessService().createQr();
        return 'Your business QR is ready.';
      });

  Future<void> syncPayments() => _run('Refreshing payments...', () async {
        final count = await MerchantBusinessService().syncQrPayments();
        ref.invalidate(merchantPaymentsProvider);
        ref.invalidate(merchantBalanceProvider);
        return count == 0
            ? 'No new payments yet.'
            : '$count payment${count == 1 ? '' : 's'} updated.';
      });

  @override
  Widget build(BuildContext context) => KpAppShell(
        title: 'Business QR',
        onRefresh: () async => ref.invalidate(merchantDashboardProvider),
        children: [
          if (notice != null) ...[
            KpNoticeBanner(
                icon: Icons.check_circle_outline,
                color: KhatuColors.success,
                message: notice!),
            const SizedBox(height: 12),
          ],
          if (error != null) ...[
            KpErrorBanner(message: error!),
            const SizedBox(height: 12),
          ],
          ref.watch(merchantDashboardProvider).when(
                loading: () => const Padding(
                    padding: EdgeInsets.only(top: 80),
                    child: Center(child: CircularProgressIndicator())),
                error: (e, _) => KpErrorState.fromError(e,
                    onRetry: () => ref.invalidate(merchantDashboardProvider)),
                data: (data) {
                  final business = data.business;
                  if (business == null) {
                    return KpEmptyState(
                      title: 'Set up your business first',
                      message:
                          'Create your business profile to get a QR for collecting payments.',
                      icon: Icons.storefront_outlined,
                      actionLabel: 'Start business setup',
                      onAction: () => router.go('/business/register'),
                    );
                  }
                  final onboarding = data.onboarding;
                  final qr = data.qr;
                  final payload = (qr?['payload'] ?? '').toString();

                  if (onboarding.qrActive && payload.isNotEmpty) {
                    return Column(children: [
                      KhatuPayQrCard(
                          imageUrl: qr!['qrImageDataUrl']?.toString(),
                          qrData: payload,
                          showCenterMark: false,
                          merchantName: business.businessName,
                          // Provider QR has no UPI ID; qrData above is always set here.
                          upi: '',
                          displayLabel:
                              (qr['qrReference'] ?? business.publicId).toString(),
                          scanLabel: 'SCAN & PAY WITH ANY UPI APP',
                          note:
                              'Payments are confirmed by the bank and settled to your verified account.'),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: OutlinedButton.icon(
                            onPressed: busy ? null : syncPayments,
                            icon: busy
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.refresh_rounded, size: 18),
                            label: Text(busy
                                ? (busyLabel ?? 'Please wait...')
                                : 'Refresh received payments')),
                      ),
                      const SizedBox(height: 12),
                      const BusinessTrustRow(
                          icon: Icons.info_outline_rounded,
                          text:
                              'Print this QR and keep it at your counter. To replace a damaged QR, contact support.'),
                    ]);
                  }

                  if (onboarding.canCreateQr) {
                    return _QrState(
                      icon: Icons.qr_code_2_rounded,
                      color: KhatuColors.teal,
                      title: 'Payments are activated',
                      message:
                          'Create your business QR now. It works with PhonePe, Google Pay, Paytm and every UPI app.',
                      action: BusinessPrimaryButton(
                          label: 'Create my business QR',
                          busyLabel: busyLabel,
                          icon: Icons.qr_code_2_rounded,
                          busy: busy,
                          onPressed: createQr),
                    );
                  }

                  final next = onboarding.nextStep == null
                      ? null
                      : onboarding.step(onboarding.nextStep!);
                  final activation = onboarding.step('activation');
                  final waiting = next == null;
                  return Column(children: [
                    _QrState(
                      icon: waiting
                          ? Icons.hourglass_top_rounded
                          : Icons.lock_outline_rounded,
                      color: waiting ? KhatuColors.warning : KhatuColors.deepTeal,
                      title: waiting
                          ? 'Your QR is on the way'
                          : 'Finish setup to get your QR',
                      message: waiting
                          ? (activation?.message ??
                              'We are verifying your business and will notify you when your QR is ready.')
                          : 'Next step: ${next.title}. ${next.message}',
                      action: waiting
                          ? SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: OutlinedButton.icon(
                                  onPressed: busy ? null : refreshStatus,
                                  icon: busy
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2))
                                      : const Icon(Icons.refresh_rounded, size: 18),
                                  label: Text(busy
                                      ? (busyLabel ?? 'Please wait...')
                                      : 'Check latest status')),
                            )
                          : BusinessPrimaryButton(
                              label: businessStepAction(next),
                              onPressed: () =>
                                  router.push(businessStepRoute(next.key))),
                    ),
                    const SizedBox(height: 12),
                    KpCard(
                      radius: KhatuRadius.lg,
                      child: Column(children: [
                        for (var i = 0; i < onboarding.steps.length; i++)
                          BusinessStepTile(
                            index: i,
                            step: onboarding.steps[i],
                            isLast: i == onboarding.steps.length - 1,
                          ),
                      ]),
                    ),
                  ]);
                },
              ),
        ],
      );
}

class _QrState extends StatelessWidget {
  const _QrState(
      {required this.icon,
      required this.color,
      required this.title,
      required this.message,
      required this.action});
  final IconData icon;
  final Color color;
  final String title, message;
  final Widget action;

  @override
  Widget build(BuildContext context) => KpCard(
        radius: KhatuRadius.xl,
        padding: const EdgeInsets.fromLTRB(20, 26, 20, 20),
        child: Column(children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 42),
          ),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontFamily: 'Roboto',
                  fontSize: 20,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Text(message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontFamily: 'Roboto',
                  color: KhatuColors.muted,
                  fontSize: 13.5,
                  height: 1.5)),
          const SizedBox(height: 20),
          action,
        ]),
      );
}
