import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/app_theme.dart';
import '../../../core/friendly_error.dart';
import '../../../providers/auth_providers.dart';
import '../../../providers/business/merchant_business_provider.dart';
import '../../../routes/app_router.dart';
import '../../../services/business/merchant_business_service.dart';
import '../../widgets/kp_widgets.dart';
import 'business_widgets.dart';

/// Step 1 of business setup: who is the business. Also used to edit the
/// profile while it is still a draft.
class BusinessRegistrationPage extends ConsumerStatefulWidget {
  const BusinessRegistrationPage({super.key});
  @override
  ConsumerState<BusinessRegistrationPage> createState() => _State();
}

class _State extends ConsumerState<BusinessRegistrationPage> {
  final key = GlobalKey<FormState>();
  final name = TextEditingController(),
      owner = TextEditingController(),
      mobile = TextEditingController(),
      email = TextEditingController(),
      address = TextEditingController();
  String category = businessCategories.first.$1;
  bool busy = false;
  bool editing = false;
  bool prefilled = false;
  String? error;

  @override
  void dispose() {
    for (final c in [name, owner, mobile, email, address]) {
      c.dispose();
    }
    super.dispose();
  }

  // Fill what we already know so the owner types as little as possible.
  void _prefill() {
    if (prefilled) return;
    final dashboard = ref.read(merchantDashboardProvider).valueOrNull;
    final business = dashboard?.business;
    final me = ref.read(meProvider).valueOrNull;
    if (business != null) {
      editing = true;
      name.text = business.businessName;
      owner.text = business.ownerName;
      mobile.text = business.mobile;
      email.text = business.email;
      address.text = business.address;
      if (businessCategories.any((c) => c.$1 == business.category)) {
        category = business.category;
      }
      prefilled = true;
    } else if (me != null) {
      if (owner.text.isEmpty) owner.text = me.name;
      if (mobile.text.isEmpty) {
        final digits = me.mobile.replaceAll(RegExp(r'\D'), '');
        mobile.text = digits.length > 10 ? digits.substring(digits.length - 10) : digits;
      }
      if (email.text.isEmpty) email.text = me.email;
      prefilled = true;
    }
  }

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    if (!(key.currentState?.validate() ?? false)) return;
    setState(() {
      busy = true;
      error = null;
    });
    final payload = {
      'businessName': name.text.trim(),
      'ownerName': owner.text.trim(),
      'category': category,
      'mobile': mobile.text.trim(),
      'email': email.text.trim().toLowerCase(),
      'address': address.text.trim(),
    };
    try {
      final service = MerchantBusinessService();
      if (editing) {
        await service.updateProfile(payload);
      } else {
        await service.create(payload);
      }
      ref.invalidate(merchantDashboardProvider);
      if (mounted) router.go('/business');
    } catch (e) {
      if (mounted) {
        setState(() => error = friendlyErrorMessage(e,
            fallback: 'Business profile could not be saved. Please try again.'));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(meProvider);
    ref.watch(merchantDashboardProvider);
    _prefill();
    return KpAppShell(
      title: editing ? 'Edit business profile' : 'Business profile',
      children: [
        const BusinessFormHeader(
          stepLabel: 'Step 1',
          title: 'Tell us about your business',
          subtitle: 'This name appears on your QR and to customers who pay you.',
          icon: Icons.storefront_rounded,
        ),
        const SizedBox(height: 14),
        if (error != null) ...[
          KpErrorBanner(message: error!),
          const SizedBox(height: 12),
        ],
        Form(
          key: key,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            KpCard(
              radius: KhatuRadius.lg,
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    BusinessField(
                      controller: name,
                      label: 'Business / shop name',
                      hint: 'e.g. Balaji Kirana Store',
                      icon: Icons.storefront_outlined,
                      maxLength: 100,
                      validator: (v) => (v ?? '').trim().length < 2
                          ? 'Enter your business name'
                          : null,
                    ),
                    BusinessField(
                      controller: owner,
                      label: 'Owner name',
                      hint: 'As on your PAN card',
                      icon: Icons.person_outline_rounded,
                      maxLength: 100,
                      validator: (v) => (v ?? '').trim().length < 2
                          ? 'Enter the owner name'
                          : null,
                    ),
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8, top: 2),
                      child: Text('Business category',
                          style: TextStyle(
                              fontFamily: 'Roboto',
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: KhatuColors.muted)),
                    ),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final item in businessCategories)
                        ChoiceChip(
                          selected: category == item.$1,
                          onSelected: busy
                              ? null
                              : (_) => setState(() => category = item.$1),
                          avatar: Icon(item.$2,
                              size: 16,
                              color: category == item.$1
                                  ? Colors.white
                                  : KhatuColors.deepTeal),
                          label: Text(item.$1),
                          showCheckmark: false,
                          selectedColor: KhatuColors.teal,
                          backgroundColor: KhatuColors.surfaceAlt,
                          labelStyle: TextStyle(
                              fontFamily: 'Roboto',
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: category == item.$1
                                  ? Colors.white
                                  : KhatuColors.text),
                          side: BorderSide(
                              color: category == item.$1
                                  ? KhatuColors.teal
                                  : KhatuColors.line),
                        ),
                    ]),
                  ]),
            ),
            const KpSectionHeader(title: 'Contact details'),
            KpCard(
              radius: KhatuRadius.lg,
              child: Column(children: [
                BusinessField(
                  controller: mobile,
                  label: 'Business mobile number',
                  icon: Icons.phone_outlined,
                  digitsOnly: true,
                  maxLength: 10,
                  validator: (v) =>
                      RegExp(r'^[6-9]\d{9}$').hasMatch((v ?? '').trim())
                          ? null
                          : 'Enter a valid 10-digit mobile number',
                ),
                BusinessField(
                  controller: email,
                  label: 'Email address',
                  helper: 'Needed for payment activation and settlement reports.',
                  icon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                          .hasMatch((v ?? '').trim())
                      ? null
                      : 'Enter a valid email address',
                ),
                BusinessField(
                  controller: address,
                  label: 'Shop address',
                  icon: Icons.location_on_outlined,
                  maxLines: 2,
                  maxLength: 300,
                  validator: (v) => (v ?? '').trim().length < 5
                      ? 'Enter your shop address'
                      : null,
                ),
              ]),
            ),
            const SizedBox(height: 18),
            BusinessPrimaryButton(
              label: editing ? 'Save changes' : 'Save and continue',
              busyLabel: 'Saving...',
              busy: busy,
              onPressed: submit,
            ),
            const SizedBox(height: 12),
            const BusinessTrustRow(
                text:
                    'Your details are used only to verify your business and set up payments.'),
          ]),
        ),
      ],
    );
  }
}
