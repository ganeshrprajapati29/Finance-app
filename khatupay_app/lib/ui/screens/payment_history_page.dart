import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../clubapi/models/clubapi_transaction.dart';
import '../../clubapi/providers/clubapi_providers.dart';
import '../../core/api_client.dart';
import '../../core/app_theme.dart';
import '../../models/business/merchant_business.dart';
import '../../models/loan.dart';
import '../../providers/business/merchant_business_provider.dart';
import '../../providers/loan_providers.dart';
import '../widgets/app_back_button.dart';
import '../widgets/kp_widgets.dart';

final _generalHistoryProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final response = await ApiClient.client.get('/payments');
  final data = response.data['data'];
  if (data is! List) return const [];
  return data
      .whereType<Map>()
      .map((value) => Map<String, dynamic>.from(value))
      .toList();
});

class PaymentHistoryPage extends ConsumerStatefulWidget {
  const PaymentHistoryPage({super.key});

  @override
  ConsumerState<PaymentHistoryPage> createState() => _PaymentHistoryPageState();
}

class _PaymentHistoryPageState extends ConsumerState<PaymentHistoryPage> {
  final _search = TextEditingController();
  String _category = 'All';
  String _status = 'All';
  DateTimeRange? _range;

  static const _categories = [
    'All',
    'Recharge',
    'Bills',
    'Payments',
    'Loans',
    'Business',
    'Settlements',
  ];
  static const _statuses = [
    'All',
    'Successful',
    'Pending',
    'Failed',
    'Refunded'
  ];

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(_generalHistoryProvider);
    ref.invalidate(transactionHistoryProvider);
    ref.invalidate(myLoansProvider);
    ref.invalidate(merchantPaymentsProvider);
    ref.invalidate(merchantSettlementsProvider);
    await Future.wait([
      ref
          .read(_generalHistoryProvider.future)
          .catchError((_) => const <Map<String, dynamic>>[]),
      ref
          .read(transactionHistoryProvider.future)
          .catchError((_) => const <ClubAPITransaction>[]),
      ref.read(myLoansProvider.future).catchError((_) => const <Loan>[]),
      ref
          .read(merchantPaymentsProvider.future)
          .catchError((_) => const <MerchantPayment>[]),
      ref
          .read(merchantSettlementsProvider.future)
          .catchError((_) => const <MerchantSettlement>[]),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final sources = <AsyncValue<dynamic>>[
      ref.watch(_generalHistoryProvider),
      ref.watch(transactionHistoryProvider),
      ref.watch(myLoansProvider),
      ref.watch(merchantPaymentsProvider),
      ref.watch(merchantSettlementsProvider),
    ];
    final loading = sources.any((source) => source.isLoading);
    final failedSources = sources.where((source) => source.hasError).length;
    final items = _items(
      ref.watch(_generalHistoryProvider).valueOrNull ?? const [],
      ref.watch(transactionHistoryProvider).valueOrNull ?? const [],
      ref.watch(myLoansProvider).valueOrNull ?? const [],
      ref.watch(merchantPaymentsProvider).valueOrNull ?? const [],
      ref.watch(merchantSettlementsProvider).valueOrNull ?? const [],
    );
    final visible = _filter(items);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: const AppBackButton(fallbackRoute: '/'),
        title: const Text('History'),
        actions: [
          IconButton(
              onPressed: _refresh,
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: KhatuSpace.pageScroll,
          children: [
            _summary(items),
            const SizedBox(height: 16),
            TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Search order ID, account or service',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
            const SizedBox(height: 12),
            _filters(),
            if (_range != null) ...[
              const SizedBox(height: 10),
              InputChip(
                avatar: const Icon(Icons.date_range_outlined, size: 18),
                label: Text(
                    '${DateFormat('dd MMM yyyy').format(_range!.start)} - ${DateFormat('dd MMM yyyy').format(_range!.end)}'),
                onDeleted: () => setState(() => _range = null),
              ),
            ],
            if (loading) ...[
              const SizedBox(height: 14),
              const LinearProgressIndicator(minHeight: 3),
            ],
            if (failedSources > 0) ...[
              const SizedBox(height: 14),
              KpNoticeBanner(
                icon: Icons.sync_problem_outlined,
                color: KhatuColors.warning,
                message:
                    '$failedSources history source${failedSources == 1 ? '' : 's'} could not refresh. Available records are shown below.',
              ),
            ],
            const SizedBox(height: 18),
            Row(children: [
              const Expanded(child: Text('All activity', style: KhatuText.h2)),
              Text('${visible.length} records', style: KhatuText.bodyMuted),
            ]),
            const SizedBox(height: 10),
            if (visible.isEmpty && !loading)
              const KpEmptyState(
                icon: Icons.history_rounded,
                title: 'No matching activity',
                message: 'Try changing the filters or date range.',
              )
            else
              _historyList(visible),
          ],
        ),
      ),
    );
  }

  List<_HistoryItem> _items(
    List<Map<String, dynamic>> payments,
    List<ClubAPITransaction> services,
    List<Loan> loans,
    List<MerchantPayment> merchantPayments,
    List<MerchantSettlement> settlements,
  ) {
    final values = <_HistoryItem>[];
    for (final payment in payments) {
      final type = (payment['type'] ?? 'Payment').toString();
      values.add(_HistoryItem(
        category: 'Payments',
        title: _pretty(type),
        subtitle: (payment['method'] ?? 'Online payment').toString(),
        reference: (payment['reference'] ?? payment['_id'] ?? '').toString(),
        status: (payment['status'] ?? 'PENDING').toString(),
        amount: _number(payment['amount']),
        date: DateTime.tryParse((payment['createdAt'] ?? '').toString()),
        icon: Icons.payments_outlined,
        details: payment,
      ));
    }
    for (final service in services) {
      final key = '${service.service} ${service.type}'.toLowerCase();
      final recharge = key.contains('mobile') ||
          key.contains('dth') ||
          key.contains('recharge');
      values.add(_HistoryItem(
        category: recharge ? 'Recharge' : 'Bills',
        title: _serviceTitle(service),
        subtitle: service.provider?.isNotEmpty == true
            ? service.provider!
            : (service.accountRef ?? 'Service payment'),
        reference: service.urid,
        status: service.status,
        amount: service.amount,
        date: service.createdAt,
        icon: recharge
            ? Icons.phone_android_rounded
            : Icons.receipt_long_outlined,
        details: service.toJson(),
      ));
    }
    for (final loan in loans) {
      values.add(_HistoryItem(
        category: 'Loans',
        title: 'Loan application',
        subtitle: loan.application.purpose.isEmpty
            ? 'Partner loan application'
            : loan.application.purpose,
        reference:
            loan.loanAccountNumber.isEmpty ? loan.id : loan.loanAccountNumber,
        status: loan.status,
        amount: loan.application.amountRequested,
        date: loan.updatedAt ?? loan.createdAt,
        icon: Icons.description_outlined,
        details: {
          'Application ID': loan.id,
          'Purpose': loan.application.purpose,
          'Requested amount': loan.application.amountRequested,
          'Tenure': '${loan.application.tenureMonths} months',
          'Status updates': loan.statusHistory,
        },
      ));
    }
    for (final payment in merchantPayments) {
      values.add(_HistoryItem(
        category: 'Business',
        title: 'Business collection',
        subtitle: payment.utr?.isNotEmpty == true
            ? 'UTR ${payment.utr}'
            : 'Digital payment',
        reference: payment.orderId,
        status: payment.status,
        amount: payment.amount,
        date: payment.createdAt,
        icon: Icons.storefront_outlined,
        details: {
          'Order ID': payment.orderId,
          'UTR': payment.utr ?? 'Pending confirmation'
        },
      ));
    }
    for (final settlement in settlements) {
      values.add(_HistoryItem(
        category: 'Settlements',
        title: 'Business settlement',
        subtitle: settlement.utr?.isNotEmpty == true
            ? 'UTR ${settlement.utr}'
            : 'Bank settlement',
        reference: settlement.settlementId,
        status: settlement.status,
        amount: settlement.amount,
        date: settlement.createdAt,
        icon: Icons.account_balance_outlined,
        details: {
          'Settlement ID': settlement.settlementId,
          'UTR': settlement.utr ?? 'Pending confirmation'
        },
      ));
    }
    values.sort((a, b) =>
        (b.date ?? DateTime(1970)).compareTo(a.date ?? DateTime(1970)));
    return values;
  }

  List<_HistoryItem> _filter(List<_HistoryItem> items) {
    final query = _search.text.trim().toLowerCase();
    return items.where((item) {
      if (_category != 'All' && item.category != _category) return false;
      if (_status != 'All' && _statusGroup(item.status) != _status)
        return false;
      if (query.isNotEmpty &&
          !'${item.title} ${item.subtitle} ${item.reference} ${item.status}'
              .toLowerCase()
              .contains(query)) return false;
      if (_range != null && item.date != null) {
        final day = DateTime(item.date!.year, item.date!.month, item.date!.day);
        final start = DateTime(
            _range!.start.year, _range!.start.month, _range!.start.day);
        final end = DateTime(
            _range!.end.year, _range!.end.month, _range!.end.day, 23, 59, 59);
        if (day.isBefore(start) || day.isAfter(end)) return false;
      }
      return true;
    }).toList();
  }

  Widget _summary(List<_HistoryItem> items) {
    final successful =
        items.where((item) => _statusGroup(item.status) == 'Successful').length;
    final pending =
        items.where((item) => _statusGroup(item.status) == 'Pending').length;
    final failed =
        items.where((item) => _statusGroup(item.status) == 'Failed').length;
    return KpCard(
        child: Row(children: [
      _metric('Total', '${items.length}', KhatuColors.teal),
      _metric('Successful', '$successful', KhatuColors.success),
      _metric('Pending', '$pending', KhatuColors.warning),
      _metric('Failed', '$failed', KhatuColors.danger),
    ]));
  }

  Widget _metric(String label, String value, Color color) => Expanded(
        child: Column(children: [
          Text(value,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 3),
          FittedBox(child: Text(label, style: KhatuText.label)),
        ]),
      );

  Widget _filters() => Row(children: [
        Expanded(
            child: DropdownButtonFormField<String>(
          value: _category,
          isExpanded: true,
          decoration: const InputDecoration(
              labelText: 'Type', prefixIcon: Icon(Icons.category_outlined)),
          items: _categories
              .map(
                  (value) => DropdownMenuItem(value: value, child: Text(value)))
              .toList(),
          onChanged: (value) => setState(() => _category = value ?? 'All'),
        )),
        const SizedBox(width: 8),
        Expanded(
            child: DropdownButtonFormField<String>(
          value: _status,
          isExpanded: true,
          decoration: const InputDecoration(
              labelText: 'Status', prefixIcon: Icon(Icons.tune_rounded)),
          items: _statuses
              .map(
                  (value) => DropdownMenuItem(value: value, child: Text(value)))
              .toList(),
          onChanged: (value) => setState(() => _status = value ?? 'All'),
        )),
        const SizedBox(width: 8),
        IconButton.filledTonal(
            onPressed: _pickDate,
            tooltip: 'Filter by date',
            icon: const Icon(Icons.date_range_outlined)),
      ]);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final selected = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: now,
      initialDateRange: _range,
    );
    if (selected != null && mounted) setState(() => _range = selected);
  }

  Widget _historyList(List<_HistoryItem> items) => Container(
        decoration: BoxDecoration(
            border: Border.all(color: KhatuColors.line),
            borderRadius: BorderRadius.circular(8)),
        child: Column(children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const Divider(height: 1, indent: 62),
            _tile(items[i]),
          ]
        ]),
      );

  Widget _tile(_HistoryItem item) => ListTile(
        onTap: () => _showDetails(item),
        leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: KhatuColors.statusTint(item.status),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(item.icon,
                color: KhatuColors.status(item.status), size: 21)),
        title: Row(children: [
          Expanded(
              child: Text(item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900))),
          const SizedBox(width: 8),
          Text(kpMoney(item.amount),
              style: const TextStyle(fontWeight: FontWeight.w900)),
        ]),
        subtitle:
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const SizedBox(height: 3),
          Text(item.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 5),
          Row(children: [
            KpStatusBadge(status: item.status, dense: true),
            const SizedBox(width: 8),
            Expanded(
                child: Text(
                    item.date == null
                        ? 'Date unavailable'
                        : DateFormat('dd MMM yyyy, hh:mm a')
                            .format(item.date!.toLocal()),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11))),
          ]),
        ]),
        isThreeLine: true,
      );

  void _showDetails(_HistoryItem item) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => SafeArea(
            child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: KhatuText.h2),
                    const SizedBox(height: 8),
                    KpStatusBadge(status: item.status),
                    const SizedBox(height: 18),
                    _detail('Type', item.category),
                    _detail('Amount', kpMoney(item.amount)),
                    _detail(
                        'Reference',
                        item.reference.isEmpty
                            ? 'Not available'
                            : item.reference),
                    _detail(
                        'Date',
                        item.date == null
                            ? 'Not available'
                            : DateFormat('dd MMM yyyy, hh:mm a')
                                .format(item.date!.toLocal())),
                    for (final entry in item.details.entries)
                      if (!{'status', 'amount', 'createdAt', '_id'}
                              .contains(entry.key) &&
                          _display(entry.value).isNotEmpty)
                        _detail(_pretty(entry.key), _display(entry.value)),
                    if (item.details['Status updates'] is List &&
                        (item.details['Status updates'] as List)
                            .isNotEmpty) ...[
                      const SizedBox(height: 14),
                      const Text('Status timeline', style: KhatuText.h3),
                      const SizedBox(height: 8),
                      for (final update
                          in (item.details['Status updates'] as List).reversed)
                        if (update is Map)
                          _statusUpdate(Map<String, dynamic>.from(update)),
                    ],
                    const SizedBox(height: 12),
                    Text(
                        'Status updates are refreshed from Khatu Pay services.',
                        style: KhatuText.bodyMuted),
                  ],
                ))),
      );

  Widget _detail(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 105, child: Text(label, style: KhatuText.label)),
          Expanded(
              child: SelectableText(value,
                  style: const TextStyle(fontWeight: FontWeight.w800))),
        ]),
      );

  Widget _statusUpdate(Map<String, dynamic> update) {
    final status =
        (update['status'] ?? update['state'] ?? 'Updated').toString();
    final note =
        (update['note'] ?? update['message'] ?? update['remarks'] ?? '')
            .toString();
    final date = DateTime.tryParse(
        (update['createdAt'] ?? update['date'] ?? '').toString());
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          margin: const EdgeInsets.only(top: 3),
          width: 9,
          height: 9,
          decoration: BoxDecoration(
              color: KhatuColors.status(status), shape: BoxShape.circle),
        ),
        const SizedBox(width: 10),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(_pretty(status),
              style: const TextStyle(fontWeight: FontWeight.w900)),
          if (note.isNotEmpty) Text(note, style: KhatuText.bodyMuted),
          if (date != null)
            Text(DateFormat('dd MMM yyyy, hh:mm a').format(date.toLocal()),
                style: const TextStyle(fontSize: 11, color: KhatuColors.muted)),
        ])),
      ]),
    );
  }

  String _serviceTitle(ClubAPITransaction item) {
    final key = '${item.service} ${item.type}'.toLowerCase();
    if (key.contains('dth')) return 'DTH recharge';
    if (key.contains('mobile') || key.contains('recharge'))
      return 'Mobile recharge';
    if (key.contains('electric')) return 'Electricity bill';
    if (key.contains('fastag')) return 'FASTag recharge';
    if (key.contains('credit')) return 'Credit card bill';
    return 'Bill payment';
  }

  String _statusGroup(String raw) {
    final value = raw.toUpperCase();
    if (value.contains('REFUND')) return 'Refunded';
    if ([
      'SUCCESS',
      'COMPLETED',
      'CONFIRMED',
      'PAID',
      'APPROVED',
      'SETTLED',
      'CREDITED'
    ].any(value.contains)) return 'Successful';
    if (['FAILED', 'REJECTED', 'CANCELLED', 'DECLINED', 'EXPIRED']
        .any(value.contains)) return 'Failed';
    return 'Pending';
  }

  num _number(dynamic value) =>
      value is num ? value : num.tryParse('$value') ?? 0;
  String _pretty(String value) => value
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) =>
          '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
      .join(' ');
  String _display(dynamic value) {
    if (value == null) return '';
    if (value is List) return '';
    if (value is Map) return '';
    final text = value.toString().trim();
    return text == 'null' ? '' : text;
  }
}

class _HistoryItem {
  const _HistoryItem({
    required this.category,
    required this.title,
    required this.subtitle,
    required this.reference,
    required this.status,
    required this.amount,
    required this.date,
    required this.icon,
    required this.details,
  });
  final String category, title, subtitle, reference, status;
  final num amount;
  final DateTime? date;
  final IconData icon;
  final Map<String, dynamic> details;
}
