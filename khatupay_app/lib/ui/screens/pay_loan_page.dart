import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../../services/payment_service.dart';
import '../../services/user_service.dart';
import '../widgets/app_back_button.dart';

class PayLoanPage extends ConsumerStatefulWidget {
  const PayLoanPage({super.key});

  @override
  ConsumerState<PayLoanPage> createState() => _PayLoanPageState();
}

class _PayLoanPageState extends ConsumerState<PayLoanPage> {
  final mobileController = TextEditingController();
  List<Map<String, dynamic>> foundLoans = [];
  bool searchingLoan = false;
  String msg = '';

  @override
  void dispose() {
    mobileController.dispose();
    super.dispose();
  }

  Future<void> _searchLoan() async {
    if (mobileController.text.trim().isEmpty) {
      setState(() => msg = 'Please enter mobile number');
      return;
    }

    setState(() {
      searchingLoan = true;
      msg = '';
      foundLoans = [];
    });

    try {
      final loans = await UserService().searchLoansByMobile(mobileController.text.trim());
      if (!mounted) return;
      setState(() {
        foundLoans = loans;
        msg = loans.isEmpty ? 'No loans found for this mobile number' : '';
      });
    } catch (e) {
      if (mounted) setState(() => msg = 'No loans found for this mobile number');
    } finally {
      if (mounted) setState(() => searchingLoan = false);
    }
  }

  Future<void> _payFullLoan(Map<String, dynamic> loan) async {
    setState(() => msg = 'Processing full loan payment...');

    try {
      final ps = PaymentService();
      final amount = _num(loan['outstandingAmount']).toDouble();
      final data = await ps.createRazorpayOrder(
        amount,
        loanId: loan['_id']?.toString(),
        isFullPayment: true,
      );
      await ps.openGatewayCheckout(data);
      if (mounted) {
        setState(() {
          msg =
              'Payment started. Loan status will update after gateway confirmation.';
          foundLoans = [];
          mobileController.clear();
        });
      }
    } catch (e) {
      if (mounted) setState(() => msg = 'Error: $e');
    }
  }

  static num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Pay Full Loan'),
        leading: const AppBackButton(),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          const _HeaderCard(),
          const SizedBox(height: 16),
          TextField(
            controller: mobileController,
            decoration: const InputDecoration(
              labelText: 'Mobile Number',
              hintText: 'Search borrower by registered mobile',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 14),
          ElevatedButton.icon(
            onPressed: searchingLoan ? null : _searchLoan,
            icon: searchingLoan
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.search),
            label: Text(searchingLoan ? 'Searching...' : 'Search Loans'),
          ),
          if (msg.isNotEmpty) ...[
            const SizedBox(height: 14),
            _MessageBanner(message: msg),
          ],
          const SizedBox(height: 12),
          ...foundLoans.map(
            (loan) => _LoanCard(
              loan: loan,
              onPay: () => _payFullLoan(loan),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [KhatuColors.ink, KhatuColors.deepTeal, KhatuColors.teal]),
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Row(
        children: [
          CircleAvatar(
            backgroundColor: Colors.white,
            child: Icon(Icons.account_balance, color: KhatuColors.teal),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Pay Full Loan for Others', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
                SizedBox(height: 4),
                Text(
                  'Search a loan by mobile number and clear the full outstanding amount.',
                  style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LoanCard extends StatelessWidget {
  final Map<String, dynamic> loan;
  final VoidCallback onPay;

  const _LoanCard({required this.loan, required this.onPay});

  @override
  Widget build(BuildContext context) {
    final amount = _PayLoanPageState._num(loan['outstandingAmount']);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Loan ID: ${loan['_id'] ?? '-'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900, color: KhatuColors.text),
            ),
            const SizedBox(height: 8),
            Text(
              'Outstanding Amount: Rs. ${amount.toStringAsFixed(0)}',
              style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.green),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: onPay,
              icon: const Icon(Icons.payments_outlined),
              label: const Text('Pay Full Loan'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  final String message;

  const _MessageBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    final success = message.toLowerCase().contains('successful');
    final color = success ? Colors.green : Colors.red;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.22)),
      ),
      child: Text(message, textAlign: TextAlign.center, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
    );
  }
}
