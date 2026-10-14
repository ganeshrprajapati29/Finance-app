import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';
import 'business_widgets.dart';

/// Step 3 of business setup: the bank account collections are settled to.
class BusinessBankPage extends ConsumerStatefulWidget {
  const BusinessBankPage({super.key});
  @override
  ConsumerState<BusinessBankPage> createState() => _State();
}

class _State extends ConsumerState<BusinessBankPage> {
  final key = GlobalKey<FormState>();
  final holder = TextEditingController(),
      account = TextEditingController(),
      confirm = TextEditingController(),
      ifsc = TextEditingController(),
      bank = TextEditingController();
  bool busy = false;
  bool prefilled = false;
  String? error;
  Map<String, dynamic>? result;

  @override
  void dispose() {
    for (final c in [holder, account, confirm, ifsc, bank]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    if (!(key.currentState?.validate() ?? false)) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final saved = await MerchantBusinessService().submitBank({
        'accountHolderName': holder.text.trim(),
        'accountNumber': account.text.trim(),
        'ifscCode': ifsc.text.trim().toUpperCase(),
        'bankName': bank.text.trim(),
      });
      ref.invalidate(merchantDashboardProvider);
      if (mounted) setState(() => result = saved);
    } catch (e) {
      if (mounted) {
        setState(() => error = friendlyErrorMessage(e,
            fallback:
                'Bank account could not be verified. Check the account number and IFSC, then try again.'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(merchantDashboardProvider).valueOrNull;
    final saved = result ?? dashboard?.bank;
    final status = (saved?['status'] ?? '').toString().toUpperCase();
    if (!prefilled && dashboard != null) {
      prefilled = true;
      if (holder.text.isEmpty) {
        holder.text = (dashboard.bank?['accountHolderName'] ??
                dashboard.personalKyc?['name'] ??
                dashboard.business?.ownerName ??
                '')
            .toString();
      }
      if (ifsc.text.isEmpty) ifsc.text = (dashboard.bank?['ifscCode'] ?? '').toString();
      if (bank.text.isEmpty) bank.text = (dashboard.bank?['bankName'] ?? '').toString();
    }
    final settled = status == 'VERIFIED' || status == 'REVIEW';

    return KpAppShell(
      title: 'Settlement bank account',
      children: [
        const BusinessFormHeader(
          stepLabel: 'Settlement account',
          title: 'Where should we send your money?',
          subtitle: 'Payments collected on your QR are settled to this account.',
          icon: Icons.account_balance_rounded,
        ),
        const SizedBox(height: 14),
        if (settled && saved != null) ...[
          _BankResult(bank: saved, verified: status == 'VERIFIED'),
          const SizedBox(height: 16),
          BusinessPrimaryButton(
              label: 'Continue setup',
              onPressed: () => router.go('/business')),
          const SizedBox(height: 10),
          Center(
            child: TextButton(
              onPressed: () => setState(() {
                result = {'status': 'EDIT'};
              }),
              child: const Text('Use a different bank account'),
            ),
          ),
        ] else ...[
          if (status == 'FAILED' && result == null) ...[
            KpErrorBanner(
                message: (saved?['verificationMessage'] ??
                        'The last bank account could not be verified. Please check the details.')
                    .toString()),
            const SizedBox(height: 12),
          ],
          if (error != null) ...[
            KpErrorBanner(message: error!),
            const SizedBox(height: 12),
          ],
          Form(
            key: key,
            child: KpCard(
              radius: KhatuRadius.lg,
              child: Column(children: [
                BusinessField(
                  controller: holder,
                  label: 'Account holder name',
                  helper: 'Must match the name in your bank records.',
                  icon: Icons.person_outline_rounded,
                  validator: (v) => (v ?? '').trim().length < 2
                      ? 'Enter the account holder name'
                      : null,
                ),
                BusinessField(
                  controller: account,
                  label: 'Account number',
                  icon: Icons.numbers_rounded,
                  digitsOnly: true,
                  maxLength: 20,
                  obscure: true,
                  validator: (v) =>
                      RegExp(r'^\d{6,20}$').hasMatch((v ?? '').trim())
                          ? null
                          : 'Enter a valid account number (6-20 digits)',
                ),
                BusinessField(
                  controller: confirm,
                  label: 'Confirm account number',
                  icon: Icons.verified_outlined,
                  digitsOnly: true,
                  maxLength: 20,
                  validator: (v) => (v ?? '').trim() == account.text.trim()
                      ? null
                      : 'Account numbers do not match',
                ),
                BusinessField(
                  controller: ifsc,
                  label: 'IFSC code',
                  hint: 'e.g. HDFC0001234',
                  icon: Icons.pin_outlined,
                  caps: true,
                  maxLength: 11,
                  validator: (v) => RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$')
                          .hasMatch((v ?? '').trim().toUpperCase())
                      ? null
                      : 'Enter the 11-character IFSC (5th character is zero)',
                ),
                BusinessField(
                  controller: bank,
                  label: 'Bank name (optional)',
                  icon: Icons.account_balance_outlined,
                  textInputAction: TextInputAction.done,
                ),
              ]),
            ),
          ),
          const SizedBox(height: 18),
          BusinessPrimaryButton(
            label: 'Verify bank account',
            busyLabel: 'Verifying with your bank...',
            icon: Icons.verified_user_outlined,
            busy: busy,
            onPressed: submit,
          ),
          const SizedBox(height: 12),
          const BusinessTrustRow(
              text:
                  'We confirm the account with a secure bank check. No money is debited from you.'),
        ],
      ],
    );
  }
}

class _BankResult extends StatelessWidget {
  const _BankResult({required this.bank, required this.verified});
  final Map<String, dynamic> bank;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    final color = verified ? KhatuColors.success : KhatuColors.warning;
    return KpCard(
      radius: KhatuRadius.lg,
      color: verified ? KhatuColors.softGreen : KhatuColors.softSaffron,
      borderColor: color.withValues(alpha: 0.35),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(verified ? Icons.verified_rounded : Icons.schedule_rounded,
              color: color, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
                verified
                    ? 'Bank account verified'
                    : 'Bank details received',
                style: const TextStyle(
                    fontFamily: 'Roboto',
                    fontSize: 16.5,
                    fontWeight: FontWeight.w900)),
          ),
        ]),
        const SizedBox(height: 12),
        _row('Account holder', (bank['accountHolderName'] ?? '-').toString()),
        _row('Account number', (bank['accountNumber'] ?? '-').toString()),
        _row('IFSC', (bank['ifscCode'] ?? '-').toString()),
        if ((bank['bankName'] ?? '').toString().isNotEmpty)
          _row('Bank', bank['bankName'].toString()),
        if (!verified) ...[
          const SizedBox(height: 8),
          const Text(
              'Our team will confirm this account shortly. You can continue with the next step now.',
              style: TextStyle(
                  fontFamily: 'Roboto',
                  color: KhatuColors.muted,
                  fontSize: 12.5,
                  height: 1.4)),
        ],
      ]),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          SizedBox(
              width: 118,
              child: Text(label,
                  style: const TextStyle(
                      fontFamily: 'Roboto',
                      color: KhatuColors.muted,
                      fontSize: 12.5))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(
                      fontFamily: 'Roboto',
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800))),
        ]),
      );
}
