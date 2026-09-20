import 'package:flutter/material.dart';

import '../../core/app_navigation_history.dart';
import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../models/clubapi_transaction.dart';

enum RechargeResultStatus { success, pending, failed }

class RechargeResultData {
  final RechargeResultStatus status;
  final String title;
  final String message;
  final double amount;
  final String accountRef;
  final String? operatorName;
  final ClubAPITransaction? transaction;

  const RechargeResultData({
    required this.status,
    required this.title,
    required this.message,
    required this.amount,
    required this.accountRef,
    this.operatorName,
    this.transaction,
  });
}

class RechargeResultPage extends StatelessWidget {
  final RechargeResultData data;

  const RechargeResultPage({super.key, required this.data});

  Color get _color => switch (data.status) {
        RechargeResultStatus.success => const Color(0xFF16A34A),
        RechargeResultStatus.pending => const Color(0xFFF59E0B),
        RechargeResultStatus.failed => const Color(0xFFDC2626),
      };

  IconData get _icon => switch (data.status) {
        RechargeResultStatus.success => Icons.check_circle_rounded,
        RechargeResultStatus.pending => Icons.hourglass_top_rounded,
        RechargeResultStatus.failed => Icons.cancel_rounded,
      };

  String get _amountText {
    final amount = data.amount;
    return 'Rs. ${amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2)}';
  }

  @override
  Widget build(BuildContext context) {
    final transaction = data.transaction;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          AppNavigationHistory.goBack(router, fallback: '/recharge');
        }
      },
      child: Scaffold(
        backgroundColor: KhatuColors.bg,
        appBar: AppBar(
          title: const Text('Recharge Status'),
          automaticallyImplyLeading: false,
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
            child: Column(
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: _color.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(_icon, color: _color, size: 56),
                ),
                const SizedBox(height: 20),
                Text(
                  data.title,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: _color,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  data.message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: KhatuColors.muted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _row('Amount', _amountText),
                        _row('Number / Account', data.accountRef),
                        if ((data.operatorName ?? '').isNotEmpty)
                          _row('Operator', data.operatorName!),
                        if ((transaction?.urid ?? '').isNotEmpty)
                          _row('Transaction ID', transaction!.urid),
                        _row('Status', data.status.name.toUpperCase()),
                        if (transaction?.createdAt != null)
                          _row(
                              'Date',
                              transaction!.createdAt
                                  .toString()
                                  .split(' ')
                                  .first),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => router.go('/payment-history'),
                    icon: const Icon(Icons.receipt_long_outlined),
                    label: const Text('View History'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => router.go(
                        data.status == RechargeResultStatus.failed
                            ? '/recharge'
                            : '/'),
                    icon: Icon(data.status == RechargeResultStatus.failed
                        ? Icons.refresh_rounded
                        : Icons.home_outlined),
                    label: Text(data.status == RechargeResultStatus.failed
                        ? 'Try Again'
                        : 'Done'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: KhatuColors.muted, fontWeight: FontWeight.w700))),
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
