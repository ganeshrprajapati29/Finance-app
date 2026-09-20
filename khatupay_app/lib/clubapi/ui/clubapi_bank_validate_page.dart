import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../ui/widgets/app_back_button.dart';
import '../providers/clubapi_providers.dart';

class ClubAPIBankValidatePage extends ConsumerStatefulWidget {
  const ClubAPIBankValidatePage({super.key});

  @override
  ConsumerState<ClubAPIBankValidatePage> createState() => _ClubAPIBankValidatePageState();
}

class _ClubAPIBankValidatePageState extends ConsumerState<ClubAPIBankValidatePage> {
  final _formKey = GlobalKey<FormState>();
  final _mobileC = TextEditingController();
  final _accountC = TextEditingController();
  final _ifscC = TextEditingController();
  bool _loading = false;
  Map<String, dynamic>? _result;

  @override
  void dispose() {
    _mobileC.dispose();
    _accountC.dispose();
    _ifscC.dispose();
    super.dispose();
  }

  Future<void> _validate() async {
    if (_formKey.currentState?.validate() != true) return;
    setState(() {
      _loading = true;
      _result = null;
    });
    try {
      final result = await ref.read(clubAPIServiceProvider).validateBankAccount(
            customerMobile: _mobileC.text.trim(),
            accountNumber: _accountC.text.trim(),
            ifscCode: _ifscC.text.trim(),
          );
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Bank validation failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accountName = (_result?['accountName'] ?? _result?['beneficiaryName'] ?? '').toString();
    final resText = (_result?['resText'] ?? '').toString();
    final isValid = _result?['isValid'] == true;

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Bank Account Validate'),
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Account Name Validate',
                      style: TextStyle(color: KhatuColors.text, fontSize: 18, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _mobileC,
                      keyboardType: TextInputType.phone,
                      maxLength: 10,
                      validator: (v) => RegExp(r'^\d{10}$').hasMatch(v?.trim() ?? '') ? null : 'Enter 10 digit customer mobile',
                      decoration: const InputDecoration(labelText: 'Customer Mobile', prefixIcon: Icon(Icons.phone), border: OutlineInputBorder(), counterText: ''),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _accountC,
                      keyboardType: TextInputType.number,
                      validator: (v) => (v?.trim().length ?? 0) >= 6 ? null : 'Enter account number',
                      decoration: const InputDecoration(labelText: 'Account Number', prefixIcon: Icon(Icons.account_balance), border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _ifscC,
                      textCapitalization: TextCapitalization.characters,
                      validator: (v) => RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$', caseSensitive: false).hasMatch(v?.trim() ?? '') ? null : 'Enter valid IFSC',
                      decoration: const InputDecoration(labelText: 'IFSC Code', prefixIcon: Icon(Icons.confirmation_number), border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _loading ? null : _validate,
                        icon: _loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.verified),
                        label: Text(_loading ? 'Validating...' : 'Validate Account Name'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_result != null)
              Card(
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isValid ? KhatuColors.mint.withOpacity(0.14) : KhatuColors.saffron.withOpacity(0.16),
                    child: Icon(isValid ? Icons.check : Icons.info_outline, color: isValid ? KhatuColors.teal : KhatuColors.saffron),
                  ),
                  title: Text(accountName.isEmpty ? 'Name not returned' : accountName, style: const TextStyle(fontWeight: FontWeight.w900)),
                  subtitle: Text(resText.isEmpty ? 'Response received' : resText),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
