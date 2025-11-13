import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../services/payment_service.dart';
import '../../services/loan_service.dart';
import '../../models/loan.dart';
import '../../routes/app_router.dart';
import '../../services/user_service.dart';
import '../../core/api_client.dart';

class PaymentsPage extends ConsumerStatefulWidget {
  const PaymentsPage({super.key});

  @override
  ConsumerState<PaymentsPage> createState() => _PaymentsPageState();
}

class _PaymentsPageState extends ConsumerState<PaymentsPage> {
  List<Loan> loans = [];
  bool loading = true;
  String? selectedLoanId;
  Map<String, dynamic>? selectedInstallment;
  String msg = '';
  bool showPayLoanSection = false;
  final loanIdController = TextEditingController();
  final mobileController = TextEditingController();
  Map<String, dynamic>? foundLoan;
  bool searchingLoan = false;
  final partialAmountController = TextEditingController();
  List<dynamic> allPayments = [];
  bool loadingPayments = true;

  @override
  void initState() {
    super.initState();
    _loadLoans();
    _loadPayments();
  }

  Future<void> _loadLoans() async {
    try {
      final l = await LoanService().myLoans();
      if (mounted) setState(() => loans = l);
    } catch (e) {
      if (mounted) setState(() => msg = 'Failed to load loans: $e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _loadPayments() async {
    try {
      final response = await ApiClient.client.get('/payments');
      if (mounted) setState(() => allPayments = response.data['data']);
    } catch (e) {
      // Handle error silently for now
    } finally {
      if (mounted) setState(() => loadingPayments = false);
    }
  }

  void _selectInstallment(String loanId, Map<String, dynamic> installment) {
    setState(() {
      selectedLoanId = loanId;
      selectedInstallment = installment;
    });
  }

  Future<void> _payInstallment() async {
    if (selectedLoanId == null || selectedInstallment == null) return;

    setState(() => msg = 'Processing payment...');

    try {
      final ps = PaymentService();
      final data = await ps.createRazorpayOrder(
        selectedInstallment!['total'],
        loanId: selectedLoanId,
        installmentNo: selectedInstallment!['installmentNo'],
      );
      final order = data['order'];

      ps.newCheckout(
        amount: selectedInstallment!['total'],
        orderId: order['id'],
        onSuccess: (oid, pid, sig) async {
          await ps.verifyRazorpay(oid, pid, sig);
          if (mounted) {
            setState(() {
              msg = 'Payment successful! EMI marked as paid.';
              selectedLoanId = null;
              selectedInstallment = null;
            });
            _loadLoans(); // Refresh loans
            _loadPayments(); // Refresh payments
          }
        },
        onFail: (m) {
          if (mounted) setState(() => msg = 'Payment failed: $m');
        },
      );
    } catch (e) {
      if (mounted) setState(() => msg = 'Error: $e');
    }
  }

  Future<void> _payPartialLoan(Loan loan) async {
    final amount = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Enter Partial Payment Amount'),
        content: TextField(
          controller: partialAmountController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Amount (₹)',
            hintText: 'Enter amount to pay',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final amount = double.tryParse(partialAmountController.text);
              if (amount != null && amount > 0) {
                Navigator.pop(context, amount);
              }
            },
            child: const Text('Pay'),
          ),
        ],
      ),
    );

    if (amount == null || amount <= 0) return;

    setState(() => msg = 'Processing partial payment...');

    try {
      final ps = PaymentService();
      final data = await ps.createRazorpayOrder(
        amount,
        loanId: loan.id,
      );
      final order = data['order'];

      ps.newCheckout(
        amount: amount,
        orderId: order['id'],
        onSuccess: (oid, pid, sig) async {
          await ps.verifyRazorpay(oid, pid, sig);
          if (mounted) {
            setState(() {
              msg = 'Partial payment successful! Amount applied to loan.';
              partialAmountController.clear();
            });
            _loadLoans(); // Refresh loans
            _loadPayments(); // Refresh payments
          }
        },
        onFail: (m) {
          if (mounted) setState(() => msg = 'Payment failed: $m');
        },
      );
    } catch (e) {
      if (mounted) setState(() => msg = 'Error: $e');
    }
  }

  Future<void> _searchLoan() async {
    if (loanIdController.text.isEmpty || mobileController.text.isEmpty) {
      setState(() => msg = 'Please enter loan ID and mobile number');
      return;
    }

    setState(() {
      searchingLoan = true;
      msg = '';
      foundLoan = null;
    });

    try {
      final userService = UserService();
      final loan = await userService.searchLoanByIdAndMobile(loanIdController.text, mobileController.text);
      setState(() => foundLoan = loan);
    } catch (e) {
      setState(() => msg = 'Loan not found or error: $e');
    } finally {
      setState(() => searchingLoan = false);
    }
  }

  Future<void> _payFullLoan() async {
    if (foundLoan == null) return;

    setState(() => msg = 'Processing full loan payment...');

    try {
      final ps = PaymentService();
      final data = await ps.createRazorpayOrder(
        foundLoan!['outstandingAmount'],
        loanId: foundLoan!['_id'],
        isFullPayment: true,
      );
      final order = data['order'];

      ps.newCheckout(
        amount: foundLoan!['outstandingAmount'],
        orderId: order['id'],
        onSuccess: (oid, pid, sig) async {
          await ps.verifyRazorpay(oid, pid, sig);
          if (mounted) {
            setState(() {
              msg = 'Full loan payment successful!';
              foundLoan = null;
              loanIdController.clear();
              mobileController.clear();
            });
            _loadPayments(); // Refresh payments
          }
        },
        onFail: (m) {
          if (mounted) setState(() => msg = 'Payment failed: $m');
        },
      );
    } catch (e) {
      if (mounted) setState(() => msg = 'Error: $e');
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'PENDING': return Colors.orange;
      case 'APPROVED': return Colors.green;
      case 'REJECTED': return Colors.red;
      case 'DISBURSED': return Colors.blue;
      case 'CLOSED': return Colors.grey;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Payments'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => router.go('/'),
          ),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Pay EMI'),
              Tab(text: 'Transaction History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Pay EMI Tab
            loading
                ? const Center(child: CircularProgressIndicator())
                : loans.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.account_balance_wallet, size: 64, color: Colors.grey),
                            SizedBox(height: 16),
                            Text('No active loans', style: TextStyle(fontSize: 18, color: Colors.grey)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadLoans,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            const Text(
                              'Select EMI to Pay',
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 16),
                            ...loans.where((loan) => loan.status == 'DISBURSED').map((loan) => Card(
                              margin: const EdgeInsets.only(bottom: 16),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'Loan: ₹${loan.application.amountRequested.toStringAsFixed(0)}',
                                          style: const TextStyle(fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: _getStatusColor(loan.status).withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            loan.status,
                                            style: TextStyle(
                                              color: _getStatusColor(loan.status),
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      'Pending EMIs:',
                                      style: TextStyle(fontWeight: FontWeight.w600),
                                    ),
                                    const SizedBox(height: 8),
                                    ...loan.schedule.where((s) => !(s['paid'] as bool? ?? false)).map((s) => Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: selectedLoanId == loan.id && selectedInstallment?['installmentNo'] == s['installmentNo']
                                            ? Colors.blue.shade50
                                            : Colors.grey.shade50,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: selectedLoanId == loan.id && selectedInstallment?['installmentNo'] == s['installmentNo']
                                              ? Colors.blue
                                              : Colors.grey.shade300,
                                          width: 1,
                                        ),
                                      ),
                                      child: InkWell(
                                        onTap: () => _selectInstallment(loan.id, s),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    'EMI ${s['installmentNo']}',
                                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                                  ),
                                                  Text(
                                                    'Due: ${DateTime.parse(s['dueDate'] as String).toLocal().toString().split(' ')[0]}',
                                                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                                                  ),
                                                  Text(
                                                    '₹${s['total']} (Principal: ₹${s['principal']}, Interest: ₹${s['interest']})',
                                                    style: const TextStyle(fontSize: 12),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.end,
                                              children: [
                                                Text(
                                                  '₹${s['total']}',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 16,
                                                  ),
                                                ),
                                                Text(
                                                  _getDaysUntilDue(DateTime.parse(s['dueDate'] as String)),
                                                  style: const TextStyle(fontSize: 10, color: Colors.red),
                                                ),
                                                const SizedBox(height: 8),
                                                ElevatedButton(
                                                  onPressed: () => _selectInstallment(loan.id, s),
                                                  child: const Text('Pay This EMI'),
                                                  style: ElevatedButton.styleFrom(
                                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                                    textStyle: const TextStyle(fontSize: 12),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    )),
                                    // Add partial payment option
                                    if (loan.schedule.where((s) => !(s['paid'] as bool? ?? false)).isNotEmpty)
                                      Container(
                                        margin: const EdgeInsets.only(top: 12),
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: Colors.orange.shade50,
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: Colors.orange.shade300, width: 1),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              'Partial Payment Option',
                                              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange),
                                            ),
                                            const SizedBox(height: 8),
                                            const Text(
                                              'Pay any amount towards your loan. This will be applied to pending EMIs.',
                                              style: TextStyle(fontSize: 12, color: Colors.grey),
                                            ),
                                            const SizedBox(height: 8),
                                            ElevatedButton.icon(
                                              onPressed: () => _payPartialLoan(loan),
                                              icon: const Icon(Icons.account_balance_wallet),
                                              label: const Text('Pay Partial Amount'),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: Colors.orange,
                                                foregroundColor: Colors.white,
                                                minimumSize: const Size(double.infinity, 36),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            )),
                            if (loans.where((loan) => loan.status == 'DISBURSED').isEmpty)
                              const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(32),
                                  child: Text(
                                    'No disbursed loans with pending EMIs',
                                    style: TextStyle(color: Colors.grey),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ),
                            const SizedBox(height: 24),
                            if (selectedInstallment != null)
                              Card(
                                color: Colors.blue.shade50,
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    children: [
                                      const Text(
                                        'Selected EMI',
                                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 8),
                                      Text('EMI ${selectedInstallment!['installmentNo']} - ₹${selectedInstallment!['total']}'),
                                      const SizedBox(height: 16),
                                      ElevatedButton.icon(
                                        onPressed: _payInstallment,
                                        icon: const Icon(Icons.payment),
                                        label: const Text('Pay Now via Razorpay'),
                                        style: ElevatedButton.styleFrom(
                                          minimumSize: const Size(double.infinity, 48),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            const SizedBox(height: 32),
                            ExpansionTile(
                              title: const Text('Pay Full Loan (for others)'),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    children: [
                                      TextField(
                                        controller: loanIdController,
                                        decoration: const InputDecoration(
                                          labelText: 'Loan ID',
                                          border: OutlineInputBorder(),
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      TextField(
                                        controller: mobileController,
                                        decoration: const InputDecoration(
                                          labelText: 'Mobile Number',
                                          border: OutlineInputBorder(),
                                        ),
                                        keyboardType: TextInputType.phone,
                                      ),
                                      const SizedBox(height: 16),
                                      if (searchingLoan)
                                        const CircularProgressIndicator()
                                      else
                                        ElevatedButton(
                                          onPressed: _searchLoan,
                                          child: const Text('Search Loan'),
                                        ),
                                      if (foundLoan != null)
                                        Card(
                                          margin: const EdgeInsets.only(top: 16),
                                          child: Padding(
                                            padding: const EdgeInsets.all(16),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text('Loan ID: ${foundLoan!['_id']}'),
                                                Text('Amount: ₹${foundLoan!['outstandingAmount']}'),
                                                const SizedBox(height: 16),
                                                ElevatedButton.icon(
                                                  onPressed: _payFullLoan,
                                                  icon: const Icon(Icons.payment),
                                                  label: const Text('Pay Full Loan'),
                                                  style: ElevatedButton.styleFrom(
                                                    minimumSize: const Size(double.infinity, 48),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            if (msg.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.all(16),
                                child: Text(
                                  msg,
                                  style: TextStyle(
                                    color: msg.contains('successful') ? Colors.green : Colors.red,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                          ],
                        ),
                      ),

            // Transaction History Tab
            loadingPayments
                ? const Center(child: CircularProgressIndicator())
                : allPayments.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.history, size: 64, color: Colors.grey),
                            SizedBox(height: 16),
                            Text('No transactions yet', style: TextStyle(fontSize: 18, color: Colors.grey)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadPayments,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: allPayments.length,
                          itemBuilder: (context, index) {
                            final payment = allPayments[index];
                            final isP2P = payment['type'] == 'P2P';
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: Icon(
                                  isP2P ? Icons.swap_horiz : Icons.payment,
                                  color: isP2P ? Colors.green : Colors.blue,
                                ),
                                title: Text(
                                  isP2P
                                      ? 'To: ${payment['payeeDetails']?['name'] ?? 'Unknown'}'
                                      : 'Payment ${payment['type']}',
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${payment['createdAt']?.split('T')[0] ?? ''}',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                    if (isP2P)
                                      Text(
                                        'VPA: ${payment['payeeDetails']?['vpa'] ?? ''}',
                                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                                      ),
                                  ],
                                ),
                                trailing: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '₹${payment['amount']}',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: payment['status'] == 'CONFIRMED' ? Colors.green : Colors.orange,
                                      ),
                                    ),
                                    Text(
                                      payment['status'],
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: payment['status'] == 'CONFIRMED' ? Colors.green : Colors.orange,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ],
        ),
      ),
    );
  }

  String _getDaysUntilDue(DateTime dueDate) {
    final now = DateTime.now();
    final difference = dueDate.difference(now).inDays;
    if (difference < 0) {
      return '${difference.abs()} days overdue';
    } else if (difference == 0) {
      return 'Due today';
    } else {
      return '$difference days left';
    }
  }
}
