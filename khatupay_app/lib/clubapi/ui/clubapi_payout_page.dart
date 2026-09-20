import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../ui/widgets/app_back_button.dart';
import '../providers/clubapi_providers.dart';

class ClubAPIPayoutPage extends ConsumerStatefulWidget {
  const ClubAPIPayoutPage({super.key});

  @override
  ConsumerState<ClubAPIPayoutPage> createState() => _ClubAPIPayoutPageState();
}

class _ClubAPIPayoutPageState extends ConsumerState<ClubAPIPayoutPage> {
  final _formKey = GlobalKey<FormState>();
  final _amountC = TextEditingController();
  final _outletMobileC = TextEditingController();
  final _accountC = TextEditingController();
  final _ifscC = TextEditingController();
  final _nameC = TextEditingController();
  final _mobileC = TextEditingController();
  bool _validating = false;
  bool _paying = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _amountC.dispose();
    _outletMobileC.dispose();
    _accountC.dispose();
    _ifscC.dispose();
    _nameC.dispose();
    _mobileC.dispose();
    super.dispose();
  }

  Future<void> _validateBank() async {
    if (!_validBankInputs()) return;
    setState(() => _validating = true);
    try {
      final result = await ref.read(clubAPIServiceProvider).validateBankAccount(
            customerMobile: _mobileC.text.trim(),
            accountNumber: _accountC.text.trim(),
            ifscCode: _ifscC.text.trim(),
          );
      final name =
          (result['accountName'] ?? result['beneficiaryName'] ?? '').toString();
      if (mounted) {
        if (name.isNotEmpty) _nameC.text = name;
        setState(() => _result = result);
      }
    } catch (e) {
      _show('Bank validation failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _validating = false);
    }
  }

  bool _validBankInputs() {
    final mobile = _mobileC.text.trim();
    final account = _accountC.text.trim();
    final ifsc = _ifscC.text.trim().toUpperCase();
    if (!RegExp(r'^\d{10}$').hasMatch(mobile) ||
        account.length < 6 ||
        !RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc)) {
      _show('Enter valid customer mobile, account number and IFSC',
          error: true);
      return false;
    }
    return true;
  }

  Future<void> _payout() async {
    if (_formKey.currentState?.validate() != true) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Payout'),
        content:
            Text('Send Rs. ${_amountC.text.trim()} to ${_nameC.text.trim()}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Confirm')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _paying = true;
      _result = null;
    });
    try {
      final result = await ref.read(clubAPIServiceProvider).payout(
            amount: _amountC.text.trim(),
            outletMobile: _outletMobileC.text.trim(),
            bankAccountNumber: _accountC.text.trim(),
            bankIfscCode: _ifscC.text.trim(),
            beneficiaryName: _nameC.text.trim(),
            mobile: _mobileC.text.trim(),
          );
      if (mounted) setState(() => _result = result);
      _show('Payout request submitted');
    } catch (e) {
      _show('Payout failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _show(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(message),
          backgroundColor: error ? Colors.red : Colors.green),
    );
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    final status = (_result?['status'] ?? '').toString();
    final resText = (_result?['resText'] ?? '').toString();

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Payout'),
        leading: const AppBackButton(fallbackRoute: '/clubapi/dashboard'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _field(_amountC, 'Amount', Icons.currency_rupee,
                        number: true),
                    _field(_outletMobileC, 'Outlet Mobile', Icons.store,
                        number: true, maxLength: 10),
                    _field(_mobileC, 'Customer Mobile', Icons.phone,
                        number: true, maxLength: 10),
                    _field(
                        _accountC, 'Bank Account Number', Icons.account_balance,
                        number: true),
                    _field(_ifscC, 'IFSC Code', Icons.confirmation_number),
                    _field(_nameC, 'Beneficiary Name', Icons.person),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _validating ? null : _validateBank,
                            icon: _validating
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.verified_outlined),
                            label: Text(_validating
                                ? 'Validating...'
                                : 'Validate Name'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _paying ? null : _payout,
                            icon: _paying
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.send),
                            label: Text(_paying ? 'Sending...' : 'Payout'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (_result != null)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.receipt_long),
                  title: Text(status.isEmpty ? 'Response received' : status,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle:
                      Text(resText.isEmpty ? _result.toString() : resText),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController controller, String label, IconData icon,
      {bool number = false, int? maxLength}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: number ? TextInputType.number : TextInputType.text,
        maxLength: maxLength,
        textCapitalization: label.contains('IFSC')
            ? TextCapitalization.characters
            : TextCapitalization.words,
        validator: _required,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          border: const OutlineInputBorder(),
          counterText: '',
        ),
      ),
    );
  }
}
