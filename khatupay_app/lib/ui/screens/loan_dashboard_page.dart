import 'package:flutter/material.dart';
import '../../services/loan_service.dart';
import '../../models/loan.dart';
import '../../routes/app_router.dart';

class LoanDashboardPage extends StatefulWidget {
  const LoanDashboardPage({super.key});

  @override
  State<LoanDashboardPage> createState() => _LoanDashboardPageState();
}

class _LoanDashboardPageState extends State<LoanDashboardPage> {
  bool loading = true;
  List<Loan> loans = [];

  @override
  void initState() {
    super.initState();
    _fetchLoans();
  }

  Future<void> _fetchLoans() async {
    try {
      final l = await LoanService().myLoans();
      if (mounted) setState(() => loans = l);
    } catch (e) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed to load loans: $e')));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Loans')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : loans.isEmpty
              ? const Center(child: Text('No loans yet'))
              : ListView.builder(
                  itemCount: loans.length,
                  itemBuilder: (ctx, i) {
                    final loan = loans[i];
                    final app = loan.application;
                    return Card(
                      margin: const EdgeInsets.all(8),
                      child: ListTile(
                        title: Text('₹${app.amountRequested} - ${loan.status}'),
                        subtitle: Text(
                          'Tenure: ${app.tenureMonths} months\n'
                          'Purpose: ${app.purpose}',
                        ),
                        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                        onTap: () => router.push('/loan-detail/${loan.id}'),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => router.push('/apply-wizard'),
        icon: const Icon(Icons.add),
        label: const Text('Apply Loan'),
      ),
    );
  }
}
