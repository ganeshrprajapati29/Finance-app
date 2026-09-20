import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/friendly_error.dart';
import '../../models/withdrawal_request.dart';
import '../../clubapi/services/clubapi_service_updated.dart';
import '../../providers/auth_providers.dart';
import '../../routes/app_router.dart';
import '../../services/withdrawal_service.dart';
import '../widgets/app_back_button.dart';

class WithdrawPage extends ConsumerStatefulWidget {
  const WithdrawPage({super.key});

  @override
  ConsumerState<WithdrawPage> createState() => _WithdrawPageState();
}

class _WithdrawPageState extends ConsumerState<WithdrawPage> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _accountNumberController = TextEditingController();
  final _ifscController = TextEditingController();
  final _accountHolderController = TextEditingController();

  bool _loading = false;
  bool _bankValidating = false;
  String? _message;
  String? _bankValidationMessage;
  List<WithdrawalRequest> _withdrawals = [];

  @override
  void initState() {
    super.initState();
    _loadWithdrawals();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _bankNameController.dispose();
    _accountNumberController.dispose();
    _ifscController.dispose();
    _accountHolderController.dispose();
    super.dispose();
  }

  Future<void> _loadWithdrawals() async {
    try {
      final list = await WithdrawalService.getMyWithdrawals();
      if (mounted) setState(() => _withdrawals = list);
    } catch (e) {
      if (mounted) setState(() => _message = 'Withdraw history load failed: $e');
    }
  }

  Future<void> _submit(num loanLimit) async {
    if (_formKey.currentState?.validate() != true) return;

    final amount = num.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) {
      setState(() => _message = 'Enter a valid amount');
      return;
    }
    if (amount > loanLimit) {
      setState(() => _message = 'Amount cannot be greater than your loan limit');
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
    });

    try {
      await WithdrawalService.createWithdrawal(
        amount: amount,
        bankDetails: {
          'bankName': _bankNameController.text.trim(),
          'accountNumber': _accountNumberController.text.trim(),
          'ifscCode': _ifscController.text.trim().toUpperCase(),
          'accountHolderName': _accountHolderController.text.trim(),
        },
      );
      _clearForm();
      await _loadWithdrawals();
      if (mounted) setState(() => _message = 'Withdrawal request submitted for approval');
    } catch (e) {
      if (mounted) setState(() => _message = 'Withdrawal failed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _clearForm() {
    _amountController.clear();
    _bankNameController.clear();
    _accountNumberController.clear();
    _ifscController.clear();
    _accountHolderController.clear();
  }

  void _setQuickAmount(num value) {
    _amountController.text = value.toStringAsFixed(0);
  }

  Future<void> _validateBank(String customerMobile) async {
    final account = _accountNumberController.text.trim();
    final ifsc = _ifscController.text.trim().toUpperCase();
    if (customerMobile.length != 10 || account.length < 6 || !RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc)) {
      setState(() => _bankValidationMessage = 'Enter valid mobile, account number and IFSC first');
      return;
    }
    setState(() {
      _bankValidating = true;
      _bankValidationMessage = null;
    });
    try {
      final result = await ClubAPIService().validateBankAccount(
        customerMobile: customerMobile,
        accountNumber: account,
        ifscCode: ifsc,
      );
      final name = (result['accountName'] ?? result['beneficiaryName'] ?? '').toString();
      if (mounted) {
        setState(() {
          if (name.isNotEmpty) _accountHolderController.text = name;
          _bankValidationMessage = name.isEmpty ? 'Bank response received, name not returned' : 'Validated: $name';
        });
      }
    } catch (e) {
      if (mounted) setState(() => _bankValidationMessage = 'Bank validation failed: $e');
    } finally {
      if (mounted) setState(() => _bankValidating = false);
    }
  }

  String _date(DateTime? date) {
    if (date == null) return 'N/A';
    return '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF4F8F7),
      appBar: AppBar(
        title: const Text('Withdraw'),
        leading: const AppBackButton(),
        actions: [
          IconButton(onPressed: _loadWithdrawals, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: me.when(
        data: (user) {
          final loanLimit = user.loanLimit;
          return RefreshIndicator(
            onRefresh: _loadWithdrawals,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _LimitCard(loanLimit: loanLimit, requested: _withdrawals.where((w) => w.status == 'PENDING').fold<num>(0, (s, w) => s + w.amount)),
                if (_message != null) ...[
                  const SizedBox(height: 12),
                  _MessageBanner(text: _message!),
                ],
                const SizedBox(height: 16),
                _FormCard(
                  formKey: _formKey,
                  amountController: _amountController,
                  bankNameController: _bankNameController,
                  accountNumberController: _accountNumberController,
                  ifscController: _ifscController,
                  accountHolderController: _accountHolderController,
                  loanLimit: loanLimit,
                  loading: _loading,
                  bankValidating: _bankValidating,
                  bankValidationMessage: _bankValidationMessage,
                  onQuickAmount: _setQuickAmount,
                  onValidateBank: () => _validateBank(user.mobile),
                  onSubmit: () => _submit(loanLimit),
                ),
                const SizedBox(height: 18),
                const Text('Withdrawal Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0B1220))),
                const SizedBox(height: 8),
                if (_withdrawals.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(18),
                      child: Text('No withdrawal requests yet.', style: TextStyle(color: Color(0xFF64748B))),
                    ),
                  )
                else
                  ..._withdrawals.map(
                    (w) => Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: _statusColor(w.status).withOpacity(0.12),
                          child: Icon(Icons.account_balance, color: _statusColor(w.status)),
                        ),
                        title: Text('Rs. ${w.amount}', style: const TextStyle(fontWeight: FontWeight.w900)),
                        subtitle: Text('${w.bankDetails['bankName'] ?? 'Bank'} • ${_date(w.createdAt)}'),
                        trailing: Chip(
                          label: Text(w.status),
                          labelStyle: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
                          backgroundColor: _statusColor(w.status),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Text(
              friendlyErrorMessage(e, fallback: 'Unable to load profile.'),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}

class _LimitCard extends StatelessWidget {
  final num loanLimit;
  final num requested;

  const _LimitCard({required this.loanLimit, required this.requested});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0B1220),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Loan limit available', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('Rs. ${loanLimit.toStringAsFixed(0)}', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.info_outline, color: Color(0xFF5EEAD4), size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  requested > 0 ? 'Pending withdrawal requests: Rs. ${requested.toStringAsFixed(0)}' : 'Withdraw requests are approved by KhatuPay before payout.',
                  style: const TextStyle(color: Color(0xFFBFFAF0), fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FormCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController amountController;
  final TextEditingController bankNameController;
  final TextEditingController accountNumberController;
  final TextEditingController ifscController;
  final TextEditingController accountHolderController;
  final num loanLimit;
  final bool loading;
  final bool bankValidating;
  final String? bankValidationMessage;
  final ValueChanged<num> onQuickAmount;
  final VoidCallback onValidateBank;
  final VoidCallback onSubmit;

  const _FormCard({
    required this.formKey,
    required this.amountController,
    required this.bankNameController,
    required this.accountNumberController,
    required this.ifscController,
    required this.accountHolderController,
    required this.loanLimit,
    required this.loading,
    required this.bankValidating,
    required this.bankValidationMessage,
    required this.onQuickAmount,
    required this.onValidateBank,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final quick = [
      loanLimit * 0.25,
      loanLimit * 0.5,
      loanLimit,
    ].where((v) => v > 0).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Request payout', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              TextFormField(
                controller: amountController,
                keyboardType: TextInputType.number,
                validator: (v) {
                  final amount = num.tryParse(v?.trim() ?? '');
                  if (amount == null || amount <= 0) return 'Enter amount';
                  if (amount > loanLimit) return 'Amount exceeds loan limit';
                  return null;
                },
                decoration: const InputDecoration(labelText: 'Amount', prefixText: 'Rs. ', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: quick.map((amount) {
                  final label = amount == loanLimit ? 'Max' : 'Rs. ${amount.toStringAsFixed(0)}';
                  return ChoiceChip(label: Text(label), selected: false, onSelected: (_) => onQuickAmount(amount));
                }).toList(),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: bankNameController,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter bank name' : null,
                decoration: const InputDecoration(labelText: 'Bank name', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: accountNumberController,
                keyboardType: TextInputType.number,
                validator: (v) => (v == null || v.trim().length < 6) ? 'Enter account number' : null,
                decoration: const InputDecoration(labelText: 'Account number', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: ifscController,
                textCapitalization: TextCapitalization.characters,
                validator: (v) => (v == null || v.trim().length < 6) ? 'Enter IFSC code' : null,
                decoration: const InputDecoration(labelText: 'IFSC code', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: accountHolderController,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter account holder name' : null,
                decoration: const InputDecoration(labelText: 'Account holder name', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: bankValidating ? null : onValidateBank,
                icon: bankValidating
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.verified_outlined),
                label: Text(bankValidating ? 'Validating...' : 'Validate Account Name'),
              ),
              if (bankValidationMessage != null) ...[
                const SizedBox(height: 8),
                Text(bankValidationMessage!, style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w800)),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: loading ? null : onSubmit,
                  icon: loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send),
                  label: Text(loading ? 'Submitting...' : 'Submit Withdrawal Request'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageBanner extends StatelessWidget {
  final String text;

  const _MessageBanner({required this.text});

  @override
  Widget build(BuildContext context) {
    final success = text.toLowerCase().contains('submitted');
    final color = success ? Colors.green : Colors.orange;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.24)),
      ),
      child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
    );
  }
}
