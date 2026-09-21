import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/loan.dart';
import '../../services/loan_service.dart';
import '../../services/payment_service.dart';
import '../widgets/kp_widgets.dart';

/// Single loan: repayment progress, next EMI, approved terms, full schedule
/// and the applicant snapshot.
///
/// The Pay action never sends an amount the client picked - it asks the
/// backend to create the order for a specific `installmentNo` and the server
/// derives the payable amount from the loan schedule. Signature verification
/// likewise happens only on the server.
class LoanDetailPage extends StatefulWidget {
  const LoanDetailPage({super.key, required this.id, this.loan});

  final String id;
  final Loan? loan;

  @override
  State<LoanDetailPage> createState() => _LoanDetailPageState();
}

class _LoanDetailPageState extends State<LoanDetailPage> {
  Loan? _loan;
  bool _loading = true;
  bool _paying = false;
  String? _error;
  String? _notice;
  Map<String, dynamic> _agreement = const {};
  bool _agreementBusy = false;
  bool _agreementAccepted = false;

  late final PaymentService _payments = PaymentService();

  @override
  void initState() {
    super.initState();
    _loan = widget.loan;
    _load();
  }

  @override
  void dispose() {
    _payments.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = _loan == null);
    try {
      final fresh = await LoanService().detail(widget.id);
      Map<String, dynamic> agreement = const {};
      if (fresh.status == 'APPROVED' || fresh.decision?.agreementStatus == 'SIGNED') {
        agreement = await LoanService().agreement(widget.id);
      }
      if (!mounted) return;
      setState(() {
        _loan = fresh;
        _agreement = agreement;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error =
          friendlyErrorMessage(e, fallback: 'Unable to load this loan.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openDocument(String? value) async {
    final uri = Uri.tryParse(value ?? '');
    if (uri == null || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) setState(() => _error = 'The document could not be opened. Please try again.');
    }
  }

  Future<void> _startSigning() async {
    if (!_agreementAccepted) {
      setState(() => _error = 'Please review and accept the agreement before continuing.');
      return;
    }
    setState(() { _agreementBusy = true; _error = null; });
    try {
      final data = await LoanService().startAgreementSigning(widget.id);
      final url = data['signingUrl']?.toString();
      if (url == null || url.isEmpty) throw Exception('The secure signing page is unavailable.');
      await _openDocument(url);
      if (mounted) setState(() { _agreement = {..._agreement, ...data}; _notice = 'Complete Aadhaar eSign, then return here and refresh the status.'; });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyErrorMessage(e, fallback: 'Secure signing could not be started.'));
    } finally {
      if (mounted) setState(() => _agreementBusy = false);
    }
  }

  Future<void> _refreshSigning() async {
    setState(() { _agreementBusy = true; _error = null; });
    try {
      final data = await LoanService().refreshAgreementStatus(widget.id);
      if (mounted) setState(() { _agreement = {..._agreement, ...data}; _notice = data['status'] == 'SIGNED' ? 'Agreement signed and verified successfully.' : 'Your signature is still pending.'; });
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyErrorMessage(e, fallback: 'Signing status could not be refreshed.'));
    } finally {
      if (mounted) setState(() => _agreementBusy = false);
    }
  }

  Future<void> _payInstallment(Map<String, dynamic> installment,
      {bool foreclose = false}) async {
    final loan = _loan;
    if (loan == null || _paying) return;

    setState(() {
      _paying = true;
      _error = null;
      _notice = null;
    });

    try {
      final installmentNo = int.tryParse('${installment['installmentNo']}');
      // The amount below is only a hint for the request body: for a loanId the
      // backend recomputes the payable amount from the schedule and ignores
      // whatever the client sent.
      final amount = _num(installment['total']).toDouble();

      final data = await _payments.createRazorpayOrder(
        amount,
        loanId: loan.id,
        installmentNo: foreclose ? null : installmentNo,
        isFullPayment: foreclose,
      );

      await _payments.openGatewayCheckout(data);

      if (!mounted) return;
      setState(() {
        _paying = false;
        _notice =
            'Payment received. Your schedule updates as soon as the bank confirms.';
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _paying = false;
        _error = friendlyErrorMessage(e,
            fallback: 'Payment could not be completed. Please try again.');
      });
    }
  }

  Future<void> _confirmForeclosure() async {
    final loan = _loan;
    if (loan == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close this loan?'),
        content: Text(
          'You will pay the full outstanding amount of '
          '${kpMoney(loan.outstandingAmount)} in one go and the loan will be '
          'marked closed once the bank confirms.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Pay full amount'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final next = loan.nextInstallment ??
        (loan.schedule.isEmpty ? <String, dynamic>{} : loan.schedule.first);
    await _payInstallment(next, foreclose: true);
  }

  static num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse(value?.toString() ?? '') ?? 0;
  }

  static String _date(dynamic value) {
    final parsed =
        value is DateTime ? value : DateTime.tryParse(value?.toString() ?? '');
    if (parsed == null) return '--';
    return DateFormat('d MMM yyyy').format(parsed.toLocal());
  }

  static String _dueText(dynamic value) {
    final due = DateTime.tryParse(value?.toString() ?? '');
    if (due == null) return 'Due date not set';
    final days = due.difference(DateTime.now()).inDays;
    if (days < 0) return '${days.abs()} days overdue';
    if (days == 0) return 'Due today';
    return 'in $days days';
  }

  @override
  Widget build(BuildContext context) {
    final loan = _loan;

    if (_loading && loan == null) {
      return const KpAppShell(
        title: 'Loan Details',
        scrollable: false,
        body: Center(child: CircularProgressIndicator(color: KhatuColors.teal)),
      );
    }

    if (loan == null) {
      return KpAppShell(
        title: 'Loan Details',
        scrollable: false,
        body: KpErrorState(
          message: _error ?? 'This loan could not be found.',
          onRetry: _load,
        ),
      );
    }

    final canPay = loan.status == 'DISBURSED';

    return KpAppShell(
      title: 'Loan Details',
      subtitle: loan.loanAccountNumber.trim().isEmpty
          ? null
          : 'A/c ${loan.loanAccountNumber}',
      onRefresh: _load,
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh_rounded),
        ),
        const SizedBox(width: 4),
      ],
      children: [
        _LoanHero(loan: loan),
        if (loan.statusHistory.isNotEmpty) ...[
          const KpSectionHeader(title: 'Application timeline'),
          KpCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < loan.statusHistory.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: KhatuSpace.lg),
                  ListTile(
                    leading: const Icon(Icons.check_circle_outline_rounded,
                        color: KhatuColors.teal),
                    title: Text(
                      (loan.statusHistory[i]['title'] ??
                              KpStatusBadge.prettify(
                                  loan.statusHistory[i]['status']?.toString() ?? ''))
                          .toString(),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text((loan.statusHistory[i]['reason'] ??
                            loan.statusHistory[i]['message'] ?? '')
                        .toString()),
                    trailing: Text(_date(loan.statusHistory[i]['createdAt']),
                        style: const TextStyle(
                            color: KhatuColors.muted, fontSize: 11)),
                  ),
                ],
              ],
            ),
          ),
        ],
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
          KpErrorBanner(message: _error!, onRetry: _load),
        ],
        KhatuSpace.gapLg,
        _NextPaymentCard(
          loan: loan,
          paying: _paying,
          onPay: (installment) => _payInstallment(installment),
        ),
        if (canPay && loan.outstandingAmount > 0) ...[
          KhatuSpace.gapMd,
          OutlinedButton.icon(
            onPressed: _paying ? null : _confirmForeclosure,
            icon: const Icon(Icons.done_all_rounded, size: 18),
            label: Text('Foreclose - pay ${kpMoney(loan.outstandingAmount)}'),
          ),
        ],
        const KpSectionHeader(title: 'Application'),
        KpCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _row(
                  'Loan account',
                  loan.loanAccountNumber.trim().isEmpty
                      ? loan.id
                      : loan.loanAccountNumber),
              _row('Requested amount',
                  kpMoney(loan.application.amountRequested)),
              _row('Tenure', '${loan.application.tenureMonths} months'),
              _row(
                  'Purpose',
                  loan.application.purpose.trim().isEmpty
                      ? 'Personal'
                      : loan.application.purpose),
              _row('Applied on', _date(loan.createdAt)),
            ],
          ),
        ),
        if (loan.decision != null) ...[
          const KpSectionHeader(title: 'Approved terms'),
          KpCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                _row('Approved amount',
                    kpMoney(loan.decision?.amountApproved)),
                _row(
                    'Interest rate',
                    loan.decision?.rateAPR == null
                        ? '--'
                        : '${loan.decision!.rateAPR!.toStringAsFixed(1)}% APR'),
                _row('Tenure', '${loan.decision?.tenureMonths ?? '--'} months'),
                if ((loan.decision?.lenderName ?? '').isNotEmpty)
                  _row('Lending partner', loan.decision!.lenderName!),
                _row('Processing fee', kpMoney(loan.decision?.processingFee ?? 0)),
                _row('Taxes', kpMoney(loan.decision?.taxAmount ?? 0)),
                if (loan.decision?.netDisbursalAmount != null)
                  _row('Net disbursal', kpMoney(loan.decision?.netDisbursalAmount)),
                if ((loan.decision?.rejectionReason ?? '').isNotEmpty)
                  _row('Decision note', loan.decision!.rejectionReason!),
                _row('Disbursed on', _date(loan.disbursementDate)),
              ],
            ),
          ),
          if (loan.status == 'APPROVED' || loan.decision?.agreementStatus == 'SIGNED') ...[
            const KpSectionHeader(title: 'Digital loan agreement'),
            KpCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    const Icon(Icons.verified_user_outlined, color: KhatuColors.teal),
                    KhatuSpace.gapSm,
                    Expanded(child: Text(
                      (_agreement['status'] ?? loan.decision?.agreementStatus ?? 'PENDING_SIGNATURE') == 'SIGNED'
                          ? 'Agreement signed and verified'
                          : 'Review and Aadhaar eSign required',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    )),
                  ]),
                  KhatuSpace.gapMd,
                  const Text('Review the approved amount, APR, fees, tenure and repayment terms before signing. Disbursal starts only after your digital signature is verified.'),
                  KhatuSpace.gapMd,
                  OutlinedButton.icon(
                    onPressed: () => _openDocument((_agreement['signedAgreementUrl'] ?? _agreement['agreementUrl'] ?? loan.decision?.signedAgreementUrl ?? loan.decision?.agreementUrl)?.toString()),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: Text((_agreement['status'] ?? loan.decision?.agreementStatus) == 'SIGNED' ? 'View signed agreement' : 'Review agreement PDF'),
                  ),
                  if ((_agreement['status'] ?? loan.decision?.agreementStatus) != 'SIGNED') ...[
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _agreementAccepted,
                      onChanged: _agreementBusy ? null : (value) => setState(() => _agreementAccepted = value == true),
                      title: const Text('I have reviewed and accept the approved loan terms.'),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                    FilledButton.icon(
                      onPressed: _agreementBusy ? null : _startSigning,
                      icon: _agreementBusy
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.draw_outlined),
                      label: const Text('Continue to Aadhaar eSign'),
                    ),
                    TextButton.icon(
                      onPressed: _agreementBusy ? null : _refreshSigning,
                      icon: const Icon(Icons.sync_rounded),
                      label: const Text('I have signed - refresh status'),
                    ),
                  ] else ...[
                    KhatuSpace.gapSm,
                    const KpNoticeBanner(icon: Icons.shield_outlined, color: KhatuColors.success, message: 'Signed copy and digital audit trail are securely recorded.'),
                  ],
                ],
              ),
            ),
          ],
        ],
        KpSectionHeader(
          title: 'Repayment schedule',
          subtitle: loan.schedule.isEmpty
              ? null
              : '${loan.paidInstallments.length} of ${loan.schedule.length} paid',
        ),
        if (loan.schedule.isEmpty)
          const KpCard(
            padding: EdgeInsets.zero,
            child: KpEmptyState(
              compact: true,
              icon: Icons.event_note_outlined,
              title: 'Schedule not generated yet',
              message:
                  'Your EMI schedule appears here once the loan is approved and disbursed.',
            ),
          )
        else
          KpCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < loan.schedule.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: KhatuSpace.lg),
                  _ScheduleTile(
                    installment: loan.schedule[i],
                    canPay: canPay && loan.schedule[i]['paid'] != true,
                    paying: _paying,
                    onPay: () => _payInstallment(loan.schedule[i]),
                  ),
                ],
              ],
            ),
          ),
        const KpSectionHeader(title: 'Applicant'),
        KpCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _row('Name', _text(loan.application.personal?['name'])),
              _row('Mobile', _text(loan.application.personal?['mobile'])),
              _row(
                  'Employment',
                  KpStatusBadge.prettify(
                      _text(loan.application.employment?['employmentType']))),
              _row('Monthly income',
                  kpMoney(_num(loan.application.employment?['monthlyIncome']))),
              _row('Bank', _text(loan.application.bankDetails?['bankName'])),
              _row('Account',
                  _maskAccount(loan.application.bankDetails?['accountNumber'])),
            ],
          ),
        ),
      ],
    );
  }

  static String _text(dynamic value) {
    final text = (value ?? '').toString().trim();
    return text.isEmpty ? '--' : text;
  }

  /// Never render a full account number back to the user - last 4 is enough
  /// to confirm the right account without exposing it on a shoulder-surfable
  /// screen.
  static String _maskAccount(dynamic value) {
    final text = (value ?? '').toString().trim();
    if (text.length < 4) return text.isEmpty ? '--' : text;
    return '•••• ${text.substring(text.length - 4)}';
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: KhatuSpace.lg, vertical: KhatuSpace.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 4, child: Text(label, style: KhatuText.label)),
          Expanded(
            flex: 6,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13.5,
                color: KhatuColors.text,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LoanHero extends StatelessWidget {
  const _LoanHero({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    final progress = loan.repaymentProgress.clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(KhatuSpace.xl),
      decoration: BoxDecoration(
        gradient: KhatuColors.heroGradient,
        borderRadius: BorderRadius.circular(KhatuRadius.xl),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'LOAN AMOUNT',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.78),
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(kpMoney(loan.approvedAmount),
                        style: KhatuText.amountLarge),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(KhatuRadius.pill),
                  border:
                      Border.all(color: Colors.white.withValues(alpha: 0.24)),
                ),
                child: Text(
                  KpStatusBadge.prettify(loan.status),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          KhatuSpace.gapLg,
          ClipRRect(
            borderRadius: BorderRadius.circular(KhatuRadius.pill),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.22),
              valueColor: const AlwaysStoppedAnimation(Color(0xFF2DD4BF)),
            ),
          ),
          KhatuSpace.gapMd,
          Row(
            children: [
              Expanded(child: _metric('Repaid', kpMoney(loan.paidAmount))),
              Expanded(
                child: _metric(
                  'Outstanding',
                  loan.schedule.isEmpty
                      ? '--'
                      : kpMoney(loan.outstandingAmount),
                ),
              ),
              Expanded(
                child: _metric(
                  'EMIs',
                  loan.schedule.isEmpty
                      ? '--'
                      : '${loan.paidInstallments.length}/${loan.schedule.length}',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.70),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14.5,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _NextPaymentCard extends StatelessWidget {
  const _NextPaymentCard({
    required this.loan,
    required this.paying,
    required this.onPay,
  });

  final Loan loan;
  final bool paying;
  final Future<void> Function(Map<String, dynamic> installment) onPay;

  @override
  Widget build(BuildContext context) {
    final next = loan.nextInstallment;
    final canPay = loan.status == 'DISBURSED' && next != null;

    if (loan.status == 'CLOSED') {
      return const KpNoticeBanner(
        icon: Icons.verified_rounded,
        color: KhatuColors.success,
        title: 'Loan fully repaid',
        message:
            'Every installment is paid and this loan is closed. Your credit profile has been updated.',
      );
    }

    if (!canPay) {
      return KpNoticeBanner(
        icon: Icons.schedule_rounded,
        color: KhatuColors.gold,
        title: loan.status == 'PENDING'
            ? 'Application under review'
            : loan.status == 'APPROVED'
                ? 'Approved - awaiting disbursement'
                : 'No repayment due',
        message: loan.status == 'PENDING'
            ? 'Our team is reviewing your documents. You will be notified as soon as there is an update.'
            : loan.status == 'APPROVED'
                ? 'Your loan is approved. The amount will be credited to your bank account shortly.'
                : 'There is nothing to pay on this loan right now.',
      );
    }

    final overdue =
        DateTime.tryParse(next['dueDate']?.toString() ?? '')?.isBefore(
              DateTime.now(),
            ) ??
            false;
    final tone = overdue ? KhatuColors.danger : KhatuColors.teal;

    return KpCard(
      borderColor: tone.withValues(alpha: 0.30),
      color: tone.withValues(alpha: 0.05),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(KhatuRadius.md),
            ),
            child: Icon(
              overdue ? Icons.warning_amber_rounded : Icons.payments_rounded,
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
                  'EMI ${next['installmentNo'] ?? ''}',
                  style: TextStyle(
                    color: tone,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(kpMoney(_LoanDetailPageState._num(next['total'])),
                    style: KhatuText.amount),
                const SizedBox(height: 2),
                Text(
                  '${_LoanDetailPageState._date(next['dueDate'])} • ${_LoanDetailPageState._dueText(next['dueDate'])}',
                  style: KhatuText.caption,
                ),
              ],
            ),
          ),
          KhatuSpace.wSm,
          ElevatedButton(
            onPressed: paying ? null : () => onPay(next),
            style: ElevatedButton.styleFrom(
              backgroundColor: tone,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              minimumSize: const Size(0, 44),
            ),
            child: paying
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Pay'),
          ),
        ],
      ),
    );
  }
}

class _ScheduleTile extends StatelessWidget {
  const _ScheduleTile({
    required this.installment,
    required this.canPay,
    required this.paying,
    required this.onPay,
  });

  final Map<String, dynamic> installment;
  final bool canPay;
  final bool paying;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final paid = installment['paid'] == true;
    final due = DateTime.tryParse(installment['dueDate']?.toString() ?? '');
    final overdue = !paid && due != null && due.isBefore(DateTime.now());

    final tone = paid
        ? KhatuColors.success
        : overdue
            ? KhatuColors.danger
            : KhatuColors.muted;

    return Padding(
      padding: const EdgeInsets.symmetric(
          horizontal: KhatuSpace.lg, vertical: KhatuSpace.md),
      child: Row(
        children: [
          Icon(
            paid
                ? Icons.check_circle_rounded
                : overdue
                    ? Icons.error_outline_rounded
                    : Icons.radio_button_unchecked_rounded,
            color: tone,
            size: 20,
          ),
          KhatuSpace.wMd,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'EMI ${installment['installmentNo'] ?? ''} • ${kpMoney(_LoanDetailPageState._num(installment['total']))}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5,
                    color: KhatuColors.text,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  paid
                      ? 'Paid on ${_LoanDetailPageState._date(installment['paidAt'])}'
                      : 'Due ${_LoanDetailPageState._date(installment['dueDate'])} • ${_LoanDetailPageState._dueText(installment['dueDate'])}',
                  style: KhatuText.caption.copyWith(
                    color: paid ? KhatuColors.success : KhatuColors.muted,
                  ),
                ),
              ],
            ),
          ),
          if (paid)
            const KpStatusBadge(status: 'PAID', dense: true, showDot: false)
          else if (canPay)
            TextButton(
              onPressed: paying ? null : onPay,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('Pay'),
            ),
        ],
      ),
    );
  }
}
