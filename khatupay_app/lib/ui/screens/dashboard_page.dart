import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/app_theme.dart';
import '../../models/user.dart';
import '../../providers/auth_providers.dart';
import '../../providers/business/merchant_business_provider.dart';
import '../../routes/app_router.dart';
import '../../services/notification_service.dart';
import '../widgets/kp_widgets.dart';

class DashboardPage extends ConsumerStatefulWidget {
  const DashboardPage({super.key});
  @override
  ConsumerState<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends ConsumerState<DashboardPage> {
  late Future<List<Map<String, dynamic>>> _activity;
  late Future<int> _unread;
  @override
  void initState() {
    super.initState();
    _activity = _loadActivity();
    _unread = _loadUnread();
  }

  Future<int> _loadUnread() async {
    try {
      return await NotificationService.getUnreadCount();
    } catch (_) {
      return 0;
    }
  }

  Future<List<Map<String, dynamic>>> _loadActivity() async {
    final result = <Map<String, dynamic>>[];
    try {
      final response = await ApiClient.client.get('/services/transactions');
      final data = response.data is Map ? response.data['data'] : null;
      final rows = data is List
          ? data
          : data is Map && data['transactions'] is List
              ? data['transactions'] as List
              : const [];
      result.addAll(
          rows.whereType<Map>().map((row) => Map<String, dynamic>.from(row)));
    } catch (_) {}
    try {
      final response = await ApiClient.client.get('/loans');
      final data = response.data is Map ? response.data['data'] : null;
      final rows = data is List
          ? data
          : data is Map && data['loans'] is List
              ? data['loans'] as List
              : const [];
      result.addAll(rows
          .whereType<Map>()
          .map((row) => {...Map<String, dynamic>.from(row), '_loan': true}));
    } catch (_) {}
    result.sort((a, b) => _date(b).compareTo(_date(a)));
    return result.take(6).toList();
  }

  static DateTime _date(Map row) =>
      DateTime.tryParse((row['createdAt'] ?? '').toString()) ??
      DateTime.fromMillisecondsSinceEpoch(0);
  static String _firstName(String value) {
    final parts = value.trim().split(RegExp(r'\s+'));
    final first = parts.isEmpty ? '' : parts.first;
    return first.isEmpty
        ? 'User'
        : first[0].toUpperCase() + first.substring(1).toLowerCase();
  }

  Future<void> _refresh() async {
    setState(() {
      _activity = _loadActivity();
      _unread = _loadUnread();
    });
    ref.invalidate(meProvider);
    ref.invalidate(merchantDashboardProvider);
    ref.invalidate(merchantBalanceProvider);
    ref.invalidate(merchantPaymentsProvider);
    await Future.wait([_activity, _unread]).catchError((_) => <dynamic>[]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.white,
        body: ref.watch(meProvider).when(
              data: (user) => _body(user),
              loading: () => const Center(
                  child: CircularProgressIndicator(color: KhatuColors.teal)),
              error: (error, _) => KpErrorState.fromError(error,
                  title: 'Home could not load',
                  fallback: 'Please check your connection and try again.',
                  onRetry: () => ref.invalidate(meProvider)),
            ),
        bottomNavigationBar: const KhatuBottomNav(currentIndex: 0),
      );

  Widget _body(KPUser user) => SafeArea(
      bottom: false,
      child: Center(
          child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: RefreshIndicator(
            color: KhatuColors.teal,
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 110),
              children: [
                _Header(name: _firstName(user.name), unread: _unread),
                const SizedBox(height: 24),
                const _Heading('Essential services',
                    'Recharge, pay bills or start a loan application'),
                const SizedBox(height: 12),
                const _PrimaryGrid(),
                const SizedBox(height: 24),
                const _MerchantCard(),
                const SizedBox(height: 24),
                const _Bills(),
                const SizedBox(height: 24),
                const _LoanCard(),
                const SizedBox(height: 24),
                _RecentActivity(future: _activity),
              ],
            )),
      )));
}

class _Header extends StatelessWidget {
  const _Header({required this.name, required this.unread});
  final String name;
  final Future<int> unread;
  @override
  Widget build(BuildContext context) => Row(children: [
        Image.asset('assets/khatulogo-removebg-preview.png',
            width: 46, height: 46),
        const SizedBox(width: 10),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Namaste, $name',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF172033))),
          const Text('What would you like to do today?',
              style: TextStyle(fontSize: 12, color: Color(0xFF667085))),
        ])),
        FutureBuilder<int>(
            future: unread,
            builder: (_, value) => Badge(
                  isLabelVisible: (value.data ?? 0) > 0,
                  label: Text((value.data ?? 0).toString()),
                  child: IconButton(
                      tooltip: 'Notifications',
                      onPressed: () => router.go('/notifications'),
                      icon: const Icon(Icons.notifications_none_rounded)),
                )),
        IconButton(
            tooltip: 'Profile',
            onPressed: () => router.go('/profile'),
            icon: const CircleAvatar(
                backgroundColor: Color(0xFFEAF8F5),
                child: Icon(Icons.person_outline_rounded,
                    color: Color(0xFF0F766E)))),
      ]);
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, [this.subtitle, this.action, this.onAction]);
  final String title;
  final String? subtitle, action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF172033))),
          if (subtitle != null)
            Text(subtitle!,
                style: const TextStyle(fontSize: 12, color: Color(0xFF667085))),
        ])),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ]);
}

class _PrimaryGrid extends StatelessWidget {
  const _PrimaryGrid();
  @override
  Widget build(BuildContext context) {
    const items = [
      (
        'Mobile recharge',
        'Prepaid plans',
        'assets/services/mobile_recharge.png',
        '/recharge?type=mobile'
      ),
      (
        'DTH recharge',
        'Recharge your TV',
        'assets/services/dth_recharge.png',
        '/recharge?type=dth'
      ),
      (
        'Pay bills',
        'Card, power & FASTag',
        'assets/services/electricity_bill.png',
        '/bills'
      ),
      (
        'Apply for loan',
        'Partner-assisted',
        'assets/loans/loan_lifecycle.png',
        '/apply'
      ),
    ];
    return LayoutBuilder(
        builder: (_, box) => Wrap(spacing: 12, runSpacing: 12, children: [
              for (final item in items)
                SizedBox(
                    width: (box.maxWidth - 12) / 2,
                    height: 124,
                    child: _ServiceTile(item.$1, item.$2, item.$3, item.$4)),
            ]));
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile(this.title, this.subtitle, this.asset, this.route);
  final String title, subtitle, asset, route;
  @override
  Widget build(BuildContext context) => Material(
      color: const Color(0xFFF8FBFA),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => router.go(route),
        child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE1EBE9)),
                borderRadius: BorderRadius.circular(8)),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Image.asset(asset, width: 42, height: 42, fit: BoxFit.contain),
              const Spacer(),
              Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      const TextStyle(fontSize: 11, color: Color(0xFF667085))),
            ])),
      ));
}

class _MerchantCard extends ConsumerWidget {
  const _MerchantCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(merchantDashboardProvider);
    final summary = ref.watch(merchantBalanceProvider).valueOrNull ??
        const <String, dynamic>{};
    final business = dashboard.valueOrNull?.business;
    num number(String key) => summary[key] is num ? summary[key] as num : 0;
    return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: const Color(0xFFEAF8F5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFCDE9E3))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text('Grow your business',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  SizedBox(height: 5),
                  Text(
                      'Accept digital payments and track your business collections.',
                      style: TextStyle(
                          fontSize: 12,
                          height: 1.35,
                          color: Color(0xFF667085))),
                ])),
            Image.asset('assets/business/merchant_dashboard.png',
                width: 104, height: 104, fit: BoxFit.contain),
          ]),
          if (business != null) ...[
            Text(business.businessName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            Text('Verification: ' + business.status,
                style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF0F766E),
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                  child: _Metric(
                      'Available', kpMoney(number('availableBalance')))),
              const SizedBox(width: 8),
              Expanded(
                  child: _Metric('Pending', kpMoney(number('pendingBalance')))),
            ]),
          ],
          const SizedBox(height: 12),
          if (dashboard.isLoading)
            const Center(child: CircularProgressIndicator(strokeWidth: 2))
          else if (business == null)
            SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                    onPressed: () => router.go('/business/register'),
                    icon: const Icon(Icons.storefront_outlined),
                    label: const Text('Set up business account')))
          else
            Wrap(spacing: 8, runSpacing: 8, children: const [
              _Action(Icons.qr_code_2_rounded, 'My QR', '/business/qr'),
              _Action(Icons.receipt_long_rounded, 'Transactions',
                  '/business/transactions'),
              _Action(Icons.account_balance_outlined, 'Settlements',
                  '/business/settlements'),
            ]),
        ]));
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
          color: Colors.white, borderRadius: BorderRadius.circular(8)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF667085))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800))
      ]));
}

class _Action extends StatelessWidget {
  const _Action(this.icon, this.label, this.route);
  final IconData icon;
  final String label, route;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
      onPressed: () => router.go(route),
      icon: Icon(icon, size: 17),
      label: Text(label),
      style: OutlinedButton.styleFrom(backgroundColor: Colors.white));
}

class _Bills extends StatelessWidget {
  const _Bills();
  @override
  Widget build(BuildContext context) => Column(children: [
        _Heading('Pay your bills', 'Secure payments with live status',
            'View all', () => router.go('/bills')),
        const SizedBox(height: 12),
        const Row(children: [
          Expanded(
              child: _BillTile(
                  'Credit card',
                  'assets/services/credit_card_bill.png',
                  '/bill?type=credit_card')),
          SizedBox(width: 8),
          Expanded(
              child: _BillTile(
                  'Electricity',
                  'assets/services/electricity_bill.png',
                  '/bill?type=electricity')),
          SizedBox(width: 8),
          Expanded(
              child: _BillTile('FASTag', 'assets/services/fastag_recharge.png',
                  '/bill?type=fastag')),
        ]),
      ]);
}

class _BillTile extends StatelessWidget {
  const _BillTile(this.label, this.asset, this.route);
  final String label, asset, route;
  @override
  Widget build(BuildContext context) => InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => router.go(route),
      child: Container(
          height: 100,
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE1EBE9)),
              borderRadius: BorderRadius.circular(8)),
          child: Column(children: [
            Expanded(child: Image.asset(asset, fit: BoxFit.contain)),
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 11, fontWeight: FontWeight.w700))
          ])));
}

class _LoanCard extends StatelessWidget {
  const _LoanCard();
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFFFFAEB),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFF4E3AC))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Need financial support?',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        const Text(
            'Apply through our lending partners with a simple digital process.',
            style: TextStyle(fontSize: 12, color: Color(0xFF667085))),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
              child: FilledButton(
                  onPressed: () => router.go('/apply'),
                  child: const Text('Apply now'))),
          const SizedBox(width: 8),
          Expanded(
              child: OutlinedButton(
                  onPressed: () => router.go('/loans'),
                  child: const Text('My applications'))),
        ]),
      ]));
}

class _RecentActivity extends StatelessWidget {
  const _RecentActivity({required this.future});
  final Future<List<Map<String, dynamic>>> future;
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _Heading('Recent activity', null, 'View all',
            () => router.go('/service-history')),
        FutureBuilder<List<Map<String, dynamic>>>(
            future: future,
            builder: (_, snap) {
              if (snap.connectionState == ConnectionState.waiting)
                return const Center(
                    child: Padding(
                        padding: EdgeInsets.all(24),
                        child: CircularProgressIndicator(strokeWidth: 2)));
              final rows = snap.data ?? const [];
              if (rows.isEmpty)
                return Center(
                    child: Column(children: [
                  Image.asset('assets/illustrations/empty_activity.png',
                      width: 112, height: 112),
                  const Text('No recent activity yet',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const Text('Your service updates will appear here.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF667085)))
                ]));
              return Column(
                  children: [for (final row in rows) _ActivityRow(row)]);
            }),
      ]);
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow(this.row);
  final Map<String, dynamic> row;
  num get amount => row['amount'] is num
      ? row['amount'] as num
      : num.tryParse(
              (row['amount'] ?? row['requestedAmount'] ?? '0').toString()) ??
          0;
  @override
  Widget build(BuildContext context) {
    final loan = row['_loan'] == true;
    final key =
        (row['serviceKey'] ?? row['type'] ?? '').toString().toLowerCase();
    final title = loan
        ? 'Loan application'
        : key.contains('dth')
            ? 'DTH recharge'
            : key.contains('bill') ||
                    key == 'electricity' ||
                    key == 'fastag' ||
                    key == 'credit_card'
                ? 'Bill payment'
                : 'Mobile recharge';
    final status = (row['status'] ?? 'Processing').toString();
    final ref =
        (row['accountRef'] ?? row['applicationId'] ?? row['providerName'] ?? '')
            .toString();
    return ListTile(
        contentPadding: EdgeInsets.zero,
        onTap: () => router.go(loan ? '/loans' : '/service-history'),
        leading: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
                color: const Color(0xFFEAF8F5),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(
                loan
                    ? Icons.account_balance_outlined
                    : key.contains('dth')
                        ? Icons.satellite_alt_rounded
                        : Icons.receipt_long_rounded,
                color: const Color(0xFF0F766E))),
        title: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: Text(ref.isEmpty ? 'KhatuPay service' : ref,
            maxLines: 1, overflow: TextOverflow.ellipsis),
        trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (amount > 0)
                Text(kpMoney(amount),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(status,
                  style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFFB54708),
                      fontWeight: FontWeight.w700))
            ]));
  }
}

class KhatuBottomNav extends StatelessWidget {
  const KhatuBottomNav({super.key, required this.currentIndex});
  final int currentIndex;
  static const routes = [
    '/',
    '/bills',
    '/business',
    '/service-history',
    '/profile'
  ];
  @override
  Widget build(BuildContext context) => NavigationBar(
          selectedIndex: currentIndex,
          onDestinationSelected: (index) => router.go(routes[index]),
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFEAF8F5),
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home'),
            NavigationDestination(
                icon: Icon(Icons.grid_view_outlined),
                selectedIcon: Icon(Icons.grid_view_rounded),
                label: 'Services'),
            NavigationDestination(
                icon: Icon(Icons.storefront_outlined),
                selectedIcon: Icon(Icons.storefront_rounded),
                label: 'Business'),
            NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                selectedIcon: Icon(Icons.receipt_long_rounded),
                label: 'Activity'),
            NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Profile'),
          ]);
}
