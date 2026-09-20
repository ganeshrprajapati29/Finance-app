import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/loan.dart';
import '../../routes/app_router.dart';
import '../../services/loan_service.dart';
import '../widgets/kp_widgets.dart';
import 'dashboard_page.dart' show KhatuBottomNav;

/// Loan portfolio.
///
/// Leads with the number that matters (total outstanding) plus the next EMI
/// due, then lists every application with its repayment progress. Filter chips
/// let a user with several loans jump straight to the active ones.
class LoanDashboardPage extends StatefulWidget {
  const LoanDashboardPage({super.key});

  @override
  State<LoanDashboardPage> createState() => _LoanDashboardPageState();
}

class _LoanDashboardPageState extends State<LoanDashboardPage> {
  bool _loading = true;
  String? _error;
  List<Loan> _loans = [];
  String _filter = 'ALL';

  static const _filters = ['ALL', 'ACTIVE', 'PENDING', 'CLOSED'];

  @override
  void initState() {
    super.initState();
    _fetchLoans();
  }

  Future<void> _fetchLoans() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final loans = await LoanService().myLoans();
      loans.sort((a, b) {
        final left = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final right = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return right.compareTo(left);
      });
      if (!mounted) return;
      setState(() => _loans = loans);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error =
          friendlyErrorMessage(e, fallback: 'Unable to load your loans.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Loan> get _visibleLoans {
    switch (_filter) {
      case 'ACTIVE':
        return _loans.where((l) => l.status == 'DISBURSED').toList();
      case 'PENDING':
        return _loans
            .where((l) => l.status == 'PENDING' || l.status == 'APPROVED')
            .toList();
      case 'CLOSED':
        return _loans
            .where((l) =>
                l.status == 'CLOSED' ||
                l.status == 'REJECTED' ||
                l.status == 'FAILED')
            .toList();
      default:
        return _loans;
    }
  }

  /// Earliest unpaid installment across every disbursed loan.
  ({Loan loan, Map<String, dynamic> installment})? get _nextDue {
    ({Loan loan, Map<String, dynamic> installment})? best;
    DateTime? bestDate;

    for (final loan in _loans) {
      if (loan.status != 'DISBURSED') continue;
      final next = loan.nextInstallment;
      if (next == null) continue;
      final due = DateTime.tryParse(next['dueDate']?.toString() ?? '');
      if (due == null) continue;
      if (bestDate == null || due.isBefore(bestDate)) {
        bestDate = due;
        best = (loan: loan, installment: next);
      }
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    final outstanding =
        _loans.fold<num>(0, (sum, loan) => sum + loan.outstandingAmount);
    final paid = _loans.fold<num>(0, (sum, loan) => sum + loan.paidAmount);
    final active = _loans.where((loan) => loan.status == 'DISBURSED').length;
    final nextDue = _nextDue;
    final visible = _visibleLoans;

    return Scaffold(
      backgroundColor: KhatuColors.bg,
      appBar: AppBar(
        title: const Text('My Loans'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _fetchLoans,
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      bottomNavigationBar: const KhatuBottomNav(currentIndex: 1),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => router.go('/apply'),
        backgroundColor: KhatuColors.saffron,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Apply for loan',
            style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: RefreshIndicator(
              color: KhatuColors.teal,
              onRefresh: _fetchLoans,
              child: ListView(
                padding: KhatuSpace.pageScroll,
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  KpBalanceCard(
                    label: 'TOTAL OUTSTANDING',
                    amount: outstanding,
                    caption: _loans.isEmpty
                        ? 'No loans yet. Apply in under 5 minutes.'
                        : '$active active ${active == 1 ? 'loan' : 'loans'} • ${_loans.length} total',
                    loading: _loading && _loans.isEmpty,
                    stats: [
                      KpBalanceStat(
                        label: 'Repaid so far',
                        value: kpMoney(paid),
                        icon: Icons.check_circle_outline_rounded,
                      ),
                      KpBalanceStat(
                        label: 'Applications',
                        value: '${_loans.length}',
                        icon: Icons.description_outlined,
                      ),
                    ],
                  ),
                  if (nextDue != null) ...[
                    KhatuSpace.gapLg,
                    _NextDueCard(
                      loan: nextDue.loan,
                      installment: nextDue.installment,
                    ),
                  ],
                  if (_loans.isNotEmpty) ...[
                    KhatuSpace.gapXl,
                    SizedBox(
                      height: 36,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _filters.length,
                        separatorBuilder: (_, __) => KhatuSpace.wSm,
                        itemBuilder: (_, index) {
                          final value = _filters[index];
                          final selected = value == _filter;
                          return ChoiceChip(
                            selected: selected,
                            showCheckmark: false,
                            label: Text(value == 'ALL'
                                ? 'All'
                                : KpStatusBadge.prettify(value)),
                            labelStyle: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 12.5,
                              color: selected
                                  ? KhatuColors.deepTeal
                                  : KhatuColors.muted,
                            ),
                            onSelected: (_) => setState(() => _filter = value),
                          );
                        },
                      ),
                    ),
                  ],
                  KhatuSpace.gapLg,
                  if (_loading && _loans.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(
                        child:
                            CircularProgressIndicator(color: KhatuColors.teal),
                      ),
                    )
                  else if (_error != null)
                    KpErrorState(
                      title: 'Loans unavailable',
                      message: _error!,
                      onRetry: _fetchLoans,
                      compact: true,
                    )
                  else if (_loans.isEmpty)
                    KpEmptyState(
                      icon: Icons.savings_outlined,
                      illustration: KpIllustrations.loanApproved,
                      title: 'No loans yet',
                      message:
                          'Apply for an instant personal loan. Fully digital eKYC, money straight to your bank account.',
                      actionLabel: 'Apply now',
                      onAction: () => router.go('/apply'),
                    )
                  else if (visible.isEmpty)
                    KpEmptyState(
                      compact: true,
                      icon: Icons.filter_alt_off_outlined,
                      title: 'Nothing in this filter',
                      message:
                          'You have no ${KpStatusBadge.prettify(_filter).toLowerCase()} loans right now.',
                      actionLabel: 'Show all',
                      onAction: () => setState(() => _filter = 'ALL'),
                    )
                  else
                    for (final loan in visible) ...[
                      _LoanCard(loan: loan),
                      KhatuSpace.gapMd,
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

class _NextDueCard extends StatelessWidget {
  const _NextDueCard({required this.loan, required this.installment});

  final Loan loan;
  final Map<String, dynamic> installment;

  @override
  Widget build(BuildContext context) {
    final due = DateTime.tryParse(installment['dueDate']?.toString() ?? '');
    final amount = installment['total'];
    final overdue = due != null && due.isBefore(DateTime.now());
    final days = due?.difference(DateTime.now()).inDays;

    final tone = overdue ? KhatuColors.danger : KhatuColors.gold;

    return Container(
      padding: const EdgeInsets.all(KhatuSpace.lg),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(KhatuRadius.lg),
        border: Border.all(color: tone.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(KhatuRadius.md),
            ),
            child: Icon(
              overdue
                  ? Icons.warning_amber_rounded
                  : Icons.event_available_rounded,
              color: tone,
              size: 22,
            ),
          ),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  overdue ? 'EMI overdue' : 'Next EMI due',
                  style: TextStyle(
                    color: tone,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(kpMoney(amount), style: KhatuText.amount),
                const SizedBox(height: 2),
                Text(
                  due == null
                      ? 'Installment ${installment['installmentNo'] ?? ''}'
                      : overdue
                          ? 'Was due ${DateFormat('d MMM yyyy').format(due)}'
                          : days == 0
                              ? 'Due today'
                              : 'Due ${DateFormat('d MMM yyyy').format(due)} (in $days days)',
                  style: KhatuText.caption,
                ),
              ],
            ),
          ),
          KhatuSpace.wSm,
          ElevatedButton(
            onPressed: () => router.go('/loan/${loan.id}'),
            style: ElevatedButton.styleFrom(
              backgroundColor: tone,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              minimumSize: const Size(0, 42),
            ),
            child: const Text('Pay now'),
          ),
        ],
      ),
    );
  }
}

class _LoanCard extends StatelessWidget {
  const _LoanCard({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    final progress = loan.repaymentProgress.clamp(0.0, 1.0);
    final tone = KhatuColors.status(loan.status);
    final created = loan.createdAt;

    return KpCard(
      onTap: () => router.go('/loan/${loan.id}'),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                KhatuSpace.lg, KhatuSpace.lg, KhatuSpace.lg, KhatuSpace.md),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(KhatuRadius.md),
                  ),
                  child:
                      Icon(Icons.request_quote_outlined, color: tone, size: 21),
                ),
                KhatuSpace.wMd,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        kpMoney(loan.approvedAmount),
                        style: KhatuText.h3,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (loan.loanAccountNumber.trim().isNotEmpty)
                            'A/c ${loan.loanAccountNumber}',
                          '${loan.application.tenureMonths} months',
                          if (created != null)
                            DateFormat('d MMM yyyy').format(created),
                        ].join(' • '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: KhatuText.caption,
                      ),
                    ],
                  ),
                ),
                KhatuSpace.wSm,
                KpStatusBadge(status: loan.status),
              ],
            ),
          ),
          if (loan.schedule.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: KhatuSpace.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(KhatuRadius.pill),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: KhatuColors.line,
                      valueColor: AlwaysStoppedAnimation(
                        loan.status == 'CLOSED'
                            ? KhatuColors.success
                            : KhatuColors.teal,
                      ),
                    ),
                  ),
                  const SizedBox(height: KhatuSpace.sm),
                  Row(
                    children: [
                      Text(
                        '${loan.paidInstallments.length}/${loan.schedule.length} EMIs paid',
                        style: KhatuText.caption,
                      ),
                      const Spacer(),
                      Text(
                        loan.outstandingAmount > 0
                            ? '${kpMoney(loan.outstandingAmount)} left'
                            : 'Fully repaid',
                        style: KhatuText.caption.copyWith(
                          color: loan.outstandingAmount > 0
                              ? KhatuColors.gold
                              : KhatuColors.success,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: KhatuSpace.md),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: KhatuSpace.lg, vertical: KhatuSpace.sm),
            child: Row(
              children: [
                Text(
                  (loan.application.purpose).trim().isEmpty
                      ? 'Personal loan'
                      : loan.application.purpose,
                  style: KhatuText.caption,
                ),
                const Spacer(),
                const Text(
                  'View details',
                  style: TextStyle(
                    color: KhatuColors.deepTeal,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const Icon(Icons.chevron_right_rounded,
                    size: 18, color: KhatuColors.deepTeal),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
