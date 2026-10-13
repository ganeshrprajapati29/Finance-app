import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/app_theme.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';

class MerchantSettlementsPage extends ConsumerStatefulWidget {
  const MerchantSettlementsPage({super.key});
  @override
  ConsumerState<MerchantSettlementsPage> createState() => _State();
}

class _State extends ConsumerState<MerchantSettlementsPage> {
  Future<void> refresh() async {
    try { await MerchantBusinessService().syncSettlements(); } catch (_) {}
    ref.invalidate(merchantSettlementsProvider); ref.invalidate(merchantBalanceProvider);
  }

  @override
  Widget build(BuildContext context) => KpAppShell(
    title: 'Settlements', onRefresh: refresh, children: [
      ref.watch(merchantBalanceProvider).when(
        loading: () => const LinearProgressIndicator(),
        error: (_, __) => const KpErrorBanner(message: 'Balance unavailable.'),
        data: (balance) => KpCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('COLLECTION BALANCE', style: TextStyle(color: KhatuColors.muted, fontWeight: FontWeight.w800, fontSize: 11)),
          const SizedBox(height: 6),
          Text(kpMoney(balance['available']), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          const Text('Razorpay settles approved business collections directly to your verified bank account according to your merchant settlement schedule.', style: TextStyle(color: KhatuColors.muted, height: 1.35)),
        ])),
      ),
      const KpNoticeBanner(icon: Icons.schedule_rounded, color: KhatuColors.info, title: 'Settlement tracking', message: 'Refresh to retrieve the latest settlement status and bank reference from Razorpay.'),
      const KpSectionHeader(title: 'Settlement history'),
      ref.watch(merchantSettlementsProvider).when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => KpErrorState.fromError(e, onRetry: () => ref.invalidate(merchantSettlementsProvider)),
        data: (rows) => rows.isEmpty
          ? const KpEmptyState(icon: Icons.account_balance_outlined, title: 'No settlements yet', message: 'Your bank settlement requests will appear here.')
          : KpCard(padding: EdgeInsets.zero, child: Column(children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1),
                ListTile(
                  leading: const CircleAvatar(backgroundColor: KhatuColors.softSaffron, child: Icon(Icons.account_balance_outlined, color: KhatuColors.gold)),
                  title: Text(kpMoney(rows[i].amount), style: const TextStyle(fontWeight: FontWeight.w900)),
                  subtitle: Text('${rows[i].settlementId}\n${rows[i].createdAt == null ? '' : DateFormat('dd MMM yyyy').format(rows[i].createdAt!.toLocal())}${rows[i].utr?.isNotEmpty == true ? ' - UTR ${rows[i].utr}' : ''}'),
                  isThreeLine: true, trailing: KpStatusBadge(status: rows[i].status, dense: true),
                ),
              ],
            ])),
      ),
    ],
  );
}
