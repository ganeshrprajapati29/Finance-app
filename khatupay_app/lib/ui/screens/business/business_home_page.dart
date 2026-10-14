import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../../models/business/merchant_business.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../widgets/kp_widgets.dart';
import 'business_widgets.dart';

/// Business hub. Until the QR is live it is a guided checklist with exactly
/// one thing to do next; after that it becomes the collections dashboard.
class BusinessHomePage extends ConsumerWidget {
  const BusinessHomePage({super.key});

  Future<void> _open(WidgetRef ref, String route) async {
    await router.push(route);
    // Any setup screen may have changed the checklist.
    ref.invalidate(merchantDashboardProvider);
    ref.invalidate(merchantBalanceProvider);
  }

  Future<void> _restart(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Start the application again?'),
        content: const Text(
            'Your business details and Razorpay connection request will be cleared so you can fill them again. Your PAN and Aadhaar verification stays.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Start again')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await MerchantBusinessService().restartApplication();
      ref.invalidate(merchantDashboardProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Application reset. Start with your business details.')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(friendlyErrorMessage(e,
                fallback: 'The application could not be reset. Please try again.'))));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(merchantDashboardProvider);
    return KpAppShell(
      title: 'KhatuPay Business',
      onRefresh: () async {
        ref.invalidate(merchantDashboardProvider);
        ref.invalidate(merchantBalanceProvider);
        await ref.read(merchantDashboardProvider.future).catchError((_) => const MerchantDashboard());
      },
      children: [
        profile.when(
          loading: () => const _HomeSkeleton(),
          error: (e, _) => KpErrorState.fromError(e,
              onRetry: () => ref.invalidate(merchantDashboardProvider)),
          data: (data) {
            final business = data.business;
            if (business == null) {
              return _Welcome(onStart: () => _open(ref, '/business/register'));
            }
            final onboarding = data.onboarding;
            final live = onboarding.qrActive;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _BusinessHero(business: business, onboarding: onboarding),
                if (!live) ...[
                  const KpSectionHeader(
                      title: 'Finish setup to accept payments',
                      subtitle: 'Complete the steps in order. Your progress is saved.'),
                  KpCard(
                    radius: KhatuRadius.lg,
                    child: Column(children: [
                      for (var i = 0; i < onboarding.steps.length; i++)
                        BusinessStepTile(
                          index: i,
                          step: onboarding.steps[i],
                          isLast: i == onboarding.steps.length - 1,
                          highlight: onboarding.steps[i].key == onboarding.nextStep,
                          onAction: () => _open(
                              ref, businessStepRoute(onboarding.steps[i].key)),
                        ),
                    ]),
                  ),
                  if (!onboarding.connected &&
                      (business.razorpay?['accountId'] ?? '').toString().isEmpty) ...[
                    const SizedBox(height: 8),
                    _ApplicationActions(
                      onEdit: () => _open(ref, '/business/register'),
                      onRestart: () => _restart(context, ref),
                    ),
                  ],
                  if (onboarding.nextStep == null) ...[
                    const SizedBox(height: 12),
                    KpNoticeBanner(
                      icon: Icons.schedule_rounded,
                      color: KhatuColors.warning,
                      title: 'Nothing more is needed from you',
                      message:
                          'We are verifying your business. You will get a notification as soon as your QR is ready.',
                      actionLabel: 'View status',
                      onAction: () => _open(ref, '/business/verification'),
                    ),
                  ],
                ] else ...[
                  const SizedBox(height: 14),
                  _QrReadyCard(onOpen: () => _open(ref, '/business/qr')),
                  const KpSectionHeader(
                      title: 'Collections',
                      subtitle: 'Money received on your business QR'),
                  ref.watch(merchantBalanceProvider).when(
                        loading: () => const LinearProgressIndicator(minHeight: 2),
                        error: (_, __) => const KpErrorBanner(
                            message: 'Balance is temporarily unavailable. Pull down to refresh.'),
                        data: (b) => Row(children: [
                          Expanded(child: _Balance(label: 'Available', value: b['available'], accent: KhatuColors.success)),
                          const SizedBox(width: 10),
                          Expanded(child: _Balance(label: 'Pending', value: b['pending'], accent: KhatuColors.warning)),
                          const SizedBox(width: 10),
                          Expanded(child: _Balance(label: 'Settled', value: b['settled'], accent: KhatuColors.info)),
                        ]),
                      ),
                ],
                const KpSectionHeader(title: 'Manage business'),
                KpServiceGrid(items: [
                  KpServiceItem(
                      icon: Icons.qr_code_2_rounded,
                      label: 'Business QR',
                      color: KhatuColors.teal,
                      onTap: () => _open(ref, '/business/qr')),
                  KpServiceItem(
                      icon: Icons.receipt_long_outlined,
                      label: 'Transactions',
                      color: KhatuColors.info,
                      onTap: () => _open(ref, '/business/transactions')),
                  KpServiceItem(
                      icon: Icons.account_balance_outlined,
                      label: 'Settlements',
                      color: KhatuColors.gold,
                      onTap: () => _open(ref, '/business/settlements')),
                  KpServiceItem(
                      icon: Icons.support_agent_rounded,
                      label: 'Support',
                      color: KhatuColors.deepTeal,
                      onTap: () => _open(ref, '/support?subject=Business%20payments')),
                ]),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _BusinessHero extends StatelessWidget {
  const _BusinessHero({required this.business, required this.onboarding});
  final MerchantBusiness business;
  final MerchantOnboarding onboarding;

  @override
  Widget build(BuildContext context) {
    final live = onboarding.qrActive;
    final done = onboarding.steps.where((s) => s.isDone).length;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: KhatuColors.heroGradient,
        borderRadius: BorderRadius.circular(KhatuRadius.xl),
        boxShadow: KhatuShadow.raised,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(16)),
            child: Text(
                business.businessName.trim().isEmpty
                    ? 'B'
                    : business.businessName.trim()[0].toUpperCase(),
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(business.businessName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          color: Colors.white,
                          fontSize: 19,
                          height: 1.2,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text('${business.category}  •  ID ${business.publicId}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          color: Colors.white70,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600)),
                ]),
          ),
        ]),
        const SizedBox(height: 18),
        Row(children: [
          Icon(live ? Icons.verified_rounded : Icons.flag_outlined,
              color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
                live
                    ? 'Live - accepting payments'
                    : 'Setup $done of ${onboarding.steps.length} steps complete',
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: Colors.white,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800)),
          ),
          Text('${onboarding.progress}%',
              style: const TextStyle(
                  fontFamily: 'Roboto',
                  color: Colors.white,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: (onboarding.progress / 100).clamp(0.0, 1.0),
            minHeight: 8,
            backgroundColor: Colors.white.withValues(alpha: 0.22),
            valueColor: const AlwaysStoppedAnimation(Colors.white),
          ),
        ),
      ]),
    );
  }
}

class _ApplicationActions extends StatelessWidget {
  const _ApplicationActions({required this.onEdit, required this.onRestart});
  final VoidCallback onEdit, onRestart;

  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Edit details'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextButton.icon(
            onPressed: onRestart,
            icon: const Icon(Icons.restart_alt_rounded, size: 18),
            label: const Text('Start again'),
          ),
        ),
      ]);
}

class _QrReadyCard extends StatelessWidget {
  const _QrReadyCard({required this.onOpen});
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => KpCard(
        radius: KhatuRadius.lg,
        color: KhatuColors.softTeal,
        borderColor: KhatuColors.teal.withValues(alpha: 0.3),
        onTap: onOpen,
        child: Row(children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
                color: Colors.white, borderRadius: BorderRadius.circular(14)),
            child: const Icon(Icons.qr_code_2_rounded,
                color: KhatuColors.deepTeal, size: 30),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Your business QR is live',
                      style: TextStyle(
                          fontFamily: 'Roboto',
                          fontSize: 15.5,
                          fontWeight: FontWeight.w900)),
                  SizedBox(height: 3),
                  Text('Show, share or print it to collect payments.',
                      style: TextStyle(
                          fontFamily: 'Roboto',
                          color: KhatuColors.muted,
                          fontSize: 12.5)),
                ]),
          ),
          const Icon(Icons.chevron_right_rounded, color: KhatuColors.deepTeal),
        ]),
      );
}

class _Welcome extends StatelessWidget {
  const _Welcome({required this.onStart});
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) => Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
          decoration: BoxDecoration(
            gradient: KhatuColors.heroGradient,
            borderRadius: BorderRadius.circular(KhatuRadius.xl),
            boxShadow: KhatuShadow.raised,
          ),
          child: Column(children: [
            Image.asset('assets/business/business_payments.png',
                height: 150,
                errorBuilder: (_, __, ___) => const Icon(
                    Icons.storefront_rounded,
                    size: 84,
                    color: Colors.white)),
            const SizedBox(height: 14),
            const Text('Accept payments at your shop',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: 'Roboto',
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const Text(
                'Get one QR for all UPI apps and receive money directly in your bank account.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: 'Roboto',
                    color: Colors.white70,
                    fontSize: 13.5,
                    height: 1.45)),
          ]),
        ),
        const SizedBox(height: 14),
        KpCard(
          radius: KhatuRadius.lg,
          child: Column(children: [
            const _Benefit(
                icon: Icons.qr_code_2_rounded,
                title: 'One QR, every UPI app',
                text: 'PhonePe, Google Pay, Paytm, BHIM and more.'),
            const _Benefit(
                icon: Icons.account_balance_rounded,
                title: 'Settled to your bank',
                text: 'Collections go to your verified bank account.'),
            const _Benefit(
                icon: Icons.timer_outlined,
                title: 'Setup in about 5 minutes',
                text: 'Keep your PAN, Aadhaar and bank details ready.',
                last: true),
            const SizedBox(height: 16),
            BusinessPrimaryButton(
                label: 'Start business setup',
                icon: Icons.storefront_rounded,
                onPressed: onStart),
          ]),
        ),
      ]);
}

class _Benefit extends StatelessWidget {
  const _Benefit(
      {required this.icon, required this.title, required this.text, this.last = false});
  final IconData icon;
  final String title, text;
  final bool last;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: last ? 0 : 14),
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
                color: KhatuColors.softTeal,
                borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: KhatuColors.deepTeal, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(text,
                      style: const TextStyle(
                          fontFamily: 'Roboto',
                          color: KhatuColors.muted,
                          fontSize: 12.5)),
                ]),
          ),
        ]),
      );
}

class _Balance extends StatelessWidget {
  const _Balance({required this.label, required this.value, required this.accent});
  final String label;
  final dynamic value;
  final Color accent;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: KhatuColors.line),
            borderRadius: BorderRadius.circular(KhatuRadius.md)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
                width: 7,
                height: 7,
                decoration:
                    BoxDecoration(color: accent, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(label,
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    color: KhatuColors.muted,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 8),
          FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(kpMoney(value is num ? value : num.tryParse('$value') ?? 0),
                  style: const TextStyle(
                      fontFamily: 'Roboto',
                      fontWeight: FontWeight.w900,
                      fontSize: 17))),
        ]),
      );
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) => Column(children: [
        for (final height in const [150.0, 280.0, 110.0])
          Container(
            height: height,
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
                color: KhatuColors.surfaceAlt,
                borderRadius: BorderRadius.circular(KhatuRadius.lg)),
          ),
      ]);
}
