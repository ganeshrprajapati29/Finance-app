import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/loan.dart';
import '../../providers/auth_providers.dart';
import '../../services/loan_service.dart';
import '../../services/payment_service.dart';
import '../../services/user_service.dart';
import '../widgets/app_back_button.dart';
import '../widgets/kp_widgets.dart';

/// Money movement hub: send, wallet top-up, EMI payment and history.
///
/// Every gateway call goes through [PaymentService], which asks the backend to
/// create the Razorpay order and posts the signature back for server-side
/// verification. Nothing here trusts a client-side amount for loans, and no
/// signature is ever validated on the device.
class PaymentsPage extends ConsumerStatefulWidget {
  const PaymentsPage({super.key});

  @override
  ConsumerState<PaymentsPage> createState() => _PaymentsPageState();
}

class _PaymentsPageState extends ConsumerState<PaymentsPage> {
  /// P2P transfers stay gated until the payout licence is live. The screen is
  /// complete behind this flag rather than deleted.
  static const bool _sendMoneyEnabled = false;

  final _sendMobileController = TextEditingController();
  final _sendAmountController = TextEditingController();
  final _sendNoteController = TextEditingController(text: 'Khatu Pay transfer');
  final _walletAmountController = TextEditingController();
  final _partialAmountController = TextEditingController();

  late final PaymentService _payments = PaymentService();

  List<Loan> _loans = [];
  List<Map<String, dynamic>> _history = [];
  bool _loadingLoans = true;
  bool _loadingHistory = true;
  bool _resolvingPayee = false;
  bool _busy = false;

  String? _selectedLoanId;
  Map<String, dynamic>? _selectedInstallment;
  Map<String, dynamic>? _resolvedPayee;

  String? _notice;
  String? _error;
  String? _sendNotice;
  String? _sendError;

  @override
  void initState() {
    super.initState();
    _loadLoans();
    _loadHistory();
    _sendMobileController.addListener(_onSendMobileChanged);
  }

  @override
  void dispose() {
    _sendMobileController.removeListener(_onSendMobileChanged);
    _sendMobileController.dispose();
    _sendAmountController.dispose();
    _sendNoteController.dispose();
    _walletAmountController.dispose();
    _partialAmountController.dispose();
    _payments.dispose();
    super.dispose();
  }

  // --- data ---------------------------------------------------------------

  Future<void> _refreshAll() async {
    ref.invalidate(meProvider);
    await Future.wait([_loadLoans(), _loadHistory()]);
  }

  Future<void> _loadLoans() async {
    setState(() => _loadingLoans = true);
    try {
      final loans = await LoanService().myLoans();
      loans.sort((a, b) => (b.createdAt ?? DateTime(1970))
          .compareTo(a.createdAt ?? DateTime(1970)));
      if (!mounted) return;
      setState(() => _loans = loans);
    } catch (e) {
      if (!mounted) return;
      setState(() =>
          _error = friendlyErrorMessage(e, fallback: 'Unable to load loans.'));
    } finally {
      if (mounted) setState(() => _loadingLoans = false);
    }
  }

  Future<void> _loadHistory() async {
    setState(() => _loadingHistory = true);
    try {
      final response = await ApiClient.client.get('/payments');
      final data = response.data is Map ? response.data['data'] : null;
      if (!mounted) return;
      setState(() {
        _history = data is List
            ? data
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
            : <Map<String, dynamic>>[];
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error =
          friendlyErrorMessage(e, fallback: 'Unable to load payments.'));
    } finally {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  void _onSendMobileChanged() {
    final mobile = _digitsOnly(_sendMobileController.text);
    if (mobile.length >= 10) {
      _resolvePayee(mobile.substring(mobile.length - 10));
    } else if (_resolvedPayee != null || _sendError != null) {
      setState(() {
        _resolvedPayee = null;
        _sendError = null;
      });
    }
  }

  Future<void> _resolvePayee(String mobile) async {
    if (_resolvingPayee) return;
    setState(() {
      _resolvingPayee = true;
      _resolvedPayee = null;
      _sendError = null;
    });
    try {
      final payee = await UserService().resolveUpiByMobile(mobile);
      if (!mounted) return;
      setState(() => _resolvedPayee = payee);
    } catch (e) {
      if (!mounted) return;
      setState(() => _sendError = friendlyErrorMessage(e,
          fallback: 'No Khatu Pay user found for this mobile number.'));
    } finally {
      if (mounted) setState(() => _resolvingPayee = false);
    }
  }

  // --- payment actions ----------------------------------------------------

  Future<void> _sendMoney() async {
    final payee = _resolvedPayee;
    final amount = double.tryParse(_sendAmountController.text.trim());

    if (payee == null) {
      setState(() => _sendError = 'Enter a registered mobile number first.');
      return;
    }
    if (amount == null || amount <= 0) {
      setState(() => _sendError = 'Enter a valid amount.');
      return;
    }
    if (amount > 100000) {
      setState(() => _sendError = 'Maximum transfer is ₹1,00,000 per payment.');
      return;
    }

    setState(() {
      _busy = true;
      _sendError = null;
      _sendNotice = null;
    });

    try {
      final data = await _payments.createP2PPaymentOrder(
        amount,
        payee['upiId']?.toString() ?? '',
        payee['name']?.toString() ?? 'Khatu Pay User',
        payeeUserId: payee['id']?.toString(),
        payeeMobile: payee['mobile']?.toString(),
        note: _sendNoteController.text.trim(),
      );
      await _payments.openGatewayCheckout(data);
      if (!mounted) return;
      setState(() {
        _sendNotice = 'Money sent. Check History for the final status.';
        _sendAmountController.clear();
      });
      await _loadHistory();
    } catch (e) {
      if (!mounted) return;
      setState(() => _sendError = friendlyErrorMessage(e,
          fallback: 'The payment could not be completed.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addWalletMoney() async {
    final amount = double.tryParse(_walletAmountController.text.trim());
    if (amount == null || amount < 10) {
      setState(() => _error = 'Minimum wallet top-up is ₹10.');
      return;
    }
    if (amount > 100000) {
      setState(() => _error = 'Maximum wallet top-up is ₹1,00,000.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final data = await _payments.createWalletTopupOrder(amount);
      await _payments.openGatewayCheckout(data);
      if (!mounted) return;
      setState(() {
        _notice =
            'Money added. Your wallet balance updates as soon as the bank confirms.';
        _walletAmountController.clear();
      });
      ref.invalidate(meProvider);
      await _loadHistory();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyErrorMessage(e,
          fallback: 'Wallet top-up could not be completed.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _payInstallment() async {
    final installment = _selectedInstallment;
    final loanId = _selectedLoanId;
    if (loanId == null || installment == null || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      // For a loanId the server recomputes the payable amount from the loan
      // schedule; this value is only a request hint.
      final amount = _numValue(installment['total']).toDouble();
      final data = await _payments.createRazorpayOrder(
        amount,
        loanId: loanId,
        installmentNo: _intValue(installment['installmentNo']),
      );
      await _payments.openGatewayCheckout(data);
      if (!mounted) return;
      setState(() {
        _notice = 'EMI paid. Your schedule updates once the bank confirms.';
        _selectedLoanId = null;
        _selectedInstallment = null;
      });
      await _refreshAll();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyErrorMessage(e,
          fallback: 'The EMI payment could not be completed.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _payFullLoan(Loan loan) async {
    if (_busy) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Pay full outstanding?'),
        content: Text(
          'This closes the loan by paying ${kpMoney(loan.outstandingAmount)} '
          'in one payment.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final data = await _payments.createRazorpayOrder(
        loan.outstandingAmount.toDouble(),
        loanId: loan.id,
        isFullPayment: true,
      );
      await _payments.openGatewayCheckout(data);
      if (!mounted) return;
      setState(() => _notice =
          'Payment received. The loan closes as soon as the bank confirms.');
      await _refreshAll();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = friendlyErrorMessage(e,
          fallback: 'The payment could not be completed.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // --- build --------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: KhatuColors.bg,
        appBar: AppBar(
          title: const Text('Payments'),
          leading: const AppBackButton(),
          bottom: const TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(icon: Icon(Icons.account_balance_wallet_rounded), text: 'Wallet'),
              Tab(icon: Icon(Icons.payments_rounded), text: 'Pay EMI'),
              Tab(icon: Icon(Icons.send_to_mobile_rounded), text: 'Send'),
              Tab(icon: Icon(Icons.history_rounded), text: 'History'),
            ],
          ),
        ),
        body: SafeArea(
          top: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: TabBarView(
                children: [
                  _walletTab(),
                  _emiTab(),
                  _sendTab(),
                  _historyTab(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _walletTab() {
    final userAsync = ref.watch(meProvider);
    final walletRows = _history
        .where((p) =>
            p['type'] == 'WALLET_TOPUP' || p['type'] == 'WALLET_SPEND')
        .take(8)
        .toList();

    return userAsync.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: KhatuColors.teal)),
      error: (e, _) => KpErrorState.fromError(
        e,
        title: 'Wallet unavailable',
        fallback: 'Unable to load your wallet right now.',
        onRetry: () => ref.invalidate(meProvider),
      ),
      data: (user) => RefreshIndicator(
        color: KhatuColors.teal,
        onRefresh: _refreshAll,
        child: ListView(
          padding: KhatuSpace.pageScroll,
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            KpBalanceCard(
              label: 'AVAILABLE BALANCE',
              amount: user.walletBalance ?? 0,
              caption: 'Instantly usable for bills, recharges and EMIs',
            ),
            if (_notice != null) ...[
              KhatuSpace.gapMd,
              KpNoticeBanner(
                icon: Icons.check_circle_outline_rounded,
                color: KhatuColors.success,
                message: _notice!,
              ),
            ],
            if (_error != null) ...[
              KhatuSpace.gapMd,
              KpErrorBanner(message: _error!),
            ],
            const KpSectionHeader(title: 'Add money'),
            KpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _walletAmountController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                      prefixText: '₹ ',
                      hintText: 'Minimum ₹10',
                    ),
                  ),
                  KhatuSpace.gapMd,
                  Wrap(
                    spacing: KhatuSpace.sm,
                    runSpacing: KhatuSpace.sm,
                    children: [100, 500, 1000, 2000, 5000]
                        .map((amount) => ActionChip(
                              label: Text('₹$amount'),
                              onPressed: () => setState(() =>
                                  _walletAmountController.text = '$amount'),
                            ))
                        .toList(),
                  ),
                  KhatuSpace.gapLg,
                  ElevatedButton.icon(
                    onPressed: _busy ? null : _addWalletMoney,
                    icon: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.add_card_rounded, size: 18),
                    label: Text(_busy ? 'Please wait...' : 'Add money securely'),
                  ),
                  KhatuSpace.gapMd,
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.lock_rounded,
                          size: 13, color: KhatuColors.muted),
                      SizedBox(width: 5),
                      Text(
                        'Secured by RBI-regulated payment partners',
                        style: KhatuText.caption,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            KpSectionHeader(
              title: 'Wallet activity',
              actionLabel: walletRows.isEmpty ? null : 'All',
              onAction:
                  walletRows.isEmpty ? null : () => DefaultTabController.of(context).animateTo(3),
            ),
            if (walletRows.isEmpty)
              const KpCard(
                padding: EdgeInsets.zero,
                child: KpEmptyState(
                  compact: true,
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'No wallet activity yet',
                  message: 'Money you add or spend will show up here.',
                ),
              )
            else
              KpTransactionGroup(
                children: [
                  for (final row in walletRows)
                    KpTransactionTile.fromPayment(row),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _emiTab() {
    if (_loadingLoans && _loans.isEmpty) {
      return const Center(
          child: CircularProgressIndicator(color: KhatuColors.teal));
    }

    final activeLoans =
        _loans.where((loan) => loan.status == 'DISBURSED').toList();

    if (activeLoans.isEmpty) {
      return RefreshIndicator(
        color: KhatuColors.teal,
        onRefresh: _loadLoans,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 40),
            KpEmptyState(
              icon: Icons.event_note_outlined,
              title: 'No active EMIs',
              message:
                  'Once a loan is approved and disbursed, its EMI schedule appears here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: KhatuColors.teal,
      onRefresh: _loadLoans,
      child: ListView(
        padding: KhatuSpace.pageScroll,
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const KpNoticeBanner(
            icon: Icons.info_outline_rounded,
            message:
                'Pick an installment to pay. The amount is always calculated from your loan schedule, never edited on the app.',
          ),
          if (_notice != null) ...[
            KhatuSpace.gapMd,
            KpNoticeBanner(
              icon: Icons.check_circle_outline_rounded,
              color: KhatuColors.success,
              message: _notice!,
            ),
          ],
          if (_error != null) ...[
            KhatuSpace.gapMd,
            KpErrorBanner(message: _error!),
          ],
          KhatuSpace.gapLg,
          for (final loan in activeLoans) ...[
            _loanEmiCard(loan),
            KhatuSpace.gapLg,
          ],
        ],
      ),
    );
  }

  Widget _loanEmiCard(Loan loan) {
    final pending = loan.pendingInstallments.toList();

    return KpCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(KhatuSpace.lg),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: KhatuColors.softTeal,
                    borderRadius: BorderRadius.circular(KhatuRadius.md),
                  ),
                  child: const Icon(Icons.account_balance_rounded,
                      color: KhatuColors.deepTeal, size: 21),
                ),
                KhatuSpace.wMd,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('${kpMoney(loan.approvedAmount)} loan',
                          style: KhatuText.h3),
                      const SizedBox(height: 2),
                      Text(
                        loan.loanAccountNumber.trim().isEmpty
                            ? loan.id
                            : 'A/c ${loan.loanAccountNumber}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: KhatuText.caption,
                      ),
                    ],
                  ),
                ),
                KpStatusBadge(status: loan.status, dense: true),
              ],
            ),
          ),
          const Divider(height: 1),
          if (pending.isEmpty)
            const Padding(
              padding: EdgeInsets.all(KhatuSpace.lg),
              child: Text('No pending EMI on this loan.',
                  style: KhatuText.bodyMuted),
            )
          else
            for (final emi in pending)
              _EmiRow(
                installment: emi,
                selected: _selectedLoanId == loan.id &&
                    _selectedInstallment?['installmentNo'] ==
                        emi['installmentNo'],
                onSelect: () => setState(() {
                  _selectedLoanId = loan.id;
                  _selectedInstallment = emi;
                }),
              ),
          Padding(
            padding: const EdgeInsets.all(KhatuSpace.lg),
            child: Column(
              children: [
                if (_selectedLoanId == loan.id &&
                    _selectedInstallment != null) ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _busy ? null : _payInstallment,
                      icon: _busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.lock_rounded, size: 17),
                      label: Text(
                        _busy
                            ? 'Please wait...'
                            : 'Pay ${kpMoney(_numValue(_selectedInstallment!['total']))}',
                      ),
                    ),
                  ),
                  KhatuSpace.gapMd,
                ],
                if (loan.outstandingAmount > 0)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _payFullLoan(loan),
                      icon: const Icon(Icons.done_all_rounded, size: 18),
                      label: Text(
                          'Close loan - ${kpMoney(loan.outstandingAmount)}'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sendTab() {
    if (!_sendMoneyEnabled) {
      return const KpEmptyState(
        icon: Icons.send_to_mobile_rounded,
        title: 'Send money is coming soon',
        message:
            'Peer-to-peer transfers are pending partner approval. Scan & Pay and bill payments work as normal.',
      );
    }

    final payee = _resolvedPayee;

    return ListView(
      padding: KhatuSpace.pageScroll,
      children: [
        const KpNoticeBanner(
          icon: Icons.shield_outlined,
          message:
              'Always confirm the receiver name before you pay. Khatu Pay never asks for your UPI PIN to receive money.',
        ),
        KhatuSpace.gapLg,
        KpCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _sendMobileController,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: InputDecoration(
                  labelText: 'Receiver mobile number',
                  counterText: '',
                  prefixIcon: const Icon(Icons.phone_android_rounded),
                  suffixIcon: _resolvingPayee
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                ),
              ),
              if (_sendError != null) ...[
                KhatuSpace.gapMd,
                KpErrorBanner(message: _sendError!),
              ],
              if (_sendNotice != null) ...[
                KhatuSpace.gapMd,
                KpNoticeBanner(
                  icon: Icons.check_circle_outline_rounded,
                  color: KhatuColors.success,
                  message: _sendNotice!,
                ),
              ],
              if (payee != null) ...[
                KhatuSpace.gapLg,
                _PayeeCard(payee: payee),
                KhatuSpace.gapLg,
                TextField(
                  controller: _sendAmountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Amount',
                    prefixText: '₹ ',
                  ),
                ),
                KhatuSpace.gapMd,
                TextField(
                  controller: _sendNoteController,
                  decoration: const InputDecoration(
                    labelText: 'Note (optional)',
                    prefixIcon: Icon(Icons.edit_note_rounded),
                  ),
                ),
                KhatuSpace.gapLg,
                ElevatedButton.icon(
                  onPressed: _busy ? null : _sendMoney,
                  icon: const Icon(Icons.lock_rounded, size: 17),
                  label: Text(_busy ? 'Please wait...' : 'Pay securely'),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _historyTab() {
    if (_loadingHistory && _history.isEmpty) {
      return const Center(
          child: CircularProgressIndicator(color: KhatuColors.teal));
    }

    if (_history.isEmpty) {
      return RefreshIndicator(
        color: KhatuColors.teal,
        onRefresh: _loadHistory,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 40),
            KpEmptyState(
              icon: Icons.history_rounded,
              illustration: KpIllustrations.secureWallet,
              title: 'No transactions yet',
              message:
                  'Wallet top-ups, EMIs, bills and transfers all show up here.',
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: KhatuColors.teal,
      onRefresh: _loadHistory,
      child: ListView(
        padding: KhatuSpace.pageScroll,
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          KpTransactionGroup(
            children: [
              for (final payment in _history)
                KpTransactionTile.fromPayment(payment),
            ],
          ),
        ],
      ),
    );
  }

  // --- helpers ------------------------------------------------------------

  static String _digitsOnly(String value) => value.replaceAll(RegExp(r'\D'), '');

  static num _numValue(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static int? _intValue(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }
}

class _EmiRow extends StatelessWidget {
  const _EmiRow({
    required this.installment,
    required this.selected,
    required this.onSelect,
  });

  final Map<String, dynamic> installment;
  final bool selected;
  final VoidCallback onSelect;

  String get _dueLabel {
    final due = DateTime.tryParse(installment['dueDate']?.toString() ?? '');
    if (due == null) return 'Due date not set';
    final diff = due.difference(DateTime.now()).inDays;
    if (diff < 0) return '${diff.abs()} days overdue';
    if (diff == 0) return 'Due today';
    return '$diff days left';
  }

  @override
  Widget build(BuildContext context) {
    final overdue = _dueLabel.contains('overdue');

    return InkWell(
      onTap: onSelect,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: KhatuSpace.lg, vertical: KhatuSpace.md),
        color: selected ? KhatuColors.softTeal : Colors.transparent,
        child: Row(
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: selected ? KhatuColors.teal : KhatuColors.lineStrong,
            ),
            KhatuSpace.wMd,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'EMI ${installment['installmentNo'] ?? ''}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13.5,
                      color: KhatuColors.text,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _dueLabel,
                    style: KhatuText.caption.copyWith(
                      color:
                          overdue ? KhatuColors.danger : KhatuColors.muted,
                      fontWeight: overdue ? FontWeight.w900 : FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              kpMoney(_PaymentsPageState._numValue(installment['total'])),
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 14,
                color: KhatuColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PayeeCard extends StatelessWidget {
  const _PayeeCard({required this.payee});

  final Map<String, dynamic> payee;

  @override
  Widget build(BuildContext context) {
    final name = (payee['name'] ?? 'Khatu Pay User').toString();

    return Container(
      padding: const EdgeInsets.all(KhatuSpace.md),
      decoration: BoxDecoration(
        color: KhatuColors.softTeal,
        borderRadius: BorderRadius.circular(KhatuRadius.md),
        border: Border.all(color: KhatuColors.teal.withValues(alpha: 0.20)),
      ),
      child: Row(
        children: [
          KpAvatar(name: name, size: 42),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 14.5,
                    color: KhatuColors.text,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  (payee['upiId'] ?? payee['mobile'] ?? '').toString(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KhatuText.caption,
                ),
              ],
            ),
          ),
          const Icon(Icons.verified_rounded,
              color: KhatuColors.success, size: 20),
        ],
      ),
    );
  }
}
