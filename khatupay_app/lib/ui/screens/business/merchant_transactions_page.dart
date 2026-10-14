import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/app_theme.dart';
import '../../../models/business/merchant_business.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';

/// Payments received on the business QR. Pull to refresh asks Razorpay for new
/// payments first, so the list never depends on a webhook arriving.
class MerchantTransactionsPage extends ConsumerStatefulWidget {
  const MerchantTransactionsPage({super.key});
  @override
  ConsumerState<MerchantTransactionsPage> createState() => _State();
}

class _State extends ConsumerState<MerchantTransactionsPage> {
  String filter = 'ALL';
  final search = TextEditingController();

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      await MerchantBusinessService().syncQrPayments();
    } catch (_) {
      // No QR yet or provider busy: still show what is stored.
    }
    ref.invalidate(merchantPaymentsProvider);
    ref.invalidate(merchantBalanceProvider);
    await ref.read(merchantPaymentsProvider.future).catchError((_) => <MerchantPayment>[]);
  }

  @override
  Widget build(BuildContext context) => KpAppShell(
        title: 'Business transactions',
        onRefresh: _refresh,
        children: [
          TextField(
            controller: search,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Search by payment ID or UTR',
              prefixIcon: Icon(Icons.search_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              for (final item in const [
                ('ALL', 'All'),
                ('SUCCESS', 'Received'),
                ('PENDING', 'Pending'),
                ('FAILED', 'Failed'),
                ('REFUNDED', 'Refunded'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(item.$2),
                    selected: filter == item.$1,
                    onSelected: (_) => setState(() => filter = item.$1),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 12),
          ref.watch(merchantPaymentsProvider).when(
                loading: () => const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: Center(child: CircularProgressIndicator())),
                error: (e, _) => KpErrorState.fromError(e,
                    onRetry: () => ref.invalidate(merchantPaymentsProvider)),
                data: (rows) {
                  final term = search.text.trim().toLowerCase();
                  final visible = rows.where((p) {
                    if (filter != 'ALL' && p.status != filter) return false;
                    if (term.isEmpty) return true;
                    return p.orderId.toLowerCase().contains(term) ||
                        (p.utr ?? '').toLowerCase().contains(term);
                  }).toList();
                  final received = rows
                      .where((p) => p.status == 'SUCCESS')
                      .fold<num>(0, (sum, p) => sum + p.amount);
                  return Column(children: [
                    KpCard(
                      radius: KhatuRadius.lg,
                      color: KhatuColors.softTeal,
                      child: Row(children: [
                        const Icon(Icons.south_west_rounded,
                            color: KhatuColors.deepTeal),
                        const SizedBox(width: 10),
                        const Expanded(
                            child: Text('Total received',
                                style: TextStyle(fontWeight: FontWeight.w800))),
                        Text(kpMoney(received),
                            style: const TextStyle(
                                fontSize: 17, fontWeight: FontWeight.w900)),
                      ]),
                    ),
                    const SizedBox(height: 12),
                    if (visible.isEmpty)
                      KpEmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: rows.isEmpty ? 'No collections yet' : 'No matching payments',
                        message: rows.isEmpty
                            ? 'Payments on your business QR appear here. Pull down to check for new ones.'
                            : 'Try another filter or search.',
                      )
                    else
                      KpCard(
                        padding: EdgeInsets.zero,
                        child: Column(children: [
                          for (var i = 0; i < visible.length; i++) ...[
                            if (i > 0) const Divider(height: 1),
                            _tile(context, visible[i]),
                          ],
                        ]),
                      ),
                  ]);
                },
              ),
        ],
      );

  Widget _tile(BuildContext context, MerchantPayment p) => ListTile(
        onTap: () => showModalBottomSheet(
            context: context, showDragHandle: true, builder: (_) => _detail(p)),
        leading: CircleAvatar(
            backgroundColor: KhatuColors.statusTint(p.status),
            child: Icon(
                p.status == 'SUCCESS'
                    ? Icons.south_west_rounded
                    : p.status == 'FAILED'
                        ? Icons.close_rounded
                        : Icons.schedule_rounded,
                color: KhatuColors.status(p.status))),
        title: Text(kpMoney(p.amount),
            style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(
            '${p.orderId}\n${p.createdAt == null ? '' : DateFormat('dd MMM yyyy, hh:mm a').format(p.createdAt!.toLocal())}'),
        isThreeLine: true,
        trailing: KpStatusBadge(status: p.status, dense: true),
      );

  Widget _detail(MerchantPayment p) => SafeArea(
      child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Transaction details',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                const SizedBox(height: 18),
                _row('Amount', kpMoney(p.amount)),
                _row('Payment ID', p.orderId),
                _row('Status', p.status),
                _row('UTR', p.utr?.isNotEmpty == true ? p.utr! : 'Awaiting bank reference'),
                if (p.createdAt != null)
                  _row('Time', DateFormat('dd MMM yyyy, hh:mm a').format(p.createdAt!.toLocal())),
                const SizedBox(height: 12),
                const Text(
                    'A payment shows as Received only after Razorpay confirms it. Settlement to your bank is shown separately under Settlements.',
                    style: TextStyle(color: KhatuColors.muted)),
              ])));

  Widget _row(String a, String b) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
            width: 96,
            child: Text(a, style: const TextStyle(color: KhatuColors.muted))),
        Expanded(
            child: SelectableText(b,
                style: const TextStyle(fontWeight: FontWeight.w800))),
      ]));
}
