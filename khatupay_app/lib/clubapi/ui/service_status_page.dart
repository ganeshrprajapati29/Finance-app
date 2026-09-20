import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_navigation_history.dart';
import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../../services/payment_service.dart';
import '../../ui/widgets/kp_widgets.dart';
import '../models/service_catalog.dart';
import '../services/clubapi_service_updated.dart';
import 'service_ui.dart';

/// Live result of a recharge / bill payment.
///
/// Recharges often confirm instantly but can take minutes at the operator, so
/// this screen polls while the transaction is pending (the server throttles
/// its own calls to ClubAPI) and settles on success, failure with refund, or a
/// "we'll notify you" state. If payment verification was interrupted it first
/// tracks the Razorpay order until the recharge / bill reference appears.
class ServiceStatusPage extends StatefulWidget {
  const ServiceStatusPage({
    super.key,
    required this.serviceKey,
    this.urid,
    this.orderId,
    this.args,
  });

  final String serviceKey;
  final String? urid;
  final String? orderId;
  final ServiceStatusArgs? args;

  @override
  State<ServiceStatusPage> createState() => _ServiceStatusPageState();
}

class _ServiceStatusPageState extends State<ServiceStatusPage> {
  final _clubapi = ClubAPIService();
  final _payments = PaymentService();

  ServiceTransaction? _transaction;
  String? _urid;
  String? _orderId;
  Timer? _timer;
  DateTime _startedAt = DateTime.now();
  bool _refreshing = false;
  bool _gaveUp = false;
  String? _paymentProblem;

  static const _fastPhase = Duration(seconds: 60);
  static const _maxWait = Duration(minutes: 5);

  ServiceMeta get _meta => ServiceMeta.of(widget.serviceKey);

  @override
  void initState() {
    super.initState();
    _transaction = widget.args?.transaction;
    _urid = (widget.urid ?? '').isNotEmpty ? widget.urid : _transaction?.urid;
    _orderId = (widget.orderId ?? '').isNotEmpty
        ? widget.orderId
        : widget.args?.pendingOrderId;
    if (_transaction == null || _transaction!.isPending)
      _schedule(immediate: true);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _payments.dispose();
    super.dispose();
  }

  void _schedule({bool immediate = false}) {
    _timer?.cancel();
    final elapsed = DateTime.now().difference(_startedAt);
    if (elapsed > _maxWait) {
      setState(() => _gaveUp = true);
      return;
    }
    final delay = immediate
        ? const Duration(milliseconds: 600)
        : (elapsed < _fastPhase
            ? const Duration(seconds: 4)
            : const Duration(seconds: 10));
    _timer = Timer(delay, _poll);
  }

  Future<void> _poll() async {
    if (!mounted) return;
    setState(() => _refreshing = true);
    try {
      if ((_urid ?? '').isEmpty && (_orderId ?? '').isNotEmpty) {
        final payment = await _payments.getPaymentStatus(_orderId!);
        final serviceUrid = payment['serviceUrid']?.toString() ?? '';
        final paymentStatus = payment['status']?.toString().toUpperCase() ?? '';
        if (serviceUrid.isNotEmpty) {
          _urid = serviceUrid;
        } else if (paymentStatus == 'FAILED') {
          setState(() => _paymentProblem =
              'The bank did not confirm this payment. If money was deducted, it will be refunded automatically.');
          return;
        }
      }

      if ((_urid ?? '').isNotEmpty) {
        final transaction = await _clubapi.getServiceTransaction(_urid!);
        if (!mounted) return;
        setState(() => _transaction = transaction);
        if (!transaction.isPending) return;
      }
    } catch (_) {
      // Network blips while polling are expected; keep trying on schedule.
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
    if (mounted) _schedule();
  }

  void _checkAgain() {
    setState(() {
      _gaveUp = false;
      _startedAt = DateTime.now();
    });
    _schedule(immediate: true);
  }

  @override
  Widget build(BuildContext context) {
    final transaction = _transaction;
    final pending = transaction == null || transaction.isPending;
    final success = transaction?.isSuccess ?? false;
    final failed = transaction?.isFailed ?? false;
    final isBill =
        ServiceMeta.bills.any((meta) => meta.key == widget.serviceKey);

    final Color tone = success
        ? KhatuColors.success
        : failed || _paymentProblem != null
            ? KhatuColors.danger
            : KhatuColors.warning;
    final IconData icon = success
        ? Icons.check_circle_rounded
        : failed || _paymentProblem != null
            ? Icons.cancel_rounded
            : Icons.hourglass_top_rounded;

    final String title;
    final String subtitle;
    if (_paymentProblem != null) {
      title = 'Payment not confirmed';
      subtitle = _paymentProblem!;
    } else if (success) {
      title = isBill ? 'Bill paid successfully' : 'Recharge successful';
      subtitle = isBill
          ? 'Your payment has been sent to the biller.'
          : 'Your recharge is complete.';
    } else if (failed) {
      title = isBill ? 'Bill payment failed' : 'Recharge failed';
      subtitle = transaction?.refundLabel ??
          (transaction!.message.isNotEmpty
              ? transaction.message
              : 'Your money is safe and will be refunded.');
    } else if (transaction == null && (_orderId ?? '').isNotEmpty) {
      title = 'Payment received';
      subtitle = 'Confirming with your bank. This usually takes a few seconds.';
    } else if (_gaveUp) {
      title = 'Taking longer than usual';
      subtitle =
          'The operator has not confirmed yet. We will notify you as soon as it does - no need to pay again.';
    } else {
      title = isBill ? 'Bill payment in progress' : 'Recharge in progress';
      subtitle =
          'Waiting for confirmation from the operator. Please do not pay again.';
    }

    final amount = transaction?.amount ?? widget.args?.amount;
    final providerName = (transaction?.providerName.isNotEmpty ?? false)
        ? transaction!.providerName
        : (widget.args?.providerName ?? _meta.label);
    final accountRef = (transaction?.accountRef.isNotEmpty ?? false)
        ? transaction!.accountRef
        : (widget.args?.accountRef ?? '');

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) AppNavigationHistory.goBack(router);
      },
      child: Scaffold(
        backgroundColor: KhatuColors.bg,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Text(_meta.label),
          actions: [
            IconButton(
              tooltip: 'Close',
              onPressed: () => router.go('/'),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: ListView(
                padding: KhatuSpace.pageScroll,
                children: [
                  KpCard(
                    padding: const EdgeInsets.all(KhatuSpace.xl),
                    child: Column(
                      children: [
                        TweenAnimationBuilder<double>(
                          key: ValueKey(icon),
                          tween: Tween(begin: 0.6, end: 1),
                          duration: const Duration(milliseconds: 420),
                          curve: Curves.easeOutBack,
                          builder: (context, scale, child) =>
                              Transform.scale(scale: scale, child: child),
                          child: Container(
                            width: 84,
                            height: 84,
                            decoration: BoxDecoration(
                                color: tone.withValues(alpha: 0.12),
                                shape: BoxShape.circle),
                            child:
                                pending && _paymentProblem == null && !_gaveUp
                                    ? Padding(
                                        padding: const EdgeInsets.all(22),
                                        child: CircularProgressIndicator(
                                            strokeWidth: 3.4, color: tone),
                                      )
                                    : Icon(icon, color: tone, size: 48),
                          ),
                        ),
                        KhatuSpace.gapLg,
                        Text(title,
                            textAlign: TextAlign.center, style: KhatuText.h1),
                        KhatuSpace.gapSm,
                        Text(subtitle,
                            textAlign: TextAlign.center,
                            style: KhatuText.bodyMuted),
                        if (amount != null && amount > 0) ...[
                          KhatuSpace.gapLg,
                          Text(serviceMoney(amount), style: KhatuText.display),
                        ],
                        KhatuSpace.gapMd,
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ServiceIcon(meta: _meta, size: 24, padding: 1),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                [
                                  providerName,
                                  if (accountRef.isNotEmpty) accountRef
                                ].join(' · '),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (transaction != null) ...[
                    KhatuSpace.gapMd,
                    _ReferenceCard(transaction: transaction, isBill: isBill),
                  ],
                  if (failed && transaction?.refundLabel != null) ...[
                    KhatuSpace.gapMd,
                    KpNoticeBanner(
                      icon: Icons.replay_circle_filled_rounded,
                      color: KhatuColors.success,
                      title: 'Refund',
                      message: transaction!.refundLabel!,
                    ),
                  ],
                  if (pending && !_gaveUp && _paymentProblem == null) ...[
                    KhatuSpace.gapMd,
                    KpNoticeBanner(
                      icon: Icons.shield_rounded,
                      message: _refreshing
                          ? 'Checking status...'
                          : 'Your money is safe. If this fails, it is refunded automatically.',
                    ),
                  ],
                  KhatuSpace.gapXl,
                  if (_gaveUp && pending)
                    Padding(
                      padding: const EdgeInsets.only(bottom: KhatuSpace.md),
                      child: OutlinedButton.icon(
                        onPressed: _checkAgain,
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Check status again'),
                      ),
                    ),
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () => router.go('/'),
                      child: const Text('Done'),
                    ),
                  ),
                  KhatuSpace.gapSm,
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => router.go(_meta.route),
                          icon: Icon(
                              isBill
                                  ? Icons.receipt_long_rounded
                                  : Icons.replay_rounded,
                              size: 18),
                          label: Text(
                              isBill ? 'Pay another bill' : 'Recharge again'),
                        ),
                      ),
                      KhatuSpace.wSm,
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => router.go('/service-history'),
                          icon: const Icon(Icons.history_rounded, size: 18),
                          label: const Text('History'),
                        ),
                      ),
                    ],
                  ),
                  if (failed || _gaveUp) ...[
                    KhatuSpace.gapSm,
                    TextButton.icon(
                      onPressed: () => router.go(Uri(
                        path: '/support',
                        queryParameters: {
                          'subject': '${_meta.label} issue',
                          'message':
                              'Reference: ${transaction?.urid ?? _orderId ?? ''}',
                        },
                      ).toString()),
                      icon: const Icon(Icons.support_agent_rounded, size: 18),
                      label: const Text('Need help? Contact support'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ReferenceCard extends StatelessWidget {
  const _ReferenceCard({required this.transaction, required this.isBill});

  final ServiceTransaction transaction;
  final bool isBill;

  @override
  Widget build(BuildContext context) {
    final rows = <MapEntry<String, String>>[
      MapEntry('Khatu Pay reference', transaction.urid),
      if (transaction.operatorTxnId.isNotEmpty)
        MapEntry(isBill ? 'Biller reference' : 'Operator reference',
            transaction.operatorTxnId),
      if (transaction.orderId.isNotEmpty)
        MapEntry(isBill ? 'BBPS order ID' : 'Order ID', transaction.orderId),
      if (transaction.createdAt != null)
        MapEntry(
            'Date & time', KpTransactionTile.formatWhen(transaction.createdAt)),
    ];

    return KpCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('Transaction details', style: KhatuText.h3)),
              KpStatusBadge(
                status: transaction.isSuccess
                    ? 'SUCCESS'
                    : transaction.isFailed
                        ? 'FAILED'
                        : 'PENDING',
                dense: true,
              ),
            ],
          ),
          KhatuSpace.gapSm,
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Expanded(child: Text(row.key, style: KhatuText.label)),
                  Flexible(
                    child: Text(
                      row.value,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 13),
                    ),
                  ),
                  if (row.key.contains('reference') || row.key.contains('ID'))
                    InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: row.value));
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('${row.key} copied')),
                        );
                      },
                      child: const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Icon(Icons.copy_rounded,
                            size: 16, color: KhatuColors.muted),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
