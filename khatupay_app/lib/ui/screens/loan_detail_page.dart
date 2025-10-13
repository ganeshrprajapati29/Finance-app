import 'package:flutter/material.dart';
import '../../services/loan_service.dart';
import '../../models/loan.dart';

class LoanDetailPage extends StatefulWidget {
  final String id;

  const LoanDetailPage({super.key, required this.id});

  @override
  State<LoanDetailPage> createState() => _LoanDetailPageState();
}

class _LoanDetailPageState extends State<LoanDetailPage> {
  Loan? loan;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final l = await LoanService().detail(widget.id);
      if (mounted) setState(() => loan = l);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load loan details: $e')),
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loan Detail')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : loan == null
              ? const Center(child: Text('Loan not found'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text('Status: ${loan!.status}'),
                    Text('Amount: ₹${loan!.application.amountRequested}'),
                    Text('Tenure: ${loan!.application.tenureMonths} months'),
                    const SizedBox(height: 12),
                    const Text('Schedule:'),
                    const SizedBox(height: 6),
                    ...loan!.schedule.map((s) => ListTile(
                          dense: true,
                          title: Text(
                              'EMI ${s['installmentNo']} • Due: ${DateTime.parse(s['dueDate'] as String).toLocal()}'),
                          subtitle: Text(
                              '₹${s['total']} (P: ${s['principal']} | I: ${s['interest']})'),
                          trailing: Icon(
                            (s['paid'] as bool? ?? false)
                                ? Icons.check_circle
                                : Icons.radio_button_unchecked,
                            color: (s['paid'] as bool? ?? false)
                                ? Colors.green
                                : null,
                          ),
                        )),
                  ],
                ),
    );
  }
}
