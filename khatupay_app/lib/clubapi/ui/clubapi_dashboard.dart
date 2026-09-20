import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_theme.dart';
import '../../ui/widgets/app_back_button.dart';
import '../providers/clubapi_providers.dart';

class ClubAPIDashboard extends ConsumerWidget {
  const ClubAPIDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transactionHistory = ref.watch(transactionHistoryProvider);

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('Bills & Recharge'),
        leading: const AppBackButton(),
        actions: [
          IconButton(
            tooltip: 'History',
            onPressed: () => context.go('/service-history'),
            icon: const Icon(Icons.history),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(transactionHistoryProvider.future),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            const _ServiceHeader(),
            const SizedBox(height: 18),
            const Text(
              'Pay & recharge',
              style: TextStyle(
                color: KhatuColors.text,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            _ServiceTile(
              title: 'Mobile Recharge',
              subtitle: 'Prepaid mobile and DTH recharge',
              icon: Icons.phone_android,
              color: KhatuColors.teal,
              onTap: () => context.go('/recharge'),
            ),
            _ServiceTile(
              title: 'Bill Payment',
              subtitle: 'Electricity, water, gas, credit card and more',
              icon: Icons.receipt_long,
              color: KhatuColors.saffron,
              onTap: () => context.go('/bill'),
            ),
            _ServiceTile(
              title: 'Transaction History',
              subtitle: 'Track recharge, DTH and BBPS payments',
              icon: Icons.history,
              color: KhatuColors.deepTeal,
              onTap: () => context.go('/service-history'),
            ),
            const SizedBox(height: 18),
            const Text(
              'Account services',
              style: TextStyle(
                color: KhatuColors.text,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            _ServiceTile(
              title: 'Bank Account Validate',
              subtitle: 'Verify account name using account number and IFSC',
              icon: Icons.account_balance,
              color: const Color(0xFF2563EB),
              onTap: () => context.go('/clubapi/bank-validate'),
            ),
            _ServiceTile(
              title: 'Outlet Setup',
              subtitle: 'Register outlet and complete OTP verification',
              icon: Icons.storefront,
              color: const Color(0xFF7C3AED),
              onTap: () => context.go('/clubapi/outlet'),
            ),
            _ServiceTile(
              title: 'Payout',
              subtitle: 'Send payout to a verified bank account',
              icon: Icons.payments,
              color: const Color(0xFF0EA5E9),
              onTap: () => context.go('/clubapi/payout'),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent activity',
                  style: TextStyle(
                    color: KhatuColors.text,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                TextButton(
                  onPressed: () => context.go('/service-history'),
                  child: const Text('View all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            transactionHistory.when(
              data: (transactions) {
                if (transactions.isEmpty) return const _EmptyHistory();

                return Column(
                  children: transactions
                      .take(4)
                      .map((transaction) => _RecentTransactionTile(
                            title: transaction.type,
                            subtitle:
                                'Rs. ${transaction.amount.toStringAsFixed(0)} - ${transaction.status}',
                            date: transaction.createdAt
                                    ?.toLocal()
                                    .toString()
                                    .split(' ')
                                    .first ??
                                '',
                            isSuccess:
                                transaction.status.toUpperCase() == 'SUCCESS',
                          ))
                      .toList(),
                );
              },
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, stack) => _InlineError(message: error.toString()),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceHeader extends StatelessWidget {
  const _ServiceHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: KhatuColors.line),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 18,
              offset: const Offset(0, 8)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: KhatuColors.teal.withOpacity(0.10),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.bolt, color: KhatuColors.teal, size: 28),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Khatu Pay',
                  style: TextStyle(
                    color: KhatuColors.text,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Recharge, BBPS bills and service history',
                  style: TextStyle(
                    color: KhatuColors.muted,
                    fontWeight: FontWeight.w700,
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

class _ServiceTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ServiceTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: KhatuColors.text,
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: KhatuColors.muted,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, color: KhatuColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecentTransactionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String date;
  final bool isSuccess;

  const _RecentTransactionTile({
    required this.title,
    required this.subtitle,
    required this.date,
    required this.isSuccess,
  });

  @override
  Widget build(BuildContext context) {
    final color = isSuccess ? KhatuColors.teal : KhatuColors.saffron;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.12),
          child: Icon(isSuccess ? Icons.check : Icons.schedule, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle),
        trailing: Text(
          date,
          style: const TextStyle(
            color: KhatuColors.muted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(Icons.history, size: 38, color: KhatuColors.muted),
            SizedBox(height: 10),
            Text(
              'No transactions yet',
              style: TextStyle(
                color: KhatuColors.muted,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  final String message;

  const _InlineError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          'Unable to load activity: $message',
          style:
              const TextStyle(color: Colors.red, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
