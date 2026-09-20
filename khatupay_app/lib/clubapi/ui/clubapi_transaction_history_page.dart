import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../ui/widgets/app_back_button.dart';
import '../models/clubapi_transaction.dart';
import '../providers/clubapi_providers.dart';
import 'service_ui.dart';

class ClubAPITransactionHistoryPage extends ConsumerStatefulWidget {
  const ClubAPITransactionHistoryPage({super.key});

  @override
  ConsumerState<ClubAPITransactionHistoryPage> createState() =>
      _ClubAPITransactionHistoryPageState();
}

class _ClubAPITransactionHistoryPageState
    extends ConsumerState<ClubAPITransactionHistoryPage> {
  final _searchController = TextEditingController();
  String _filter = 'ALL';
  String _statusFilter = 'ALL';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final transactionHistory = ref.watch(transactionHistoryProvider);

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Bills & Recharge History'),
        leading: const AppBackButton(fallbackRoute: '/bills'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(transactionHistoryProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: transactionHistory.when(
        data: (transactions) {
          final visible = _applyFilters(transactions);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(transactionHistoryProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                _SummaryStrip(transactions: transactions),
                const SizedBox(height: 14),
                _SearchBox(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 12),
                _FilterChips(
                  selected: _filter,
                  onChanged: (value) => setState(() => _filter = value),
                ),
                const SizedBox(height: 8),
                _StatusFilterChips(
                  selected: _statusFilter,
                  onChanged: (value) => setState(() => _statusFilter = value),
                ),
                const SizedBox(height: 14),
                if (visible.isEmpty)
                  const _EmptyState()
                else
                  ...visible.map((transaction) =>
                      _TransactionTile(transaction: transaction)),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => _ErrorState(
          message:
              'History could not be loaded. Check your connection and try again.',
          onRetry: () => ref.invalidate(transactionHistoryProvider),
        ),
      ),
    );
  }

  List<ClubAPITransaction> _applyFilters(List<ClubAPITransaction> rows) {
    final query = _searchController.text.trim().toLowerCase();
    return rows.where((transaction) {
      final kind = _historyKey(transaction);
      if (_filter != 'ALL' && kind != _filter) return false;
      if (_statusFilter != 'ALL' &&
          _statusGroup(transaction.status) != _statusFilter) return false;
      if (query.isEmpty) return true;
      final haystack = [
        transaction.urid,
        transaction.type,
        transaction.status,
        transaction.provider,
        transaction.accountRef,
        transaction.billId,
        transaction.customerMobile,
        _responseValue(transaction, ['orderId', 'order_id']),
        _responseValue(transaction, ['transId', 'operatorTransactionId']),
        _responseValue(transaction, ['resText', 'message']),
      ].whereType<String>().join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }
}

class _SummaryStrip extends StatelessWidget {
  final List<ClubAPITransaction> transactions;

  const _SummaryStrip({required this.transactions});

  @override
  Widget build(BuildContext context) {
    final completed = transactions.where((t) => _isSuccess(t.status)).length;
    final processing =
        transactions.where((t) => _isProcessing(t.status)).length;
    final failed = transactions.where((t) => _isFailed(t.status)).length;
    final amount = transactions
        .where((t) => t.type != 'bill_fetch')
        .fold<double>(0, (sum, t) => sum + t.amount);

    return SizedBox(
      height: 76,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _SummaryCard(
            label: 'Total',
            value: transactions.length.toString(),
            color: KhatuColors.deepTeal,
          ),
          const SizedBox(width: 8),
          _SummaryCard(
            label: 'Success',
            value: completed.toString(),
            color: Colors.green,
          ),
          const SizedBox(width: 8),
          _SummaryCard(
            label: 'Pending',
            value: processing.toString(),
            color: KhatuColors.saffron,
          ),
          const SizedBox(width: 8),
          _SummaryCard(
            label: 'Failed',
            value: failed.toString(),
            color: Colors.red,
          ),
          const SizedBox(width: 8),
          _SummaryCard(
            label: 'Amount',
            value: 'Rs. ${amount.toStringAsFixed(0)}',
            color: Colors.indigo,
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SummaryCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 94,
      constraints: const BoxConstraints(minHeight: 68),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: color, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _SearchBox extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const _SearchBox({required this.controller, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: 'Search history',
        hintText: 'Mobile, account, URID, order ID, biller',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: 'Clear',
                onPressed: () {
                  controller.clear();
                  onChanged('');
                },
                icon: const Icon(Icons.close),
              ),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const _FilterChips({required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    const filters = [
      ('ALL', 'All'),
      ('mobile', 'Mobile'),
      ('dth', 'DTH'),
      ('credit_card', 'Credit Card'),
      ('electricity', 'Electricity'),
      ('fastag', 'FASTag'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((item) {
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              selected: selected == item.$1,
              label: Text(item.$2),
              onSelected: (_) => onChanged(item.$1),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _StatusFilterChips extends StatelessWidget {
  const _StatusFilterChips({required this.selected, required this.onChanged});

  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const filters = [
      ('ALL', 'Any status'),
      ('SUCCESS', 'Successful'),
      ('PROCESSING', 'Processing'),
      ('FAILED', 'Failed'),
      ('REFUNDED', 'Refunded'),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final item in filters)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                selected: selected == item.$1,
                label: Text(item.$2),
                onSelected: (_) => onChanged(item.$1),
              ),
            ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final ClubAPITransaction transaction;

  const _TransactionTile({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(transaction.status);
    final serviceKey = _historyKey(transaction);
    final meta = ServiceMeta.of(serviceKey);
    final kind = _historyLabel(transaction);
    final orderId = _responseValue(transaction, ['orderId', 'order_id']);
    final transId =
        _responseValue(transaction, ['transId', 'operatorTransactionId']);
    final resText = _responseValue(transaction, ['resText', 'message']);

    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          child: ServiceIcon(meta: meta, size: 44, padding: 2),
        ),
        title: Text(
          _title(transaction),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            color: KhatuColors.text,
          ),
        ),
        subtitle: Text(
          [
            _statusLabel(transaction.status),
            _dateTime(transaction.createdAt),
            if ((transaction.accountRef ?? '').isNotEmpty)
              _maskedAccount(transaction.accountRef!),
            if ((orderId ?? '').isNotEmpty) 'Order $orderId',
            if ((transId ?? '').isNotEmpty) 'Txn $transId',
            if ((resText ?? '').isNotEmpty) resText!,
          ].where((item) => item.isNotEmpty).join(' | '),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: KhatuColors.muted,
            fontWeight: FontWeight.w700,
          ),
        ),
        trailing: SizedBox(
          width: 78,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                transaction.type == 'bill_fetch'
                    ? 'Fetch'
                    : 'Rs. ${transaction.amount.toStringAsFixed(2)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: color, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(kind,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10.5)),
            ],
          ),
        ),
        onTap: () => _showDetails(context, transaction),
      ),
    );
  }

  static String _title(ClubAPITransaction transaction) {
    final kind = _historyLabel(transaction);
    final provider = transaction.provider;
    if ((provider ?? '').isNotEmpty) return '$kind - $provider';
    return kind;
  }

  static void _showDetails(
      BuildContext context, ClubAPITransaction transaction) {
    final orderId = _responseValue(transaction, ['orderId', 'order_id']);
    final transId =
        _responseValue(transaction, ['transId', 'operatorTransactionId']);
    final creditUsed =
        _responseValue(transaction, ['creditused', 'creditUsed']);
    final resText = _responseValue(transaction, ['resText', 'message']);

    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.72,
        minChildSize: 0.35,
        maxChildSize: 0.92,
        builder: (context, controller) {
          return ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
            children: [
              Text(
                _title(transaction),
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              _DetailRow(label: 'URID', value: transaction.urid),
              _DetailRow(label: 'Type', value: transaction.type),
              _DetailRow(label: 'Status', value: transaction.status),
              _DetailRow(
                  label: 'Amount',
                  value: 'Rs. ${transaction.amount.toStringAsFixed(2)}'),
              if ((transaction.provider ?? '').isNotEmpty)
                _DetailRow(
                    label: 'Provider/Biller', value: transaction.provider!),
              if ((transaction.accountRef ?? '').isNotEmpty)
                _DetailRow(label: 'Account', value: transaction.accountRef!),
              if ((transaction.customerMobile ?? '').isNotEmpty)
                _DetailRow(
                    label: 'Customer Mobile',
                    value: transaction.customerMobile!),
              if ((transaction.billId ?? '').isNotEmpty)
                _DetailRow(label: 'Bill ID', value: transaction.billId!),
              if ((transaction.paymentId ?? '').isNotEmpty)
                _DetailRow(label: 'Payment ID', value: transaction.paymentId!),
              if ((orderId ?? '').isNotEmpty)
                _DetailRow(label: 'Order ID', value: orderId!),
              if ((transId ?? '').isNotEmpty)
                _DetailRow(label: 'Operator Txn ID', value: transId!),
              if ((creditUsed ?? '').isNotEmpty)
                _DetailRow(label: 'Credit Used', value: creditUsed!),
              if ((resText ?? '').isNotEmpty)
                _DetailRow(label: 'Message', value: resText!),
              if (transaction.createdAt != null)
                _DetailRow(
                    label: 'Created', value: _dateTime(transaction.createdAt)),
              if (transaction.updatedAt != null)
                _DetailRow(
                    label: 'Updated', value: _dateTime(transaction.updatedAt)),
              if (transaction.refund != null)
                _DetailRow(
                    label: 'Refund', value: transaction.refund.toString()),
            ],
          );
        },
      ),
    );
  }

  static Color _statusColor(String status) {
    if (_isSuccess(status)) return Colors.green;
    if (_isFailed(status)) return Colors.red;
    return KhatuColors.saffron;
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 126,
            child: Text(label,
                style: const TextStyle(
                    color: KhatuColors.muted, fontWeight: FontWeight.w800)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(Icons.history,
                size: 60, color: KhatuColors.muted.withOpacity(0.45)),
            const SizedBox(height: 16),
            const Text(
              'No matching history',
              style: TextStyle(
                  fontSize: 18,
                  color: KhatuColors.text,
                  fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            const Text(
              'Recharge, DTH and BBPS bill payment history will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: KhatuColors.muted, fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 54, color: Colors.red),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

String _historyKey(ClubAPITransaction transaction) {
  final explicit = transaction.service.trim().toLowerCase();
  if (ServiceMeta.all.any((meta) => meta.key == explicit)) return explicit;
  switch (transaction.type.toLowerCase()) {
    case 'mobile':
    case 'recharge':
      return 'mobile';
    case 'dth':
      return 'dth';
    default:
      final text = '${transaction.provider ?? ''} ${transaction.billId ?? ''}'
          .toLowerCase();
      if (text.contains('fastag') || text.contains('fast tag')) return 'fastag';
      if (text.contains('credit') || text.contains('card'))
        return 'credit_card';
      return 'electricity';
  }
}

String _historyLabel(ClubAPITransaction transaction) =>
    ServiceMeta.of(_historyKey(transaction)).label;

String _maskedAccount(String value) {
  final clean = value.trim();
  if (clean.length <= 4) return clean;
  return '${List.filled((clean.length - 4).clamp(2, 8), '•').join()}${clean.substring(clean.length - 4)}';
}

String _statusGroup(String status) {
  final value = status.toLowerCase();
  if (value.contains('refund') || value == 'reversed') return 'REFUNDED';
  if (_isSuccess(value)) return 'SUCCESS';
  if (_isFailed(value)) return 'FAILED';
  return 'PROCESSING';
}

bool _isSuccess(String status) {
  final value = status.toLowerCase();
  return value == 'success' || value == 'completed' || value == 'confirmed';
}

bool _isProcessing(String status) {
  final value = status.toLowerCase();
  return value == 'pending' || value == 'processing';
}

bool _isFailed(String status) {
  final value = status.toLowerCase();
  return value == 'failed' || value == 'cancelled' || value == 'canceled';
}

String _statusLabel(String status) {
  if (_isSuccess(status)) return 'Success';
  if (_isFailed(status)) return 'Failed';
  return 'Processing';
}

String _dateTime(DateTime? date) {
  if (date == null) return '';
  final value = date.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(value.day)}-${two(value.month)}-${value.year} ${two(value.hour)}:${two(value.minute)}';
}

String? _responseValue(ClubAPITransaction transaction, List<String> keys) {
  final maps = <Map<String, dynamic>>[
    if (transaction.response != null) transaction.response!,
    if (transaction.response?['data'] is Map)
      Map<String, dynamic>.from(transaction.response!['data']),
    if (transaction.response?['callback'] is Map)
      Map<String, dynamic>.from(transaction.response!['callback']),
  ];
  for (final map in maps) {
    for (final key in keys) {
      final value = map[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString();
      }
    }
  }
  return null;
}
