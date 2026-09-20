import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';

class MerchantSettlementsPage extends ConsumerStatefulWidget {
  const MerchantSettlementsPage({super.key});
  @override
  ConsumerState<MerchantSettlementsPage> createState() => _State();
}

class _State extends ConsumerState<MerchantSettlementsPage> {
  final amount = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() { amount.dispose(); super.dispose(); }

  Future<void> request() async {
    final value = num.tryParse(amount.text);
    if (value == null || value <= 0) { setState(() => error = 'Enter a valid settlement amount.'); return; }
    setState(() { busy = true; error = null; });
    try {
      await MerchantBusinessService().requestSettlement(value);
      amount.clear();
      ref.invalidate(merchantSettlementsProvider);
      ref.invalidate(merchantBalanceProvider);
    } catch (e) {
      setState(() => error = friendlyErrorMessage(e, fallback: 'Settlement request could not be created.'));
    } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> refresh() async { ref.invalidate(merchantSettlementsProvider); ref.invalidate(merchantBalanceProvider); }

  @override
  Widget build(BuildContext context) => KpAppShell(
    title: 'Settlements', onRefresh: refresh, children: [
      ref.watch(merchantBalanceProvider).when(
        loading: () => const LinearProgressIndicator(),
        error: (_, __) => const KpErrorBanner(message: 'Balance unavailable.'),
        data: (balance) => KpCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('AVAILABLE TO SETTLE', style: TextStyle(color: KhatuColors.muted, fontWeight: FontWeight.w800, fontSize: 11)),
          const SizedBox(height: 6),
          Text(kpMoney(balance['available']), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          TextField(controller: amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Settlement amount', prefixText: 'Rs. ')),
          if (error != null) ...[const SizedBox(height: 8), Text(error!, style: const TextStyle(color: KhatuColors.danger))],
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: ElevatedButton.icon(onPressed: busy ? null : request, icon: const Icon(Icons.account_balance_outlined), label: Text(busy ? 'Requesting...' : 'Request bank settlement'))),
        ])),
      ),
      const KpNoticeBanner(icon: Icons.schedule_rounded, color: KhatuColors.info, title: 'Settlement tracking', message: 'A request is queued only against available collections. Processing, settled and failed states update after provider confirmation.'),
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
