import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/bill_providers.dart';
import '../../services/bill_service.dart';

class BillsPage extends ConsumerStatefulWidget { const BillsPage({super.key}); @override ConsumerState<BillsPage> createState()=>_S(); }
class _S extends ConsumerState<BillsPage> {
  final type=TextEditingController(text:'OTHER'), prov=TextEditingController(), acc=TextEditingController(), amt=TextEditingController(text:'99');
  DateTime due = DateTime.now().add(const Duration(days:7));

  @override Widget build(BuildContext context){
    final bills = ref.watch(billsProvider);
    return Scaffold(appBar: AppBar(title: const Text('Bills')), body: ListView(
      padding: const EdgeInsets.all(16), children: [
        Row(children:[Expanded(child: TextField(controller:type, decoration: const InputDecoration(hintText:'Type'))),
        const SizedBox(width:8), Expanded(child: TextField(controller:prov, decoration: const InputDecoration(hintText:'Provider')))]),
        Row(children:[Expanded(child: TextField(controller:acc, decoration: const InputDecoration(hintText:'Account Ref'))),
        const SizedBox(width:8), Expanded(child: TextField(controller:amt, decoration: const InputDecoration(hintText:'Amount')))]),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: () async {
          await BillService().add(type: type.text, provider: prov.text, accountRef: acc.text, amount: num.parse(amt.text), due: due);
          ref.refresh(billsProvider);
        }, child: const Text('Add Bill')),
        const SizedBox(height: 12),
        bills.when(
          data: (list)=> Column(children: list.map((b)=> ListTile(
            title: Text('${b.type} • ₹${b.amount} • ${b.status}'),
            subtitle: Text('${b.provider} • ${b.accountRef}'),
            trailing: ElevatedButton(onPressed: b.status=='PENDING'? () async {
              // Quick mark paid (or use Payments page with billId)
              await BillService().markPaid(b.id);
              ref.refresh(billsProvider);
            } : null, child: const Text('Mark Paid')),
          )).toList()),
          loading: ()=> const Center(child:CircularProgressIndicator()),
          error: (e,_)=> Text('Error: $e')
        )
      ],
    ));
  }
}
