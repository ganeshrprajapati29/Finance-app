import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../../services/loan_service.dart';
import '../widgets/app_back_button.dart';

class LoanApplyPage extends StatefulWidget {
  const LoanApplyPage({super.key});

  @override
  State<LoanApplyPage> createState() => _LoanApplyPageState();
}

class _LoanApplyPageState extends State<LoanApplyPage> {
  final amountController = TextEditingController();
  final tenureController = TextEditingController(text: '12');
  final purposeController = TextEditingController(text: 'Personal');
  String message = '';
  bool isLoading = false;

  @override
  void dispose() {
    amountController.dispose();
    tenureController.dispose();
    purposeController.dispose();
    super.dispose();
  }

  Future<void> _applyLoan() async {
    if (amountController.text.trim().isEmpty ||
        tenureController.text.trim().isEmpty ||
        purposeController.text.trim().isEmpty) {
      setState(() => message = 'Please fill all fields');
      return;
    }

    final amount = num.tryParse(amountController.text.trim());
    final tenure = int.tryParse(tenureController.text.trim());

    if (amount == null || amount <= 0) {
      setState(() => message = 'Please enter a valid amount');
      return;
    }
    if (tenure == null || tenure <= 0) {
      setState(() => message = 'Please enter a valid tenure');
      return;
    }

    setState(() {
      isLoading = true;
      message = '';
    });

    try {
      final id = await LoanService().apply(amount, tenure, purpose: purposeController.text.trim());
      if (!mounted) return;
      setState(() => message = 'Loan application submitted successfully. Loan ID: $id');
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) router.go('/loans');
      });
    } catch (e) {
      if (mounted) setState(() => message = 'Failed to apply for loan: $e');
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Apply for Loan'),
        leading: const AppBackButton(),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          const _HeaderCard(),
          const SizedBox(height: 16),
          TextField(
            controller: amountController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Loan Amount',
              hintText: 'Enter amount, e.g. 50000',
              prefixIcon: Icon(Icons.currency_rupee),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: tenureController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Tenure',
              hintText: 'Enter tenure in months',
              prefixIcon: Icon(Icons.calendar_today),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: purposeController,
            decoration: const InputDecoration(
              labelText: 'Purpose',
              hintText: 'Personal, Business, Education',
              prefixIcon: Icon(Icons.description_outlined),
            ),
          ),
          const SizedBox(height: 22),
          ElevatedButton.icon(
            onPressed: isLoading ? null : _applyLoan,
            icon: isLoading
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.verified),
            label: Text(isLoading ? 'Submitting...' : 'Apply for Loan'),
          ),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 14),
            _MessageBanner(message: message),
          ],
          const SizedBox(height: 16),
          const _TermsCard(),
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
            child: Icon(Icons.trending_up, color: KhatuColors.teal),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quick Loan Application', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
                SizedBox(height: 4),
                Text(
                  'Submit amount, tenure and purpose for quick review.',
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

class _TermsCard extends StatelessWidget {
  const _TermsCard();

  @override
  Widget build(BuildContext context) {
    const terms = [
      'Interest rates starting from 12% per annum',
      'Processing fee: 2% of loan amount',
      'Minimum tenure: 3 months',
      'Maximum tenure: 60 months',
      'Quick approval within 24 hours',
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loan Terms & Conditions', style: TextStyle(fontWeight: FontWeight.w900, color: KhatuColors.text)),
            const SizedBox(height: 10),
            ...terms.map(
              (term) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.check_circle, size: 17, color: KhatuColors.teal),
                    const SizedBox(width: 8),
                    Expanded(child: Text(term, style: const TextStyle(color: KhatuColors.muted, fontWeight: FontWeight.w700))),
                  ],
                ),
              ),
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
    final success = message.toLowerCase().contains('successfully');
    final color = success ? Colors.green : Colors.red;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.22)),
      ),
      child: Text(message, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
    );
  }
}
