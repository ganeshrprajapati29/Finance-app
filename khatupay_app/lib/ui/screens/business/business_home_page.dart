import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/app_theme.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../widgets/kp_widgets.dart';

class BusinessHomePage extends ConsumerWidget {
  const BusinessHomePage({super.key});
  @override Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(merchantDashboardProvider);
    final balance = ref.watch(merchantBalanceProvider);
    return KpAppShell(title: 'Khatu Pay Business', onRefresh: () async { ref.invalidate(merchantDashboardProvider); ref.invalidate(merchantBalanceProvider); }, children: [
      profile.when(
        loading: () => const KpCard(child: Center(child: CircularProgressIndicator())),
        error: (e, _) => KpErrorState.fromError(e, onRetry: () => ref.invalidate(merchantDashboardProvider)),
        data: (data) {
          if (data.business == null) return _Welcome(onStart: () => router.push('/business/register'));
          final approved = data.business!.status == 'APPROVED';
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            KpCard(child: Row(children: [
              Container(width: 76, height: 76, decoration: BoxDecoration(color: KhatuColors.softTeal, borderRadius: BorderRadius.circular(12)), child: Image.asset('assets/business/business_payments.png', fit: BoxFit.cover)),
              const SizedBox(width: 14), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(data.business!.businessName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)), const SizedBox(height: 5), KpStatusBadge(status: data.business!.status), const SizedBox(height: 4), Text(data.business!.publicId, style: const TextStyle(color: KhatuColors.muted))]))
            ])),
            if (!approved) KpNoticeBanner(icon: Icons.fact_check_outlined, color: KhatuColors.warning, title: 'Complete business verification', message: 'Submit KYC and a settlement bank account. QR collections activate after approval.', actionLabel: 'Continue', onAction: () => router.push('/business/verification')),
            const KpSectionHeader(title: 'Business balance', subtitle: 'Collections become available after the settlement hold period'),
            balance.when(loading: () => const LinearProgressIndicator(), error: (_, __) => const KpErrorBanner(message: 'Balance is temporarily unavailable.'), data: (b) => Row(children: [
              Expanded(child: _Balance(label: 'Available', value: b['available'])), const SizedBox(width: 10),
              Expanded(child: _Balance(label: 'Pending', value: b['pending'])), const SizedBox(width: 10),
              Expanded(child: _Balance(label: 'Settled', value: b['settled'])),
            ])),
            const KpSectionHeader(title: 'Manage business'),
            KpServiceGrid(items: [
              KpServiceItem(icon: Icons.qr_code_2_rounded, label: 'Business QR', color: KhatuColors.teal, onTap: approved ? () => router.push('/business/qr') : null),
              KpServiceItem(icon: Icons.receipt_long_outlined, label: 'Transactions', color: KhatuColors.info, onTap: () => router.push('/business/transactions')),
              KpServiceItem(icon: Icons.account_balance_outlined, label: 'Settlements', color: KhatuColors.gold, onTap: () => router.push('/business/settlements')),
              KpServiceItem(icon: Icons.support_agent_rounded, label: 'Support', color: KhatuColors.deepTeal, onTap: () => router.push('/support?subject=Business%20payments')),
            ]),
          ]);
        }),
    ]);
  }
}
class _Welcome extends StatelessWidget { const _Welcome({required this.onStart}); final VoidCallback onStart; @override Widget build(BuildContext context) => KpCard(child: Column(children: [Image.asset('assets/business/business_payments.png', height: 210), const Text('Accept payments for your business', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)), const SizedBox(height: 8), const Text('Create a verified business profile, display your QR and track collections and bank settlements.', textAlign: TextAlign.center, style: TextStyle(color: KhatuColors.muted)), const SizedBox(height: 18), SizedBox(width: double.infinity, child: ElevatedButton.icon(onPressed: onStart, icon: const Icon(Icons.storefront_outlined), label: const Text('Create business profile')))])); }
class _Balance extends StatelessWidget { const _Balance({required this.label, required this.value}); final String label; final dynamic value; @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.white, border: Border.all(color: KhatuColors.line), borderRadius: BorderRadius.circular(8)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: KhatuColors.muted, fontSize: 11)), const SizedBox(height: 5), FittedBox(child: Text(kpMoney(value), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)))])); }
