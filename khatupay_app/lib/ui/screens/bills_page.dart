import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../clubapi/models/service_catalog.dart';
import '../../clubapi/providers/clubapi_providers.dart';
import '../../clubapi/ui/service_ui.dart';
import '../../core/app_theme.dart';
import '../../routes/app_router.dart';
import '../widgets/kp_widgets.dart';
import 'dashboard_page.dart' show KhatuBottomNav;

/// Recharge & Bills hub.
///
/// Khatu Pay offers exactly five services here - Mobile and DTH recharge,
/// and Credit Card, Electricity and FASTag bills - so this is a compact
/// launcher plus the customer's recent recharges and bill payments with live
/// status, rather than a long catalogue.
class BillsPage extends ConsumerStatefulWidget {
  const BillsPage({super.key});

  @override
  ConsumerState<BillsPage> createState() => _BillsPageState();
}

class _BillsPageState extends ConsumerState<BillsPage> {
  late Future<List<ServiceTransaction>> _recent;

  @override
  void initState() {
    super.initState();
    _recent = _loadRecent();
  }

  Future<List<ServiceTransaction>> _loadRecent() =>
      ref.read(clubAPIServiceProvider).getServiceTransactions(limit: 5);

  Future<void> _refresh() async {
    final future = _loadRecent();
    setState(() => _recent = future);
    await future.catchError((_) => <ServiceTransaction>[]);
  }

  @override
  Widget build(BuildContext context) {
    return KpAppShell(
      title: 'Recharge & Bills',
      showBack: false,
      bottomBar: const KhatuBottomNav(currentIndex: 1),
      actions: [
        IconButton(
          tooltip: 'History',
          onPressed: () => router.go('/service-history'),
          icon: const Icon(Icons.history_rounded),
        ),
      ],
      onRefresh: _refresh,
      children: [
        const _HubHeader(),
        const KpSectionHeader(title: 'Recharge', icon: Icons.bolt_rounded),
        const _ServiceRow(items: ServiceMeta.recharges),
        const KpSectionHeader(title: 'Pay bills', icon: Icons.receipt_long_rounded),
        const _ServiceRow(items: ServiceMeta.bills),
        KpSectionHeader(
          title: 'Recent',
          actionLabel: 'View all',
          onAction: () => router.go('/service-history'),
        ),
        FutureBuilder<List<ServiceTransaction>>(
          future: _recent,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Padding(
                padding: EdgeInsets.all(KhatuSpace.xl),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              return KpErrorBanner(message: 'Recent payments could not be loaded.', onRetry: _refresh);
            }
            final rows = snapshot.data ?? const <ServiceTransaction>[];
            if (rows.isEmpty) {
              return const KpCard(
                child: KpEmptyState(
                  compact: true,
                  icon: Icons.receipt_long_outlined,
                  title: 'No recharges or bills yet',
                  message: 'Your recharges and bill payments will show up here.',
                ),
              );
            }
            return KpTransactionGroup(
              children: [
                for (final txn in rows)
                  KpTransactionTile(
                    title: txn.providerName.isNotEmpty ? txn.providerName : ServiceMeta.of(txn.service).label,
                    subtitle: [ServiceMeta.of(txn.service).label, if (txn.accountRef.isNotEmpty) txn.accountRef].join(' · '),
                    amount: txn.amount,
                    status: txn.isSuccess ? 'SUCCESS' : txn.isFailed ? (txn.refundLabel != null ? 'REFUNDED' : 'FAILED') : 'PENDING',
                    timestamp: txn.createdAt,
                    direction: KpTxnDirection.debit,
                    icon: ServiceMeta.of(txn.service).icon,
                    iconColor: ServiceMeta.of(txn.service).color,
                    onTap: () => router.go(
                      Uri(path: '/service-status', queryParameters: {'service': txn.service.isEmpty ? 'mobile' : txn.service, 'urid': txn.urid}).toString(),
                      extra: ServiceStatusArgs(serviceKey: txn.service.isEmpty ? 'mobile' : txn.service, transaction: txn),
                    ),
                  ),
              ],
            );
          },
        ),
        KhatuSpace.gapXl,
        const SecurePaymentNote(bbps: true),
      ],
    );
  }
}

class _HubHeader extends StatelessWidget {
  const _HubHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KhatuSpace.lg),
      decoration: BoxDecoration(
        gradient: KhatuColors.brandGradient,
        borderRadius: BorderRadius.circular(KhatuRadius.lg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Recharge & pay bills instantly',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                Text(
                  'Pay with UPI, card or wallet. Failed payments are refunded automatically.',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12.5, fontWeight: FontWeight.w700, height: 1.35),
                ),
              ],
            ),
          ),
          KhatuSpace.wMd,
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(KhatuRadius.md),
            ),
            child: const Icon(Icons.verified_user_rounded, color: Colors.white, size: 28),
          ),
        ],
      ),
    );
  }
}

class _ServiceRow extends StatelessWidget {
  const _ServiceRow({required this.items});

  final List<ServiceMeta> items;

  @override
  Widget build(BuildContext context) {
    return KpServiceGrid(
      columns: 3,
      items: [
        for (final meta in items)
          KpServiceItem(
            icon: meta.icon,
            label: meta.label,
            color: meta.color,
            onTap: () => router.go(meta.route),
          ),
      ],
    );
  }
}
