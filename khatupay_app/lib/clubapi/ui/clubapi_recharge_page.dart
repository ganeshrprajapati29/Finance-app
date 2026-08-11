import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../services/payment_service.dart';
import '../../ui/widgets/app_back_button.dart';
import '../models/clubapi_transaction.dart';
import '../providers/clubapi_providers.dart';

class ClubAPIRechargePage extends ConsumerStatefulWidget {
  const ClubAPIRechargePage({super.key});

  @override
  ConsumerState<ClubAPIRechargePage> createState() => _ClubAPIRechargePageState();
}

class _ClubAPIRechargePageState extends ConsumerState<ClubAPIRechargePage> {
  final _operatorController = TextEditingController();
  final _accountRefController = TextEditingController();
  final _amountController = TextEditingController();
  final _customerMobileController = TextEditingController();
  final _paymentService = PaymentService();

  String _type = 'mobile';
  bool _operatorsLoading = true;
  bool _validatingAmount = false;
  bool _payingRecharge = false;
  String? _operatorError;
  String? _amountValidationMessage;
  String? _rechargeMessage;
  Map<String, dynamic>? _selectedOperator;
  ClubAPITransaction? _paidRechargeTransaction;
  List<Map<String, dynamic>> _operators = [];

  @override
  void initState() {
    super.initState();
    _loadOperators();
  }

  @override
  void dispose() {
    _operatorController.dispose();
    _accountRefController.dispose();
    _amountController.dispose();
    _customerMobileController.dispose();
    _paymentService.dispose();
    super.dispose();
  }

  Future<void> _loadOperators() async {
    setState(() {
      _operatorsLoading = true;
      _operatorError = null;
    });

    try {
      final rows = await ref.read(clubAPIServiceProvider).getOperatorList();
      final seen = <String>{};
      final operators = rows
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .where((row) => _operatorId(row).isNotEmpty && _operatorName(row).isNotEmpty)
          .where((row) => seen.add(_operatorId(row)))
          .toList();
      if (!mounted) return;
      setState(() {
        _operators = operators;
        _operatorsLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _operatorError = e.toString();
        _operatorsLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredOperators {
    final needle = _type.toLowerCase();
    final filtered = _operators.where((row) {
      final category = [
        row['category'],
        row['type'],
        row['serviceType'],
        row['operatorType'],
        row['transType'],
      ].where((value) => value != null).join(' ').toLowerCase();
      if (category.isEmpty) return true;
      if (needle == 'mobile') {
        return category.contains('mobile') || category.contains('prepaid');
      }
      return category.contains('dth');
    }).toList();
    return filtered.isEmpty ? _operators : filtered;
  }

  String _operatorId(Map<String, dynamic> row) {
    return (row['operatorId'] ?? row['id'] ?? row['opId'] ?? row['code'] ?? row['operatorCode'] ?? '')
        .toString()
        .trim();
  }

  String _operatorName(Map<String, dynamic> row) {
    return (row['operatorName'] ?? row['name'] ?? row['operator'] ?? row['title'] ?? '').toString().trim();
  }

  String _newUrid() {
    final stamp = DateTime.now().millisecondsSinceEpoch.toRadixString(36).toUpperCase();
    return 'KPR$stamp'.padRight(12, '0');
  }

  String _effectiveCustomerMobile() {
    final typed = _customerMobileController.text.trim();
    if (typed.isNotEmpty) return typed;
    if (_type == 'mobile') return _accountRefController.text.trim();
    return '';
  }

  Future<void> _validateAmount() async {
    final operatorId = _operatorController.text.trim();
    final accountRef = _accountRefController.text.trim();
    final amount = _amountController.text.trim();
    if (operatorId.isEmpty || accountRef.isEmpty || amount.isEmpty) {
      setState(() => _amountValidationMessage = 'Enter operator ID, number and amount first.');
      return;
    }

    setState(() {
      _validatingAmount = true;
      _amountValidationMessage = null;
    });

    try {
      final result = await ref.read(clubAPIServiceProvider).validateRechargeAmount(
            urid: _newUrid(),
            mobile: accountRef,
            operatorId: operatorId,
            rechargeAmount: amount,
            transType: 'amountValidation',
          );
      if (!mounted) return;
      setState(() {
        _amountValidationMessage = result['resText']?.toString().isNotEmpty == true
            ? result['resText'].toString()
            : 'Amount validation completed.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _amountValidationMessage = e.toString());
    } finally {
      if (mounted) setState(() => _validatingAmount = false);
    }
  }

  Future<void> _recharge() async {
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    final operatorId = _operatorController.text.trim();
    final accountRef = _accountRefController.text.trim();
    final customerMobile = _effectiveCustomerMobile();

    if (operatorId.isEmpty || accountRef.isEmpty || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter valid operator ID, account and amount.')),
      );
      return;
    }

    setState(() {
      _payingRecharge = true;
      _rechargeMessage = null;
      _paidRechargeTransaction = null;
    });

    try {
      final data = await _paymentService.createRechargeOrder(
        amount: amount,
        type: _type,
        operatorId: operatorId,
        accountRef: accountRef,
        customerMobile: customerMobile.isEmpty ? null : customerMobile,
      );
      final order = Map<String, dynamic>.from(data['order'] ?? {});
      final orderId = (order['id'] ?? '').toString();
      if (orderId.isEmpty) throw Exception('Payment order create nahi hua');

      _paymentService.newCheckout(
        amount: amount,
        orderId: orderId,
        keyId: data['key_id']?.toString(),
        onSuccess: (oid, pid, sig) async {
          try {
            final verified = await _paymentService.verifyRazorpay(oid, pid, sig);
            final recharge = verified['recharge'] is Map ? Map<String, dynamic>.from(verified['recharge']) : const <String, dynamic>{};
            final transactionJson = recharge['transaction'] is Map ? Map<String, dynamic>.from(recharge['transaction']) : null;
            final refund = recharge['refund'];
            if (!mounted) return;
            setState(() {
              _payingRecharge = false;
              _paidRechargeTransaction = transactionJson == null ? null : ClubAPITransaction.fromJson(transactionJson);
              _rechargeMessage = refund != null
                  ? 'Recharge failed. Refund/wallet credit initiate ho gaya hai.'
                  : 'Payment successful. Recharge request submitted.';
            });
          } catch (e) {
            if (!mounted) return;
            setState(() {
              _payingRecharge = false;
              _rechargeMessage = 'Payment verify/recharge failed: $e';
            });
          }
        },
        onFail: (message) {
          if (!mounted) return;
          setState(() {
            _payingRecharge = false;
            _rechargeMessage = message;
          });
        },
        );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _payingRecharge = false;
        _rechargeMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final operators = _filteredOperators;

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Recharge'),
        leading: const AppBackButton(fallbackRoute: '/clubapi/dashboard'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _HeaderCard(
              icon: Icons.phone_android,
              title: 'Mobile & DTH Recharge',
              subtitle: 'Live recharge through ClubAPI with transaction tracking.',
            ),
            const SizedBox(height: 16),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'mobile', icon: Icon(Icons.phone_android), label: Text('Mobile')),
                ButtonSegment(value: 'dth', icon: Icon(Icons.satellite_alt), label: Text('DTH')),
              ],
              selected: {_type},
              onSelectionChanged: (values) {
                setState(() {
                  _type = values.first;
                  _selectedOperator = null;
                  _operatorController.clear();
                  _amountValidationMessage = null;
                });
              },
            ),
            const SizedBox(height: 14),
            if (_operatorsLoading)
              const LinearProgressIndicator()
            else if (operators.isNotEmpty)
              DropdownButtonFormField<String>(
                value: _selectedOperator == null ? null : _operatorId(_selectedOperator!),
                items: operators.map((row) {
                  final id = _operatorId(row);
                  return DropdownMenuItem(
                    value: id,
                    child: Text('$id - ${_operatorName(row)}', overflow: TextOverflow.ellipsis),
                  );
                }).toList(),
                onChanged: (value) {
                  final row = operators.firstWhere((item) => _operatorId(item) == value);
                  setState(() {
                    _selectedOperator = row;
                    _operatorController.text = _operatorId(row);
                    _amountValidationMessage = null;
                  });
                },
                decoration: const InputDecoration(
                  labelText: 'ClubAPI Operator',
                  prefixIcon: Icon(Icons.apartment),
                ),
              ),
            if (_operatorError != null) ...[
              _MessageCard(
                message: 'Operator list unavailable. Enter ClubAPI operator ID manually. $_operatorError',
                color: Colors.orange,
              ),
              const SizedBox(height: 12),
            ],
            if (!_operatorsLoading) ...[
              const SizedBox(height: 14),
              TextField(
                controller: _operatorController,
                decoration: const InputDecoration(
                  labelText: 'Operator ID',
                  hintText: 'ClubAPI operator ID',
                  prefixIcon: Icon(Icons.tag),
                ),
                keyboardType: TextInputType.number,
              ),
            ],
            const SizedBox(height: 14),
            TextField(
              controller: _accountRefController,
              decoration: InputDecoration(
                labelText: _type == 'mobile' ? 'Mobile Number' : 'Subscriber ID',
                hintText: _type == 'mobile' ? '10 digit mobile number' : 'Enter DTH subscriber ID',
                prefixIcon: const Icon(Icons.badge_outlined),
              ),
              keyboardType: _type == 'mobile' ? TextInputType.phone : TextInputType.text,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _amountController,
              decoration: const InputDecoration(
                labelText: 'Amount',
                hintText: 'Recharge amount',
                prefixIcon: Icon(Icons.currency_rupee),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _customerMobileController,
              decoration: InputDecoration(
                labelText: _type == 'mobile' ? 'Customer Mobile' : 'Customer Mobile',
                hintText: _type == 'mobile' ? 'Defaults to recharge mobile' : '10 digit contact mobile',
                prefixIcon: const Icon(Icons.phone_outlined),
              ),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _validatingAmount ? null : _validateAmount,
              icon: _validatingAmount
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.fact_check_outlined),
              label: const Text('Validate Amount'),
            ),
            if (_amountValidationMessage != null) ...[
              const SizedBox(height: 10),
              _MessageCard(message: _amountValidationMessage!, color: Colors.blueGrey),
            ],
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _payingRecharge ? null : _recharge,
              icon: _payingRecharge
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.payment),
              label: Text(_payingRecharge ? 'Opening Payment...' : 'Pay & Recharge'),
            ),
            const SizedBox(height: 18),
            if (_rechargeMessage != null)
              _MessageCard(
                message: _rechargeMessage!,
                color: _rechargeMessage!.toLowerCase().contains('failed') ? Colors.red : Colors.green,
              ),
            if (_paidRechargeTransaction != null) ...[
              const SizedBox(height: 12),
              _RechargeResultCard(transaction: _paidRechargeTransaction!),
            ],
          ],
        ),
      ),
    );
  }
}

class _RechargeResultCard extends StatelessWidget {
  final dynamic transaction;

  const _RechargeResultCard({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final status = (transaction.status ?? '').toString();
    final success = status.toLowerCase() == 'completed' || status.toUpperCase() == 'SUCCESS';
    final color = success ? Colors.green : Colors.orange;

    return Card(
      color: color.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              success ? 'Recharge Successful' : 'Recharge Processing',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color),
            ),
            const SizedBox(height: 14),
            _DetailRow(label: 'Transaction ID', value: transaction.urid ?? ''),
            _DetailRow(label: 'Amount', value: 'Rs. ${transaction.amount ?? 0}'),
            _DetailRow(label: 'Status', value: status),
            if ((transaction.provider ?? '').toString().isNotEmpty)
              _DetailRow(label: 'Operator', value: transaction.provider.toString()),
            if ((transaction.accountRef ?? '').toString().isNotEmpty)
              _DetailRow(label: 'Account', value: transaction.accountRef.toString()),
            if (transaction.createdAt != null)
              _DetailRow(label: 'Date', value: transaction.createdAt.toString().split(' ').first),
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _HeaderCard({required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [KhatuColors.ink, KhatuColors.deepTeal, KhatuColors.teal]),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          CircleAvatar(backgroundColor: Colors.white, child: Icon(icon, color: KhatuColors.teal)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  final String message;
  final Color color;

  const _MessageCard({required this.message, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Text(message, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: KhatuColors.muted, fontWeight: FontWeight.w700))),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}
