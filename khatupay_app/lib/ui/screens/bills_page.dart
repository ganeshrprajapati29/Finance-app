import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/bill_providers.dart';
import '../../services/bill_service.dart';
import '../../routes/app_router.dart';

class BillsPage extends ConsumerStatefulWidget {
  const BillsPage({super.key});

  @override
  ConsumerState<BillsPage> createState() => _S();
}

class _S extends ConsumerState<BillsPage> {
  final type = TextEditingController(text: 'MOBILE'),
      prov = TextEditingController(),
      acc = TextEditingController(),
      amt = TextEditingController(text: '99');
  DateTime due = DateTime.now().add(const Duration(days: 7));
  bool isFetching = false;
  Map<String, dynamic>? fetchedBill;

  @override
  Widget build(BuildContext context) {
    final bills = ref.watch(billsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bills'),
        leading: IconButton(
          icon: const Icon(Icons.home),
          onPressed: () => router.go('/'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            value: type.text,
            items: ['MOBILE', 'DTH', 'ELECTRICITY', 'WATER', 'GAS'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
            onChanged: (v) => setState(() => type.text = v!),
            decoration: const InputDecoration(labelText: 'Bill Type'),
          ),
          TextField(
              controller: prov,
              decoration: const InputDecoration(hintText: 'Provider (e.g., Airtel, Tata Power)')),
          TextField(
              controller: acc,
              decoration: const InputDecoration(hintText: 'Account Ref (Mobile No, Consumer No)')),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: isFetching ? null : () async {
                    setState(() => isFetching = true);
                    try {
                      final billData = await BillService().fetchBill(type: type.text, provider: prov.text, accountRef: acc.text);
                      setState(() => fetchedBill = billData);
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                    } finally {
                      setState(() => isFetching = false);
                    }
                  },
                  child: isFetching ? const CircularProgressIndicator() : const Text('Fetch Bill'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: fetchedBill == null ? null : () async {
                    try {
                      await BillService().add(
                        type: type.text,
                        provider: prov.text,
                        accountRef: acc.text,
                        amount: fetchedBill!['amount'],
                        due: DateTime.parse(fetchedBill!['dueDate']),
                      );
                      ref.refresh(billsProvider);
                      setState(() => fetchedBill = null);
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                    }
                  },
                  child: const Text('Add Bill'),
                ),
              ),
            ],
          ),
          if (fetchedBill != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Customer: ${fetchedBill!['customerName']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text('Amount: ₹${fetchedBill!['amount']}'),
                    Text('Due Date: ${DateTime.parse(fetchedBill!['dueDate']).toLocal().toString().split(' ')[0]}'),
                    Text('Bill Number: ${fetchedBill!['billNumber']}'),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: () async {
                        try {
                          final result = await BillService().payBill(billId: fetchedBill!['billNumber'], amount: fetchedBill!['amount']);
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Bill paid successfully!')));
                          setState(() => fetchedBill = null);
                          ref.refresh(billsProvider);
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment failed: $e')));
                        }
                      },
                      child: const Text('Pay Now'),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          const Text('My Bills', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          bills.when(
            data: (list) => Column(
                children: list
                    .map((b) => ListTile(
                          title: Text('${b.type} • ₹${b.amount} • ${b.status}'),
                          subtitle: Text('${b.provider} • ${b.accountRef}'),
                          trailing: ElevatedButton(
                              onPressed: b.status == 'PENDING'
                                  ? () async {
                                      await BillService().markPaid(b.id);
                                      ref.refresh(billsProvider);
                                    }
                                  : null,
                              child: const Text('Mark Paid')),
                        ))
                    .toList()),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Error: $e'),
          )
        ],
      ),
    );
  }
}
