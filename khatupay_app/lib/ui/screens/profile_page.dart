import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_theme.dart';
import '../../core/friendly_error.dart';
import '../../models/loan.dart';
import '../../models/user.dart';
import '../../providers/auth_providers.dart';
import '../../providers/business/merchant_business_provider.dart';
import '../../providers/loan_providers.dart';
import '../../routes/app_router.dart';
import '../widgets/kp_widgets.dart';
import 'dashboard_page.dart' show KhatuBottomNav;

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  Future<void> _refresh() async {
    ref.invalidate(meProvider);
    ref.invalidate(myLoansProvider);
    ref.invalidate(merchantDashboardProvider);
    await ref.read(meProvider.future);
  }

  String _maskMobile(String value) => value.length < 4
      ? value
      : '+91 ******${value.substring(value.length - 4)}';

  String _maskEmail(String value) {
    final parts = value.split('@');
    if (parts.length != 2 || parts.first.isEmpty) return value;
    return '${parts.first[0]}***@${parts.last}';
  }

  String _status(KPUser user) {
    final raw = (user.kyc?['status'] ?? '').toString().toUpperCase();
    if (raw == 'APPROVED' || raw == 'VERIFIED') return 'Verified';
    if (raw == 'REJECTED' || raw == 'ACTION_REQUIRED') return 'Action required';
    return 'Verification pending';
  }

  bool _flag(Map<String, dynamic>? source, List<String> keys) {
    for (final key in keys) {
      final value = source?[key];
      if (value == true ||
          {'VERIFIED', 'APPROVED', 'SUCCESS'}
              .contains(value.toString().toUpperCase())) {
        return true;
      }
    }
    return false;
  }

  int _completion(KPUser user) {
    final checks = <bool>[
      user.name.trim().isNotEmpty,
      user.mobile.trim().isNotEmpty,
      user.emailVerified,
      _flag(user.kyc, ['panVerified', 'panStatus']),
      _flag(user.kyc, ['aadhaarVerified', 'aadhaarStatus']),
      _flag(user.kyc, ['bankVerified', 'bankStatus']),
    ];
    return (checks.where((value) => value).length * 100 / checks.length)
        .round();
  }

  Future<void> _edit(KPUser user) async {
    final name = TextEditingController(text: user.name);
    final mobile = TextEditingController(text: user.mobile);
    final form = GlobalKey<FormState>();
    var busy = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Edit personal details'),
          content: Form(
            key: form,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                controller: name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (value) => (value ?? '').trim().length < 3
                    ? 'Enter your full name'
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: mobile,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: const InputDecoration(
                    labelText: 'Mobile number', counterText: ''),
                validator: (value) =>
                    RegExp(r'^[6-9]\d{9}$').hasMatch((value ?? '').trim())
                        ? null
                        : 'Enter a valid mobile number',
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (!(form.currentState?.validate() ?? false)) return;
                      setDialogState(() => busy = true);
                      try {
                        await ref.read(userServiceProvider).updateMe(
                            name: name.text.trim(), mobile: mobile.text.trim());
                        ref.invalidate(meProvider);
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (error) {
                        if (dialogContext.mounted) {
                          ScaffoldMessenger.of(this.context).showSnackBar(
                              SnackBar(
                                  content: Text(friendlyErrorMessage(error,
                                      fallback:
                                          'Unable to update your profile.'))));
                        }
                        setDialogState(() => busy = false);
                      }
                    },
              child: Text(busy ? 'Saving...' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(meProvider);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Profile'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => router.push('/settings'),
          )
        ],
      ),
      bottomNavigationBar: const KhatuBottomNav(currentIndex: 4),
      body: user.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => KpErrorState.fromError(error,
            title: 'Profile unavailable',
            onRetry: () => ref.invalidate(meProvider)),
        data: (data) => RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: KhatuSpace.pageScroll,
            children: [
              _header(data),
              const KpSectionHeader(title: 'Account completion'),
              _completionCard(data),
              const KpSectionHeader(title: 'Personal information'),
              _personal(data),
              const KpSectionHeader(title: 'Verification and KYC'),
              _kyc(data),
              const KpSectionHeader(title: 'Loan applications'),
              _loans(),
              const KpSectionHeader(title: 'Merchant business'),
              _business(),
              const KpSectionHeader(title: 'Activity and support'),
              _actions(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(KPUser user) => KpCard(
        child: Row(children: [
          KpAvatar(name: user.name, size: 60),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(user.name.isEmpty ? 'Khatu Pay user' : user.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 19, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text(_maskMobile(user.mobile), style: KhatuText.bodyMuted),
                Text(_maskEmail(user.email), style: KhatuText.bodyMuted),
                const SizedBox(height: 8),
                KpStatusBadge(status: _status(user)),
              ])),
          IconButton(
              tooltip: 'Edit profile',
              onPressed: () => _edit(user),
              icon: const Icon(Icons.edit_outlined)),
        ]),
      );

  Widget _completionCard(KPUser user) {
    final value = _completion(user);
    return KpCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text('$value% complete', style: KhatuText.h3)),
        const Icon(Icons.verified_user_outlined, color: KhatuColors.teal),
      ]),
      const SizedBox(height: 10),
      LinearProgressIndicator(
          value: value / 100,
          minHeight: 7,
          borderRadius: BorderRadius.circular(8),
          backgroundColor: KhatuColors.softTeal),
      const SizedBox(height: 10),
      Text(
          'Complete identity and bank verification to keep your account ready for services.',
          style: KhatuText.bodyMuted),
    ]));
  }

  Widget _personal(KPUser user) => KpCard(
          child: Column(children: [
        _row('Full name', user.name),
        _row('Mobile', _maskMobile(user.mobile)),
        _row('Email', _maskEmail(user.email)),
        _row(
            'PAN',
            _flag(user.kyc, ['panVerified', 'panStatus'])
                ? 'Verified'
                : 'Not verified'),
        _row(
            'Aadhaar',
            _flag(user.kyc, ['aadhaarVerified', 'aadhaarStatus'])
                ? 'Verified'
                : 'Not verified'),
        const SizedBox(height: 8),
        SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
                onPressed: () => _edit(user),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit personal details'))),
      ]));

  Widget _kyc(KPUser user) {
    final status = (user.kyc?['status'] ?? 'NOT_STARTED').toString();
    final reason =
        (user.kyc?['rejectionReason'] ?? user.kyc?['remarks'] ?? '').toString();
    return KpCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Image.asset('assets/profile/profile_verification.png',
            width: 72, height: 72),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Identity verification', style: KhatuText.h3),
          const SizedBox(height: 6),
          KpStatusBadge(status: status),
        ])),
      ]),
      if (reason.isNotEmpty) ...[
        const SizedBox(height: 12),
        KpErrorBanner(message: reason)
      ],
      const SizedBox(height: 12),
      SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
              onPressed: () => router.push('/kyc'),
              icon: const Icon(Icons.shield_outlined),
              label: Text(status.toUpperCase() == 'APPROVED'
                  ? 'Review details'
                  : 'Continue verification'))),
    ]));
  }

  Widget _loans() => ref.watch(myLoansProvider).when(
      loading: () => const KpCard(child: LinearProgressIndicator()),
      error: (_, __) => KpCard(
              child: Column(children: [
            Image.asset('assets/profile/empty_loan.png', height: 82),
            const Text('Loan applications are unavailable right now.'),
            TextButton(
                onPressed: () => ref.invalidate(myLoansProvider),
                child: const Text('Try again')),
          ])),
      data: (List<Loan> loans) {
        final latest = loans.isEmpty ? null : loans.first;
        return KpCard(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (latest == null) ...[
            Center(
                child:
                    Image.asset('assets/profile/empty_loan.png', height: 90)),
            const Center(
                child: Text('No loan application yet', style: KhatuText.h3)),
          ] else ...[
            _row('Total applications', '${loans.length}'),
            _row(
                'Latest application',
                latest.loanAccountNumber.isEmpty
                    ? latest.id
                    : latest.loanAccountNumber),
            _row('Current status', KpStatusBadge.prettify(latest.status)),
          ],
          const SizedBox(height: 8),
          Text('Loans are provided through lending partners.',
              style: KhatuText.bodyMuted),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
                child: OutlinedButton(
                    onPressed: () => router.push('/loans'),
                    child: const Text('My applications'))),
            const SizedBox(width: 10),
            Expanded(
                child: FilledButton(
                    onPressed: () => router.push('/apply'),
                    child: const Text('Apply for loan'))),
          ]),
        ]));
      });

  Widget _business() => ref.watch(merchantDashboardProvider).when(
      loading: () => const KpCard(child: LinearProgressIndicator()),
      error: (_, __) => KpCard(
              child: Column(children: [
            const Text('Business profile could not be loaded.'),
            TextButton(
                onPressed: () => ref.invalidate(merchantDashboardProvider),
                child: const Text('Try again')),
          ])),
      data: (dashboard) {
        final business = dashboard.business;
        if (business == null) {
          return KpCard(
              child: Row(children: [
            Image.asset('assets/profile/merchant_setup.png',
                width: 92, height: 92),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  const Text('Set up your business profile',
                      style: KhatuText.h3),
                  const SizedBox(height: 4),
                  Text('Accept digital payments and track collections.',
                      style: KhatuText.bodyMuted),
                  TextButton(
                      onPressed: () => router.push('/business/register'),
                      child: const Text('Get started')),
                ])),
          ]));
        }
        return KpCard(
            child: Column(children: [
          _row('Business name', business.businessName),
          _row('Merchant ID', business.publicId),
          _row('Verification', KpStatusBadge.prettify(business.status)),
          _row(
              'Bank account',
              KpStatusBadge.prettify(
                  (dashboard.bank?['status'] ?? 'PENDING').toString())),
          _row('Business QR', dashboard.qr == null ? 'Not active' : 'Active'),
          const SizedBox(height: 8),
          SizedBox(
              width: double.infinity,
              child: FilledButton(
                  onPressed: () => router.push('/business'),
                  child: const Text('Open business dashboard'))),
        ]));
      });

  Widget _actions() => Column(children: [
        _tile(Icons.receipt_long_outlined, 'Recharge and bill history',
            '/service-history'),
        _tile(Icons.description_outlined, 'Loan applications', '/loans'),
        _tile(Icons.storefront_outlined, 'Merchant transactions',
            '/business/transactions'),
        _tile(Icons.support_agent_outlined, 'Help and support', '/support'),
        _tile(Icons.help_outline_rounded, 'Frequently asked questions', '/faq'),
      ]);

  Widget _tile(IconData icon, String title, String route) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: KpListActionTile(
            icon: icon, title: title, onTap: () => router.push(route)),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(label, style: KhatuText.label)),
          const SizedBox(width: 12),
          Flexible(
              child: Text(value.isEmpty ? 'Not added' : value,
                  textAlign: TextAlign.right,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, color: KhatuColors.text))),
        ]),
      );
}
