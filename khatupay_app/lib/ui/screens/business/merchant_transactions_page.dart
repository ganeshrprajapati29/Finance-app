import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/app_theme.dart';
import '../../../models/business/merchant_business.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../widgets/kp_widgets.dart';

class MerchantTransactionsPage extends ConsumerWidget {
  const MerchantTransactionsPage({super.key});
  @override Widget build(BuildContext context, WidgetRef ref) => KpAppShell(title: 'Business transactions', onRefresh: () async => ref.invalidate(merchantPaymentsProvider), children: [
    ref.watch(merchantPaymentsProvider).when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => KpErrorState.fromError(e, onRetry: () => ref.invalidate(merchantPaymentsProvider)),
      data: (rows) => rows.isEmpty ? const KpEmptyState(icon: Icons.receipt_long_outlined, title: 'No collections yet', message: 'Successful QR payments will appear here in real time.') : KpCard(padding: EdgeInsets.zero, child: Column(children: [for (var i=0;i<rows.length;i++) ...[if(i>0) const Divider(height:1), _tile(context, rows[i])]])),
    )
  ]);
  Widget _tile(BuildContext context, MerchantPayment p) => ListTile(onTap: () => showModalBottomSheet(context: context, showDragHandle: true, builder: (_) => _detail(p)), leading: CircleAvatar(backgroundColor: KhatuColors.softTeal, child: Icon(p.status == 'SUCCESS' ? Icons.south_west_rounded : Icons.schedule_rounded, color: KhatuColors.status(p.status))), title: Text(kpMoney(p.amount), style: const TextStyle(fontWeight: FontWeight.w900)), subtitle: Text('${p.orderId}\n${p.createdAt == null ? '' : DateFormat('dd MMM yyyy, hh:mm a').format(p.createdAt!.toLocal())}'), isThreeLine: true, trailing: KpStatusBadge(status: p.status, dense: true));
  Widget _detail(MerchantPayment p) => SafeArea(child: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Transaction details', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 18), _row('Amount', kpMoney(p.amount)), _row('Order ID', p.orderId), _row('Status', p.status), _row('UTR', p.utr?.isNotEmpty == true ? p.utr! : 'Awaiting provider confirmation'), const SizedBox(height: 12), const Text('Only provider-confirmed payments are credited to your business balance.', style: TextStyle(color: KhatuColors.muted))])));
  Widget _row(String a,String b)=>Padding(padding: const EdgeInsets.symmetric(vertical:7),child:Row(crossAxisAlignment: CrossAxisAlignment.start,children:[SizedBox(width:90,child:Text(a,style:const TextStyle(color:KhatuColors.muted))),Expanded(child:SelectableText(b,style:const TextStyle(fontWeight:FontWeight.w800)))]));
}
